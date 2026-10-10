import { DetectionResult, FrameworkId, Language, RuntimeType } from './types.js';

export interface ContainerSpec {
  baseImage: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  env: Record<string, string>;
  dockerfile: string;
  nixpacksConfig: {
    providers: string[];
    phases: Record<string, { cmds: string[] }>;
    start: { cmd: string };
  };
}

export interface ProcessSupervisorSpec {
  name: string;
  script: string;
  args?: string[];
  cwd?: string;
  env: Record<string, string>;
  instances: number;
  autorestart: boolean;
  maxMemoryRestart: string;
  healthCheck: {
    path: string;
    intervalSeconds: number;
    timeoutSeconds: number;
    maxRetries: number;
  };
}

export interface RuntimeDescriptor {
  deploymentId: string;
  projectId: string;
  runtimeType: RuntimeType;
  framework: FrameworkId;
  language: Language;
  containerSpec?: ContainerSpec;
  supervisorSpec?: ProcessSupervisorSpec;
  isIsolatedWorkerRequired: boolean;
  createdAt: string;
}

/**
 * Generates an isolated container and process supervisor specification for server-side applications
 * (Node.js, Express, NestJS, Next.js SSR, Python FastAPI/Flask/Django, Go, Rust, PHP).
 */
export function generateRuntimeDescriptor(
  deploymentId: string,
  projectId: string,
  detection: DetectionResult,
  customEnv: Record<string, string> = {}
): RuntimeDescriptor {
  if (detection.runtimeType === 'static') {
    return {
      deploymentId,
      projectId,
      runtimeType: 'static',
      framework: detection.framework,
      language: detection.language,
      isIsolatedWorkerRequired: false,
      createdAt: new Date().toISOString(),
    };
  }

  const port = parseInt(customEnv['PORT'] || '3000', 10);
  const safeEnv: Record<string, string> = {
    PORT: String(port),
    NODE_ENV: 'production',
    ...detection.envSuggestions,
    ...customEnv,
  };

  let baseImage = 'node:20-alpine';
  let dockerfile = '';
  const nixProviders: string[] = [];

  switch (detection.language) {
    case 'python':
      baseImage = 'python:3.11-slim';
      nixProviders.push('python');
      dockerfile = `
FROM ${baseImage}
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl build-essential && rm -rf /var/lib/apt/lists/*
COPY . /app
RUN ${detection.installCommand || 'pip install -r requirements.txt'}
${detection.buildCommand ? `RUN ${detection.buildCommand}` : ''}
EXPOSE ${port}
ENV PORT=${port}
CMD ["sh", "-c", "${detection.startCommand}"]
`.trim();
      break;

    case 'go':
      baseImage = 'golang:1.22-alpine';
      nixProviders.push('go');
      dockerfile = `
FROM ${baseImage} AS builder
WORKDIR /app
COPY . /app
RUN ${detection.installCommand || 'go mod download'}
RUN ${detection.buildCommand || 'go build -o /app/server .'}

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/server /app/server
EXPOSE ${port}
ENV PORT=${port}
CMD ["/app/server"]
`.trim();
      break;

    case 'rust':
      baseImage = 'rust:1.77-slim';
      nixProviders.push('rust');
      dockerfile = `
FROM ${baseImage} AS builder
WORKDIR /app
COPY . /app
RUN ${detection.buildCommand || 'cargo build --release'}

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/app /app/server
EXPOSE ${port}
ENV PORT=${port}
CMD ["/app/server"]
`.trim();
      break;

    case 'php':
      baseImage = 'php:8.3-cli-alpine';
      nixProviders.push('php');
      dockerfile = `
FROM ${baseImage}
WORKDIR /app
COPY . /app
EXPOSE ${port}
ENV PORT=${port}
CMD ["sh", "-c", "${detection.startCommand}"]
`.trim();
      break;

    case 'javascript':
    case 'typescript':
    default:
      baseImage = 'node:20-alpine';
      nixProviders.push('node');
      dockerfile = `
FROM ${baseImage}
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN ${detection.installCommand || 'npm ci --production=false'}
COPY . ./
${detection.buildCommand ? `RUN ${detection.buildCommand}` : ''}
ENV NODE_ENV=production
ENV PORT=${port}
EXPOSE ${port}
CMD ["sh", "-c", "${detection.startCommand}"]
`.trim();
      break;
  }

  const containerSpec: ContainerSpec = {
    baseImage,
    installCommand: detection.installCommand,
    buildCommand: detection.buildCommand,
    startCommand: detection.startCommand,
    port,
    env: safeEnv,
    dockerfile,
    nixpacksConfig: {
      providers: nixProviders,
      phases: {
        setup: { cmds: [detection.installCommand].filter(Boolean) },
        build: { cmds: [detection.buildCommand].filter(Boolean) },
      },
      start: { cmd: detection.startCommand },
    },
  };

  const supervisorSpec: ProcessSupervisorSpec = {
    name: `optic-${projectId}-${deploymentId.slice(0, 8)}`,
    script: detection.startCommand,
    env: safeEnv,
    instances: 1,
    autorestart: true,
    maxMemoryRestart: '512M',
    healthCheck: {
      path: '/health',
      intervalSeconds: 10,
      timeoutSeconds: 3,
      maxRetries: 3,
    },
  };

  return {
    deploymentId,
    projectId,
    runtimeType: 'server',
    framework: detection.framework,
    language: detection.language,
    containerSpec,
    supervisorSpec,
    isIsolatedWorkerRequired: true,
    createdAt: new Date().toISOString(),
  };
}

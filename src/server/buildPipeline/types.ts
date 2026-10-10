export type Language =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'php'
  | 'html';

export type FrameworkId =
  | 'static'
  | 'vite'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'nextjs'
  | 'astro'
  | 'nuxt'
  | 'remix'
  | 'express'
  | 'nestjs'
  | 'fastapi'
  | 'flask'
  | 'django'
  | 'go'
  | 'rust'
  | 'php'
  | 'other';

export type RuntimeType = 'static' | 'server';

export interface DetectionResult {
  framework: FrameworkId;
  frameworkName: string;
  language: Language;
  languageName: string;
  runtimeType: RuntimeType;
  buildCommand: string;
  installCommand: string;
  outputDir: string;
  startCommand: string;
  rootDirectory: string;
  isStaticExport: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectedFiles: string[];
  envSuggestions: Record<string, string>;
  reasons: string[];
}

export interface BuildStepLog {
  step: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export interface BuildOptions {
  deploymentId: string;
  projectId: string;
  projectSlug: string;
  organizationId: string;
  branch: string;
  commitSha?: string;
  isProduction: boolean;
  envVars?: Record<string, string>;
  customBuildCommand?: string;
  customInstallCommand?: string;
  customOutputDir?: string;
  customRootDirectory?: string;
  customStartCommand?: string;
  customFramework?: FrameworkId;
}

export interface SourceFile {
  relativePath: string;
  buffer: Buffer;
}

export interface OutputFile {
  relativePath: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface DeploymentManifest {
  deploymentId: string;
  projectId: string;
  projectSlug: string;
  framework: FrameworkId;
  language: Language;
  runtimeType: RuntimeType;
  totalFiles: number;
  entryPoint?: string;
  buildTimeMs: number;
  commitSha?: string;
  branch: string;
  createdAt: string;
  storagePath: string;
}

export interface BuildResult {
  success: boolean;
  deploymentId: string;
  runtimeType: RuntimeType;
  framework: FrameworkId;
  outputFilesCount: number;
  storagePath: string;
  deploymentUrl: string;
  buildTimeMs: number;
  logs: BuildStepLog[];
  manifest?: DeploymentManifest;
  error?: string;
}

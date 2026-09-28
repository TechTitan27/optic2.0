import JSZip from 'jszip';

export type FrameworkId =
  | 'vite'
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'nuxt'
  | 'astro'
  | 'svelte'
  | 'angular'
  | 'static';

export type PackageManagerId = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'none';

export interface ProjectFileEntry {
  path: string; // sanitized relative path
  file?: File;
  zipEntry?: JSZip.JSZipObject;
  size: number;
}

export interface DetectedProjectConfig {
  framework: FrameworkId;
  frameworkName: string;
  frameworkReason: string;
  packageManager: PackageManagerId;
  packageManagerReason: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  nodeVersion: string;
  isStaticOnly: boolean;
  hasPrebuiltOutput: boolean;
  prebuiltOutputDir?: string;
  suggestedProjectName: string;
  configFiles: string[];
  totalFiles: number;
  totalSizeBytes: number;
  packageJsonData?: {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: { node?: string };
  };
}

export const FRAMEWORK_PRESETS: Record<
  FrameworkId,
  {
    name: string;
    description: string;
    defaultBuildCommand: (pm: PackageManagerId) => string;
    defaultOutputDir: string;
    defaultInstallCommand: (pm: PackageManagerId) => string;
    badgeColor: string;
  }
> = {
  vite: {
    name: 'Vite',
    description: 'Next Generation Frontend Tooling',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'dist',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-purple-500/40 bg-purple-950/30 text-purple-300',
  },
  nextjs: {
    name: 'Next.js',
    description: 'The React Framework for the Web',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: '.next',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-zinc-500/40 bg-zinc-900 text-zinc-200',
  },
  astro: {
    name: 'Astro',
    description: 'The web framework for content-driven websites',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'dist',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-amber-500/40 bg-amber-950/30 text-amber-300',
  },
  svelte: {
    name: 'Svelte / SvelteKit',
    description: 'Cybernetically enhanced web apps',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'build',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-orange-500/40 bg-orange-950/30 text-orange-300',
  },
  nuxt: {
    name: 'Nuxt',
    description: 'The Intuitive Vue Framework',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: '.output/public',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
  },
  vue: {
    name: 'Vue.js',
    description: 'The Progressive JavaScript Framework',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'dist',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-teal-500/40 bg-teal-950/30 text-teal-300',
  },
  react: {
    name: 'React (CRA)',
    description: 'Create React App single page application',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'build',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300',
  },
  angular: {
    name: 'Angular',
    description: 'The modern web developer\'s platform',
    defaultBuildCommand: (pm) => (pm === 'bun' ? 'bun run build' : `${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run'} build`),
    defaultOutputDir: 'dist',
    defaultInstallCommand: (pm) => (pm === 'bun' ? 'bun install' : pm === 'yarn' ? 'yarn install' : pm === 'pnpm' ? 'pnpm install' : 'npm install'),
    badgeColor: 'border-rose-500/40 bg-rose-950/30 text-rose-300',
  },
  static: {
    name: 'Static HTML',
    description: 'Direct static assets (HTML, CSS, JS)',
    defaultBuildCommand: () => '',
    defaultOutputDir: './',
    defaultInstallCommand: () => '',
    badgeColor: 'border-blue-500/40 bg-blue-950/30 text-blue-300',
  },
};

/**
 * Clean path helper: remove leading/trailing slashes, normalize backslashes
 */
export function sanitizePath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

/**
 * Filter out system and metadata clutter like .DS_Store, __MACOSX, thumbs.db
 */
export function isIgnoreFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    normalized.includes('.ds_store') ||
    normalized.startsWith('__macosx/') ||
    normalized.includes('/__macosx/') ||
    normalized.endsWith('thumbs.db') ||
    normalized.endsWith('.gitkeep') ||
    normalized.startsWith('.git/') ||
    normalized.includes('/.git/')
  );
}

/**
 * Extract files from a ZIP archive
 */
export async function extractFilesFromZip(zipFile: File): Promise<ProjectFileEntry[]> {
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(zipFile);
  const entries: ProjectFileEntry[] = [];

  const rawPaths: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && !isIgnoreFile(path)) {
      rawPaths.push(path);
    }
  });

  // If all files are inside a common root folder (e.g. "my-project/..."), strip that common prefix
  const commonPrefix = getCommonRootPrefix(rawPaths);

  for (const rawPath of rawPaths) {
    const entry = zip.file(rawPath);
    if (!entry) continue;

    const relPath = commonPrefix ? rawPath.slice(commonPrefix.length) : rawPath;
    const cleanPath = sanitizePath(relPath);
    if (!cleanPath) continue;

    // Read file as Blob to create standard File object for uploading
    const blob = await entry.async('blob');
    const fileName = cleanPath.split('/').pop() || 'file';
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

    entries.push({
      path: cleanPath,
      file,
      zipEntry: entry,
      size: (entry as any)._data?.uncompressedSize || blob.size || 0,
    });
  }

  return entries;
}

/**
 * Normalize browser folder selection (FileList)
 */
export function normalizeFolderFiles(fileList: FileList | File[]): ProjectFileEntry[] {
  const entries: ProjectFileEntry[] = [];
  const rawPaths: { file: File; rawPath: string }[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rawPath = (file as any).webkitRelativePath || file.name;
    if (!isIgnoreFile(rawPath)) {
      rawPaths.push({ file, rawPath });
    }
  }

  const commonPrefix = getCommonRootPrefix(rawPaths.map((r) => r.rawPath));

  for (const { file, rawPath } of rawPaths) {
    const relPath = commonPrefix ? rawPath.slice(commonPrefix.length) : rawPath;
    const cleanPath = sanitizePath(relPath);
    if (!cleanPath) continue;

    entries.push({
      path: cleanPath,
      file,
      size: file.size,
    });
  }

  return entries;
}

function getCommonRootPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const firstSlash = paths[0].indexOf('/');
  if (firstSlash === -1) return '';

  const candidate = paths[0].slice(0, firstSlash + 1);
  const allMatch = paths.every((p) => p.startsWith(candidate));
  return allMatch ? candidate : '';
}

/**
 * Read text content from a ProjectFileEntry
 */
export async function readFileText(entry: ProjectFileEntry): Promise<string> {
  if (entry.file) {
    return await entry.file.text();
  }
  if (entry.zipEntry) {
    return await entry.zipEntry.async('text');
  }
  return '';
}

/**
 * Parse Node.js version from string
 */
function parseNodeVersion(raw?: string): string {
  if (!raw) return '20.x';
  const clean = raw.trim().replace(/^v/i, '').replace(/[^0-9.x^~>=<]/g, '');
  const match = clean.match(/(\d+)/);
  if (match) {
    return `${match[1]}.x`;
  }
  return '20.x';
}

/**
 * Inspect uploaded project files and perform real, accurate framework & build detection
 */
export async function detectProjectDetails(
  files: ProjectFileEntry[],
  fallbackName?: string
): Promise<DetectedProjectConfig> {
  const pathSet = new Set(files.map((f) => f.path.toLowerCase()));
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);

  // 1. Locate and parse package.json if present
  let packageJsonData: any = null;
  const packageJsonEntry = files.find((f) => f.path.toLowerCase() === 'package.json');
  if (packageJsonEntry) {
    try {
      const text = await readFileText(packageJsonEntry);
      packageJsonData = JSON.parse(text);
    } catch (err) {
      console.warn('[ProjectDetector] Error parsing package.json:', err);
    }
  }

  // 2. Locate node version indicators (.nvmrc, .node-version, or engines.node)
  let detectedNodeVersion = '20.x';
  const nvmrcEntry = files.find((f) => f.path.toLowerCase() === '.nvmrc');
  const nodeVersionEntry = files.find((f) => f.path.toLowerCase() === '.node-version');

  if (nvmrcEntry) {
    try {
      const txt = await readFileText(nvmrcEntry);
      detectedNodeVersion = parseNodeVersion(txt);
    } catch {
      // non-blocking
    }
  } else if (nodeVersionEntry) {
    try {
      const txt = await readFileText(nodeVersionEntry);
      detectedNodeVersion = parseNodeVersion(txt);
    } catch {
      // non-blocking
    }
  } else if (packageJsonData?.engines?.node) {
    detectedNodeVersion = parseNodeVersion(packageJsonData.engines.node);
  }

  // 3. Detect Package Manager
  let packageManager: PackageManagerId = 'none';
  let packageManagerReason = 'No package manager detected';

  if (pathSet.has('bun.lock') || pathSet.has('bun.lockb')) {
    packageManager = 'bun';
    packageManagerReason = 'bun.lock detected';
  } else if (pathSet.has('pnpm-lock.yaml') || pathSet.has('pnpm-lock.yml')) {
    packageManager = 'pnpm';
    packageManagerReason = 'pnpm-lock.yaml detected';
  } else if (pathSet.has('yarn.lock')) {
    packageManager = 'yarn';
    packageManagerReason = 'yarn.lock detected';
  } else if (pathSet.has('package-lock.json')) {
    packageManager = 'npm';
    packageManagerReason = 'package-lock.json detected';
  } else if (packageJsonData) {
    packageManager = 'npm';
    packageManagerReason = 'package.json found (default npm)';
  }

  // 4. Identify Config Files
  const configFiles: string[] = [];
  const knownConfigs = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'astro.config.mjs',
    'astro.config.ts',
    'astro.config.js',
    'svelte.config.js',
    'svelte.config.ts',
    'nuxt.config.ts',
    'nuxt.config.js',
    'vue.config.js',
    'angular.json',
    'tsconfig.json',
    'tailwind.config.js',
    'tailwind.config.ts',
    'postcss.config.js',
    '.nvmrc',
  ];

  for (const cfg of knownConfigs) {
    if (pathSet.has(cfg)) {
      configFiles.push(cfg);
    }
  }

  // 5. Detect Framework
  let framework: FrameworkId = 'static';
  let frameworkReason = 'Static HTML site';

  const deps = {
    ...(packageJsonData?.dependencies || {}),
    ...(packageJsonData?.devDependencies || {}),
  };

  const hasViteConfig =
    pathSet.has('vite.config.ts') ||
    pathSet.has('vite.config.js') ||
    pathSet.has('vite.config.mjs') ||
    pathSet.has('vite.config.cjs');

  const hasNextConfig =
    pathSet.has('next.config.js') ||
    pathSet.has('next.config.mjs') ||
    pathSet.has('next.config.ts');

  const hasAstroConfig =
    pathSet.has('astro.config.mjs') ||
    pathSet.has('astro.config.ts') ||
    pathSet.has('astro.config.js');

  const hasSvelteConfig =
    pathSet.has('svelte.config.js') || pathSet.has('svelte.config.ts');

  const hasNuxtConfig =
    pathSet.has('nuxt.config.ts') || pathSet.has('nuxt.config.js');

  const hasAngularConfig = pathSet.has('angular.json');

  if (packageJsonData && hasViteConfig) {
    framework = 'vite';
    frameworkReason = 'package.json + vite.config.* detected';
  } else if (packageJsonData && (hasNextConfig || deps['next'])) {
    framework = 'nextjs';
    frameworkReason = hasNextConfig
      ? 'package.json + next.config.* detected'
      : 'next in package.json dependencies';
  } else if (packageJsonData && (hasAstroConfig || deps['astro'])) {
    framework = 'astro';
    frameworkReason = hasAstroConfig
      ? 'package.json + astro.config.* detected'
      : 'astro in package.json dependencies';
  } else if (packageJsonData && (hasSvelteConfig || deps['@sveltejs/kit'] || deps['svelte'])) {
    framework = 'svelte';
    frameworkReason = hasSvelteConfig
      ? 'package.json + svelte.config.* detected'
      : 'svelte in package.json dependencies';
  } else if (packageJsonData && (hasNuxtConfig || deps['nuxt'] || deps['nuxt3'])) {
    framework = 'nuxt';
    frameworkReason = hasNuxtConfig
      ? 'package.json + nuxt.config.* detected'
      : 'nuxt in package.json dependencies';
  } else if (packageJsonData && (deps['vue'] || pathSet.has('vue.config.js'))) {
    framework = 'vue';
    frameworkReason = 'Vue in package.json dependencies';
  } else if (packageJsonData && (hasAngularConfig || deps['@angular/core'])) {
    framework = 'angular';
    frameworkReason = hasAngularConfig
      ? 'angular.json detected'
      : '@angular/core in dependencies';
  } else if (packageJsonData && (deps['vite'] || hasViteConfig)) {
    framework = 'vite';
    frameworkReason = 'Vite tooling detected';
  } else if (packageJsonData && (deps['react'] || deps['react-dom'])) {
    framework = 'react';
    frameworkReason = 'React in package.json dependencies';
  } else if (pathSet.has('index.html')) {
    framework = 'static';
    frameworkReason = 'no package.json + index.html (Static)';
  } else if (packageJsonData) {
    framework = 'vite';
    frameworkReason = 'Standard JavaScript/TypeScript project';
  }

  // 6. Check for Prebuilt Output Directories (dist/, build/, out/, .output/public/)
  let hasPrebuiltOutput = false;
  let prebuiltOutputDir: string | undefined = undefined;

  const prebuiltCandidates = [
    { dir: 'dist', file: 'dist/index.html' },
    { dir: 'build', file: 'build/index.html' },
    { dir: 'out', file: 'out/index.html' },
    { dir: '.output/public', file: '.output/public/index.html' },
    { dir: 'public', file: 'public/index.html' },
  ];

  for (const cand of prebuiltCandidates) {
    if (pathSet.has(cand.file)) {
      hasPrebuiltOutput = true;
      prebuiltOutputDir = cand.dir;
      break;
    }
  }

  // 7. Output directory and build command determination
  const preset = FRAMEWORK_PRESETS[framework];
  let buildCommand = preset.defaultBuildCommand(packageManager);
  let outputDirectory = preset.defaultOutputDir;

  // If package.json defines custom build script, honor it!
  if (packageJsonData?.scripts?.build) {
    if (packageManager === 'bun') {
      buildCommand = 'bun run build';
    } else if (packageManager === 'yarn') {
      buildCommand = 'yarn build';
    } else if (packageManager === 'pnpm') {
      buildCommand = 'pnpm build';
    } else {
      buildCommand = 'npm run build';
    }
  }

  if (hasPrebuiltOutput && prebuiltOutputDir) {
    outputDirectory = prebuiltOutputDir;
  }

  const isStaticOnly = framework === 'static' && !packageJsonData;

  // 8. Suggest clean project name
  let suggestedProjectName =
    packageJsonData?.name ||
    fallbackName?.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-') ||
    'my-app';

  // Clean suggested name
  suggestedProjectName = suggestedProjectName
    .replace(/^@[\w-]+\//, '') // strip scope e.g. @scope/pkg
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (!suggestedProjectName) {
    suggestedProjectName = 'optic-project';
  }

  return {
    framework,
    frameworkName: preset.name,
    frameworkReason,
    packageManager,
    packageManagerReason,
    buildCommand: isStaticOnly ? '' : buildCommand,
    outputDirectory: isStaticOnly ? './' : outputDirectory,
    installCommand: preset.defaultInstallCommand(packageManager),
    nodeVersion: detectedNodeVersion,
    isStaticOnly,
    hasPrebuiltOutput,
    prebuiltOutputDir,
    suggestedProjectName,
    configFiles,
    totalFiles: files.length,
    totalSizeBytes,
    packageJsonData,
  };
}

/**
 * Filter files that should be deployed directly to Cloudflare R2
 * If prebuilt output directory exists (e.g. dist/), deploys assets from that directory as root!
 * If static project, deploys root assets.
 */
export function getDeployableStaticFiles(
  files: ProjectFileEntry[],
  outputDirectory: string
): { file: File; relativePath: string }[] {
  const result: { file: File; relativePath: string }[] = [];
  const cleanOutputDir = sanitizePath(outputDirectory);

  const isRootOutput = !cleanOutputDir || cleanOutputDir === '.' || cleanOutputDir === './';

  if (!isRootOutput) {
    const prefix = cleanOutputDir.toLowerCase() + '/';
    const outFiles = files.filter((f) => f.path.toLowerCase().startsWith(prefix));

    if (outFiles.length > 0) {
      for (const f of outFiles) {
        if (!f.file) continue;
        const strippedRelPath = f.path.slice(prefix.length);
        if (strippedRelPath) {
          result.push({
            file: f.file,
            relativePath: strippedRelPath,
          });
        }
      }
      return result;
    }
  }

  // If no files under outputDir prefix or root is outputDir:
  // Check if root has index.html or static files
  for (const f of files) {
    if (!f.file) continue;
    // Exclude node_modules, .git, etc.
    if (f.path.startsWith('node_modules/') || f.path.startsWith('.git/')) continue;
    result.push({
      file: f.file,
      relativePath: f.path,
    });
  }

  return result;
}

/**
 * Creates an Edge preview index.html if the user uploaded a source-only project without pre-built output
 */
export function createSourceBuildFallbackFile(
  projectName: string,
  config: DetectedProjectConfig
): File {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${projectName} - Optic Edge Deployment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 36px;
      max-width: 560px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    p.lead {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .specs-grid {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .spec-item { display: flex; flex-direction: column; gap: 2px; }
    .spec-label { color: #71717a; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
    .spec-val { color: #e4e4e7; font-family: monospace; font-weight: 500; }
    .status-box {
      border-left: 3px solid #6366f1;
      padding-left: 12px;
      font-size: 12px;
      color: #d4d4d8;
      line-height: 1.6;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Optic Hosting · Edge Deployment</div>
    <h1>${projectName}</h1>
    <p class="lead">Project source code deployed successfully to Optic's Edge Network.</p>
    
    <div class="specs-grid">
      <div class="spec-item">
        <span class="spec-label">Framework</span>
        <span class="spec-val">${config.frameworkName}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Package Manager</span>
        <span class="spec-val">${config.packageManager}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Build Command</span>
        <span class="spec-val">${config.buildCommand || 'none'}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Output Directory</span>
        <span class="spec-val">${config.outputDirectory}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Node Runtime</span>
        <span class="spec-val">${config.nodeVersion}</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Files Preserved</span>
        <span class="spec-val">${config.totalFiles} files</span>
      </div>
    </div>

    <div class="status-box">
      <strong>Source Preservation:</strong> Complete project tree and configuration files have been stored in Cloudflare R2 for continuous delivery and edge compilation.
    </div>

    <div class="footer">
      <span>Optic Hosting</span>
      <span>${new Date().toUTCString()}</span>
    </div>
  </div>
</body>
</html>`;

  return new File([html], 'index.html', { type: 'text/html; charset=utf-8' });
}

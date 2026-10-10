import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import {
  BuildOptions,
  BuildResult,
  BuildStepLog,
  DeploymentManifest,
  OutputFile,
  SourceFile,
} from './types.js';
import { detectFrameworkAndLanguage } from './detector.js';
import { generateRuntimeDescriptor } from './runtime.js';
import { getMimeType, storeMemoryDeploymentFile, setProductionDeployment, cacheDeploymentRecord } from '../deploymentServer.js';
import { getR2Config, getR2Client, uploadDeploymentFileBuffer } from '../r2Storage.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const MAX_BUILD_TIMEOUT_MS = 180000; // 3 minutes max build time
const MAX_LOG_ENTRIES = 500;

export class BuildEngine {
  private logs: BuildStepLog[] = [];

  private log(step: string, level: 'info' | 'warn' | 'error' | 'success', message: string) {
    const entry: BuildStepLog = {
      step,
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (this.logs.length < MAX_LOG_ENTRIES) {
      this.logs.push(entry);
    }
    console.log(`[BUILD_${level.toUpperCase()}] [${step}] ${message}`);
  }

  public getLogs(): BuildStepLog[] {
    return [...this.logs];
  }

  /**
   * Executes the end-to-end build pipeline.
   */
  public async executeBuild(
    files: SourceFile[],
    options: BuildOptions,
    supabaseClient?: any
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const {
      deploymentId,
      projectId,
      projectSlug,
      organizationId,
      branch,
      commitSha,
      isProduction,
      envVars = {},
    } = options;

    const storagePath = `deployments/${organizationId}/${projectId}/${deploymentId}`;
    const deploymentUrl = `https://${projectSlug}.host.doy.best`;

    this.log('init', 'info', `Starting deployment ${deploymentId} for project ${projectSlug} (${branch})`);

    // 1. Framework and Language Detection
    this.log('detect', 'info', `Analyzing ${files.length} repository files for framework and runtime characteristics...`);
    const detection = detectFrameworkAndLanguage(files, options.customRootDirectory);

    // Apply any explicit overrides passed by user settings
    const framework = options.customFramework || detection.framework;
    const buildCommand = options.customBuildCommand !== undefined ? options.customBuildCommand : detection.buildCommand;
    const installCommand = options.customInstallCommand !== undefined ? options.customInstallCommand : detection.installCommand;
    const outputDir = options.customOutputDir !== undefined ? options.customOutputDir : detection.outputDir;
    const runtimeType = detection.runtimeType;

    this.log('detect', 'success', `Detected Framework: ${detection.frameworkName} (${detection.languageName}) [Runtime: ${runtimeType.toUpperCase()}]`);
    if (detection.reasons.length > 0) {
      this.log('detect', 'info', `Detection reasons: ${detection.reasons.join('; ')}`);
    }

    // Persist logs to Supabase if client available
    await this.persistSupabaseLogs(supabaseClient, deploymentId, 'detect', `Identified ${detection.frameworkName} (${detection.languageName})`);

    let outputFiles: OutputFile[] = [];
    const tmpBuildDir = path.join(os.tmpdir(), `optic-build-${deploymentId}`);

    try {
      // 2. Build Execution
      if (runtimeType === 'static' && buildCommand) {
        // Needs a build step (e.g. Vite, React, Vue, Svelte, Next export, Astro)
        this.log('build', 'info', `Setting up isolated build workspace at ${tmpBuildDir}...`);
        await this.prepareWorkspace(tmpBuildDir, files);

        this.log('install', 'info', `Running dependency installation: ${installCommand || 'npm install'}...`);
        const installSuccess = await this.runProcess(
          installCommand || 'npm install',
          tmpBuildDir,
          envVars,
          'install'
        );

        if (!installSuccess) {
          throw new Error(`Dependency installation failed. Check build logs for details.`);
        }

        this.log('build', 'info', `Executing build command: ${buildCommand}...`);
        const buildSuccess = await this.runProcess(
          buildCommand,
          tmpBuildDir,
          envVars,
          'build'
        );

        if (!buildSuccess) {
          throw new Error(`Build command "${buildCommand}" failed with exit code non-zero.`);
        }

        // Collect outputs from designated outputDir
        const targetOutputFolder = path.resolve(tmpBuildDir, outputDir || 'dist');
        this.log('package', 'info', `Collecting build artifacts from output directory: ${outputDir || 'dist'}...`);
        outputFiles = await this.collectOutputFiles(targetOutputFolder);

        if (outputFiles.length === 0) {
          this.log('package', 'warn', `Output directory "${outputDir}" was empty or not found; falling back to root static files.`);
          outputFiles = files.map((f) => ({
            relativePath: f.relativePath,
            buffer: f.buffer,
            mimeType: getMimeType(f.relativePath),
            size: f.buffer.length,
          }));
        }
      } else if (runtimeType === 'server') {
        // Persistent server application (Node.js, Express, NestJS, Python, Go, Rust, PHP)
        this.log('runtime', 'info', `Generating isolated container & process specification for ${detection.languageName} application...`);
        const runtimeSpec = generateRuntimeDescriptor(deploymentId, projectId, detection, envVars);

        // Store runtime spec alongside artifacts
        const specBuffer = Buffer.from(JSON.stringify(runtimeSpec, null, 2), 'utf-8');
        outputFiles = files.map((f) => ({
          relativePath: f.relativePath,
          buffer: f.buffer,
          mimeType: getMimeType(f.relativePath),
          size: f.buffer.length,
        }));
        outputFiles.push({
          relativePath: 'optic-runtime.json',
          buffer: specBuffer,
          mimeType: 'application/json',
          size: specBuffer.length,
        });

        this.log('runtime', 'success', `Generated container runner spec: ${detection.language} runner, port ${runtimeSpec.containerSpec?.port || 3000}`);
      } else {
        // Pure static site without build command (HTML/CSS/JS)
        this.log('package', 'info', `Packaging static assets (zero-config)...`);
        outputFiles = files.map((f) => ({
          relativePath: f.relativePath,
          buffer: f.buffer,
          mimeType: getMimeType(f.relativePath),
          size: f.buffer.length,
        }));
      }

      // 3. Artifact Validation
      const hasIndexHtml = outputFiles.some((f) => f.relativePath === 'index.html');
      this.log('validate', 'info', `Validated ${outputFiles.length} output files (Root index.html: ${hasIndexHtml ? 'present' : 'absent'}).`);

      // 4. Storage & CDN Ingestion
      this.log('storage', 'info', `Uploading ${outputFiles.length} deployment artifacts to Cloudflare R2 and edge cache...`);
      const r2Config = getR2Config();
      let r2Uploaded = 0;

      for (const file of outputFiles) {
        // Memory edge cache for instant response
        storeMemoryDeploymentFile(deploymentId, file.relativePath, file.buffer, file.mimeType);

        if (r2Config.isConfigured) {
          const key = `${storagePath}/${file.relativePath}`;
          try {
            await uploadDeploymentFileBuffer(key, file.buffer, file.mimeType);
            r2Uploaded++;
          } catch (r2Err: any) {
            this.log('storage', 'warn', `R2 upload notice on ${file.relativePath}: ${r2Err.message}`);
          }
        }
      }

      this.log('storage', 'success', `Successfully persisted ${outputFiles.length} files (R2 uploaded: ${r2Uploaded}).`);

      // 5. Atomic Promotion & Lifecycle
      const buildTimeMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      // In-memory deployment record
      cacheDeploymentRecord({
        id: deploymentId,
        project_id: projectId,
        organization_id: organizationId,
        status: 'ready',
        storage_path: storagePath,
        createdAt: Date.now(),
      });

      if (isProduction) {
        this.log('lifecycle', 'info', `Atomically activating production deployment for project "${projectSlug}"...`);
        setProductionDeployment(projectId, deploymentId, projectSlug);

        // Update R2 production pointer
        if (r2Config.isConfigured) {
          try {
            const r2Client = getR2Client();
            if (r2Client && r2Config.bucketName) {
              const prodPayload = JSON.stringify({
                projectId,
                projectSlug,
                productionDeploymentId: deploymentId,
                framework,
                runtimeType,
                promotedAt: completedAt,
              });
              await r2Client.send(
                new PutObjectCommand({
                  Bucket: r2Config.bucketName,
                  Key: `projects/${projectSlug.toLowerCase().trim()}/production.json`,
                  Body: Buffer.from(prodPayload, 'utf-8'),
                  ContentType: 'application/json',
                })
              );
            }
          } catch (ptrErr: any) {
            this.log('lifecycle', 'warn', `Notice writing production pointer: ${ptrErr.message}`);
          }
        }
        this.log('lifecycle', 'success', `Production deployment active at ${deploymentUrl}`);
      } else {
        this.log('lifecycle', 'info', `Preview deployment active at https://${deploymentId}.host.doy.best`);
      }

      // 6. Manifest Generation
      const manifest: DeploymentManifest = {
        deploymentId,
        projectId,
        projectSlug,
        framework,
        language: detection.language,
        runtimeType,
        totalFiles: outputFiles.length,
        entryPoint: hasIndexHtml ? 'index.html' : outputFiles[0]?.relativePath,
        buildTimeMs,
        commitSha,
        branch,
        createdAt: completedAt,
        storagePath,
      };

      // Persist completion status to Supabase
      if (supabaseClient) {
        try {
          await supabaseClient
            .from('deployments')
            .update({
              status: 'ready',
              completed_at: completedAt,
              build_time_ms: buildTimeMs,
            })
            .eq('id', deploymentId);

          await this.persistSupabaseLogs(
            supabaseClient,
            deploymentId,
            'finish',
            `Deployment READY in ${Math.round(buildTimeMs / 1000)}s. Live at ${deploymentUrl}`
          );
        } catch (dbErr: any) {
          this.log('lifecycle', 'warn', `Supabase update notice: ${dbErr.message}`);
        }
      }

      return {
        success: true,
        deploymentId,
        runtimeType,
        framework,
        outputFilesCount: outputFiles.length,
        storagePath,
        deploymentUrl: isProduction ? deploymentUrl : `https://${deploymentId}.host.doy.best`,
        buildTimeMs,
        logs: this.logs,
        manifest,
      };
    } catch (err: any) {
      const buildTimeMs = Date.now() - startTime;
      const errorMsg = err?.message || 'Unknown build failure occurred';
      this.log('error', 'error', `Build failed: ${errorMsg}`);

      if (supabaseClient) {
        try {
          await supabaseClient
            .from('deployments')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              build_time_ms: buildTimeMs,
              error_message: errorMsg,
            })
            .eq('id', deploymentId);

          await this.persistSupabaseLogs(supabaseClient, deploymentId, 'error', `Build failed: ${errorMsg}`);
        } catch {
          // ignore error reporting issues
        }
      }

      return {
        success: false,
        deploymentId,
        runtimeType,
        framework,
        outputFilesCount: 0,
        storagePath,
        deploymentUrl,
        buildTimeMs,
        logs: this.logs,
        error: errorMsg,
      };
    } finally {
      // Clean up workspace
      try {
        await fs.rm(tmpBuildDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }

  private async prepareWorkspace(dir: string, files: SourceFile[]): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
      const safeRel = file.relativePath.replace(/\.\./g, '').replace(/^\/+/, '');
      const targetPath = path.join(dir, safeRel);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.buffer);
    }
  }

  private runProcess(
    command: string,
    cwd: string,
    envVars: Record<string, string>,
    step: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('sh', ['-c', command], {
          cwd,
          env: {
            ...process.env,
            ...envVars,
            NODE_ENV: 'production',
            PATH: process.env.PATH,
          },
          timeout: MAX_BUILD_TIMEOUT_MS,
        });

        proc.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          for (const l of lines) {
            this.log(step, 'info', l.trim());
          }
        });

        proc.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          for (const l of lines) {
            this.log(step, 'warn', l.trim());
          }
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve(true);
          } else {
            this.log(step, 'error', `Command exited with non-zero exit code ${code}`);
            resolve(false);
          }
        });

        proc.on('error', (err) => {
          this.log(step, 'error', `Process execution error: ${err.message}`);
          resolve(false);
        });
      } catch (err: any) {
        this.log(step, 'error', `Failed to spawn process: ${err.message}`);
        resolve(false);
      }
    });
  }

  private async collectOutputFiles(dir: string, baseDir: string = dir): Promise<OutputFile[]> {
    const results: OutputFile[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const sub = await this.collectOutputFiles(fullPath, baseDir);
          results.push(...sub);
        } else if (entry.isFile()) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const buffer = await fs.readFile(fullPath);
          results.push({
            relativePath: relPath,
            buffer,
            mimeType: getMimeType(relPath),
            size: buffer.length,
          });
        }
      }
    } catch {
      // Directory may not exist
    }
    return results;
  }

  private async persistSupabaseLogs(
    sb: any,
    deploymentId: string,
    step: string,
    message: string
  ): Promise<void> {
    if (!sb) return;
    try {
      await sb.from('deployment_logs').insert([
        {
          deployment_id: deploymentId,
          message: `[${step.toUpperCase()}] ${message}`,
          level: step === 'error' ? 'error' : step === 'finish' ? 'success' : 'info',
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      // logs insertion non-fatal
    }
  }
}

import type { IncomingMessage, ServerResponse } from 'http';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Config, getR2Client, sanitizeDeploymentPath } from './r2Storage.js';
import { getSupabaseServerClient } from './supabaseServer.js';

const MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  cjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  wasm: 'application/wasm',
  map: 'application/json; charset=utf-8',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  zip: 'application/zip',
};

function getMimeType(filePath: string, fallback?: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext && MIME_TYPES[ext]) {
    return MIME_TYPES[ext];
  }
  if (fallback && fallback !== 'application/octet-stream') {
    return fallback;
  }
  return 'application/octet-stream';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendHtmlPage(res: ServerResponse, statusCode: number, title: string, message: string) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Optic Hosting</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #27272a;
      color: #818cf8;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 10px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      margin-bottom: 20px;
    }
    .footer {
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #27272a;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">Optic Hosting</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="footer">Optic Cloud Edge Network</div>
  </div>
</body>
</html>`);
}

function isSpaCandidate(subpath: string): boolean {
  if (!subpath || subpath === 'index.html') return false;
  const lastSegment = subpath.split('/').pop() || '';
  // If the last segment contains a file extension (e.g. .css, .js, .png), it is NOT an SPA candidate
  if (lastSegment.includes('.')) {
    return false;
  }
  return true;
}

export interface DeploymentServerOptions {
  supabase?: any;
  r2Client?: any;
  r2Config?: { bucketName: string; isConfigured: boolean };
}

/**
 * Handles incoming public static file requests for ready deployments.
 * Route pattern: /api/deployments/:deploymentId/*
 */
export async function handleDeploymentRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options?: DeploymentServerOptions
): Promise<void> {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
    return;
  }

  const rawUrl = req.url || '';
  if (
    rawUrl.includes('/../') ||
    rawUrl.endsWith('/..') ||
    rawUrl.toLowerCase().includes('%2e%2e')
  ) {
    return sendHtmlPage(res, 400, 'Security Violation', 'Directory traversal is prohibited.');
  }

  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // Match /api/deployments/:deploymentId or /api/deployments/:deploymentId/*
  const match = pathname.match(/^\/api\/deployments\/([^/]+)(?:\/(.*))?$/);
  if (!match) {
    return sendHtmlPage(res, 404, 'Invalid Request', 'Deployment endpoint not recognized.');
  }

  const deploymentId = match[1];
  const hasTrailingSlash = pathname.startsWith(`/api/deployments/${deploymentId}/`);
  const rawSubpath = match[2] || '';

  // 1. Directory Root Redirection:
  // If user accesses /api/deployments/{deploymentId} without a trailing slash,
  // 302 redirect to /api/deployments/{deploymentId}/ so relative asset paths resolve correctly
  if (!hasTrailingSlash && !rawSubpath) {
    res.statusCode = 302;
    res.setHeader('Location', `/api/deployments/${deploymentId}/${parsedUrl.search}`);
    res.end();
    return;
  }

  // 2. Prevent Path Traversal
  let decodedSubpath = '';
  try {
    decodedSubpath = decodeURIComponent(rawSubpath);
  } catch {
    return sendHtmlPage(res, 400, 'Bad Request', 'Malformed URL path encoding.');
  }

  if (decodedSubpath.includes('\0') || decodedSubpath.includes('..')) {
    return sendHtmlPage(res, 400, 'Security Violation', 'Directory traversal is prohibited.');
  }

  // 3. Database Lookup: Verify deployment exists, belongs to valid project/organization, and is ready
  const sb = options?.supabase || getSupabaseServerClient();
  if (!sb) {
    return sendHtmlPage(
      res,
      503,
      'Service Unavailable',
      'Database connection is not configured on this instance.'
    );
  }

  let deployment: any = null;
  try {
    const { data: depData, error: depErr } = await sb
      .from('deployments')
      .select('id, project_id, organization_id, status, storage_path')
      .eq('id', deploymentId)
      .maybeSingle();

    if (depData) {
      deployment = depData;
    } else {
      // Fallback check in hosting_deployments if present
      const { data: hDepData } = await sb
        .from('hosting_deployments')
        .select('id, project_id, organization_id, status')
        .eq('id', deploymentId)
        .maybeSingle();
      if (hDepData) {
        deployment = hDepData;
      }
    }
  } catch (err: any) {
    console.error('[Optic Hosting] DB lookup exception:', err);
    return sendHtmlPage(
      res,
      500,
      'Database Error',
      'An unexpected error occurred while resolving deployment.'
    );
  }

  if (!deployment) {
    return sendHtmlPage(
      res,
      404,
      'Deployment Not Found',
      `The deployment "${deploymentId}" was not found or has been removed.`
    );
  }

  // 4. Verify deployment status is ready
  if (deployment.status !== 'ready') {
    return sendHtmlPage(
      res,
      404,
      'Deployment Not Ready',
      `This deployment is currently in "${deployment.status}" status. Only ready deployments are publicly accessible.`
    );
  }

  // 5. Verify project and organization validity
  try {
    const { data: pData } = await sb
      .from('projects')
      .select('id, organization_id')
      .eq('id', deployment.project_id)
      .maybeSingle();

    const project = pData;

    if (!project || project.organization_id !== deployment.organization_id) {
      return sendHtmlPage(
        res,
        404,
        'Project Inactive',
        'The project associated with this deployment is no longer active.'
      );
    }
  } catch (err) {
    console.error('[Optic Hosting] Project verification exception:', err);
  }

  // 6. Cloudflare R2 Client Check
  const r2Config = options?.r2Config || getR2Config();
  const r2Client = options?.r2Client || getR2Client();
  if (!r2Client || !r2Config.bucketName || !r2Config.isConfigured) {
    return sendHtmlPage(
      res,
      503,
      'Storage Unavailable',
      'Cloudflare R2 storage credentials are not configured on this Optic instance.'
    );
  }

  // 7. Resolve Target File Path
  // Default document for root or directories is index.html
  let targetRelative = decodedSubpath.replace(/^\/+/, '');
  if (!targetRelative || targetRelative.endsWith('/')) {
    targetRelative = `${targetRelative}index.html`;
  }

  const safeRelPath = sanitizeDeploymentPath(targetRelative);
  const orgId = deployment.organization_id;
  const projId = deployment.project_id;
  const depId = deployment.id;

  const storageKey = `deployments/${orgId}/${projId}/${depId}/${safeRelPath}`;

  // 8. Stream Object from Cloudflare R2
  try {
    const getCmd = new GetObjectCommand({
      Bucket: r2Config.bucketName,
      Key: storageKey,
    });

    const s3Res = await r2Client.send(getCmd);

    // ETag caching check (HTTP 304 Not Modified)
    if (s3Res.ETag) {
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === s3Res.ETag) {
        res.statusCode = 304;
        res.end();
        return;
      }
      res.setHeader('ETag', s3Res.ETag);
    }

    const mime = getMimeType(safeRelPath, s3Res.ContentType);
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (safeRelPath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    if (s3Res.ContentLength) {
      res.setHeader('Content-Length', s3Res.ContentLength);
    }

    if (method === 'HEAD') {
      res.end();
      return;
    }

    // Stream body to client
    if (s3Res.Body) {
      if (
        typeof (s3Res.Body as any).pipe === 'function' &&
        typeof (res as any).on === 'function'
      ) {
        (s3Res.Body as any).pipe(res);
      } else if (typeof (s3Res.Body as any).transformToByteArray === 'function') {
        const bytes = await (s3Res.Body as any).transformToByteArray();
        res.end(Buffer.from(bytes));
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of s3Res.Body as any) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
        }
        res.end(Buffer.concat(chunks));
      }
    } else {
      res.end();
    }
  } catch (err: any) {
    const isNotFound =
      err.name === 'NoSuchKey' ||
      err.name === 'NotFound' ||
      err.$metadata?.httpStatusCode === 404;

    if (isNotFound) {
      // 9. SPA Routing Fallback:
      // If requested path is not index.html and does not have a static file extension (e.g. /dashboard or /about),
      // fallback to index.html to support single-page apps
      if (isSpaCandidate(targetRelative)) {
        try {
          const indexKey = `deployments/${orgId}/${projId}/${depId}/index.html`;
          const indexCmd = new GetObjectCommand({
            Bucket: r2Config.bucketName,
            Key: indexKey,
          });
          const indexRes = await r2Client.send(indexCmd);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

          if (indexRes.ETag) res.setHeader('ETag', indexRes.ETag);
          if (indexRes.ContentLength) res.setHeader('Content-Length', indexRes.ContentLength);

          if (method === 'HEAD') {
            res.end();
            return;
          }

          if (indexRes.Body) {
            if (
              typeof (indexRes.Body as any).pipe === 'function' &&
              typeof (res as any).on === 'function'
            ) {
              (indexRes.Body as any).pipe(res);
            } else if (typeof (indexRes.Body as any).transformToByteArray === 'function') {
              const bytes = await (indexRes.Body as any).transformToByteArray();
              res.end(Buffer.from(bytes));
            } else {
              const chunks: Buffer[] = [];
              for await (const chunk of indexRes.Body as any) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
              }
              res.end(Buffer.concat(chunks));
            }
          } else {
            res.end();
          }
          return;
        } catch {
          // index.html also not found, continue to 404
        }
      }

      return sendHtmlPage(
        res,
        404,
        'File Not Found',
        `The requested path "${targetRelative}" does not exist in deployment ${deploymentId}.`
      );
    }

    console.error('[Optic Hosting] Error serving R2 object:', err);
    return sendHtmlPage(
      res,
      500,
      'Internal Server Error',
      'Failed to retrieve deployment file from storage.'
    );
  }
}

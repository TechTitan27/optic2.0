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

export function getMimeType(filePath: string, fallback?: string): string {
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

export function sendHtmlPage(res: ServerResponse, statusCode: number, title: string, message: string) {
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

export interface CachedDeployment {
  id: string;
  project_id: string;
  organization_id: string;
  status: string;
  storage_path: string;
  createdAt: number;
}

const memoryDeployments = new Map<string, CachedDeployment>();
const projectProductionMap = new Map<string, string>();

export function cacheDeploymentRecord(record: CachedDeployment) {
  memoryDeployments.set(record.id, record);
}

export function getCachedDeployment(deploymentId: string): CachedDeployment | undefined {
  return memoryDeployments.get(deploymentId);
}

export function setProductionDeployment(projectId: string, deploymentId: string, slug?: string) {
  projectProductionMap.set(projectId, deploymentId);
  if (slug) {
    projectProductionMap.set(slug.toLowerCase().trim(), deploymentId);
  }
}

export function getProductionDeployment(idOrSlug: string): string | undefined {
  const clean = idOrSlug.toLowerCase().trim();
  return projectProductionMap.get(idOrSlug) || projectProductionMap.get(clean);
}

/**
 * Resolves the active production deployment ID for a project (by slug or ID).
 * Priority: memory cache -> R2 metadata pointer -> Supabase latest ready deployment.
 */
export async function resolveProductionDeploymentId(
  slugOrId: string,
  options?: DeploymentServerOptions
): Promise<string | null> {
  const clean = slugOrId.toLowerCase().trim();
  const cached = getProductionDeployment(clean);
  if (cached) return cached;

  const r2Client = options?.r2Client || getR2Client();
  const r2Config = options?.r2Config || getR2Config();

  // 1. Check R2 for explicit production pointer
  if (r2Client && r2Config.bucketName) {
    try {
      const getCmd = new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `projects/${clean}/production.json`,
      });
      const res = await r2Client.send(getCmd);
      if (res.Body) {
        let text = '';
        if (typeof (res.Body as any).transformToString === 'function') {
          text = await (res.Body as any).transformToString('utf-8');
        } else if (typeof (res.Body as any).transformToByteArray === 'function') {
          const bytes = await (res.Body as any).transformToByteArray();
          text = Buffer.from(bytes).toString('utf-8');
        }
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed?.productionDeploymentId) {
            setProductionDeployment(parsed.projectId || clean, parsed.productionDeploymentId, clean);
            return parsed.productionDeploymentId;
          }
        }
      }
    } catch {
      // Pointer file not present in R2
    }
  }

  // 2. Query Supabase for project and its latest ready deployment
  const sb = options?.supabase || getSupabaseServerClient();
  if (sb) {
    try {
      const { data: proj } = await sb
        .from('projects')
        .select('id, organization_id, slug')
        .or(`slug.eq.${clean},id.eq.${clean}`)
        .maybeSingle();

      if (proj) {
        // Query latest ready deployment
        const { data: dep } = await sb
          .from('deployments')
          .select('id, status')
          .eq('project_id', proj.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dep?.id) {
          setProductionDeployment(proj.id, dep.id, proj.slug);
          return dep.id;
        }
      }
    } catch (err: any) {
      console.warn('[Optic Hosting] Production deployment lookup notice:', err.message);
    }
  }

  return null;
}

/**
 * Extracts deploymentId and relative subpath from any URL, rewrite format, or custom host.
 * Supports:
 * 1. Host-based project URLs: https://my-project.host.optic.doy.best/ -> project slug -> production deployment
 * 2. Host-based immutable URLs: https://<deployment-id>.host.optic.doy.best/ -> direct deployment ID
 * 3. Public API paths: /api/deployments/:deploymentId/*
 */
export async function resolveRequestTarget(
  req: IncomingMessage,
  options?: DeploymentServerOptions
): Promise<{
  deploymentId: string;
  rawSubpath: string;
  rawUrl: string;
  isHostRouting: boolean;
  projectSlug?: string;
}> {
  const host = (
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    ''
  )
    .toLowerCase()
    .trim()
    .split(':')[0];

  const headerUri =
    (req.headers['x-forwarded-uri'] as string) ||
    (req.headers['x-original-url'] as string) ||
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-vercel-matched-path'] as string) ||
    '';
  const reqUrl = req.url || '';
  const candidate = (headerUri && headerUri.includes('/api/deployments')) ? headerUri : reqUrl;

  const parsed = new URL(candidate, 'http://localhost');
  const pathname = parsed.pathname;

  // 1. Host-based wildcard routing check: *.host.optic.doy.best or *.host.localhost
  const hostMatch = host.match(/^([a-z0-9_-]+)\.host\.(?:optic\.doy\.best|localhost)$/i);
  if (hostMatch) {
    const subdomain = hostMatch[1].toLowerCase();
    const rawSubpath = pathname.replace(/^\/+/, '');

    // Is subdomain a deployment ID (UUID or known cached deployment)?
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subdomain);
    if (isUuid || getCachedDeployment(subdomain)) {
      return {
        deploymentId: subdomain,
        rawSubpath,
        rawUrl: candidate || reqUrl,
        isHostRouting: true,
      };
    }

    // Subdomain is a project slug: resolve production deployment ID
    const prodDepId = await resolveProductionDeploymentId(subdomain, options);
    return {
      deploymentId: prodDepId || '',
      rawSubpath,
      rawUrl: candidate || reqUrl,
      isHostRouting: true,
      projectSlug: subdomain,
    };
  }

  // 2. Standard /api/deployments/:deploymentId/* parsing
  let deploymentId = '';
  let rawSubpath = '';

  const match = pathname.match(/^\/api\/deployments(?:\/([^/]+))?(?:\/(.*))?$/);
  if (match && match[1]) {
    deploymentId = match[1];
    rawSubpath = match[2] || '';
  }

  // Check query params if not found via pathname
  if (!deploymentId) {
    const depIdParam = parsed.searchParams.get('deploymentId');
    if (depIdParam) {
      deploymentId = depIdParam;
    }
    const subpathParam = parsed.searchParams.get('subpath');
    if (subpathParam) {
      rawSubpath = subpathParam;
    }
    const pathParam = parsed.searchParams.get('path');
    if (pathParam && !deploymentId) {
      const parts = pathParam.replace(/^\/+/, '').split('/');
      deploymentId = parts[0] || '';
      rawSubpath = parts.slice(1).join('/');
    }
  } else if (!rawSubpath) {
    const subpathParam = parsed.searchParams.get('subpath');
    if (subpathParam) {
      rawSubpath = subpathParam;
    }
  }

  return {
    deploymentId,
    rawSubpath,
    rawUrl: candidate || reqUrl,
    isHostRouting: false,
  };
}

/**
 * Handles incoming public static file requests for ready deployments.
 * Route patterns:
 * - https://my-project.host.optic.doy.best/*
 * - https://<deployment-id>.host.optic.doy.best/*
 * - /api/deployments/:deploymentId/*
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

  const { deploymentId, rawSubpath, rawUrl, isHostRouting, projectSlug } =
    await resolveRequestTarget(req, options);

  // Security Check: Traversal in raw URL
  if (
    rawUrl.includes('/../') ||
    rawUrl.endsWith('/..') ||
    rawUrl.toLowerCase().includes('%2e%2e')
  ) {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      url: rawUrl,
      reason: 'Directory traversal sequence in raw URL',
    });
    return sendHtmlPage(res, 400, 'Security Violation', 'Directory traversal is prohibited.');
  }

  if (!deploymentId) {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      url: rawUrl,
      isHostRouting,
      projectSlug,
      reason: isHostRouting
        ? `No ready production deployment found for project "${projectSlug}"`
        : 'URL pattern does not match /api/deployments/:deploymentId/*',
    });
    return sendHtmlPage(
      res,
      404,
      isHostRouting ? 'No Production Deployment' : 'Invalid Request',
      isHostRouting
        ? `The project "${projectSlug}" does not have an active production deployment yet.`
        : 'Deployment endpoint not recognized.'
    );
  }

  // Prevent Path Traversal in subpath
  let decodedSubpath = '';
  try {
    decodedSubpath = decodeURIComponent(rawSubpath);
  } catch {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      rawSubpath,
      reason: 'Malformed URL path encoding',
    });
    return sendHtmlPage(res, 400, 'Bad Request', 'Malformed URL path encoding.');
  }

  if (decodedSubpath.includes('\0') || decodedSubpath.includes('..')) {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      decodedSubpath,
      reason: 'Path traversal character detected in subpath',
    });
    return sendHtmlPage(res, 400, 'Security Violation', 'Directory traversal is prohibited.');
  }

  // 1. STRUCTURED LOG: DEPLOYMENT_REQUEST
  console.log('[DEPLOYMENT_REQUEST]', {
    method,
    url: rawUrl,
    deploymentId,
    subpath: decodedSubpath,
    isHostRouting,
  });

  // 2. Database & Cache Lookup: Verify deployment exists and is ready
  let deployment: any = getCachedDeployment(deploymentId) || null;
  const sb = options?.supabase || getSupabaseServerClient();
  const r2Config = options?.r2Config || getR2Config();
  const r2Client = options?.r2Client || getR2Client();

  if (!deployment && sb) {
    try {
      const { data: depData, error: depErr } = await sb
        .from('deployments')
        .select('id, project_id, organization_id, status, storage_path')
        .eq('id', deploymentId)
        .maybeSingle();

      if (depErr) {
        console.warn('[Optic Hosting] Supabase query notice on deployments:', depErr.message);
      }

      if (depData) {
        deployment = depData;
        cacheDeploymentRecord({
          id: depData.id,
          project_id: depData.project_id,
          organization_id: depData.organization_id,
          status: depData.status || 'ready',
          storage_path:
            depData.storage_path ||
            `deployments/${depData.organization_id}/${depData.project_id}/${depData.id}`,
          createdAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.warn('[Optic Hosting] DB lookup notice:', err.message);
    }
  }

  // Fallback: Check R2 metadata if database query returned null
  if (!deployment && r2Client && r2Config.bucketName) {
    try {
      const metaCmd = new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `deployments/_meta/${deploymentId}.json`,
      });
      const metaRes = await r2Client.send(metaCmd);
      if (metaRes.Body) {
        let text = '';
        if (typeof (metaRes.Body as any).transformToString === 'function') {
          text = await (metaRes.Body as any).transformToString('utf-8');
        } else if (typeof (metaRes.Body as any).transformToByteArray === 'function') {
          const bytes = await (metaRes.Body as any).transformToByteArray();
          text = Buffer.from(bytes).toString('utf-8');
        }
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed && parsed.id) {
            deployment = parsed;
            cacheDeploymentRecord({
              id: parsed.id,
              project_id: parsed.project_id,
              organization_id: parsed.organization_id,
              status: parsed.status || 'ready',
              storage_path:
                parsed.storage_path ||
                `deployments/${parsed.organization_id}/${parsed.project_id}/${parsed.id}`,
              createdAt: Date.now(),
            });
          }
        }
      }
    } catch {
      // Metadata object not present
    }
  }

  // 2. STRUCTURED LOG: DEPLOYMENT_LOOKUP
  console.log('[DEPLOYMENT_LOOKUP]', {
    deploymentId,
    found: Boolean(deployment),
    status: deployment?.status || null,
    projectId: deployment?.project_id || null,
    organizationId: deployment?.organization_id || null,
  });

  if (!deployment) {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      reason: 'Deployment record not found in database, memory cache, or storage',
    });
    return sendHtmlPage(
      res,
      404,
      'Deployment Not Found',
      `The deployment "${deploymentId}" was not found or has been removed.`
    );
  }

  // 3. Verify deployment status is ready
  if (deployment.status !== 'ready') {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      status: deployment.status,
      reason: `Deployment status is "${deployment.status}", must be "ready" to serve`,
    });
    return sendHtmlPage(
      res,
      404,
      'Deployment Not Ready',
      `This deployment is currently in "${deployment.status}" status. Only ready deployments are publicly accessible.`
    );
  }

  // 4. Cloudflare R2 Client Check
  if (!r2Client || !r2Config.bucketName || !r2Config.isConfigured) {
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      reason: 'Cloudflare R2 is not configured on this instance',
    });
    return sendHtmlPage(
      res,
      503,
      'Storage Unavailable',
      'Cloudflare R2 storage credentials are not configured on this Optic instance.'
    );
  }

  // 5. Resolve Target File Path
  let targetRelative = decodedSubpath.replace(/^\/+/, '');
  if (!targetRelative || targetRelative.endsWith('/')) {
    targetRelative = `${targetRelative}index.html`;
  }

  const safeRelPath = sanitizeDeploymentPath(targetRelative);
  const orgId = deployment.organization_id;
  const projId = deployment.project_id;
  const depId = deployment.id;

  const storageKey = deployment.storage_path
    ? `${deployment.storage_path.replace(/\/+$/, '')}/${safeRelPath}`
    : `deployments/${orgId}/${projId}/${depId}/${safeRelPath}`;

  // 3. STRUCTURED LOG: DEPLOYMENT_R2_PATH
  console.log('[DEPLOYMENT_R2_PATH]', {
    deploymentId,
    targetRelative,
    safeRelPath,
    storageKey,
  });

  // 6. Stream Object from Cloudflare R2
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

    // 4. STRUCTURED LOG: DEPLOYMENT_R2_READ
    console.log('[DEPLOYMENT_R2_READ]', {
      deploymentId,
      storageKey,
      contentLength: s3Res.ContentLength || null,
      contentType: mime,
    });

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

    // 5. STRUCTURED LOG: DEPLOYMENT_RESPONSE
    console.log('[DEPLOYMENT_RESPONSE]', {
      deploymentId,
      statusCode: 200,
      contentType: mime,
      contentLength: s3Res.ContentLength || 0,
      safeRelPath,
    });

    if (method === 'HEAD') {
      res.end();
      return;
    }

    // Stream body to client
    if (s3Res.Body) {
      if (typeof (s3Res.Body as any).transformToByteArray === 'function') {
        const bytes = await (s3Res.Body as any).transformToByteArray();
        res.end(Buffer.from(bytes));
      } else if (
        typeof (s3Res.Body as any).pipe === 'function' &&
        typeof (res as any).on === 'function'
      ) {
        (s3Res.Body as any).pipe(res);
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
    // 6. STRUCTURED LOG: DEPLOYMENT_SERVE_FAILED
    console.error('[DEPLOYMENT_SERVE_FAILED]', {
      deploymentId,
      storageKey,
      safeRelPath,
      error: err?.message || err,
    });

    const isNotFound =
      err.name === 'NoSuchKey' ||
      err.name === 'NotFound' ||
      err.$metadata?.httpStatusCode === 404;

    if (isNotFound) {
      // SPA Fallback for extensionless client-side routes
      if (isSpaCandidate(targetRelative)) {
        try {
          const indexKey = deployment.storage_path
            ? `${deployment.storage_path.replace(/\/+$/, '')}/index.html`
            : `deployments/${orgId}/${projId}/${depId}/index.html`;
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

          console.log('[DEPLOYMENT_RESPONSE]', {
            deploymentId,
            statusCode: 200,
            contentType: 'text/html; charset=utf-8',
            contentLength: indexRes.ContentLength || 0,
            safeRelPath: 'index.html (SPA Fallback)',
          });

          if (method === 'HEAD') {
            res.end();
            return;
          }

          if (indexRes.Body) {
            if (typeof (indexRes.Body as any).transformToByteArray === 'function') {
              const bytes = await (indexRes.Body as any).transformToByteArray();
              res.end(Buffer.from(bytes));
            } else if (
              typeof (indexRes.Body as any).pipe === 'function' &&
              typeof (res as any).on === 'function'
            ) {
              (indexRes.Body as any).pipe(res);
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
        `The requested file "${targetRelative}" does not exist in deployment ${deploymentId}.`
      );
    }

    return sendHtmlPage(
      res,
      500,
      'Internal Server Error',
      'Failed to retrieve deployment file from storage.'
    );
  }
}

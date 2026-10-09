import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  getSupabaseServerClient,
  verifyUserToken,
  getSupabaseSecretKey,
  getSupabaseAnonKey,
} from './supabaseServer.js';
import {
  getR2Config,
  getR2Client,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteStorageFile,
  cleanupOrphanedObject,
  createDeploymentPresignedUploadUrl,
  createSharePresignedUrls,
  verifyR2DeploymentFile,
  uploadDeploymentFileBuffer,
  sanitizeDeploymentPath,
} from './r2Storage.js';
import {
  handleDeploymentRequest,
  cacheDeploymentRecord,
  setProductionDeployment,
  resolveProductionDeploymentId,
  storeMemoryDeploymentFile,
  getMemoryDeploymentFile,
  getMimeType,
} from './deploymentServer.js';
import {
  getShareSettings,
  setShareSettings,
} from './shareSecurity.js';
import {
  getGithubOAuthConfig,
  getGitHubAuthUrl,
  verifyOAuthState,
  getGitHubRedirectUri,
  exchangeCodeForGitHubToken,
  fetchGitHubUserProfile,
  saveGitHubConnection,
  getGitHubConnection,
  disconnectGitHubConnection,
  fetchGitHubRepositories,
  fetchGitHubBranches,
  fetchRepositoryContentsRecursive,
  verifyGitHubToken,
  formatGitHubAuthHeader,
} from './githubServer.js';

interface WaitlistEntry {
  email: string;
  source: string;
  createdAt: string;
}

interface StoredApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
}

// In-memory waitlist state during server lifetime
const waitlist: WaitlistEntry[] = [];

function parseJsonBody(req: IncomingMessage): Promise<any> {
  const existing = (req as any).body;
  if (existing !== undefined && existing !== null) {
    if (typeof existing === 'string') {
      try {
        return Promise.resolve(JSON.parse(existing));
      } catch {
        return Promise.resolve({});
      }
    }
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

function sendHtml(res: ServerResponse, statusCode: number, html: string) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(html);
}

async function resolveUserId(req: IncomingMessage): Promise<{ userId: string; token?: string }> {
  const authHeader = req.headers['authorization'] as string | undefined;
  const headerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  
  if (headerToken) {
    const verified = await verifyUserToken(authHeader);
    if (verified) {
      return { userId: verified.id, token: headerToken };
    }
  }

  const headerUserId = req.headers['x-user-id'] as string | undefined;
  return { userId: headerUserId || 'usr_dev', token: headerToken };
}

export async function getAuthenticatedUser(req: IncomingMessage): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers['authorization'] as string | undefined;
  const headerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (headerToken) {
    const verified = await verifyUserToken(authHeader);
    if (verified) return verified;
  }
  const headerUserId = (req.headers['x-user-id'] as string | undefined)?.trim();
  if (headerUserId) return { id: headerUserId };
  if (headerToken) return { id: headerToken.startsWith('usr_') ? headerToken : 'usr_dev' };
  return null;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const url = req.url || '';
  const hostHeader = (
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    ''
  ).toLowerCase().split(':')[0];

  // 0. Host-based deployed sites (*.host.doy.best, *.host.optic.doy.best, *.host.localhost, or any *.host.*)
  // or explicit /api/deployments/:deploymentId/* paths must enter public static file serving directly.
  // Never let the Vite SPA fallback capture deployed-site requests.
  const isDeployedHost =
    hostHeader.includes('.host.') ||
    hostHeader.endsWith('.host.doy.best') ||
    hostHeader.endsWith('.host.optic.doy.best') ||
    hostHeader.endsWith('.host.localhost');

  if (
    isDeployedHost ||
    url.startsWith('/api/deployments')
  ) {
    try {
      await handleDeploymentRequest(req, res);
    } catch (serveErr: any) {
      console.error('[DEPLOYMENT_SERVING_ERROR]', serveErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<h1>500 Internal Server Error</h1><p>Failed to serve deployment.</p>');
      }
    }
    return;
  }

  if (!url.startsWith('/api')) {
    return next();
  }

  const method = req.method || 'GET';

  // Handle CORS Preflight for all API routes
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    res.end();
    return;
  }

  let pathname = '';
  let action = '';
  try {
    const parsed = new URL(url, 'http://localhost');
    pathname = parsed.pathname;
    action = (parsed.searchParams.get('action') || '').toLowerCase().trim();
  } catch {
    pathname = url.split('?')[0];
  }

  // 1. POST /api/waitlist
  if ((pathname === '/api/waitlist' || pathname === '/v1/waitlist') && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();

      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Please provide a valid developer email address.',
        });
      }

      // Check duplicate
      const exists = waitlist.some((w) => w.email === email);
      if (exists) {
        return sendJson(res, 200, {
          success: true,
          message: "You're already on the Optic early access waitlist.",
        });
      }

      // Store in list
      waitlist.push({
        email,
        source: body.source || 'landing_page',
        createdAt: new Date().toISOString(),
      });

      return sendJson(res, 200, {
        success: true,
        message: "You're on the waitlist. We'll invite you to the private beta soon.",
      });
    } catch {
      return sendJson(res, 500, { success: false, error: 'Internal server error' });
    }
  }

  // 2. POST /api/keys/create or /api/keys?action=create
  if (
    ((pathname === '/api/keys' && (action === 'create' || !action)) ||
      pathname === '/api/keys/create') &&
    method === 'POST'
  ) {
    try {
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      const { userId, token } = await resolveUserId(req);

      if (!name) {
        return sendJson(res, 400, {
          success: false,
          error: 'API key name is required.',
        });
      }

      // Cryptographically secure token generation (32 bytes entropy)
      const randomEntropy = crypto.randomBytes(24).toString('hex');
      const rawKey = `opt_live_${randomEntropy}`;
      const keyPrefix = `opt_live_${randomEntropy.substring(0, 8)}...`;
      // Cryptographically secure sha256 hash before storing - NEVER store the raw key
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const id = 'key_' + crypto.randomBytes(8).toString('hex');
      const createdAt = new Date().toISOString();

      // Insert into Supabase api_keys table
      const sb = getSupabaseServerClient(token);
      if (!sb) {
        console.error('[API /api/keys/create] Supabase server client unavailable.');
        return sendJson(res, 500, {
          success: false,
          error: 'Supabase server client is not available. Please verify your Supabase configuration.',
        });
      }

      const { data, error } = await sb
        .from('api_keys')
        .insert({
          user_id: userId,
          name,
          key_hash: keyHash,
        })
        .select()
        .single();

      if (error) {
        console.error('[API /api/keys/create] Supabase error inserting api_key:', error);
        return sendJson(res, 500, {
          success: false,
          error: error.message || 'Database error creating API key',
        });
      }

      return sendJson(res, 201, {
        success: true,
        key: {
          id: data.id,
          name: data.name,
          rawKey, // returned ONLY once
          keyPrefix,
          createdAt: data.created_at,
        },
      });
    } catch (err: any) {
      console.error('[API /api/keys/create] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to create key' });
    }
  }

  // 3. GET /api/keys/list or /api/keys?action=list
  if (
    ((pathname === '/api/keys' && (action === 'list' || !action)) ||
      pathname === '/api/keys/list') &&
    method === 'GET'
  ) {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);

      if (!sb) {
        console.error('[API /api/keys/list] Supabase server client unavailable.');
        return sendJson(res, 500, {
          success: false,
          error: 'Supabase server client is not available.',
        });
      }

      // STRICT: select only existing columns: id, name, created_at, last_used_at
      // NEVER select or return key_hash
      const { data, error } = await sb
        .from('api_keys')
        .select('id, name, created_at, last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[API /api/keys/list] Supabase error listing api_keys:', error);
        return sendJson(res, 500, {
          success: false,
          error: error.message || 'Database error fetching API keys',
        });
      }

      const keys = (data || []).map((k: any) => ({
        id: k.id,
        name: k.name,
        keyPrefix: `opt_live_${k.id.substring(0, 8)}...`,
        status: 'active',
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      }));
      return sendJson(res, 200, { success: true, keys });
    } catch (err: any) {
      console.error('[API /api/keys/list] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to list keys' });
    }
  }

  // 4. POST /api/keys/revoke or /api/keys?action=revoke
  if (
    ((pathname === '/api/keys' && action === 'revoke') ||
      pathname === '/api/keys/revoke') &&
    method === 'POST'
  ) {
    try {
      const body = await parseJsonBody(req);
      const { id } = body;
      const { userId, token } = await resolveUserId(req);

      if (!id) {
        return sendJson(res, 400, { success: false, error: 'Key id is required' });
      }

      const sb = getSupabaseServerClient(token);
      if (!sb) {
        console.error('[API /api/keys/revoke] Supabase server client unavailable.');
        return sendJson(res, 500, { success: false, error: 'Supabase server client unavailable.' });
      }

      // Since api_keys schema has no status column, revoking deletes the key record
      const { error } = await sb
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[API /api/keys/revoke] Supabase error revoking api_key:', error);
        return sendJson(res, 500, { success: false, error: error.message });
      }

      return sendJson(res, 200, { success: true, message: 'Key revoked' });
    } catch (err: any) {
      console.error('[API /api/keys/revoke] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to revoke key' });
    }
  }

  // 5. POST/DELETE /api/keys/delete or /api/keys?action=delete
  if (
    ((pathname === '/api/keys' && action === 'delete') ||
      pathname === '/api/keys/delete') &&
    (method === 'POST' || method === 'DELETE')
  ) {
    try {
      const body = await parseJsonBody(req);
      const { id } = body;
      const { userId, token } = await resolveUserId(req);

      if (!id) {
        return sendJson(res, 400, { success: false, error: 'Key id is required' });
      }

      const sb = getSupabaseServerClient(token);
      if (!sb) {
        console.error('[API /api/keys/delete] Supabase server client unavailable.');
        return sendJson(res, 500, { success: false, error: 'Supabase server client unavailable.' });
      }

      const { error } = await sb
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[API /api/keys/delete] Supabase error deleting api_key:', error);
        return sendJson(res, 500, { success: false, error: error.message });
      }

      return sendJson(res, 200, { success: true, message: 'Key deleted' });
    } catch (err: any) {
      console.error('[API /api/keys/delete] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to delete key' });
    }
  }

  // 6. GET /api/cloud/files
  if (url.startsWith('/api/cloud/files') && method === 'GET') {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);
      const urlObj = new URL(url, 'http://localhost');
      const folderId = urlObj.searchParams.get('folderId');

      if (sb) {
        try {
          let fileQuery = sb.from('files').select('*').eq('user_id', userId);
          if (folderId) {
            fileQuery = fileQuery.eq('folder_id', folderId);
          } else {
            fileQuery = fileQuery.is('folder_id', null);
          }

          let folderQuery = sb
            .from('folders')
            .select('id, user_id, parent_id, name, created_at')
            .eq('user_id', userId)
            .order('name', { ascending: true });

          if (folderId) {
            folderQuery = folderQuery.eq('parent_id', folderId);
          } else {
            folderQuery = folderQuery.is('parent_id', null);
          }

          const [filesRes, foldersRes] = await Promise.all([fileQuery, folderQuery]);

          if (filesRes.error) {
            console.error('[API /api/cloud/files] Error querying files:', filesRes.error);
          }
          if (foldersRes.error) {
            console.error('[API /api/cloud/files] Error querying folders:', foldersRes.error);
          }

          if (!filesRes.error && !foldersRes.error && (filesRes.data || foldersRes.data)) {
            const mappedFiles = (filesRes.data || []).map((f: any) => ({
              id: f.id,
              name: f.name,
              extension: f.extension || (f.name.includes('.') ? f.name.split('.').pop().toUpperCase() : ''),
              mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
              sizeBytes: Number(f.size_bytes || f.sizeBytes || 0),
              folderId: f.folder_id || f.folderId || null,
              storageKey: f.storage_key || f.storageKey || '',
              storageProvider: f.storage_provider || f.storageProvider || 'r2',
              publicUrl: f.public_url || f.publicUrl || '',
              createdAt: f.created_at || f.createdAt || new Date().toISOString(),
              updatedAt: f.updated_at || f.updatedAt || new Date().toISOString(),
              isPublic: f.is_public ?? f.isPublic ?? true,
            }));

            const mappedFolders = (foldersRes.data || []).map((fd: any) => ({
              id: fd.id,
              name: fd.name,
              parentId: fd.parent_id || fd.parentId || null,
              itemCount: 0,
              createdAt: fd.created_at || fd.createdAt || new Date().toISOString(),
            }));

            return sendJson(res, 200, {
              success: true,
              files: mappedFiles,
              folders: mappedFolders,
            });
          }
        } catch (dbErr) {
          console.error('[API /api/cloud/files] Supabase cloud files exception:', dbErr);
        }
      }

      return sendJson(res, 200, {
        success: true,
        files: [],
        folders: [],
      });
    } catch (err: any) {
      console.error('[API /api/cloud/files] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: 'Failed to fetch cloud files' });
    }
  }

  // 7. GET /api/hosting/deployments or /api/hosting?action=deployments
  if (
    ((pathname === '/api/hosting' && action === 'deployments') ||
      pathname.startsWith('/api/hosting/deployments')) &&
    method === 'GET'
  ) {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);
      const urlObj = new URL(url, 'http://localhost');
      const projectId = urlObj.searchParams.get('projectId');
      const orgId = urlObj.searchParams.get('orgId');

      if (sb) {
        try {
          let query = sb.from('deployments').select('*').order('created_at', { ascending: false });
          if (projectId) {
            query = query.eq('project_id', projectId);
          }
          if (orgId) {
            query = query.eq('organization_id', orgId);
          }

          let { data, error } = await query;
          if (error) {
            console.error('[API /api/hosting/deployments] Error querying deployments:', error.message);
          }

          if (data) {
            const mapped = data.map((d: any) => ({
              id: d.id,
              projectId: d.project_id,
              projectName: d.project_name || 'project',
              status: d.status || 'ready',
              url: d.deployment_url || d.url || '',
              deploymentUrl: d.deployment_url || d.url || '',
              storagePath: d.storage_path,
              commitHash: d.commit_hash || 'HEAD',
              commitMessage: d.commit_message || 'Deployment update',
              creator: d.creator || 'developer',
              branch: d.branch || 'main',
              durationSeconds: d.duration_seconds || 12,
              environment: d.environment || 'production',
              createdAt: d.created_at,
              completedAt: d.completed_at,
            }));
            return sendJson(res, 200, { success: true, deployments: mapped });
          }
        } catch (dbErr) {
          console.error('[API /api/hosting/deployments] Supabase exception:', dbErr);
        }
      }

      return sendJson(res, 200, {
        success: true,
        deployments: [],
      });
    } catch (err: any) {
      console.error('[API /api/hosting/deployments] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: 'Failed to fetch deployments' });
    }
  }

  // 7b. POST /api/hosting/upload-url or /api/hosting?action=upload-url
  if (
    ((pathname === '/api/hosting' && action === 'upload-url') ||
      pathname.startsWith('/api/hosting/deployments/upload-url') ||
      pathname.startsWith('/api/hosting/upload-url')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await getAuthenticatedUser(req);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to create hosting deployments.',
        });
      }

      const r2Config = getR2Config();
      const body = await parseJsonBody(req);
      const { organizationId, projectId, deploymentId, filePath, mimeType, size } = body;

      if (!organizationId || !projectId || !deploymentId || !filePath) {
        return sendJson(res, 400, {
          success: false,
          error: 'organizationId, projectId, deploymentId, and filePath are required.',
        });
      }

      const safeRelPath = sanitizeDeploymentPath(filePath);

      if (!r2Config.isConfigured) {
        // Provide direct upload endpoint on this server instance when R2 credentials are not set
        return sendJson(res, 200, {
          success: true,
          uploadUrl: `/api/hosting?action=direct-upload&deploymentId=${encodeURIComponent(deploymentId)}&filePath=${encodeURIComponent(safeRelPath)}&organizationId=${encodeURIComponent(organizationId)}&projectId=${encodeURIComponent(projectId)}`,
          storageKey: `deployments/${organizationId}/${projectId}/${deploymentId}/${safeRelPath}`,
          expiresIn: 900,
        });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createDeploymentPresignedUploadUrl({
        userId: user.id,
        organizationId,
        projectId,
        deploymentId,
        filePath: safeRelPath,
        mimeType: mimeType || 'application/octet-stream',
        size: Number(size || 0),
        userToken: token,
      });

      return sendJson(res, 200, {
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/deployments/upload-url] Error:', err);
      const message = err?.message || 'Failed to generate deployment upload URL.';
      const status =
        message.includes('permission') || message.includes('Unauthorized')
          ? 403
          : message.includes('not found') || message.includes('belong')
          ? 404
          : message.includes('too large') || message.includes('exceeds')
          ? 400
          : 500;
      return sendJson(res, status, { success: false, error: message });
    }
  }

  // 7b-2. PUT or POST /api/hosting?action=direct-upload
  if (
    ((pathname === '/api/hosting' && action === 'direct-upload') ||
      pathname.startsWith('/api/hosting/direct-upload')) &&
    (method === 'PUT' || method === 'POST')
  ) {
    try {
      const parsed = new URL(url, 'http://localhost');
      const deploymentId = parsed.searchParams.get('deploymentId') || '';
      const filePath = parsed.searchParams.get('filePath') || 'index.html';
      const organizationId = parsed.searchParams.get('organizationId') || parsed.searchParams.get('orgId') || '';
      const projectId = parsed.searchParams.get('projectId') || '';

      if (!deploymentId || !filePath) {
        return sendJson(res, 400, { success: false, error: 'deploymentId and filePath are required.' });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req as any) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      const safeRelPath = sanitizeDeploymentPath(filePath);
      const mime = (req.headers['content-type'] as string) || getMimeType(safeRelPath);

      // Store in memory cache
      storeMemoryDeploymentFile(deploymentId, safeRelPath, buffer, mime);

      // Upload to R2 if configured
      const r2Config = getR2Config();
      if (r2Config.isConfigured && organizationId && projectId) {
        const storageKey = `deployments/${organizationId}/${projectId}/${deploymentId}/${safeRelPath}`;
        try {
          await uploadDeploymentFileBuffer(storageKey, buffer, mime);
        } catch (r2Err: any) {
          console.warn('[Direct Upload] Notice saving to R2:', r2Err.message);
        }
      }

      console.log('[DIRECT_UPLOAD_SUCCESS]', {
        deploymentId,
        safeRelPath,
        size: buffer.length,
        contentType: mime,
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, uploaded: true, size: buffer.length }));
      return;
    } catch (err: any) {
      console.error('[DIRECT_UPLOAD_ERROR]', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Direct upload failed' });
    }
  }

  // 7c. POST /api/hosting/finalize or /api/hosting?action=finalize
  if (
    ((pathname === '/api/hosting' && action === 'finalize') ||
      pathname.startsWith('/api/hosting/finalize')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await getAuthenticatedUser(req);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to finalize deployments.',
        });
      }

      const body = await parseJsonBody(req);
      const { organizationId, projectId, deploymentId, filePath = 'index.html' } = body;

      if (!organizationId || !projectId || !deploymentId) {
        return sendJson(res, 400, {
          success: false,
          error: 'organizationId, projectId, and deploymentId are required.',
        });
      }

      let verification: any = null;
      const safeRelPath = sanitizeDeploymentPath(filePath);
      const memFile = getMemoryDeploymentFile(deploymentId, safeRelPath);

      if (memFile) {
        verification = {
          exists: true,
          size: memFile.size,
          storageKey: `deployments/${organizationId}/${projectId}/${deploymentId}/${safeRelPath}`,
        };
      } else {
        verification = await verifyR2DeploymentFile({
          organizationId,
          projectId,
          deploymentId,
          filePath: safeRelPath,
        });
      }

      if (!verification.exists) {
        console.error('[R2_UPLOAD_FAILED]', {
          deploymentId,
          projectId,
          organizationId,
          storageKey: verification.storageKey,
          error: verification.error || 'Object not found in storage',
        });

        // Mark as failed in Supabase
        const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
        const sb = getSupabaseServerClient(token);
        if (sb) {
          await sb
            .from('deployments')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', deploymentId);
        }

        return sendJson(res, 400, {
          success: false,
          error: `Storage verification failed: file "${filePath}" does not exist in storage at ${verification.storageKey}. Details: ${verification.error || 'Not found'}`,
        });
      }

      console.log('[STORAGE_UPLOAD_SUCCESS]', {
        deploymentId,
        projectId,
        organizationId,
        storageKey: verification.storageKey,
        size: verification.size,
      });

      // Update deployment status to ready in public.deployments
      const completedAt = new Date().toISOString();
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      const sb = getSupabaseServerClient(token);
      let projectSlug = (body.projectSlug || '').trim();

      if (sb) {
        const { error: updateErr } = await sb
          .from('deployments')
          .update({ status: 'ready', completed_at: completedAt })
          .eq('id', deploymentId);

        if (updateErr) {
          console.warn('[Supabase] Warning updating deployment status to ready:', updateErr.message);
        }

        if (!projectSlug) {
          try {
            const { data: proj } = await sb.from('projects').select('slug').eq('id', projectId).maybeSingle();
            if (proj?.slug) projectSlug = proj.slug;
          } catch {}
        }
      }

      // Update in-memory deployment cache for instant public serving
      cacheDeploymentRecord({
        id: deploymentId,
        project_id: projectId,
        organization_id: organizationId,
        status: 'ready',
        storage_path: `deployments/${organizationId}/${projectId}/${deploymentId}`,
        createdAt: Date.now(),
      });

      // Promote to production deployment
      if (projectSlug) {
        setProductionDeployment(projectId, deploymentId, projectSlug);
      }

      // Persist deployment metadata and production pointer to R2 if configured
      try {
        const r2Client = getR2Client();
        const r2Config = getR2Config();
        if (r2Client && r2Config.bucketName) {
          const metaPayload = JSON.stringify({
            id: deploymentId,
            project_id: projectId,
            organization_id: organizationId,
            status: 'ready',
            storage_path: `deployments/${organizationId}/${projectId}/${deploymentId}`,
            completed_at: completedAt,
          });
          await r2Client.send(
            new PutObjectCommand({
              Bucket: r2Config.bucketName,
              Key: `deployments/_meta/${deploymentId}.json`,
              Body: Buffer.from(metaPayload, 'utf-8'),
              ContentType: 'application/json',
            })
          );

          if (projectSlug) {
            const prodPayload = JSON.stringify({
              projectId,
              projectSlug,
              productionDeploymentId: deploymentId,
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
        }
      } catch (metaErr: any) {
        console.warn('[Optic Hosting] Notice saving deployment metadata in R2:', metaErr?.message || metaErr);
      }

      console.log('[DEPLOYMENT_READY]', {
        deploymentId,
        projectId,
        projectSlug,
        organizationId,
        status: 'ready',
        completedAt,
      });

      return sendJson(res, 200, {
        success: true,
        ready: true,
        size: verification.size,
        storageKey: verification.storageKey,
        completedAt,
        productionDomain: projectSlug ? `https://${projectSlug}.host.doy.best` : undefined,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/finalize] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to finalize deployment',
      });
    }
  }

  // 7d. POST /api/hosting/production or /api/hosting?action=set-production
  // Promotes / restores a deployment to be the active production deployment without copying files
  if (
    ((pathname === '/api/hosting' && action === 'set-production') ||
      pathname.startsWith('/api/hosting/set-production') ||
      pathname.startsWith('/api/hosting/production')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to manage production deployments.',
        });
      }

      const body = await parseJsonBody(req);
      const { projectId, deploymentId, projectSlug } = body;

      if (!projectId || !deploymentId) {
        return sendJson(res, 400, {
          success: false,
          error: 'projectId and deploymentId are required to set production target.',
        });
      }

      // Update memory cache
      setProductionDeployment(projectId, deploymentId, projectSlug);

      // Persist production target pointer in R2
      try {
        const r2Client = getR2Client();
        const r2Config = getR2Config();
        if (r2Client && r2Config.bucketName) {
          const payload = JSON.stringify({
            projectId,
            projectSlug: projectSlug || '',
            productionDeploymentId: deploymentId,
            promotedAt: new Date().toISOString(),
            promotedBy: user.id,
          });

          await r2Client.send(
            new PutObjectCommand({
              Bucket: r2Config.bucketName,
              Key: `projects/${projectId}/production.json`,
              Body: Buffer.from(payload, 'utf-8'),
              ContentType: 'application/json',
            })
          );

          if (projectSlug) {
            await r2Client.send(
              new PutObjectCommand({
                Bucket: r2Config.bucketName,
                Key: `projects/${projectSlug.toLowerCase().trim()}/production.json`,
                Body: Buffer.from(payload, 'utf-8'),
                ContentType: 'application/json',
              })
            );
          }
        }
      } catch (r2Err: any) {
        console.warn('[Optic Hosting] Notice persisting production pointer in R2:', r2Err.message);
      }

      console.log('[PRODUCTION_TARGET_UPDATED]', {
        projectId,
        projectSlug,
        productionDeploymentId: deploymentId,
      });

      return sendJson(res, 200, {
        success: true,
        projectId,
        productionDeploymentId: deploymentId,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/production] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to update production target',
      });
    }
  }

  // 7e. GET /api/hosting/production or /api/hosting?action=production
  if (
    ((pathname === '/api/hosting' && action === 'production') ||
      pathname.startsWith('/api/hosting/production')) &&
    method === 'GET'
  ) {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const projectId = urlObj.searchParams.get('projectId') || '';
      const slug = urlObj.searchParams.get('slug') || '';
      const target = projectId || slug;

      if (!target) {
        return sendJson(res, 400, {
          success: false,
          error: 'projectId or slug query parameter is required',
        });
      }

      const prodDepId = await resolveProductionDeploymentId(target);
      return sendJson(res, 200, {
        success: true,
        target,
        productionDeploymentId: prodDepId || null,
      });
    } catch (err: any) {
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to retrieve production deployment target',
      });
    }
  }

  // 8. GET /api/hosting/projects or /api/hosting?action=projects
  if (
    ((pathname === '/api/hosting' && action === 'projects') ||
      pathname.startsWith('/api/hosting/projects')) &&
    method === 'GET'
  ) {
    try {
      const { token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);
      const urlObj = new URL(url, 'http://localhost');
      const orgId = urlObj.searchParams.get('orgId');

      if (sb && orgId) {
        try {
          const { data, error } = await sb
            .from('projects')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('[API /api/hosting/projects] Error querying public.projects:', error.message);
          }

          if (data) {
            return sendJson(res, 200, { success: true, projects: data });
          }
        } catch (dbErr) {
          console.error('[API /api/hosting/projects] Supabase exception:', dbErr);
        }
      }

      return sendJson(res, 200, { success: true, projects: [] });
    } catch (err: any) {
      console.error('[API /api/hosting/projects] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: 'Failed to fetch projects' });
    }
  }

  // 8b-1. GET /api/hosting?action=github-auth-url
  if (
    ((pathname === '/api/hosting' && action === 'github-auth-url') ||
      pathname === '/api/hosting/github/auth-url' ||
      pathname.startsWith('/api/hosting/github/auth-url')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user?.id) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to Optic before connecting your GitHub account.',
        });
      }

      const config = getGithubOAuthConfig();
      if (!config.configured) {
        return sendJson(res, 200, {
          success: false,
          configured: false,
          error:
            'GitHub OAuth is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
        });
      }

      const parsedAuthUrl = new URL(url, 'http://localhost');
      const returnUrlParam = parsedAuthUrl.searchParams.get('returnUrl') || '/hosting/new';
      const { url: authUrl, state } = getGitHubAuthUrl(req, user.id, returnUrlParam);
      return sendJson(res, 200, {
        success: true,
        configured: true,
        url: authUrl,
        state,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/auth-url] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to generate GitHub authorization URL',
      });
    }
  }

  // 8b-2. GET /api/hosting/github/callback
  if (
    ((pathname === '/api/hosting' && action === 'github-callback') ||
      pathname === '/api/hosting/github/callback' ||
      pathname.startsWith('/api/hosting/github/callback')) &&
    method === 'GET'
  ) {
    try {
      const parsed = new URL(url, 'http://localhost');
      const code = parsed.searchParams.get('code');
      const state = parsed.searchParams.get('state');
      const errorParam =
        parsed.searchParams.get('error_description') ||
        parsed.searchParams.get('error');

      if (errorParam || !code || !state) {
        const errorMsg = errorParam || 'Missing OAuth authorization code or state.';
        return sendHtml(
          res,
          400,
          `<!DOCTYPE html>
<html>
<head><title>GitHub Connection Error</title></head>
<body style="background:#09090b;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;max-width:400px;border:1px solid #27272a;border-radius:12px;background:#18181b;">
    <p style="color:#ef4444;font-weight:600;margin-bottom:8px;font-size:15px;">GitHub Authorization Failed</p>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin-bottom:16px;">${errorMsg}</p>
    <button onclick="window.close()" style="background:#27272a;color:#fff;border:1px solid #3f3f46;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;">Close Window</button>
  </div>
</body>
</html>`
        );
      }

      const verifiedState = verifyOAuthState(state);
      if (!verifiedState) {
        return sendHtml(
          res,
          403,
          `<!DOCTYPE html>
<html>
<head><title>Session Mismatch</title></head>
<body style="background:#09090b;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;max-width:400px;border:1px solid #27272a;border-radius:12px;background:#18181b;">
    <p style="color:#ef4444;font-weight:600;margin-bottom:8px;font-size:15px;">Security Validation Failed</p>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin-bottom:16px;">The state parameter has expired or was tampered with. Please close this window and retry from Optic.</p>
    <button onclick="window.close()" style="background:#27272a;color:#fff;border:1px solid #3f3f46;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;">Close Window</button>
  </div>
</body>
</html>`
        );
      }

      const { userId: verifiedUserId, returnUrl } = verifiedState;
      const targetReturnUrl = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/hosting/new';

      const redirectUri = getGitHubRedirectUri(req);
      const tokenData = await exchangeCodeForGitHubToken(code, redirectUri);
      const ghUser = await fetchGitHubUserProfile(tokenData.accessToken);

      await saveGitHubConnection(verifiedUserId, {
        githubUserId: ghUser.id,
        githubUsername: ghUser.login,
        avatarUrl: ghUser.avatarUrl,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresIn ? Date.now() + tokenData.expiresIn * 1000 : undefined,
        refreshTokenExpiresAt: tokenData.refreshTokenExpiresIn ? Date.now() + tokenData.refreshTokenExpiresIn * 1000 : undefined,
        scope: tokenData.scope,
      });

      return sendHtml(
        res,
        200,
        `<!DOCTYPE html>
<html>
<head><title>GitHub Connected</title></head>
<body style="background:#09090b;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:28px;max-width:420px;border:1px solid #27272a;border-radius:14px;background:#18181b;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
    <div style="width:40px;height:40px;border-radius:50%;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:20px;">✓</div>
    <p style="font-weight:700;font-size:16px;color:#ffffff;margin:0 0 6px;">Connected as @${ghUser.login}</p>
    <p style="color:#a1a1aa;font-size:12px;margin:0 0 16px;">GitHub authorization complete. Returning to Optic...</p>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', username: '${ghUser.login}' }, '*');
        setTimeout(function() { window.close(); }, 500);
      } else {
        window.location.href = '${targetReturnUrl}';
      }
    } catch (e) {
      window.location.href = '${targetReturnUrl}';
    }
  </script>
</body>
</html>`
      );
    } catch (err: any) {
      console.error('[API /api/hosting/github/callback] Error:', err);
      const errMsg = err?.message || 'Failed to complete GitHub authorization.';
      return sendHtml(
        res,
        500,
        `<!DOCTYPE html>
<html>
<head><title>GitHub Connection Error</title></head>
<body style="background:#09090b;color:#f4f4f5;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;max-width:400px;border:1px solid #27272a;border-radius:12px;background:#18181b;">
    <p style="color:#ef4444;font-weight:600;margin-bottom:8px;font-size:15px;">GitHub Connection Error</p>
    <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin-bottom:16px;">${errMsg}</p>
    <button onclick="window.close()" style="background:#27272a;color:#fff;border:1px solid #3f3f46;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;">Close Window</button>
  </div>
</body>
</html>`
      );
    }
  }

  // 8b-3. GET /api/hosting?action=github-status
  if (
    ((pathname === '/api/hosting' && action === 'github-status') ||
      pathname === '/api/hosting/github/status' ||
      pathname.startsWith('/api/hosting/github/status')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      const config = getGithubOAuthConfig();

      if (!config.configured) {
        return sendJson(res, 200, {
          success: true,
          configured: false,
          connected: false,
        });
      }

      if (!user?.id) {
        return sendJson(res, 200, {
          success: true,
          configured: true,
          connected: false,
        });
      }

      const connection = await getGitHubConnection(user.id);
      if (!connection || !connection.accessToken) {
        return sendJson(res, 200, {
          success: true,
          configured: true,
          connected: false,
        });
      }

      // Actively verify token validity with GitHub API
      const tokenVerification = await verifyGitHubToken(connection.accessToken);
      if (!tokenVerification.valid) {
        return sendJson(res, 200, {
          success: true,
          configured: true,
          connected: false,
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      // Explicitly SANITIZED: Never send access_token to client!
      return sendJson(res, 200, {
        success: true,
        configured: true,
        connected: true,
        account: {
          username: tokenVerification.user?.login || connection.githubUsername,
          avatarUrl: connection.avatarUrl,
          githubUserId: tokenVerification.user?.id || connection.githubUserId,
          connectedAt: connection.createdAt,
        },
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/status] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to check GitHub status',
      });
    }
  }

  // 8b-4. POST /api/hosting?action=github-disconnect
  if (
    ((pathname === '/api/hosting' && action === 'github-disconnect') ||
      pathname === '/api/hosting/github/disconnect' ||
      pathname.startsWith('/api/hosting/github/disconnect')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user?.id) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }

      await disconnectGitHubConnection(user.id);
      return sendJson(res, 200, {
        success: true,
        message: 'GitHub account disconnected successfully.',
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/disconnect] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to disconnect GitHub account',
      });
    }
  }

  // 8b-5. GET /api/hosting?action=github-repos
  if (
    ((pathname === '/api/hosting' && action === 'github-repos') ||
      pathname === '/api/hosting/github/repos' ||
      pathname.startsWith('/api/hosting/github/repos')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user?.id) {
        return sendJson(res, 401, {
          success: false,
          repositories: [],
          error: 'Unauthorized. Sign in required.',
        });
      }

      const connection = await getGitHubConnection(user.id);
      if (!connection?.accessToken) {
        return sendJson(res, 401, {
          success: false,
          repositories: [],
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      const tokenVerification = await verifyGitHubToken(connection.accessToken);
      if (!tokenVerification.valid) {
        return sendJson(res, 401, {
          success: false,
          repositories: [],
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      const parsed = new URL(url, 'http://localhost');
      const searchQuery = parsed.searchParams.get('search') || undefined;
      const repos = await fetchGitHubRepositories(connection.accessToken, searchQuery);

      return sendJson(res, 200, {
        success: true,
        repositories: repos,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/repos] Error:', err);
      const isAuthError =
        err?.message?.includes('authorization expired') ||
        err?.message?.includes('Bad credentials') ||
        err?.message?.includes('401');
      return sendJson(res, isAuthError ? 401 : 500, {
        success: false,
        repositories: [],
        error: isAuthError
          ? 'GitHub authorization expired/reconnect GitHub'
          : err?.message || 'Failed to fetch GitHub repositories.',
      });
    }
  }

  // 8b-6. GET /api/hosting?action=github-branches
  if (
    ((pathname === '/api/hosting' && action === 'github-branches') ||
      pathname === '/api/hosting/github/branches' ||
      pathname.startsWith('/api/hosting/github/branches')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user?.id) {
        return sendJson(res, 401, {
          success: false,
          branches: [],
          error: 'Unauthorized. Sign in required.',
        });
      }

      const connection = await getGitHubConnection(user.id);
      if (!connection?.accessToken) {
        return sendJson(res, 401, {
          success: false,
          branches: [],
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      const tokenVerification = await verifyGitHubToken(connection.accessToken);
      if (!tokenVerification.valid) {
        return sendJson(res, 401, {
          success: false,
          branches: [],
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      const parsed = new URL(url, 'http://localhost');
      const owner = parsed.searchParams.get('owner') || '';
      const repo = parsed.searchParams.get('repo') || '';

      if (!owner || !repo) {
        return sendJson(res, 400, {
          success: false,
          branches: [],
          error: 'Both owner and repo are required query parameters.',
        });
      }

      const branches = await fetchGitHubBranches(connection.accessToken, owner, repo);
      return sendJson(res, 200, {
        success: true,
        branches,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/branches] Error:', err);
      const isAuthError =
        err?.message?.includes('authorization expired') ||
        err?.message?.includes('Bad credentials') ||
        err?.message?.includes('401');
      return sendJson(res, isAuthError ? 401 : 500, {
        success: false,
        branches: [],
        error: isAuthError
          ? 'GitHub authorization expired/reconnect GitHub'
          : err?.message || 'Failed to fetch repository branches.',
      });
    }
  }

  // 8b-7. POST /api/hosting?action=github-save-project
  if (
    ((pathname === '/api/hosting' && action === 'github-save-project') ||
      pathname === '/api/hosting/github/save-project' ||
      pathname.startsWith('/api/hosting/github/save-project')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await getAuthenticatedUser(req);
      if (!user?.id) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }

      const body = await parseJsonBody(req);
      const {
        orgId,
        name,
        slug,
        description,
        framework,
        gitRepo,
        gitBranch,
        buildCommand,
        outputDirectory,
        rootDirectory,
      } = body;

      if (!name || !gitRepo) {
        return sendJson(res, 400, {
          success: false,
          error: 'Project name and Git repository are required.',
        });
      }

      const cleanSlug = (
        slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      )
        .replace(/^-|-$/g, '')
        .toLowerCase();

      const sb = getSupabaseServerClient();
      let projectRecord: any = null;

      const rawGitRepo = (gitRepo || '').trim();
      const owner = (body.owner || (rawGitRepo.includes('/') ? rawGitRepo.split('/')[0] : '')).trim();
      const repoName = (body.repoName || (rawGitRepo.includes('/') ? rawGitRepo.split('/')[1] : rawGitRepo)).trim();
      const fullName = owner && repoName ? `${owner}/${repoName}` : rawGitRepo;
      const selectedBranch = (gitBranch || body.selectedBranch || 'main').trim();
      const defaultBranch = (body.defaultBranch || selectedBranch || 'main').trim();

      if (sb) {
        try {
          // STRICT: Canonical projects table schema has NO git_branch column
          const projectPayload = {
            user_id: user.id,
            organization_id: orgId,
            name: name.trim(),
            slug: cleanSlug,
            description: description?.trim() || null,
          };

          const { data: projData, error: projErr } = await sb
            .from('projects')
            .insert(projectPayload)
            .select()
            .maybeSingle();

          if (projErr) {
            throw projErr;
          }

          projectRecord = projData;

          // Link to github_repositories
          if (projectRecord?.id && fullName) {
            // Find user connection ID
            const { data: conn } = await sb
              .from('github_connections')
              .select('id')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const now = new Date().toISOString();
            const { error: repoErr } = await sb
              .from('github_repositories')
              .insert({
                connection_id: conn?.id || null,
                project_id: projectRecord.id,
                github_repo_id: body.githubRepoId || 0,
                owner,
                name: repoName,
                full_name: fullName,
                default_branch: defaultBranch,
                selected_branch: selectedBranch,
                created_at: now,
                updated_at: now,
              });

            if (repoErr) {
              console.warn('[API /api/hosting/github/save-project] Notice creating github_repositories record:', repoErr.message);
            }
          }
        } catch (dbErr: any) {
          console.warn('[API /api/hosting/github/save-project] DB exception:', dbErr.message);
        }
      }

      const fallbackProject = {
        id: projectRecord?.id || 'proj_' + crypto.randomBytes(6).toString('hex'),
        organization_id: orgId,
        name: name.trim(),
        slug: cleanSlug,
        description: description?.trim() || undefined,
        framework: framework || 'react',
        productionDomain: `https://${cleanSlug}.host.doy.best`,
        assignedSubdomain: `${cleanSlug}.host.doy.best`,
        customDomains: [],
        gitRepo: fullName,
        gitBranch: selectedBranch,
        gitProvider: 'github',
        gitOwner: owner,
        gitRepoName: repoName,
        buildCommand,
        outputDirectory,
        rootDirectory,
        status: 'ready',
        createdAt: projectRecord?.created_at || new Date().toISOString(),
        updatedAt: projectRecord?.updated_at || new Date().toISOString(),
      };

      return sendJson(res, 200, {
        success: true,
        project: fallbackProject,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/save-project] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to save GitHub project configuration.',
      });
    }
  }

  // 8b-8. POST /api/hosting?action=github-deploy
  if (
    ((pathname === '/api/hosting' && action === 'github-deploy') ||
      pathname === '/api/hosting/github/deploy' ||
      pathname.startsWith('/api/hosting/github/deploy')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await getAuthenticatedUser(req);
      if (!user?.id) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized. Sign in required.' });
      }

      const body = await parseJsonBody(req);
      const {
        projectId,
        organizationId,
        branch,
        deploymentNote,
        owner: bodyOwner,
        repo: bodyRepo,
        projectSlug: bodySlug,
      } = body;

      if (!projectId) {
        return sendJson(res, 400, { success: false, error: 'projectId is required.' });
      }

      const sb = getSupabaseServerClient();
      let projectData: any = null;
      let ghRepoData: any = null;

      if (sb) {
        // Query project (NO projects.git_branch query)
        try {
          const { data: p } = await sb
            .from('projects')
            .select('id, user_id, organization_id, name, slug')
            .eq('id', projectId)
            .maybeSingle();
          projectData = p;
        } catch (pErr: any) {
          console.warn('[GITHUB_DEPLOY] DB project query notice:', pErr.message);
        }

        // Query linked github repository from github_repositories
        try {
          const { data: gr } = await sb
            .from('github_repositories')
            .select('*')
            .eq('project_id', projectId)
            .maybeSingle();
          ghRepoData = gr;
        } catch (grErr: any) {
          console.warn('[GITHUB_DEPLOY] DB github_repositories query notice:', grErr.message);
        }
      }

      const orgId = organizationId || projectData?.organization_id || body.orgId || 'org_default';
      const projectSlug = (projectData?.slug || bodySlug || projectId)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '');

      let owner = (bodyOwner || ghRepoData?.owner || '').trim();
      let repoName = (bodyRepo || ghRepoData?.name || '').trim();

      if (!owner || !repoName) {
        const fullName = ghRepoData?.full_name || '';
        if (fullName.includes('/')) {
          owner = fullName.split('/')[0].trim();
          repoName = fullName.split('/')[1].trim();
        }
      }

      // Selected branch strictly from github_repositories.selected_branch (or passed override)
      const targetBranch = (
        branch ||
        ghRepoData?.selected_branch ||
        ghRepoData?.default_branch ||
        'main'
      ).trim();

      if (!owner || !repoName) {
        return sendJson(res, 400, {
          success: false,
          error:
            'No GitHub repository linked to this project. Please connect a repository with owner and name.',
        });
      }

      // Retrieve GitHub connection for the authenticated user
      const connection = await getGitHubConnection(user.id);
      if (!connection?.accessToken) {
        return sendJson(res, 401, {
          success: false,
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      // Verify the credential is valid before downloading the repository
      const tokenVerification = await verifyGitHubToken(connection.accessToken);
      if (!tokenVerification.valid) {
        console.warn('[GITHUB_DEPLOY] GitHub token validation failed for user:', user.id);
        return sendJson(res, 401, {
          success: false,
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      console.log('[GITHUB_DEPLOY_START]', {
        projectId,
        projectSlug,
        owner,
        repo: repoName,
        branch: targetBranch,
      });

      // 1. Fetch the selected branch's ENTIRE repository recursively (preserving all relative paths)
      const { files, commitSha } = await fetchRepositoryContentsRecursive(
        connection.accessToken,
        owner,
        repoName,
        targetBranch
      );

      if (!files || files.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: `No files found in GitHub repository ${owner}/${repoName} on branch "${targetBranch}".`,
        });
      }

      console.log('[GITHUB_DEPLOY_RECURSIVE_EXTRACTED]', {
        totalFiles: files.length,
        commitSha,
        hasIndexHtml: files.some((f) => f.relativePath === 'index.html'),
        fileSample: files.slice(0, 8).map((f) => f.relativePath),
      });

      // 2. Generate deployment ID and storage path
      const deploymentId = crypto.randomUUID();
      const storagePath = `deployments/${orgId}/${projectId}/${deploymentId}`;
      const deploymentUrl = `https://${projectSlug}.host.doy.best`;

      // 3. Create initial deployment record in public.deployments
      if (sb) {
        try {
          const { error: insErr } = await sb.from('deployments').insert({
            id: deploymentId,
            project_id: projectId,
            organization_id: orgId,
            user_id: user.id,
            status: 'building',
            storage_path: storagePath,
            deployment_url: deploymentUrl,
          });

          if (insErr) {
            console.error('[GITHUB_DEPLOY] DB insert error:', insErr.message);
          }

          // Insert initial deployment logs
          await sb.from('deployment_logs').insert([
            {
              deployment_id: deploymentId,
              message: `Initiating deployment for ${owner}/${repoName}@${targetBranch}`,
              level: 'info',
              created_at: new Date().toISOString(),
            },
            {
              deployment_id: deploymentId,
              message: `Fetched ${files.length} repository file(s) from branch "${targetBranch}" (commit: ${commitSha || 'HEAD'})`,
              level: 'info',
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (dbErr: any) {
          console.warn('[GITHUB_DEPLOY] DB insert notice:', dbErr.message);
        }
      }

      // 4. Upload EVERY file to R2 storage_path (and memory edge cache)
      const r2Config = getR2Config();
      let uploadedToR2Count = 0;

      for (const file of files) {
        const safeRel = sanitizeDeploymentPath(file.relativePath);
        const mime = getMimeType(safeRel);

        // Store in memory cache for instant public serving
        storeMemoryDeploymentFile(deploymentId, safeRel, file.buffer, mime);

        // Upload to Cloudflare R2 if configured
        if (r2Config.isConfigured) {
          const key = `${storagePath}/${safeRel}`;
          try {
            await uploadDeploymentFileBuffer(key, file.buffer, mime);
            uploadedToR2Count++;
          } catch (uploadErr: any) {
            console.error('[GITHUB_DEPLOY_UPLOAD_FAIL]', {
              key,
              error: uploadErr?.message || uploadErr,
            });
            throw new Error(
              `Failed to upload ${file.relativePath} to Cloudflare R2: ${uploadErr.message}`
            );
          }
        }
      }

      console.log('[GITHUB_DEPLOY_ALL_FILES_STORED]', {
        deploymentId,
        totalFiles: files.length,
        uploadedToR2Count,
      });

      // 5. Mark deployment record READY only after every file has been successfully stored
      const completedAt = new Date().toISOString();
      if (sb) {
        try {
          const { error: upErr } = await sb
            .from('deployments')
            .update({ status: 'ready', completed_at: completedAt })
            .eq('id', deploymentId);

          if (upErr) {
            console.warn('[GITHUB_DEPLOY] DB status update notice:', upErr.message);
          }

          // Insert completion deployment logs
          await sb.from('deployment_logs').insert([
            {
              deployment_id: deploymentId,
              message: `Uploaded ${uploadedToR2Count || files.length} file(s) to edge storage (${storagePath})`,
              level: 'info',
              created_at: new Date().toISOString(),
            },
            {
              deployment_id: deploymentId,
              message: `Deployment READY. Live at ${deploymentUrl}`,
              level: 'success',
              created_at: completedAt,
            },
          ]);
        } catch (upErr: any) {
          console.warn('[GITHUB_DEPLOY] DB status update notice:', upErr.message);
        }
      }

      // Update in-memory deployment cache
      cacheDeploymentRecord({
        id: deploymentId,
        project_id: projectId,
        organization_id: orgId,
        status: 'ready',
        storage_path: storagePath,
        createdAt: Date.now(),
      });

      // Automatically promote to active production deployment
      setProductionDeployment(projectId, deploymentId, projectSlug);

      // Persist production target and deployment metadata to R2 if configured
      if (r2Config.isConfigured) {
        try {
          const r2Client = getR2Client();
          if (r2Client && r2Config.bucketName) {
            const metaPayload = JSON.stringify({
              id: deploymentId,
              project_id: projectId,
              organization_id: orgId,
              status: 'ready',
              storage_path: storagePath,
              completed_at: completedAt,
            });
            await r2Client.send(
              new PutObjectCommand({
                Bucket: r2Config.bucketName,
                Key: `deployments/_meta/${deploymentId}.json`,
                Body: Buffer.from(metaPayload, 'utf-8'),
                ContentType: 'application/json',
              })
            );

            const prodPayload = JSON.stringify({
              projectId,
              projectSlug,
              productionDeploymentId: deploymentId,
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
        } catch (metaErr: any) {
          console.warn('[GITHUB_DEPLOY] Notice persisting metadata in R2:', metaErr.message);
        }
      }

      console.log('[GITHUB_DEPLOY_READY]', {
        deploymentId,
        projectId,
        projectSlug,
        totalFiles: files.length,
        productionDomain: `https://${projectSlug}.host.doy.best`,
      });

      return sendJson(res, 200, {
        success: true,
        deploymentId,
        fileCount: files.length,
        commitSha,
        branch: targetBranch,
        status: 'ready',
        deploymentUrl,
        productionDomain: `https://${projectSlug}.host.doy.best`,
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/deploy] Error:', err);
      const isAuthError =
        err?.message?.includes('authorization expired') ||
        err?.message?.includes('Bad credentials') ||
        err?.message?.includes('401');
      return sendJson(res, isAuthError ? 401 : 500, {
        success: false,
        error: isAuthError
          ? 'GitHub authorization expired/reconnect GitHub'
          : err?.message || 'Failed to deploy GitHub repository.',
      });
    }
  }

  // 8b-9. GET /api/hosting?action=github-test-zipball
  if (
    ((pathname === '/api/hosting' && action === 'github-test-zipball') ||
      pathname === '/api/hosting/github/test-zipball' ||
      pathname.startsWith('/api/hosting/github/test-zipball')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user?.id) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized. Sign in required.' });
      }

      const connection = await getGitHubConnection(user.id);
      if (!connection?.accessToken) {
        return sendJson(res, 401, {
          success: false,
          error: 'GitHub authorization expired/reconnect GitHub',
        });
      }

      const parsed = new URL(url, 'http://localhost');
      const owner = parsed.searchParams.get('owner') || '';
      const repo = parsed.searchParams.get('repo') || '';
      const ref = parsed.searchParams.get('ref') || 'main';

      if (!owner || !repo) {
        return sendJson(res, 400, {
          success: false,
          error: 'Both owner and repo are required query parameters.',
        });
      }

      const { files, commitSha } = await fetchRepositoryContentsRecursive(
        connection.accessToken,
        owner,
        repo,
        ref
      );

      return sendJson(res, 200, {
        success: true,
        fileCount: files.length,
        commitSha,
        sampleFiles: files.slice(0, 5).map((f) => f.relativePath),
      });
    } catch (err: any) {
      console.error('[API /api/hosting/github/test-zipball] Error:', err);
      const isAuthError =
        err?.message?.includes('authorization expired') ||
        err?.message?.includes('Bad credentials') ||
        err?.message?.includes('401');
      return sendJson(res, isAuthError ? 401 : 500, {
        success: false,
        error: isAuthError
          ? 'GitHub authorization expired/reconnect GitHub'
          : err?.message || 'Failed to test repository zipball.',
      });
    }
  }

  // 9. GET /api/organizations
  if (
    (pathname === '/api/organizations' ||
      pathname.startsWith('/api/organizations')) &&
    method === 'GET'
  ) {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);

      if (sb && userId) {
        try {
          const orgMap = new Map<string, any>();

          // Query organizations where user is a member
          const { data: memberData, error: memErr } = await sb
            .from('organizations')
            .select('*, organization_members!inner(user_id, role)')
            .eq('organization_members.user_id', userId);

          if (!memErr && memberData) {
            for (const item of memberData) {
              orgMap.set(item.id, item);
            }
          }

          // Also query organizations created by the user directly
          const { data: createdData, error: createErr } = await sb
            .from('organizations')
            .select('*')
            .eq('created_by', userId);

          if (!createErr && createdData) {
            for (const item of createdData) {
              if (!orgMap.has(item.id)) {
                orgMap.set(item.id, {
                  ...item,
                  organization_members: [{ user_id: userId, role: 'owner' }],
                });
              }
            }
          }

          return sendJson(res, 200, { success: true, organizations: Array.from(orgMap.values()) });
        } catch (dbErr) {
          console.error('[API /api/organizations] Supabase exception:', dbErr);
        }
      }

      return sendJson(res, 200, { success: true, organizations: [] });
    } catch (err: any) {
      console.error('[API /api/organizations] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: 'Failed to fetch organizations' });
    }
  }

  // 9b. GET/POST /api/domains
  if (pathname === '/api/domains' || pathname.startsWith('/api/domains')) {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);
      const parsed = new URL(url, 'http://localhost');
      const projectId = parsed.searchParams.get('projectId');
      const domainParam = parsed.searchParams.get('domain');

      if (method === 'GET') {
        if (!sb) {
          return sendJson(res, 200, { success: true, domains: [] });
        }
        let query = sb.from('domains').select('*').order('created_at', { ascending: false });
        if (projectId) {
          query = query.eq('project_id', projectId);
        } else if (userId && userId !== 'usr_dev') {
          query = query.eq('user_id', userId);
        }
        const { data, error } = await query;
        if (error) {
          console.error('[API /api/domains] Error querying domains:', error);
          return sendJson(res, 500, { success: false, error: error.message });
        }
        return sendJson(res, 200, { success: true, domains: data || [] });
      }

      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const domain = (body.domain || domainParam || '').trim().toLowerCase();
        if (!domain) {
          return sendJson(res, 400, { success: false, error: 'Domain name is required' });
        }
        return sendJson(res, 200, {
          success: true,
          domain,
          verified: false,
          configured: true,
          dns: {
            type: 'CNAME',
            name: domain,
            target: 'cname.optic.doy.best',
            status: 'pending_verification',
          },
        });
      }
    } catch (err: any) {
      console.error('[API /api/domains] Error:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to process domain request' });
    }
  }

  // 9b. GET /api/storage/share or /api/share or /api/storage?action=share
  if (
    ((pathname === '/api/storage' && action === 'share') ||
      pathname.startsWith('/api/storage/share') ||
      pathname.startsWith('/api/share')) &&
    method === 'GET'
  ) {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      let rawToken = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('id');
      if (!rawToken && parsedUrl.pathname !== '/api/storage/share') {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        // e.g. ['api', 'storage', 'share', 'abc123']
        if (parts.length >= 4) {
          rawToken = parts[3];
        }
      }

      let token = '';
      if (rawToken) {
        try {
          token = decodeURIComponent(rawToken).trim();
        } catch {
          token = rawToken.trim();
        }
      }

      if (!token) {
        return sendJson(res, 400, {
          success: false,
          error: 'Share token is required.',
        });
      }

      // Supabase server client (uses service role key to query public.share_links & public.files for unauthenticated visitors)
      const sb = getSupabaseServerClient();
      if (!sb) {
        console.error('[API /api/storage/share] Database server client is not available.');
        return sendJson(res, 503, {
          success: false,
          error: 'Database connection unavailable.',
        });
      }

      // 1. Find share_links row by token: SELECT * FROM public.share_links WHERE token = '<TOKEN>'
      const { data: shareLink, error: shareErr } = await sb
        .from('share_links')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (shareErr) {
        console.error('[API /api/storage/share] Supabase query error fetching share_link:', shareErr);
        return sendJson(res, 500, {
          success: false,
          error: `Database error looking up share link: ${shareErr.message || 'Lookup failed'}`,
        });
      }

      if (!shareLink) {
        return sendJson(res, 404, {
          success: false,
          notFound: true,
          error: 'File not found.',
        });
      }

      // 2. Check if expired
      if (shareLink.expires_at) {
        const isExpired = new Date(shareLink.expires_at).getTime() < Date.now();
        if (isExpired) {
          return sendJson(res, 410, {
            success: false,
            expired: true,
            error: 'This link has expired.',
          });
        }
      }

      // 3. Fetch associated file: SELECT * FROM public.files WHERE id = '<share_links.file_id>'
      const { data: file, error: fileErr } = await sb
        .from('files')
        .select('*')
        .eq('id', shareLink.file_id)
        .maybeSingle();

      if (fileErr) {
        console.error('[API /api/storage/share] Supabase query error fetching file:', fileErr);
        return sendJson(res, 500, {
          success: false,
          error: `Database error fetching file: ${fileErr.message || 'Lookup failed'}`,
        });
      }

      if (!file) {
        return sendJson(res, 404, {
          success: false,
          notFound: true,
          error: 'File not found.',
        });
      }

      // 4. Retrieve uploader's display name from profiles table (explicitly do NOT expose email)
      let uploaderName = 'Optic User';
      if (file.user_id) {
        try {
          const { data: profile } = await sb
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', file.user_id)
            .maybeSingle();

          if (profile) {
            uploaderName = profile.full_name || 'Optic User';
          }
        } catch (pErr) {
          console.warn('[API /api/storage/share] Profile query warning:', pErr);
        }
      }

      // 5. Check Access Control & Password Protection Settings
      const shareSettings = await getShareSettings(token);
      const isPasswordProtected = shareSettings?.accessLevel === 'password' && Boolean(shareSettings?.password);

      // Authenticate requesting user if token is present in header
      const authHeader = req.headers['authorization'] as string | undefined;
      const currentUser = await verifyUserToken(authHeader);
      const isOwner = Boolean(
        currentUser &&
        currentUser.id &&
        (currentUser.id === file.user_id || currentUser.id === shareLink.user_id)
      );

      const providedPassword = (
        parsedUrl.searchParams.get('password') ||
        (req.headers['x-share-password'] as string) ||
        ''
      ).trim();

      const passwordMatches =
        isPasswordProtected &&
        Boolean(providedPassword) &&
        Boolean(shareSettings?.password) &&
        providedPassword === shareSettings?.password;

      // Access is granted if not protected, if user is owner, or if password matches
      const isUnlocked = !isPasswordProtected || isOwner || passwordMatches;

      const safeExtension =
        (file as any).extension ||
        (file.name && file.name.includes('.') ? file.name.split('.').pop() || '' : '');

      // If locked, return metadata only (do NOT generate or leak presigned URLs)
      if (!isUnlocked) {
        return sendJson(res, 200, {
          success: true,
          isProtected: true,
          requiresPassword: true,
          isUnlocked: false,
          isOwner: false,
          share: {
            token: shareLink.token,
            expiresAt: shareLink.expires_at || null,
            createdAt: shareLink.created_at,
            accessLevel: 'password',
            hasPassword: true,
          },
          file: {
            id: file.id,
            name: file.name,
            extension: safeExtension,
            mimeType: file.mime_type || 'application/octet-stream',
            sizeBytes: Number(file.size_bytes) || 0,
            createdAt: file.created_at,
            updatedAt: file.updated_at,
            userId: file.user_id,
          },
          uploader: {
            name: uploaderName,
          },
          error: providedPassword ? 'Incorrect access password. Please try again.' : undefined,
        });
      }

      // 6. Generate short-lived presigned GET URLs from R2 for unlocked access
      let previewUrl = '';
      let downloadUrl = '';
      const r2Config = getR2Config();

      if (r2Config.isConfigured && file.storage_key) {
        try {
          const urls = await createSharePresignedUrls({
            storageKey: file.storage_key,
            filename: file.name,
            mimeType: file.mime_type || 'application/octet-stream',
          });
          previewUrl = urls.previewUrl;
          downloadUrl = urls.downloadUrl;
        } catch (r2Err) {
          console.error('[API /api/storage/share] Presigned URL error:', r2Err);
        }
      }

      // Fallback preview/download URL if public_url is present on file row
      if (!previewUrl && (file as any).public_url) {
        previewUrl = (file as any).public_url;
        downloadUrl = (file as any).public_url;
      }

      // If ?download=1 was requested directly, redirect to download URL
      const isDownloadRedirect =
        parsedUrl.searchParams.get('download') === '1' ||
        parsedUrl.pathname.endsWith('/download');

      if (isDownloadRedirect && downloadUrl) {
        res.writeHead(302, { Location: downloadUrl });
        return res.end();
      }

      return sendJson(res, 200, {
        success: true,
        isProtected: isPasswordProtected,
        requiresPassword: false,
        isUnlocked: true,
        isOwner,
        share: {
          token: shareLink.token,
          expiresAt: shareLink.expires_at || null,
          createdAt: shareLink.created_at,
          accessLevel: isPasswordProtected ? 'password' : 'public',
          hasPassword: isPasswordProtected,
        },
        file: {
          id: file.id,
          name: file.name,
          extension: safeExtension,
          mimeType: file.mime_type || 'application/octet-stream',
          sizeBytes: Number(file.size_bytes) || 0,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
          userId: file.user_id,
        },
        uploader: {
          name: uploaderName,
        },
        previewUrl,
        downloadUrl,
      });
    } catch (err: any) {
      console.error('[API /api/storage/share] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to process share link',
      });
    }
  }

  // 9c. POST /api/share/settings or /api/storage?action=share-settings
  if (
    ((pathname === '/api/storage' && action === 'share-settings') ||
      pathname === '/api/share/settings' ||
      pathname.startsWith('/api/share/settings')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);
      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to update file access settings.',
        });
      }

      const body = await parseJsonBody(req);
      const { token, fileId, accessLevel, password, expiresInHours } = body;

      if (!token) {
        return sendJson(res, 400, {
          success: false,
          error: 'Share token is required.',
        });
      }

      const level = accessLevel === 'password' ? 'password' : 'public';
      const cleanPassword = level === 'password' ? (password || '').trim() : undefined;

      if (level === 'password' && !cleanPassword) {
        return sendJson(res, 400, {
          success: false,
          error: 'A password is required for password-protected access.',
        });
      }

      const saved = await setShareSettings({
        token,
        fileId: fileId || '',
        accessLevel: level,
        password: cleanPassword,
      });

      // Optionally update expiration in share_links if requested
      if (expiresInHours !== undefined) {
        const sb = getSupabaseServerClient();
        if (sb) {
          const newExpiresAt =
            expiresInHours && expiresInHours > 0
              ? new Date(Date.now() + expiresInHours * 3600000).toISOString()
              : null;
          await sb
            .from('share_links')
            .update({ expires_at: newExpiresAt })
            .eq('token', token);
        }
      }

      return sendJson(res, 200, {
        success: true,
        settings: {
          token: saved.token,
          accessLevel: saved.accessLevel,
          hasPassword: Boolean(saved.password),
          updatedAt: saved.updatedAt,
        },
      });
    } catch (err: any) {
      console.error('[API /api/share/settings] Error:', err);
      return sendJson(res, 500, {
        success: false,
        error: err?.message || 'Failed to update share settings.',
      });
    }
  }

  // 10. POST /api/storage/upload-url or /api/storage?action=upload-url
  if (
    ((pathname === '/api/storage' && action === 'upload-url') ||
      pathname.startsWith('/api/storage/upload-url')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to upload files.',
        });
      }

      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return sendJson(res, 503, {
          success: false,
          error:
            'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
        });
      }

      const body = await parseJsonBody(req);
      const { name, mimeType, size, folderId } = body;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createPresignedUploadUrl({
        userId: user.id,
        name,
        mimeType,
        size: Number(size),
        folderId: folderId || null,
        userToken: token,
      });

      return sendJson(res, 200, {
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage/upload-url] Error:', err);
      const message = err?.message || 'Failed to generate upload URL.';
      const status =
        message.includes('permission') || message.includes('Unauthorized')
          ? 403
          : message.includes('not found')
          ? 404
          : message.includes('too large') || message.includes('type') || message.includes('cannot be empty')
          ? 400
          : message.includes('Storage is not configured')
          ? 503
          : 500;
      return sendJson(res, status, { success: false, error: message });
    }
  }

  // 11. GET /api/storage/download or /api/storage?action=download
  if (
    ((pathname === '/api/storage' && action === 'download') ||
      pathname.startsWith('/api/storage/download')) &&
    method === 'GET'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to download files.',
        });
      }

      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return sendJson(res, 503, {
          success: false,
          error:
            'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
        });
      }

      const parsedUrl = new URL(url, 'http://localhost');
      let fileId = parsedUrl.searchParams.get('fileId') || parsedUrl.searchParams.get('id');
      if (!fileId && parsedUrl.pathname !== '/api/storage/download' && parsedUrl.pathname !== '/api/storage') {
        const parts = parsedUrl.pathname.split('/');
        fileId = parts[parts.length - 1];
      }

      if (!fileId) {
        return sendJson(res, 400, { success: false, error: 'fileId parameter is required.' });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createPresignedDownloadUrl({
        userId: user.id,
        fileId,
        userToken: token,
      });

      return sendJson(res, 200, {
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage/download] Error:', err);
      const message = err?.message || 'Failed to generate download URL.';
      const status = message.includes('permission')
        ? 403
        : message.includes('not found')
        ? 404
        : message.includes('Storage is not configured')
        ? 503
        : 500;
      return sendJson(res, status, { success: false, error: message });
    }
  }

  // 12. DELETE /api/storage/files or /api/storage?action=delete
  if (
    ((pathname === '/api/storage' && (action === 'delete' || action === 'files')) ||
      pathname.startsWith('/api/storage/files')) &&
    (method === 'DELETE' || method === 'POST')
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to delete files.',
        });
      }

      const parsedUrl = new URL(url, 'http://localhost');
      let fileId = parsedUrl.searchParams.get('fileId') || parsedUrl.searchParams.get('id');
      if (!fileId && parsedUrl.pathname !== '/api/storage/files' && parsedUrl.pathname !== '/api/storage') {
        const parts = parsedUrl.pathname.split('/');
        fileId = parts[parts.length - 1];
      }

      if (!fileId && method === 'POST') {
        const body = await parseJsonBody(req);
        fileId = body.fileId || body.id;
      }

      if (!fileId) {
        return sendJson(res, 400, { success: false, error: 'fileId is required.' });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await deleteStorageFile({
        userId: user.id,
        fileId,
        userToken: token,
      });

      return sendJson(res, 200, {
        message: 'File deleted successfully from R2 and database.',
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage/files] Error:', err);
      const message = err?.message || 'Failed to delete file.';
      const status = message.includes('permission')
        ? 403
        : message.includes('not found')
        ? 404
        : 500;
      return sendJson(res, status, { success: false, error: message });
    }
  }

  // 13. GET /api/status, /api/health, or /api/storage?action=status
  const isStatusEndpoint =
    (url === '/api/status' ||
      url.startsWith('/api/status?') ||
      url === '/api/health' ||
      url.startsWith('/api/health?') ||
      url.startsWith('/api/storage/status') ||
      (pathname === '/api/storage' && action === 'status')) &&
    method === 'GET';

  if (isStatusEndpoint) {
    const config = getR2Config();
    const hasDb = Boolean(getSupabaseSecretKey() || getSupabaseAnonKey());
    return sendJson(res, 200, {
      status: 'ok',
      success: true,
      service: 'Optic Cloud & Edge Platform',
      timestamp: new Date().toISOString(),
      isConfigured: config.isConfigured,
      storage: {
        provider: 'Cloudflare R2',
        configured: config.isConfigured,
        bucket: config.bucketName || null,
        hasAccountId: Boolean(config.accountId),
        hasAccessKey: Boolean(config.accessKeyId),
        hasSecretKey: Boolean(config.secretAccessKey),
      },
      database: {
        provider: 'Supabase PostgreSQL',
        configured: hasDb,
      },
      notice: config.isConfigured
        ? 'Cloudflare R2 is configured and ready.'
        : 'Cloudflare R2 server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
    });
  }

  // 14. POST /api/storage/cleanup-orphan or /api/storage?action=cleanup-orphan
  if (
    ((pathname === '/api/storage' && action === 'cleanup-orphan') ||
      pathname.startsWith('/api/storage/cleanup-orphan')) &&
    method === 'POST'
  ) {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized.' });
      }

      const body = await parseJsonBody(req);
      const { storageKey } = body;

      if (!storageKey) {
        return sendJson(res, 400, { success: false, error: 'storageKey is required.' });
      }

      const cleaned = await cleanupOrphanedObject({
        userId: user.id,
        storageKey,
      });

      return sendJson(res, 200, { success: true, cleaned });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to cleanup object.' });
    }
  }

  return next();
}

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
} from './r2Storage.js';
import {
  handleDeploymentRequest,
  cacheDeploymentRecord,
  setProductionDeployment,
  resolveProductionDeploymentId,
} from './deploymentServer.js';
import {
  getShareSettings,
  setShareSettings,
} from './shareSecurity.js';

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

  // 0. Host-based deployed sites (*.host.doy.best, *.host.optic.doy.best, *.host.localhost)
  // or explicit /api/deployments/:deploymentId/* paths must enter public static file serving directly.
  // Never let the Vite SPA fallback capture deployed-site requests.
  const isDeployedHost =
    hostHeader.endsWith('.host.doy.best') ||
    hostHeader.endsWith('.host.optic.doy.best') ||
    hostHeader.endsWith('.host.localhost');

  if (
    isDeployedHost ||
    url.startsWith('/api/deployments')
  ) {
    return handleDeploymentRequest(req, res);
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
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized. Please sign in to create hosting deployments.',
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
      const { organizationId, projectId, deploymentId, filePath, mimeType, size } = body;

      if (!organizationId || !projectId || !deploymentId || !filePath) {
        return sendJson(res, 400, {
          success: false,
          error: 'organizationId, projectId, deploymentId, and filePath are required.',
        });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createDeploymentPresignedUploadUrl({
        userId: user.id,
        organizationId,
        projectId,
        deploymentId,
        filePath,
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
          : message.includes('Storage is not configured')
          ? 503
          : 500;
      return sendJson(res, status, { success: false, error: message });
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
      const user = await verifyUserToken(authHeader);

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

      const verification = await verifyR2DeploymentFile({
        organizationId,
        projectId,
        deploymentId,
        filePath,
      });

      if (!verification.exists) {
        console.error('[R2_UPLOAD_FAILED]', {
          deploymentId,
          projectId,
          organizationId,
          storageKey: verification.storageKey,
          error: verification.error || 'Object not found in R2',
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
          error: `R2 verification failed: file "${filePath}" does not exist in Cloudflare R2 bucket at ${verification.storageKey}. Details: ${verification.error || 'Not found'}`,
        });
      }

      console.log('[R2_UPLOAD_SUCCESS]', {
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
      if (sb) {
        const { error: updateErr } = await sb
          .from('deployments')
          .update({ status: 'ready', completed_at: completedAt })
          .eq('id', deploymentId);

        if (updateErr) {
          console.warn('[Supabase] Warning updating deployment status to ready:', updateErr.message);
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

      // Persist deployment metadata to R2 for edge resilience across all serverless instances
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
        }
      } catch (metaErr: any) {
        console.warn('[Optic Hosting] Notice saving deployment metadata in R2:', metaErr?.message || metaErr);
      }

      console.log('[DEPLOYMENT_READY]', {
        deploymentId,
        projectId,
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
      const user = await verifyUserToken(authHeader);
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

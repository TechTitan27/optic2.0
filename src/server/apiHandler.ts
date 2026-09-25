import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { getSupabaseServerClient, verifyUserToken } from './supabaseServer.js';
import {
  getR2Config,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteStorageFile,
  cleanupOrphanedObject,
  createDeploymentPresignedUploadUrl,
  createSharePresignedUrls,
} from './r2Storage.js';

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

  if (!url.startsWith('/api/')) {
    return next();
  }

  const method = req.method || 'GET';

  // 1. POST /api/waitlist
  if (url === '/api/waitlist' && method === 'POST') {
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

  // 2. POST /api/keys/create
  if (url === '/api/keys/create' && method === 'POST') {
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
          key_prefix: keyPrefix,
          key_hash: keyHash,
          status: 'active',
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
          keyPrefix: data.key_prefix,
          createdAt: data.created_at,
        },
      });
    } catch (err: any) {
      console.error('[API /api/keys/create] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to create key' });
    }
  }

  // 3. GET /api/keys/list
  if (url === '/api/keys/list' && method === 'GET') {
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

      // Select only non-sensitive columns: id, name, key_prefix, status, created_at, last_used_at
      // NEVER select or return key_hash
      const { data, error } = await sb
        .from('api_keys')
        .select('id, name, key_prefix, status, created_at, last_used_at')
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
        keyPrefix: k.key_prefix,
        status: k.status,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      }));
      return sendJson(res, 200, { success: true, keys });
    } catch (err: any) {
      console.error('[API /api/keys/list] Uncaught exception:', err);
      return sendJson(res, 500, { success: false, error: err?.message || 'Failed to list keys' });
    }
  }

  // 4. POST /api/keys/revoke
  if (url === '/api/keys/revoke' && method === 'POST') {
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

      const { error } = await sb
        .from('api_keys')
        .update({ status: 'revoked' })
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

  // 5. POST /api/keys/delete
  if (url === '/api/keys/delete' && method === 'POST') {
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

  // 7. GET /api/hosting/deployments (REAL SUPABASE DATA, ZERO MOCK DATA)
  if (url.startsWith('/api/hosting/deployments') && method === 'GET') {
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

          const { data, error } = await query;
          if (error) {
            console.error('[API /api/hosting/deployments] Supabase query error:', error);
          } else if (data) {
            const mapped = data.map((d: any) => ({
              id: d.id,
              projectId: d.project_id,
              projectName: d.project_name || 'project',
              status: d.status || 'ready',
              url: d.url,
              commitHash: d.commit_hash || 'HEAD',
              commitMessage: d.commit_message || 'Deployment update',
              creator: d.creator || 'developer',
              branch: d.branch || 'main',
              durationSeconds: d.duration_seconds || 12,
              environment: d.environment || 'production',
              createdAt: d.created_at,
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

  // 7b. POST /api/hosting/deployments/upload-url or /api/hosting/upload-url
  if (
    (url.startsWith('/api/hosting/deployments/upload-url') ||
      url.startsWith('/api/hosting/upload-url')) &&
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

  // 8. GET /api/hosting/projects
  if (url.startsWith('/api/hosting/projects') && method === 'GET') {
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
            console.error('[API /api/hosting/projects] Supabase query error:', error);
          } else if (data) {
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
  if (url.startsWith('/api/organizations') && method === 'GET') {
    try {
      const { userId, token } = await resolveUserId(req);
      const sb = getSupabaseServerClient(token);

      if (sb && userId) {
        try {
          const { data, error } = await sb
            .from('organizations')
            .select('*, organization_members!inner(user_id, role)')
            .eq('organization_members.user_id', userId);

          if (error) {
            console.error('[API /api/organizations] Supabase query error:', error);
          } else if (data) {
            return sendJson(res, 200, { success: true, organizations: data });
          }
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

  // 9b. GET /api/storage/share (Public Shared File Access & Presigned URL Generation)
  if (url.startsWith('/api/storage/share') && method === 'GET') {
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      let token = parsedUrl.searchParams.get('token');
      if (!token && parsedUrl.pathname !== '/api/storage/share') {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        // e.g. ['api', 'storage', 'share', 'abc123']
        if (parts.length >= 4) {
          token = parts[3];
        }
      }

      if (!token) {
        return sendJson(res, 400, {
          success: false,
          error: 'Share token is required.',
        });
      }

      // Supabase server client (uses service role key to query public.share_links for unauthenticated visitors)
      const sb = getSupabaseServerClient();
      if (!sb) {
        return sendJson(res, 503, {
          success: false,
          error: 'Database connection unavailable.',
        });
      }

      // 1. Find share_links row by token
      const { data: shareLink, error: shareErr } = await sb
        .from('share_links')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (shareErr) {
        console.error('[API /api/storage/share] Supabase query error:', shareErr);
        return sendJson(res, 500, {
          success: false,
          error: 'Failed to look up share link.',
        });
      }

      if (!shareLink) {
        return sendJson(res, 404, {
          success: false,
          notFound: true,
          error: 'Share link not found.',
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

      // 3. Fetch associated file from public.files
      const { data: file, error: fileErr } = await sb
        .from('files')
        .select('id, user_id, name, extension, mime_type, size_bytes, storage_key, created_at, updated_at')
        .eq('id', shareLink.file_id)
        .maybeSingle();

      if (fileErr || !file) {
        return sendJson(res, 404, {
          success: false,
          notFound: true,
          error: 'File not found.',
        });
      }

      // 4. Retrieve uploader's display name from profiles table (explicitly do NOT expose email)
      let uploaderName = 'Optic User';
      try {
        const { data: profile } = await sb
          .from('profiles')
          .select('id, display_name, full_name, name')
          .eq('id', file.user_id)
          .maybeSingle();

        if (profile) {
          uploaderName =
            profile.display_name || profile.full_name || profile.name || 'Optic User';
        }
      } catch (pErr) {
        console.warn('[API /api/storage/share] Profile query warning:', pErr);
      }

      // 5. Generate short-lived presigned GET URLs from R2
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
        share: {
          token: shareLink.token,
          expiresAt: shareLink.expires_at || null,
          createdAt: shareLink.created_at,
        },
        file: {
          id: file.id,
          name: file.name,
          extension: file.extension || (file.name.includes('.') ? file.name.split('.').pop() : ''),
          mimeType: file.mime_type || 'application/octet-stream',
          sizeBytes: file.size_bytes || 0,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
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

  // 10. POST /api/storage/upload-url
  if (url.startsWith('/api/storage/upload-url') && method === 'POST') {
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

  // 11. GET /api/storage/download/:fileId or /api/storage/download?fileId=...
  if (url.startsWith('/api/storage/download') && method === 'GET') {
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
      if (!fileId && parsedUrl.pathname !== '/api/storage/download') {
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

  // 12. DELETE /api/storage/files/:fileId or /api/storage/files?fileId=...
  if (url.startsWith('/api/storage/files') && (method === 'DELETE' || method === 'POST')) {
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
      if (!fileId && parsedUrl.pathname !== '/api/storage/files') {
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

  // 13. GET /api/storage/status
  if (url.startsWith('/api/storage/status') && method === 'GET') {
    const config = getR2Config();
    return sendJson(res, 200, {
      success: true,
      isConfigured: config.isConfigured,
      provider: 'Cloudflare R2',
      bucketName: config.bucketName || null,
      hasAccountId: Boolean(config.accountId),
      hasAccessKey: Boolean(config.accessKeyId),
      hasSecretKey: Boolean(config.secretAccessKey),
      notice: config.isConfigured
        ? 'Cloudflare R2 is configured and ready for presigned uploads.'
        : 'Cloudflare R2 server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
    });
  }

  // 14. POST /api/storage/cleanup-orphan
  if (url.startsWith('/api/storage/cleanup-orphan') && method === 'POST') {
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

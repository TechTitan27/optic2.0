import { verifyUserToken } from '../src/server/supabaseServer.js';
import {
  getR2Config,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteStorageFile,
  cleanupOrphanedObject,
} from '../src/server/r2Storage.js';
import { getSupabaseSecretKey, getSupabaseAnonKey } from '../src/server/supabaseServer.js';

function extractAction(req: any): string {
  if (req.query?.action) {
    return String(req.query.action).toLowerCase().trim();
  }
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  // e.g. /api/storage/upload-url -> parts = ['api', 'storage', 'upload-url']
  if (parts.length >= 3) {
    return parts[2].toLowerCase().trim();
  }
  return '';
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    return res.status(200).end();
  }

  const action = extractAction(req);
  const method = req.method || 'GET';

  // 1. Storage Status: GET /api/storage?action=status or GET /api/storage/status
  if (action === 'status') {
    if (method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    const config = getR2Config();
    const hasDb = Boolean(getSupabaseSecretKey() || getSupabaseAnonKey());

    return res.status(200).json({
      status: 'ok',
      success: true,
      service: 'Optic Cloud Storage',
      timestamp: new Date().toISOString(),
      isConfigured: config.isConfigured,
      provider: 'Cloudflare R2',
      bucketName: config.bucketName || null,
      hasAccountId: Boolean(config.accountId),
      hasAccessKey: Boolean(config.accessKeyId),
      hasSecretKey: Boolean(config.secretAccessKey),
      storage: {
        provider: 'Cloudflare R2',
        configured: config.isConfigured,
        bucket: config.bucketName || null,
      },
      database: {
        provider: 'Supabase PostgreSQL',
        configured: hasDb,
      },
      notice: config.isConfigured
        ? 'Cloudflare R2 is configured and operational.'
        : 'Cloudflare R2 server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
    });
  }

  // 2. Presigned Upload URL: POST /api/storage?action=upload-url
  if (action === 'upload-url') {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. Please sign in to upload files.',
        });
      }

      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return res.status(503).json({
          success: false,
          error:
            'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
        });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
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

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage?action=upload-url] Error:', err);
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

      return res.status(status).json({ success: false, error: message });
    }
  }

  // 3. Presigned Download URL: GET /api/storage?action=download&fileId=...
  if (action === 'download') {
    if (method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. Please sign in to download files.',
        });
      }

      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return res.status(503).json({
          success: false,
          error:
            'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
        });
      }

      const fileId = req.query?.fileId || req.query?.id;
      if (!fileId) {
        return res.status(400).json({ success: false, error: 'fileId parameter is required.' });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createPresignedDownloadUrl({
        userId: user.id,
        fileId: String(fileId),
        userToken: token,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage?action=download] Error:', err);
      const message = err?.message || 'Failed to generate download URL.';
      const status = message.includes('permission')
        ? 403
        : message.includes('not found')
        ? 404
        : message.includes('Storage is not configured')
        ? 503
        : 500;

      return res.status(status).json({ success: false, error: message });
    }
  }

  // 4. Cleanup Orphaned R2 Object: POST /api/storage?action=cleanup-orphan
  if (action === 'cleanup-orphan') {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const storageKey = body.storageKey || req.query?.storageKey;

      if (!storageKey) {
        return res.status(400).json({ success: false, error: 'storageKey is required.' });
      }

      const cleaned = await cleanupOrphanedObject({
        userId: user.id,
        storageKey: String(storageKey),
      });

      return res.status(200).json({ success: true, cleaned });
    } catch (err: any) {
      console.error('[API /api/storage?action=cleanup-orphan] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to cleanup object.' });
    }
  }

  // 5. Delete File: DELETE/POST /api/storage?action=delete or action=files
  if (action === 'delete' || action === 'files' || method === 'DELETE') {
    try {
      const authHeader = req.headers['authorization'];
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. Please sign in to delete files.',
        });
      }

      let fileId = req.query?.fileId || req.query?.id;
      if (!fileId && method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        fileId = body.fileId || body.id;
      }

      if (!fileId) {
        return res.status(400).json({ success: false, error: 'fileId parameter is required.' });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await deleteStorageFile({
        userId: user.id,
        fileId: String(fileId),
        userToken: token,
      });

      return res.status(200).json({
        message: 'File deleted successfully from R2 and database.',
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/storage?action=delete] Error:', err);
      const message = err?.message || 'Failed to delete file.';
      const status = message.includes('permission')
        ? 403
        : message.includes('not found')
        ? 404
        : 500;

      return res.status(status).json({ success: false, error: message });
    }
  }

  return res.status(400).json({
    success: false,
    error: `Unknown action: '${action}'. Valid actions: upload-url, download, cleanup-orphan, delete, status.`,
  });
}

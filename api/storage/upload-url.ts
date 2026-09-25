import type { IncomingMessage, ServerResponse } from 'http';
import { verifyUserToken } from '../../src/server/supabaseServer.js';
import { createPresignedUploadUrl, getR2Config } from '../../src/server/r2Storage.js';

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
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

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}

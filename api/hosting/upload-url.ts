import type { IncomingMessage, ServerResponse } from 'http';
import { verifyUserToken } from '../../src/server/supabaseServer.js';
import { createDeploymentPresignedUploadUrl, getR2Config } from '../../src/server/r2Storage.js';

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
        error: 'Unauthorized. Please sign in to create hosting deployments.',
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
    const { organizationId, projectId, deploymentId, filePath, mimeType, size } = body;

    if (!organizationId || !projectId || !deploymentId || !filePath) {
      return res.status(400).json({
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

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('[API /api/hosting/upload-url] Error:', err);
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

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}

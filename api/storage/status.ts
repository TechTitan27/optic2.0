import { getR2Config } from '../../src/server/r2Storage.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const config = getR2Config();
  return res.status(200).json({
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

import { getR2Config } from '../src/server/r2Storage.js';
import { getSupabaseSecretKey, getSupabaseAnonKey } from '../src/server/supabaseServer.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const config = getR2Config();
  const hasDb = Boolean(getSupabaseSecretKey() || getSupabaseAnonKey());

  return res.status(200).json({
    status: 'ok',
    success: true,
    service: 'Optic Cloud & Edge Platform',
    timestamp: new Date().toISOString(),
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
      ? 'Cloudflare R2 is configured and operational.'
      : 'Cloudflare R2 server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
  });
}

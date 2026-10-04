import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Config } from './r2Storage.js';

export interface ShareSecuritySettings {
  token: string;
  fileId: string;
  accessLevel: 'public' | 'password';
  password?: string;
  updatedAt: string;
}

// In-memory cache for ultra-fast validation
const memoryShareSettings = new Map<string, ShareSecuritySettings>();

/**
 * Retrieve share settings from memory cache or Cloudflare R2
 */
export async function getShareSettings(token: string): Promise<ShareSecuritySettings | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  // 1. Check in-memory cache
  if (memoryShareSettings.has(cleanToken)) {
    return memoryShareSettings.get(cleanToken)!;
  }

  // 2. Check Cloudflare R2 persistence
  const r2Client = getR2Client();
  const r2Config = getR2Config();

  if (r2Client && r2Config.bucketName) {
    try {
      const getCmd = new GetObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `meta/shares/${cleanToken}/settings.json`,
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
          const parsed = JSON.parse(text) as ShareSecuritySettings;
          memoryShareSettings.set(cleanToken, parsed);
          return parsed;
        }
      }
    } catch {
      // settings file does not exist yet (default is public)
    }
  }

  return null;
}

/**
 * Save share settings to memory cache and persist to Cloudflare R2
 */
export async function setShareSettings(settings: {
  token: string;
  fileId: string;
  accessLevel: 'public' | 'password';
  password?: string;
}): Promise<ShareSecuritySettings> {
  const cleanToken = settings.token.trim();
  const entry: ShareSecuritySettings = {
    token: cleanToken,
    fileId: settings.fileId,
    accessLevel: settings.accessLevel,
    password: settings.password?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to in-memory cache
  memoryShareSettings.set(cleanToken, entry);

  // 2. Persist to Cloudflare R2 if configured
  const r2Client = getR2Client();
  const r2Config = getR2Config();

  if (r2Client && r2Config.bucketName) {
    try {
      const putCmd = new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `meta/shares/${cleanToken}/settings.json`,
        Body: Buffer.from(JSON.stringify(entry), 'utf-8'),
        ContentType: 'application/json',
      });
      await r2Client.send(putCmd);
    } catch (err: any) {
      console.warn('[ShareSecurity] Notice persisting share settings to R2:', err.message);
    }
  }

  return entry;
}

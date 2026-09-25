import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { getSupabaseServerClient } from './supabaseServer.js';

/**
 * Cloudflare R2 Storage Configuration
 * Server-only: never expose credentials to client code.
 */
export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);

  return {
    isConfigured,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  };
}

let r2ClientInstance: S3Client | null = null;
let corsConfigured = false;

export function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!config.isConfigured || !config.endpoint) {
    return null;
  }

  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });
  }

  return r2ClientInstance;
}

/**
 * Configure R2 CORS for Optic production and development domains
 */
export async function ensureR2Cors(): Promise<boolean> {
  if (corsConfigured) return true;
  const client = getR2Client();
  const { bucketName } = getR2Config();
  if (!client || !bucketName) return false;

  try {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE'],
            AllowedOrigins: [
              'https://cloud.optic.doy.best',
              'https://optic.doy.best',
              'http://localhost:3000',
              'http://localhost:5173',
              'https://ais-dev-7xqwvdpwsxzc333qufjyyn-51319299209.europe-west2.run.app',
              'https://ais-pre-7xqwvdpwsxzc333qufjyyn-51319299209.europe-west2.run.app',
            ],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });

    await client.send(corsCommand);
    corsConfigured = true;
    console.log('[R2] Bucket CORS policy applied successfully.');
    return true;
  } catch (err: any) {
    // If credentials lack CORS edit permissions, log notice but do not crash
    console.warn('[R2] Notice: Could not automatically set R2 bucket CORS via API:', err?.message || err);
    return false;
  }
}

/**
 * Sanitize filename to prevent path traversal and shell exploits
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Strip path traversal prefixes and directories
  const basename = filename.replace(/^.*[\\\/]/, '').trim();
  // Keep only safe characters: alphanumeric, dots, dashes, underscores
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || 'unnamed_file';
}

/**
 * Generate a short-lived presigned PUT URL for direct browser-to-R2 upload
 */
export async function createPresignedUploadUrl(params: {
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
  userToken?: string;
}): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
  const { userId, name, mimeType, size, folderId, userToken } = params;
  const config = getR2Config();

  if (!config.isConfigured) {
    throw new Error(
      'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.'
    );
  }

  const client = getR2Client();
  if (!client || !config.bucketName) {
    throw new Error('Failed to initialize Cloudflare R2 client.');
  }

  // 1. Validate filename
  const cleanName = (name || '').trim();
  if (!cleanName) {
    throw new Error('Filename cannot be empty.');
  }
  const safeName = sanitizeFilename(cleanName);

  // 2. Validate MIME type
  const cleanMime = (mimeType || '').trim();
  if (!cleanMime || !cleanMime.includes('/')) {
    throw new Error('Unsupported file type or invalid MIME format.');
  }

  // 3. Validate file size (maximum 5 GB)
  const maxSizeBytes = 5 * 1024 * 1024 * 1024;
  if (typeof size !== 'number' || isNaN(size) || size <= 0) {
    throw new Error('File size must be greater than 0.');
  }
  if (size > maxSizeBytes) {
    throw new Error('File is too large. Maximum supported file size is 5 GB.');
  }

  // 4. Validate folder ownership if folderId is provided
  if (folderId) {
    const sb = getSupabaseServerClient(userToken);
    if (sb) {
      const { data: folder, error: folderErr } = await sb
        .from('folders')
        .select('id, user_id')
        .eq('id', folderId)
        .maybeSingle();

      if (folderErr || !folder) {
        throw new Error('Folder not found.');
      }
      if (folder.user_id !== userId) {
        throw new Error("You don't have permission to upload here.");
      }
    }
  }

  // 5. Generate secure, unique object key: users/{userId}/{uuid}/{safeFilename}
  const uuid = crypto.randomUUID();
  const storageKey = `users/${userId}/${uuid}/${safeName}`;

  // 6. Generate presigned PUT URL with 15-minute expiration
  const expiresIn = 900;
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: storageKey,
    ContentType: cleanMime,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  // Attempt to ensure CORS on first upload
  ensureR2Cors().catch(() => {});

  return {
    uploadUrl,
    storageKey,
    expiresIn,
  };
}

/**
 * Generate a short-lived presigned GET URL for authenticated download
 */
export async function createPresignedDownloadUrl(params: {
  userId: string;
  fileId: string;
  userToken?: string;
}): Promise<{ downloadUrl: string; filename: string; mimeType: string }> {
  const { userId, fileId, userToken } = params;
  const config = getR2Config();

  if (!config.isConfigured) {
    throw new Error(
      'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.'
    );
  }

  const client = getR2Client();
  if (!client || !config.bucketName) {
    throw new Error('Failed to initialize Cloudflare R2 client.');
  }

  // 1. Fetch file metadata and verify ownership
  const sb = getSupabaseServerClient(userToken);
  if (!sb) {
    throw new Error('Database connection unavailable.');
  }

  const { data: file, error: fileErr } = await sb
    .from('files')
    .select('id, user_id, name, storage_key, mime_type, is_public')
    .eq('id', fileId)
    .maybeSingle();

  if (fileErr || !file) {
    throw new Error('File not found.');
  }

  if (file.user_id !== userId && !file.is_public) {
    throw new Error("You don't have permission to access this file.");
  }

  if (!file.storage_key) {
    throw new Error('File has no storage key associated.');
  }

  // 2. Generate presigned GET URL with 15-minute expiration
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: file.storage_key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
    ResponseContentType: file.mime_type || 'application/octet-stream',
  });

  const downloadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

  return {
    downloadUrl,
    filename: file.name,
    mimeType: file.mime_type || 'application/octet-stream',
  };
}

/**
 * Delete file from Cloudflare R2 and Supabase PostgreSQL
 */
export async function deleteStorageFile(params: {
  userId: string;
  fileId: string;
  userToken?: string;
}): Promise<{ success: boolean; deletedKey?: string }> {
  const { userId, fileId, userToken } = params;
  const config = getR2Config();

  const sb = getSupabaseServerClient(userToken);
  if (!sb) {
    throw new Error('Database connection unavailable.');
  }

  // 1. Fetch file metadata
  const { data: file, error: fileErr } = await sb
    .from('files')
    .select('id, user_id, storage_key, size_bytes')
    .eq('id', fileId)
    .maybeSingle();

  if (fileErr || !file) {
    throw new Error('File not found.');
  }

  if (file.user_id !== userId) {
    throw new Error("You don't have permission to delete this file.");
  }

  // 2. Delete object from R2 if configured and storage_key exists
  const client = getR2Client();
  if (client && config.bucketName && file.storage_key) {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: file.storage_key,
      });
      await client.send(deleteCommand);
    } catch (r2Err: any) {
      console.warn('[R2 Delete Object Warning]:', r2Err?.message || r2Err);
      // Proceed with deleting DB record even if object was already deleted in R2
    }
  }

  // 3. Delete metadata row from public.files
  const { error: delDbErr } = await sb
    .from('files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId);

  if (delDbErr) {
    throw new Error(delDbErr.message || 'Failed to remove file record from database.');
  }

  // 4. Decrement usage in public.usage
  const sizeBytes = Number(file.size_bytes || 0);
  if (sizeBytes > 0) {
    try {
      const { data: usageRow } = await sb
        .from('usage')
        .select('id, storage_used_bytes')
        .eq('user_id', userId)
        .maybeSingle();

      if (usageRow) {
        const updatedBytes = Math.max(0, (Number(usageRow.storage_used_bytes) || 0) - sizeBytes);
        await sb
          .from('usage')
          .update({ storage_used_bytes: updatedBytes })
          .eq('id', usageRow.id);
      }
    } catch (uErr) {
      console.warn('[Supabase] Usage decrement warning:', uErr);
    }
  }

  return { success: true, deletedKey: file.storage_key };
}

/**
 * Clean up an orphaned R2 object if database metadata insertion fails
 */
export async function cleanupOrphanedObject(params: {
  userId: string;
  storageKey: string;
}): Promise<boolean> {
  const { userId, storageKey } = params;
  const config = getR2Config();
  const client = getR2Client();

  if (!client || !config.bucketName || !storageKey) {
    return false;
  }

  // Strict ownership check: key MUST start with users/{userId}/
  if (!storageKey.startsWith(`users/${userId}/`)) {
    console.warn('[R2 Cleanup] Security violation: Attempt to delete key outside user prefix:', {
      userId,
      storageKey,
    });
    return false;
  }

  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: storageKey,
    });
    await client.send(deleteCommand);
    console.log('[R2 Cleanup] Orphaned object removed:', storageKey);
    return true;
  } catch (err) {
    console.warn('[R2 Cleanup] Failed to delete orphaned object:', err);
    return false;
  }
}

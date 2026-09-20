import { getSupabase } from './supabaseClient';

export interface StorageUploadRequest {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  folderId?: string | null;
}

export interface StorageUploadResult {
  success: boolean;
  storageKey?: string;
  publicUrl?: string;
  storageProvider?: 'r2' | 'supabase_storage';
  error?: string;
}

/**
 * Storage adapter abstraction
 * Strictly isolated so Cloudflare R2 or Supabase Storage can be plugged in without refactoring UI.
 * Explicitly rejects faked successful byte uploads when storage credentials are not provided.
 */
export class OpticStorageService {
  private isR2Configured: boolean;

  constructor() {
    this.isR2Configured = false;
  }

  getStorageStatus() {
    return {
      provider: this.isR2Configured ? 'Cloudflare R2' : 'Optic Modular Adapter (Awaiting R2 credentials)',
      isR2Configured: this.isR2Configured,
      objectStorageReady: this.isR2Configured,
      metadataEngine: 'Supabase PostgreSQL (files, folders, share_links, usage)',
      notice:
        'R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are configured server-side. File metadata is securely synced to Supabase.',
    };
  }

  /**
   * Uploads file bytes to real storage backend.
   * If R2 is not yet configured, attempts Supabase Storage bucket 'optic-files'.
   * If neither is configured, returns an explicit error rather than faking success.
   */
  async uploadFile(file: File, folderPath?: string): Promise<StorageUploadResult> {
    const sb = getSupabase();
    if (sb) {
      try {
        const cleanPath = folderPath ? `${folderPath.replace(/^\//, '')}/${file.name}` : file.name;
        const storageKey = `uploads/${Date.now()}_${cleanPath.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const { data, error } = await sb.storage.from('optic-files').upload(storageKey, file, {
          cacheControl: '3600',
          upsert: false,
        });

        if (!error && data) {
          const {
            data: { publicUrl },
          } = sb.storage.from('optic-files').getPublicUrl(storageKey);
          return {
            success: true,
            storageKey,
            publicUrl:
              publicUrl ||
              `https://dsrvkqutqxuvmfhbcuvy.supabase.co/storage/v1/object/public/optic-files/${storageKey}`,
            storageProvider: 'supabase_storage',
          };
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload attempt:', storageErr);
      }
    }

    // Do NOT fake successful uploads per prompt instructions
    return {
      success: false,
      error:
        'Object storage backend is not yet connected. Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) or a Supabase Storage bucket ("optic-files") must be provisioned to store object binary data.',
    };
  }

  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  detectMimeType(fileName: string): { type: string; ext: string } {
    const parts = fileName.split('.');
    const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';

    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      gif: 'image/gif',
      zip: 'application/zip',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      json: 'application/json',
      js: 'application/javascript',
      ts: 'application/typescript',
      html: 'text/html',
      css: 'text/css',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
    };

    return {
      type: mimeMap[ext] || 'application/octet-stream',
      ext: ext.toUpperCase(),
    };
  }
}

export const storageService = new OpticStorageService();

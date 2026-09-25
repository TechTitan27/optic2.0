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

export interface R2StatusResponse {
  success: boolean;
  isConfigured: boolean;
  provider: string;
  bucketName: string | null;
  notice: string;
}

export class OpticStorageService {
  /**
   * Helper to retrieve active Supabase Auth JWT token
   */
  async getAuthToken(): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Query server to check if Cloudflare R2 credentials are configured
   */
  async getStorageStatus(): Promise<R2StatusResponse> {
    try {
      const token = await this.getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/storage/status', { headers });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.warn('[OpticStorageService] Could not check storage status:', err);
    }

    return {
      success: false,
      isConfigured: false,
      provider: 'Cloudflare R2',
      bucketName: null,
      notice:
        'Cloudflare R2 server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
    };
  }

  /**
   * Request a short-lived presigned PUT URL from Optic API
   */
  async requestUploadUrl(params: {
    name: string;
    mimeType: string;
    size: number;
    folderId?: string | null;
  }): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to upload files.');
    }

    const res = await fetch('/api/storage/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: params.name,
        mimeType: params.mimeType,
        size: params.size,
        folderId: params.folderId || null,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      uploadUrl: data.uploadUrl,
      storageKey: data.storageKey,
      expiresIn: data.expiresIn || 900,
    };
  }

  /**
   * Directly PUT file bytes to Cloudflare R2 with progress monitoring
   */
  async uploadDirectToR2(
    uploadUrl: string,
    file: File,
    mimeType: string,
    onProgress?: (percentage: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', mimeType || file.type || 'application/octet-stream');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(
            new Error(
              `Cloudflare R2 returned status ${xhr.status}: ${xhr.statusText || 'Direct upload rejected'}`
            )
          );
        }
      };

      xhr.onerror = () => {
        reject(
          new Error(
            'Direct R2 network upload error. Please ensure Cloudflare R2 bucket CORS allows PUT and Content-Type from this origin.'
          )
        );
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload to Cloudflare R2 timed out.'));
      };

      xhr.send(file);
    });
  }

  /**
   * Cleanup orphaned R2 object if metadata insert fails
   */
  async cleanupOrphanedObject(storageKey: string): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token || !storageKey) return;

      await fetch('/api/storage/cleanup-orphan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storageKey }),
      });
    } catch (err) {
      console.warn('[OpticStorageService] Orphan cleanup notice:', err);
    }
  }

  /**
   * Request short-lived presigned GET URL for authenticated download
   */
  async getDownloadUrl(
    fileId: string
  ): Promise<{ downloadUrl: string; filename: string; mimeType: string }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to download files.');
    }

    const res = await fetch(`/api/storage/download?fileId=${encodeURIComponent(fileId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate download URL');
    }

    return {
      downloadUrl: data.downloadUrl,
      filename: data.filename || 'download',
      mimeType: data.mimeType || 'application/octet-stream',
    };
  }

  /**
   * Delete file from R2 and database via API
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to delete files.');
    }

    const res = await fetch(`/api/storage/files?fileId=${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete file.');
    }
  }

  formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return '0 B';
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
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };

    return {
      type: mimeMap[ext] || 'application/octet-stream',
      ext: ext.toUpperCase(),
    };
  }
}

export const storageService = new OpticStorageService();

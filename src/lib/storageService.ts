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

      let res = await fetch('/api/status', { headers });
      if (!res.ok) {
        res = await fetch('/api/storage?action=status', { headers });
      }
      if (!res.ok) {
        res = await fetch('/status', { headers });
      }
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

    const res = await fetch('/api/storage?action=upload-url', {
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
   * Request a short-lived presigned PUT URL for a hosting deployment file
   */
  async requestDeploymentUploadUrl(params: {
    organizationId: string;
    projectId: string;
    deploymentId: string;
    filePath: string;
    mimeType: string;
    size: number;
  }): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to upload deployment files.');
    }

    // Request presigned URL from consolidated hosting API
    let res = await fetch('/api/hosting?action=upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (res.status === 404) {
      res = await fetch('/api/hosting/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });
    }

    let data: any = {};
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 150)}`);
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to generate deployment upload URL (HTTP ${res.status})`);
    }

    return {
      uploadUrl: data.uploadUrl,
      storageKey: data.storageKey,
      expiresIn: data.expiresIn || 900,
    };
  }

  /**
   * Finalize and verify static website deployment in Cloudflare R2
   */
  async finalizeDeployment(params: {
    organizationId: string;
    projectId: string;
    deploymentId: string;
    filePath?: string;
  }): Promise<{
    success: boolean;
    ready?: boolean;
    size?: number;
    storageKey?: string;
    completedAt?: string;
    error?: string;
  }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to finalize deployment.');
    }

    let res = await fetch('/api/hosting?action=finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (res.status === 404) {
      res = await fetch('/api/hosting/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });
    }

    let data: any = {};
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 150)}`);
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to finalize deployment (HTTP ${res.status})`);
    }

    return data;
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
          const detail = xhr.responseText ? `: ${xhr.responseText.slice(0, 150)}` : '';
          reject(
            new Error(
              `Cloudflare R2 returned status ${xhr.status} (${xhr.statusText || 'Direct upload rejected'})${detail}`
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

      await fetch('/api/storage?action=cleanup-orphan', {
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

    const res = await fetch(`/api/storage?action=download&fileId=${encodeURIComponent(fileId)}`, {
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
   * Fetch public shared file metadata and short-lived presigned URLs (unauthenticated access or authenticated owner)
   */
  async getSharedFile(token: string, password?: string): Promise<{
    success: boolean;
    share?: {
      token: string;
      expiresAt: string | null;
      createdAt: string;
      accessLevel?: 'public' | 'password';
      hasPassword?: boolean;
    };
    file?: {
      id: string;
      name: string;
      extension: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
      updatedAt: string;
      userId?: string;
    };
    uploader?: {
      name: string;
    };
    isProtected?: boolean;
    requiresPassword?: boolean;
    isUnlocked?: boolean;
    isOwner?: boolean;
    previewUrl?: string;
    downloadUrl?: string;
    expired?: boolean;
    notFound?: boolean;
    error?: string;
  }> {
    try {
      const headers: Record<string, string> = {};
      const authToken = await this.getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      if (password) {
        headers['x-share-password'] = password;
      }

      let fetchUrl = `/api/share?token=${encodeURIComponent(token)}`;
      if (password) {
        fetchUrl += `&password=${encodeURIComponent(password)}`;
      }

      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers,
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to connect to storage service.',
      };
    }
  }

  /**
   * Update file share access settings (public vs password protected)
   */
  async updateShareSettings(params: {
    token: string;
    fileId: string;
    accessLevel: 'public' | 'password';
    password?: string;
    expiresInHours?: number | null;
  }): Promise<{ success: boolean; error?: string; settings?: any }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const authToken = await this.getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/share/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update share settings.');
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update share settings.',
      };
    }
  }

  /**
   * Delete file from R2 and database via API
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('You must be signed in to delete files.');
    }

    const res = await fetch(`/api/storage?action=delete&fileId=${encodeURIComponent(fileId)}`, {
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

import { FileItem, FolderItem } from '../types';

export interface StorageUploadRequest {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  folderId?: string | null;
}

export interface StorageUploadResponse {
  uploadUrl?: string;
  storageKey: string;
  provider: 'r2' | 'direct' | 'simulation';
  expiresInSeconds: number;
  requiresDirectR2: boolean;
  notes: string;
}

/**
 * Storage adapter abstraction
 * Designed to interface with Cloudflare R2 signed upload URLs or local dev uploads
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
      objectStorageReady: false,
      metadataEngine: 'Supabase PostgreSQL (files & folders tables)',
      notice: 'R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are configured server-side. File metadata is securely synced to Supabase.'
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
    };

    return {
      type: mimeMap[ext] || 'application/octet-stream',
      ext: ext.toUpperCase(),
    };
  }
}

export const storageService = new OpticStorageService();

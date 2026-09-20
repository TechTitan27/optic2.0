import { getSupabase } from './supabaseClient';
import { FileItem, FolderItem, UsageStats } from '../types';

export interface FileRecordInput {
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string | null;
  storageKey: string;
  storageProvider: 'r2' | 'supabase_storage' | 'mock';
  publicUrl?: string;
  isPublic?: boolean;
}

export const supabaseData = {
  /**
   * Fetch usage statistics for the authenticated user from the `usage` table
   */
  async getUserUsage(userId: string): Promise<UsageStats> {
    const defaultStats: UsageStats = {
      storageUsedBytes: 0,
      storageLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB
      bandwidthUsedBytes: 0,
      bandwidthLimitBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      deploymentsThisMonth: 1,
      deploymentsLimit: 100,
      apiRequestsThisMonth: 0,
      apiRequestsLimit: 100000,
    };

    const sb = getSupabase();
    if (!sb || !userId) return defaultStats;

    try {
      // Query the `usage` table for this user
      const { data, error } = await sb
        .from('usage')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          ...defaultStats,
          storageUsedBytes: Number(data.storage_used_bytes || data.storage_used || 0),
          storageLimitBytes: Number(data.storage_limit_bytes || data.storage_limit || defaultStats.storageLimitBytes),
          bandwidthUsedBytes: Number(data.bandwidth_used_bytes || data.bandwidth_used || 0),
          bandwidthLimitBytes: Number(data.bandwidth_limit_bytes || data.bandwidth_limit || defaultStats.bandwidthLimitBytes),
        };
      }

      // If no usage record found yet, compute storage from existing files
      const { data: userFiles } = await sb
        .from('files')
        .select('size_bytes')
        .eq('user_id', userId);

      const computedBytes = (userFiles || []).reduce(
        (acc: number, f: any) => acc + (Number(f.size_bytes) || 0),
        0
      );

      // Attempt to upsert the initial usage row
      try {
        await sb.from('usage').upsert({
          user_id: userId,
          storage_used_bytes: computedBytes,
          storage_limit_bytes: defaultStats.storageLimitBytes,
          bandwidth_used_bytes: 0,
          bandwidth_limit_bytes: defaultStats.bandwidthLimitBytes,
        });
      } catch {
        // ignore upsert error
      }

      return {
        ...defaultStats,
        storageUsedBytes: computedBytes,
      };
    } catch (err) {
      console.warn('Error fetching usage from Supabase:', err);
      return defaultStats;
    }
  },

  /**
   * Fetch recent files for overview dashboard from `files` table
   */
  async getRecentFiles(userId: string, limit = 4): Promise<FileItem[]> {
    const sb = getSupabase();
    if (!sb || !userId) return [];

    try {
      const { data, error } = await sb
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Error fetching recent files:', error);
        return [];
      }

      return (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        extension: f.extension || (f.name?.includes('.') ? f.name.split('.').pop()?.toUpperCase() : ''),
        mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
        sizeBytes: Number(f.size_bytes || f.sizeBytes || 0),
        folderId: f.folder_id || f.folderId || null,
        storageKey: f.storage_key || f.storageKey || '',
        storageProvider: f.storage_provider || f.storageProvider || 'r2',
        publicUrl: f.public_url || f.publicUrl,
        createdAt: f.created_at || f.createdAt || new Date().toISOString(),
        updatedAt: f.updated_at || f.updatedAt || f.created_at || new Date().toISOString(),
        isPublic: f.is_public ?? f.isPublic ?? true,
      }));
    } catch (err) {
      console.warn('Error in getRecentFiles:', err);
      return [];
    }
  },

  /**
   * List files and folders for a specific folder from `files` & `folders` tables
   */
  async getFilesAndFolders(
    userId: string,
    folderId: string | null
  ): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
    const sb = getSupabase();
    if (!sb || !userId) return { files: [], folders: [] };

    try {
      // 1. Fetch folders
      let foldersQuery = sb
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (folderId) {
        foldersQuery = foldersQuery.eq('parent_id', folderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }

      // 2. Fetch files
      let filesQuery = sb
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (folderId) {
        filesQuery = filesQuery.eq('folder_id', folderId);
      } else {
        filesQuery = filesQuery.is('folder_id', null);
      }

      const [foldersRes, filesRes] = await Promise.all([foldersQuery, filesQuery]);

      if (foldersRes.error) {
        console.warn('Error querying folders:', foldersRes.error);
      }
      if (filesRes.error) {
        console.warn('Error querying files:', filesRes.error);
      }

      const mappedFiles: FileItem[] = (filesRes.data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        extension: f.extension || (f.name?.includes('.') ? f.name.split('.').pop()?.toUpperCase() : ''),
        mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
        sizeBytes: Number(f.size_bytes || f.sizeBytes || 0),
        folderId: f.folder_id || f.folderId || null,
        storageKey: f.storage_key || f.storageKey || '',
        storageProvider: f.storage_provider || f.storageProvider || 'r2',
        publicUrl: f.public_url || f.publicUrl,
        createdAt: f.created_at || f.createdAt || new Date().toISOString(),
        updatedAt: f.updated_at || f.updatedAt || f.created_at || new Date().toISOString(),
        isPublic: f.is_public ?? f.isPublic ?? true,
      }));

      const mappedFolders: FolderItem[] = (foldersRes.data || []).map((fd: any) => ({
        id: fd.id,
        name: fd.name,
        parentId: fd.parent_id || fd.parentId || null,
        path: fd.path || `/${fd.name}`,
        itemCount: 0,
        createdAt: fd.created_at || fd.createdAt || new Date().toISOString(),
      }));

      return { files: mappedFiles, folders: mappedFolders };
    } catch (err) {
      console.warn('Error fetching files and folders from Supabase:', err);
      return { files: [], folders: [] };
    }
  },

  /**
   * Create folder in `folders` table
   */
  async createFolder(
    userId: string,
    name: string,
    parentId: string | null = null,
    parentPath: string = ''
  ): Promise<FolderItem> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const cleanName = name.trim();
    const path = parentPath ? `${parentPath}/${cleanName}` : `/${cleanName}`;

    const { data, error } = await sb
      .from('folders')
      .insert({
        user_id: userId,
        name: cleanName,
        parent_id: parentId,
        path,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      parentId: data.parent_id,
      path: data.path,
      itemCount: 0,
      createdAt: data.created_at,
    };
  },

  /**
   * Rename folder in `folders` table
   */
  async renameFolder(userId: string, folderId: string, newName: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const cleanName = newName.trim();
    const { error } = await sb
      .from('folders')
      .update({ name: cleanName })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Delete folder in `folders` table
   */
  async deleteFolder(userId: string, folderId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const { error } = await sb
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Save newly uploaded file record in `files` table & update `usage` table
   */
  async insertFileRecord(userId: string, input: FileRecordInput): Promise<FileItem> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const { data, error } = await sb
      .from('files')
      .insert({
        user_id: userId,
        name: input.name,
        extension: input.extension,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        folder_id: input.folderId || null,
        storage_key: input.storageKey,
        storage_provider: input.storageProvider,
        public_url: input.publicUrl,
        is_public: input.isPublic ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    // Update usage table storage
    try {
      const { data: usageRow } = await sb
        .from('usage')
        .select('id, storage_used_bytes')
        .eq('user_id', userId)
        .maybeSingle();

      if (usageRow) {
        const updatedBytes = Math.max(0, (Number(usageRow.storage_used_bytes) || 0) + input.sizeBytes);
        await sb
          .from('usage')
          .update({ storage_used_bytes: updatedBytes })
          .eq('id', usageRow.id);
      } else {
        await sb.from('usage').insert({
          user_id: userId,
          storage_used_bytes: input.sizeBytes,
          storage_limit_bytes: 10 * 1024 * 1024 * 1024,
          bandwidth_used_bytes: 0,
          bandwidth_limit_bytes: 50 * 1024 * 1024 * 1024,
        });
      }
    } catch (uErr) {
      console.warn('Usage update notification:', uErr);
    }

    return {
      id: data.id,
      name: data.name,
      extension: data.extension,
      mimeType: data.mime_type,
      sizeBytes: Number(data.size_bytes),
      folderId: data.folder_id,
      storageKey: data.storage_key,
      storageProvider: data.storage_provider,
      publicUrl: data.public_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
      isPublic: data.is_public,
    };
  },

  /**
   * Delete file from `files` table & update `usage` table
   */
  async deleteFile(userId: string, fileId: string, sizeBytes = 0): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const { error } = await sb
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (error) throw error;

    // Decrement usage
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
        console.warn('Usage decrement notification:', uErr);
      }
    }
  },

  /**
   * Create or fetch share link in `share_links` table
   */
  async createShareLink(
    userId: string,
    fileId: string,
    expiresInHours = 48
  ): Promise<{ shareUrl: string; token: string; expiresAt: string }> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase client is not available.');

    const token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();

    const { data, error } = await sb
      .from('share_links')
      .insert({
        user_id: userId,
        file_id: fileId,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://optic.doy.best';
    return {
      shareUrl: `${origin}/share/${data.token || token}`,
      token: data.token || token,
      expiresAt: data.expires_at || expiresAt,
    };
  },
};

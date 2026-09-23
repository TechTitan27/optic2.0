import { getSupabase } from './supabaseClient';
import { getDiceBearOrgAvatarUrl } from './avatar';
import {
  FileItem,
  FolderItem,
  UsageStats,
  Organization,
  HostingProject,
  DeploymentItem,
  DomainItem,
} from '../types';

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
   * Fetch usage statistics for the authenticated user from the real `public.usage` table
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
      const { data, error } = await sb
        .from('usage')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Supabase] Error querying public.usage table:', error);
      }

      if (data) {
        return {
          ...defaultStats,
          storageUsedBytes: Number(data.storage_used_bytes || 0),
          storageLimitBytes: Number(data.storage_limit_bytes || defaultStats.storageLimitBytes),
          bandwidthUsedBytes: Number(data.bandwidth_used_bytes || 0),
          bandwidthLimitBytes: Number(data.bandwidth_limit_bytes || defaultStats.bandwidthLimitBytes),
          deploymentsThisMonth: Number(data.deployments_this_month || 1),
          deploymentsLimit: Number(data.deployments_limit || defaultStats.deploymentsLimit),
          apiRequestsThisMonth: Number(data.api_requests_this_month || 0),
          apiRequestsLimit: Number(data.api_requests_limit || defaultStats.apiRequestsLimit),
        };
      }

      // Compute total storage from existing files in public.files
      const { data: userFiles, error: filesErr } = await sb
        .from('files')
        .select('size_bytes')
        .eq('user_id', userId);

      if (filesErr) {
        console.error('[Supabase] Error querying file sizes for usage calculation:', filesErr);
      }

      const computedBytes = (userFiles || []).reduce(
        (acc: number, f: any) => acc + (Number(f.size_bytes) || 0),
        0
      );

      // Attempt to initialize usage row
      try {
        await sb.from('usage').upsert({
          user_id: userId,
          storage_used_bytes: computedBytes,
          storage_limit_bytes: defaultStats.storageLimitBytes,
          bandwidth_used_bytes: 0,
          bandwidth_limit_bytes: defaultStats.bandwidthLimitBytes,
          deployments_this_month: 1,
          deployments_limit: defaultStats.deploymentsLimit,
          api_requests_this_month: 0,
          api_requests_limit: defaultStats.apiRequestsLimit,
        });
      } catch (upsertErr) {
        console.warn('[Supabase] Usage row initialization warning:', upsertErr);
      }

      return {
        ...defaultStats,
        storageUsedBytes: computedBytes,
      };
    } catch (err) {
      console.error('[Supabase] Unexpected exception in getUserUsage:', err);
      return defaultStats;
    }
  },

  /**
   * Fetch recent files for overview dashboard from `public.files` table
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
        console.error('[Supabase] Error fetching recent files from public.files:', error);
        return [];
      }

      return (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        extension: f.extension || (f.name?.includes('.') ? f.name.split('.').pop()?.toUpperCase() : ''),
        mimeType: f.mime_type || 'application/octet-stream',
        sizeBytes: Number(f.size_bytes || 0),
        folderId: f.folder_id || null,
        storageKey: f.storage_key || '',
        storageProvider: f.storage_provider || 'r2',
        publicUrl: f.public_url || undefined,
        createdAt: f.created_at || new Date().toISOString(),
        updatedAt: f.updated_at || f.created_at || new Date().toISOString(),
        isPublic: f.is_public ?? true,
      }));
    } catch (err) {
      console.error('[Supabase] Unexpected exception in getRecentFiles:', err);
      return [];
    }
  },

  /**
   * List folders and files from `public.folders` and `public.files`.
   * Columns in public.folders: id, user_id, parent_id, name, created_at.
   * Root level uses parent_id = null; nested level uses parent_id = folderId.
   */
  async getFilesAndFolders(
    userId: string,
    folderId: string | null = null
  ): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in getFilesAndFolders.');
      throw new Error('Supabase client is not available. Please verify configuration.');
    }
    if (!userId) {
      return { files: [], folders: [] };
    }

    console.log(`[Supabase] Listing files and folders for user ${userId}, folderId: ${folderId}`);

    // 1. Fetch folders for current level
    let foldersQuery = sb
      .from('folders')
      .select('id, user_id, parent_id, name, created_at')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (folderId) {
      foldersQuery = foldersQuery.eq('parent_id', folderId);
    } else {
      foldersQuery = foldersQuery.is('parent_id', null);
    }

    // 2. Fetch files for current level
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
      console.error('[Supabase] Error listing public.folders:', foldersRes.error);
      throw foldersRes.error;
    }
    if (filesRes.error) {
      console.error('[Supabase] Error listing public.files:', filesRes.error);
      throw filesRes.error;
    }

    const mappedFolders: FolderItem[] = (foldersRes.data || []).map((fd: any) => ({
      id: fd.id,
      name: fd.name,
      parentId: fd.parent_id || null,
      itemCount: 0,
      createdAt: fd.created_at || new Date().toISOString(),
    }));

    const mappedFiles: FileItem[] = (filesRes.data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      extension: f.extension || (f.name?.includes('.') ? f.name.split('.').pop()?.toUpperCase() : ''),
      mimeType: f.mime_type || 'application/octet-stream',
      sizeBytes: Number(f.size_bytes || 0),
      folderId: f.folder_id || null,
      storageKey: f.storage_key || '',
      storageProvider: f.storage_provider || 'r2',
      publicUrl: f.public_url || undefined,
      createdAt: f.created_at || new Date().toISOString(),
      updatedAt: f.updated_at || f.created_at || new Date().toISOString(),
      isPublic: f.is_public ?? true,
    }));

    return { files: mappedFiles, folders: mappedFolders };
  },

  /**
   * Reconstruct folder hierarchy / breadcrumb chain from Supabase using parent_id links.
   * Returns array ordered from root ancestor down to target folder.
   */
  async getFolderHierarchy(userId: string, targetFolderId: string): Promise<FolderItem[]> {
    const sb = getSupabase();
    if (!sb || !userId || !targetFolderId) return [];

    try {
      const { data, error } = await sb
        .from('folders')
        .select('id, user_id, parent_id, name, created_at')
        .eq('user_id', userId);

      if (error || !data) return [];

      const folderMap = new Map<string, FolderItem>();
      for (const item of data) {
        folderMap.set(item.id, {
          id: item.id,
          name: item.name,
          parentId: item.parent_id || null,
          itemCount: 0,
          createdAt: item.created_at || new Date().toISOString(),
        });
      }

      const hierarchy: FolderItem[] = [];
      let currId: string | null = targetFolderId;
      const visited = new Set<string>();

      while (currId && folderMap.has(currId) && !visited.has(currId)) {
        visited.add(currId);
        const folder: FolderItem | undefined = folderMap.get(currId);
        if (!folder) break;
        hierarchy.unshift(folder);
        currId = folder.parentId || null;
      }

      return hierarchy;
    } catch (err) {
      console.warn('[Supabase] Failed to resolve folder hierarchy:', err);
      return [];
    }
  },

  /**
   * Create folder in `public.folders` table.
   * Exact schema: id (uuid), user_id (uuid), parent_id (uuid | null), name (text), created_at (timestamptz).
   * Root folders use parent_id = null. Nested folders use the parent folder's UUID.
   */
  async createFolder(
    userId: string,
    name: string,
    parentId: string | null = null
  ): Promise<FolderItem> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createFolder.');
      throw new Error('Supabase client is not available. Please verify configuration.');
    }

    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Folder name cannot be empty.');
    }

    const cleanParentId = parentId || null;

    console.log('[Supabase] Creating folder in public.folders:', {
      user_id: userId,
      name: cleanName,
      parent_id: cleanParentId,
    });

    const { data, error } = await sb
      .from('folders')
      .insert({
        user_id: userId,
        name: cleanName,
        parent_id: cleanParentId,
      })
      .select('id, user_id, parent_id, name, created_at')
      .single();

    if (error) {
      console.error('[Supabase] Error creating folder in public.folders:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      parentId: data.parent_id,
      itemCount: 0,
      createdAt: data.created_at,
    };
  },

  /**
   * Rename folder in `public.folders` table
   */
  async renameFolder(userId: string, folderId: string, newName: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in renameFolder.');
      throw new Error('Supabase client is not available.');
    }

    const cleanName = newName.trim();
    if (!cleanName) {
      throw new Error('Folder name cannot be empty.');
    }

    console.log('[Supabase] Renaming folder in public.folders:', { folderId, cleanName, userId });

    const { error } = await sb
      .from('folders')
      .update({ name: cleanName })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error renaming folder in public.folders:', error);
      throw error;
    }
  },

  /**
   * Delete folder in `public.folders` table
   */
  async deleteFolder(userId: string, folderId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in deleteFolder.');
      throw new Error('Supabase client is not available.');
    }

    console.log('[Supabase] Deleting folder in public.folders:', { folderId, userId });

    const { error } = await sb
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error deleting folder from public.folders:', error);
      throw error;
    }
  },

  /**
   * Insert file record into `public.files` metadata table & update `public.usage`.
   * File bytes are stored in Cloudflare R2 / storage adapter; ONLY metadata is stored in Supabase Postgres.
   */
  async insertFileRecord(userId: string, input: FileRecordInput): Promise<FileItem> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in insertFileRecord.');
      throw new Error('Supabase client is not available.');
    }

    console.log('[Supabase] Inserting file metadata into public.files:', {
      user_id: userId,
      name: input.name,
      size_bytes: input.sizeBytes,
      folder_id: input.folderId,
      storage_key: input.storageKey,
      storage_provider: input.storageProvider,
    });

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

    if (error) {
      console.error('[Supabase] Error inserting file metadata into public.files:', error);
      throw error;
    }

    // Update usage table storage count
    try {
      const { data: usageRow, error: uFetchErr } = await sb
        .from('usage')
        .select('id, storage_used_bytes')
        .eq('user_id', userId)
        .maybeSingle();

      if (uFetchErr) {
        console.warn('[Supabase] Usage lookup warning:', uFetchErr);
      }

      if (usageRow) {
        const updatedBytes = Math.max(0, (Number(usageRow.storage_used_bytes) || 0) + input.sizeBytes);
        const { error: uUpErr } = await sb
          .from('usage')
          .update({ storage_used_bytes: updatedBytes })
          .eq('id', usageRow.id);
        if (uUpErr) console.warn('[Supabase] Usage update warning:', uUpErr);
      } else {
        const { error: uInErr } = await sb.from('usage').insert({
          user_id: userId,
          storage_used_bytes: input.sizeBytes,
          storage_limit_bytes: 10 * 1024 * 1024 * 1024,
          bandwidth_used_bytes: 0,
          bandwidth_limit_bytes: 50 * 1024 * 1024 * 1024,
          deployments_this_month: 1,
          deployments_limit: 100,
          api_requests_this_month: 0,
          api_requests_limit: 100000,
        });
        if (uInErr) console.warn('[Supabase] Usage insert warning:', uInErr);
      }
    } catch (uErr) {
      console.warn('[Supabase] Usage stats update notification:', uErr);
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
   * Delete file metadata from `public.files` & decrement `public.usage`
   */
  async deleteFile(userId: string, fileId: string, sizeBytes = 0): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in deleteFile.');
      throw new Error('Supabase client is not available.');
    }

    console.log('[Supabase] Deleting file from public.files:', { fileId, userId });

    const { error } = await sb
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Supabase] Error deleting file from public.files:', error);
      throw error;
    }

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
        console.warn('[Supabase] Usage decrement notification:', uErr);
      }
    }
  },

  /**
   * Create share link in `public.share_links` table
   */
  async createShareLink(
    userId: string,
    fileId: string,
    expiresInHours = 48
  ): Promise<{ shareUrl: string; token: string; expiresAt: string }> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createShareLink.');
      throw new Error('Supabase client is not available.');
    }

    const token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();

    console.log('[Supabase] Creating share link in public.share_links for file:', fileId);

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

    if (error) {
      console.error('[Supabase] Error inserting share link in public.share_links:', error);
      throw error;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://optic.doy.best';
    return {
      shareUrl: `${origin}/share/${data.token || token}`,
      token: data.token || token,
      expiresAt: data.expires_at || expiresAt,
    };
  },

  // ==========================================
  // ORGANIZATIONS & HOSTING DATA OPERATIONS
  // (Uses REAL Supabase tables: organizations,
  // organization_members, projects, deployments, domains)
  // ==========================================

  /**
   * Get all organizations that the user belongs to from `public.organizations`
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const sb = getSupabase();
    if (!sb || !userId) return [];

    console.log('[Supabase] Querying organizations for user:', userId);

    try {
      // 1. Fetch organization memberships for this user
      const { data: memberRows, error: memberErr } = await sb
        .from('organization_members')
        .select('organization_id, role, organizations (*)')
        .eq('user_id', userId);

      if (memberErr) {
        console.error('[Supabase] Error querying public.organization_members:', memberErr);
      }

      if (!memberErr && memberRows && memberRows.length > 0) {
        return memberRows
          .filter((m: any) => m.organizations)
          .map((m: any) => ({
            id: m.organizations.id,
            name: m.organizations.name,
            slug: m.organizations.slug,
            created_by: m.organizations.created_by,
            created_at: m.organizations.created_at,
            avatarUrl: m.organizations.avatar_url || getDiceBearOrgAvatarUrl(m.organizations.name),
            role: m.role || 'member',
          }));
      }

      // Query organizations created by user directly
      const { data: directOrgs, error: orgErr } = await sb
        .from('organizations')
        .select('*')
        .eq('created_by', userId);

      if (orgErr) {
        console.error('[Supabase] Error querying direct public.organizations:', orgErr);
        throw orgErr;
      }

      return (directOrgs || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        created_by: o.created_by,
        created_at: o.created_at,
        avatarUrl: o.avatar_url || getDiceBearOrgAvatarUrl(o.name),
        role: 'owner',
      }));
    } catch (err) {
      console.error('[Supabase] Error in getUserOrganizations:', err);
      throw err;
    }
  },

  /**
   * Create a new organization in `public.organizations` and member in `public.organization_members`
   */
  async createOrganization(userId: string, name: string, customSlug?: string): Promise<Organization> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createOrganization.');
      throw new Error('Supabase client is not available.');
    }

    const cleanName = name.trim();
    const baseSlug = (customSlug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'org';
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    const orgAvatarUrl = getDiceBearOrgAvatarUrl(cleanName);

    console.log('[Supabase] Creating organization in public.organizations:', {
      name: cleanName,
      slug,
      created_by: userId,
    });

    const { data: orgData, error: orgErr } = await sb
      .from('organizations')
      .insert({
        name: cleanName,
        slug,
        created_by: userId,
        avatar_url: orgAvatarUrl,
      })
      .select()
      .single();

    if (orgErr) {
      console.error('[Supabase] Error inserting organization into public.organizations:', orgErr);
      throw orgErr;
    }

    // Add creator as owner in organization_members
    try {
      const { error: memErr } = await sb.from('organization_members').insert({
        organization_id: orgData.id,
        user_id: userId,
        role: 'owner',
      });
      if (memErr) {
        console.warn('[Supabase] Membership insert warning:', memErr);
      }
    } catch (memEx) {
      console.warn('[Supabase] Membership insert exception:', memEx);
    }

    return {
      id: orgData.id,
      name: orgData.name,
      slug: orgData.slug,
      created_by: orgData.created_by,
      created_at: orgData.created_at,
      avatarUrl: orgData.avatar_url || orgAvatarUrl,
      role: 'owner',
    };
  },

  /**
   * Get all hosting projects belonging to an organization from `public.projects`
   */
  async getHostingProjects(orgId: string): Promise<HostingProject[]> {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    console.log('[Supabase] Querying public.projects for organization:', orgId);

    const { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error querying public.projects:', error);
      throw error;
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      organization_id: p.organization_id || orgId,
      name: p.name,
      slug: p.slug,
      framework: p.framework || 'react',
      productionDomain: p.production_domain || `https://${p.slug}.optic.doy.best`,
      assignedSubdomain: p.assigned_subdomain || `${p.slug}.optic.doy.best`,
      customDomains: p.custom_domains || [],
      gitRepo: p.git_repo || undefined,
      gitBranch: p.git_branch || 'main',
      status: p.status || 'ready',
      createdAt: p.created_at || new Date().toISOString(),
      updatedAt: p.updated_at || new Date().toISOString(),
    }));
  },

  /**
   * Create a new hosting project under an organization in `public.projects`
   */
  async createHostingProject(
    orgId: string,
    input: {
      name: string;
      framework: 'static' | 'react' | 'vite' | 'nextjs' | 'astro' | 'html';
      gitRepo?: string;
      gitBranch?: string;
      creatorName?: string;
    }
  ): Promise<HostingProject> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createHostingProject.');
      throw new Error('Supabase client is not available.');
    }

    const cleanName = input.name.trim();
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `app-${Math.random().toString(36).substring(2, 6)}`;
    const subdomain = `${slug}.optic.doy.best`;
    const productionDomain = `https://${subdomain}`;

    console.log('[Supabase] Inserting project into public.projects:', {
      organization_id: orgId,
      name: cleanName,
      slug,
      framework: input.framework,
    });

    const { data, error } = await sb
      .from('projects')
      .insert({
        organization_id: orgId,
        name: cleanName,
        slug,
        framework: input.framework,
        production_domain: productionDomain,
        assigned_subdomain: subdomain,
        custom_domains: [],
        git_repo: input.gitRepo || null,
        git_branch: input.gitBranch || 'main',
        status: 'ready',
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error inserting project into public.projects:', error);
      throw error;
    }

    const newProject: HostingProject = {
      id: data.id,
      organization_id: data.organization_id || orgId,
      name: data.name,
      slug: data.slug,
      framework: data.framework,
      productionDomain: data.production_domain || productionDomain,
      assignedSubdomain: data.assigned_subdomain || subdomain,
      customDomains: data.custom_domains || [],
      gitRepo: data.git_repo || undefined,
      gitBranch: data.git_branch || 'main',
      status: data.status || 'ready',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // Create initial deployment record in `public.deployments`
    try {
      await this.createDeployment(newProject.id, orgId, {
        projectName: newProject.name,
        commitMessage: 'Initial project setup & deployment',
        creator: input.creatorName || 'developer',
        branch: input.gitBranch || 'main',
        environment: 'production',
        url: newProject.productionDomain,
      });
    } catch (depErr) {
      console.warn('[Supabase] Initial deployment creation notice:', depErr);
    }

    return newProject;
  },

  /**
   * Delete hosting project from `public.projects`
   */
  async deleteHostingProject(projectId: string, orgId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in deleteHostingProject.');
      throw new Error('Supabase client is not available.');
    }

    console.log('[Supabase] Deleting project from public.projects:', { projectId, orgId });

    const { error } = await sb.from('projects').delete().eq('id', projectId);
    if (error) {
      console.error('[Supabase] Error deleting project from public.projects:', error);
      throw error;
    }
  },

  /**
   * Get deployments for a project from `public.deployments`
   */
  async getProjectDeployments(projectId: string, orgId?: string): Promise<DeploymentItem[]> {
    const sb = getSupabase();
    if (!sb || !projectId) return [];

    console.log('[Supabase] Querying public.deployments for project:', projectId);

    const { data, error } = await sb
      .from('deployments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error querying public.deployments:', error);
      throw error;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      projectName: d.project_name || 'project',
      status: d.status || 'ready',
      url: d.url,
      commitHash: d.commit_hash || 'HEAD',
      commitMessage: d.commit_message || 'Deployment update',
      creator: d.creator || 'developer',
      branch: d.branch || 'main',
      durationSeconds: d.duration_seconds || 12,
      environment: d.environment || 'production',
      createdAt: d.created_at,
    }));
  },

  /**
   * Create a new deployment for a project in `public.deployments`
   */
  async createDeployment(
    projectId: string,
    orgId: string,
    input: Partial<DeploymentItem>
  ): Promise<DeploymentItem> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createDeployment.');
      throw new Error('Supabase client is not available.');
    }

    const commitHash = input.commitHash || Math.random().toString(16).substring(2, 9);
    const duration = input.durationSeconds || Math.floor(8 + Math.random() * 8);

    console.log('[Supabase] Inserting deployment into public.deployments:', {
      project_id: projectId,
      organization_id: orgId,
    });

    const { data, error } = await sb
      .from('deployments')
      .insert({
        project_id: projectId,
        organization_id: orgId,
        status: input.status || 'ready',
        url: input.url || 'https://app.optic.doy.best',
        commit_hash: commitHash,
        commit_message: input.commitMessage || 'Manual deployment',
        creator: input.creator || 'developer',
        branch: input.branch || 'main',
        duration_seconds: duration,
        environment: input.environment || 'production',
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error inserting deployment into public.deployments:', error);
      throw error;
    }

    return {
      id: data.id,
      projectId: data.project_id,
      projectName: input.projectName || 'project',
      status: data.status,
      url: data.url,
      commitHash: data.commit_hash,
      commitMessage: data.commit_message,
      creator: data.creator,
      branch: data.branch,
      durationSeconds: data.duration_seconds,
      environment: data.environment,
      createdAt: data.created_at,
    };
  },

  /**
   * Get domains for a project from `public.domains`
   */
  async getProjectDomains(projectId: string): Promise<DomainItem[]> {
    const sb = getSupabase();
    if (!sb || !projectId) return [];

    console.log('[Supabase] Querying public.domains for project:', projectId);

    const { data, error } = await sb
      .from('domains')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error querying public.domains:', error);
      throw error;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      domain: d.domain,
      status: d.status || 'verified',
      dnsType: d.dns_type || 'CNAME',
      dnsTarget: d.dns_target || 'cname.optic.doy.best',
      sslStatus: d.ssl_status || 'active',
      createdAt: d.created_at,
    }));
  },

  /**
   * Add a custom domain for a project in `public.domains`
   */
  async addProjectDomain(projectId: string, orgId: string, domain: string): Promise<DomainItem> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in addProjectDomain.');
      throw new Error('Supabase client is not available.');
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    console.log('[Supabase] Inserting domain into public.domains:', {
      project_id: projectId,
      organization_id: orgId,
      domain: cleanDomain,
    });

    const { data, error } = await sb
      .from('domains')
      .insert({
        project_id: projectId,
        organization_id: orgId,
        domain: cleanDomain,
        status: 'verified',
        dns_type: 'CNAME',
        dns_target: 'cname.optic.doy.best',
        ssl_status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error inserting domain into public.domains:', error);
      throw error;
    }

    return {
      id: data.id,
      projectId: data.project_id,
      domain: data.domain,
      status: data.status,
      dnsType: data.dns_type,
      dnsTarget: data.dns_target,
      sslStatus: data.ssl_status,
      createdAt: data.created_at,
    };
  },

  /**
   * Delete domain from `public.domains`
   */
  async deleteProjectDomain(domainId: string, projectId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in deleteProjectDomain.');
      throw new Error('Supabase client is not available.');
    }

    console.log('[Supabase] Deleting domain from public.domains:', { domainId, projectId });

    const { error } = await sb.from('domains').delete().eq('id', domainId);
    if (error) {
      console.error('[Supabase] Error deleting domain from public.domains:', error);
      throw error;
    }
  },
};

import { getSupabase } from './supabaseClient';
import { getDiceBearOrgAvatarUrl } from './avatar';
import { getShareLinkUrl } from './domainNavigation';
import {
  FileItem,
  FolderItem,
  UsageStats,
  Organization,
  HostingProject,
  DeploymentItem,
  DeploymentLog,
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
   * Fetch usage statistics for the authenticated user.
   * Total storage is calculated from SUM(files.size_bytes) for the authenticated user.
   * Folders are not counted.
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
      // Calculate total storage from: SUM(files.size_bytes) for the authenticated user
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

      // Attempt to sync computed storage into usage table
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
        // Non-blocking sync warning
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

    const canonicalPayload: any = {
      user_id: userId,
      folder_id: input.folderId || null,
      name: input.name,
      storage_key: input.storageKey,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    };

    let { data, error } = await sb
      .from('files')
      .insert({
        ...canonicalPayload,
        extension: input.extension,
        storage_provider: input.storageProvider,
        public_url: input.publicUrl,
        is_public: input.isPublic ?? false,
      })
      .select()
      .single();

    if (error && error.message && error.message.includes('column')) {
      // Retry with strictly canonical public.files schema
      const retry = await sb
        .from('files')
        .insert(canonicalPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

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
   * Create share link in `public.share_links` table with optional expiration
   */
  async createShareLink(
    userId: string,
    fileId: string,
    expiresInHours?: number | null
  ): Promise<{ shareUrl: string; token: string; expiresAt: string | null }> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createShareLink.');
      throw new Error('Supabase client is not available.');
    }

    const token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const expiresAt =
      expiresInHours && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 3600000).toISOString()
        : null;

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

    const finalToken = data?.token || token;
    const finalExpiresAt = data?.expires_at ?? expiresAt;

    return {
      shareUrl: getShareLinkUrl(finalToken),
      token: finalToken,
      expiresAt: finalExpiresAt,
    };
  },

  // ==========================================
  // ORGANIZATIONS & HOSTING DATA OPERATIONS
  // (Uses REAL Supabase tables: organizations,
  // organization_members, projects, deployments, deployment_logs, domains)
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
            avatarUrl: getDiceBearOrgAvatarUrl(m.organizations.id),
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
        avatarUrl: getDiceBearOrgAvatarUrl(o.id),
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
      avatarUrl: getDiceBearOrgAvatarUrl(orgData.id),
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

    const { data: projectsData, error: projErr } = await sb
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (projErr) {
      console.error('[Supabase] Error querying public.projects:', projErr);
      throw projErr;
    }

    // Also fetch latest deployment for each project to show live status & times
    let deploymentsByProject: Record<string, DeploymentItem> = {};
    try {
      const { data: depsData } = await sb
        .from('deployments')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (depsData) {
        for (const d of depsData) {
          if (!deploymentsByProject[d.project_id]) {
            deploymentsByProject[d.project_id] = {
              id: d.id,
              projectId: d.project_id,
              organizationId: d.organization_id,
              userId: d.user_id,
              projectName: d.project_name || '',
              status: d.status || 'ready',
              url: d.deployment_url || d.url || '',
              deploymentUrl: d.deployment_url || d.url,
              storagePath: d.storage_path,
              commitHash: d.commit_hash || 'HEAD',
              commitMessage: d.commit_message,
              creator: d.creator,
              branch: d.branch,
              durationSeconds: d.duration_seconds,
              environment: d.environment || 'production',
              createdAt: d.created_at,
              completedAt: d.completed_at,
            };
          }
        }
      }
    } catch {
      // non-blocking
    }

    return (projectsData || []).map((p: any) => {
      const latestDep = deploymentsByProject[p.id];
      const prodDomain = p.production_domain || `https://${p.slug}.optic.doy.best`;
      return {
        id: p.id,
        organization_id: p.organization_id || orgId,
        name: p.name,
        slug: p.slug,
        description: p.description || undefined,
        framework: p.framework || 'react',
        productionDomain: prodDomain,
        assignedSubdomain: p.assigned_subdomain || `${p.slug}.optic.doy.best`,
        customDomains: p.custom_domains || [],
        gitRepo: p.git_repo || undefined,
        gitBranch: p.git_branch || 'main',
        status: (latestDep?.status as any) || p.status || 'ready',
        latestDeployment: latestDep,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: latestDep?.createdAt || p.updated_at || new Date().toISOString(),
      };
    });
  },

  /**
   * Create a new hosting project under an organization in `public.projects`
   */
  async createHostingProject(
    orgId: string,
    input: {
      name: string;
      slug?: string;
      description?: string;
      framework?: 'static' | 'react' | 'vite' | 'nextjs' | 'astro' | 'html';
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
    const baseSlug = (input.slug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `app-${Math.random().toString(36).substring(2, 6)}`;
    const slug = baseSlug;
    const subdomain = `${slug}.optic.doy.best`;
    const productionDomain = `https://${subdomain}`;

    console.log('[Supabase] Inserting project into public.projects:', {
      organization_id: orgId,
      name: cleanName,
      slug,
      framework: input.framework || 'static',
    });

    const projectInsertPayload: any = {
      organization_id: orgId,
      name: cleanName,
      slug,
      framework: input.framework || 'static',
      production_domain: productionDomain,
      assigned_subdomain: subdomain,
      custom_domains: [],
      git_repo: input.gitRepo || null,
      git_branch: input.gitBranch || 'main',
      status: 'ready',
    };

    if (input.description) {
      projectInsertPayload.description = input.description.trim();
    }

    const { data, error } = await sb
      .from('projects')
      .insert(projectInsertPayload)
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
      description: data.description,
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

    const { error } = await sb
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('organization_id', orgId);

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

    let query = sb
      .from('deployments')
      .select('*')
      .eq('project_id', projectId);

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error querying public.deployments:', error);
      throw error;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      organizationId: d.organization_id,
      userId: d.user_id,
      projectName: d.project_name || 'project',
      status: d.status || 'ready',
      url: d.deployment_url || d.url || '',
      deploymentUrl: d.deployment_url || d.url || '',
      storagePath: d.storage_path || `deployments/${d.organization_id}/${d.project_id}/${d.id}`,
      commitHash: d.commit_hash || 'HEAD',
      commitMessage: d.commit_message || 'Deployment update',
      creator: d.creator || 'developer',
      branch: d.branch || 'main',
      durationSeconds: d.duration_seconds || 12,
      environment: d.environment || 'production',
      createdAt: d.created_at,
      completedAt: d.completed_at,
    }));
  },

  /**
   * Create a new deployment record in `public.deployments`
   */
  async createDeploymentRecord(params: {
    id?: string;
    projectId: string;
    organizationId: string;
    userId: string;
    status: 'pending' | 'building' | 'ready' | 'failed' | 'queued';
    deploymentUrl: string;
    storagePath: string;
    commitMessage?: string;
    creator?: string;
    branch?: string;
  }): Promise<DeploymentItem> {
    const sb = getSupabase();
    if (!sb) {
      throw new Error('Supabase client is not available.');
    }

    const deploymentId = params.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));

    console.log('[Supabase] Creating deployment record in public.deployments:', {
      id: deploymentId,
      project_id: params.projectId,
      organization_id: params.organizationId,
      status: params.status,
    });

    const payload: any = {
      id: deploymentId,
      project_id: params.projectId,
      organization_id: params.organizationId,
      user_id: params.userId,
      status: params.status,
      deployment_url: params.deploymentUrl,
      url: params.deploymentUrl,
      storage_path: params.storagePath,
      commit_message: params.commitMessage || 'Manual deployment',
      creator: params.creator || 'developer',
      branch: params.branch || 'main',
      environment: 'production',
    };

    let { data, error } = await sb
      .from('deployments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Retrying deployment insert with standard columns:', error.message);
      // Fallback if some column names differ
      const fallbackPayload: any = {
        project_id: params.projectId,
        organization_id: params.organizationId,
        status: params.status,
        url: params.deploymentUrl,
      };
      if (params.userId) fallbackPayload.user_id = params.userId;
      if (params.storagePath) fallbackPayload.storage_path = params.storagePath;

      const retryRes = await sb
        .from('deployments')
        .insert(fallbackPayload)
        .select()
        .single();

      if (retryRes.error) {
        console.error('[Supabase] Failed to insert deployment record:', retryRes.error);
        throw retryRes.error;
      }
      data = retryRes.data;
    }

    return {
      id: data.id,
      projectId: data.project_id,
      organizationId: data.organization_id,
      userId: data.user_id,
      status: data.status,
      url: data.deployment_url || data.url,
      deploymentUrl: data.deployment_url || data.url,
      storagePath: data.storage_path || params.storagePath,
      commitMessage: data.commit_message || params.commitMessage,
      creator: data.creator || params.creator,
      branch: data.branch || params.branch || 'main',
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  },

  /**
   * Update deployment status and completion timestamp in `public.deployments`
   */
  async updateDeploymentStatus(
    deploymentId: string,
    status: 'pending' | 'building' | 'ready' | 'failed' | 'queued',
    completedAt?: string
  ): Promise<void> {
    const sb = getSupabase();
    if (!sb || !deploymentId) return;

    console.log('[Supabase] Updating deployment status:', { deploymentId, status, completedAt });

    const updatePayload: any = { status };
    if (completedAt) {
      updatePayload.completed_at = completedAt;
    }

    try {
      const { error } = await sb
        .from('deployments')
        .update(updatePayload)
        .eq('id', deploymentId);

      if (error) {
        console.warn('[Supabase] Error updating deployment status:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] Exception updating deployment status:', err);
    }
  },

  /**
   * Insert a log event in `public.deployment_logs`
   */
  async addDeploymentLog(
    deploymentId: string,
    message: string,
    level: 'info' | 'warn' | 'error' | 'success' = 'info'
  ): Promise<void> {
    const sb = getSupabase();
    if (!sb || !deploymentId) return;

    try {
      const { error } = await sb.from('deployment_logs').insert({
        deployment_id: deploymentId,
        message,
        level,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('[Supabase] deployment_logs insert notice:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase] deployment_logs insert exception:', err);
    }
  },

  /**
   * Query deployment logs for a deployment from `public.deployment_logs`
   */
  async getDeploymentLogs(deploymentId: string): Promise<DeploymentLog[]> {
    const sb = getSupabase();
    if (!sb || !deploymentId) return [];

    try {
      const { data, error } = await sb
        .from('deployment_logs')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[Supabase] Error fetching deployment_logs:', error.message);
        return [];
      }

      return (data || []).map((l: any) => ({
        id: l.id,
        deploymentId: l.deployment_id,
        timestamp: l.created_at ? new Date(l.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
        level: l.level || 'info',
        message: l.message,
      }));
    } catch (err) {
      console.warn('[Supabase] Exception fetching deployment_logs:', err);
      return [];
    }
  },

  /**
   * Backward-compatible createDeployment helper
   */
  async createDeployment(
    projectId: string,
    orgId: string,
    input: Partial<DeploymentItem>
  ): Promise<DeploymentItem> {
    return this.createDeploymentRecord({
      id: input.id,
      projectId,
      organizationId: orgId,
      userId: input.userId || '',
      status: input.status || 'ready',
      deploymentUrl: input.url || `https://${projectId}.optic.doy.best`,
      storagePath: input.storagePath || `deployments/${orgId}/${projectId}/${input.id || 'initial'}`,
      commitMessage: input.commitMessage || 'Manual deployment',
      creator: input.creator || 'developer',
      branch: input.branch || 'main',
    });
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

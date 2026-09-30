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
        filesCount: (userFiles || []).length,
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
  async getUserOrganizations(userId?: string): Promise<Organization[]> {
    const sb = getSupabase();
    if (!sb) return [];

    try {
      // 1. Resolve currently authenticated Supabase user
      const { data: authData } = await sb.auth.getUser();
      const verifiedUserId = authData?.user?.id || userId;
      if (!verifiedUserId) return [];

      console.log('[Supabase] Querying organizations for verified user:', verifiedUserId);

      const orgMap = new Map<string, Organization>();
      const memberOrgIds: string[] = [];

      // 2. Fetch memberships from public.organization_members
      try {
        const { data: memberRows, error: memberErr } = await sb
          .from('organization_members')
          .select('organization_id, role, organizations (*)')
          .eq('user_id', verifiedUserId);

        if (memberErr) {
          console.warn('[Supabase] Note on public.organization_members lookup:', memberErr.message);
        } else if (memberRows && Array.isArray(memberRows)) {
          for (const m of memberRows) {
            if (m.organization_id) {
              memberOrgIds.push(m.organization_id);
            }
            // In postgrest, embedded relation can be an object or an array
            const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
            if (org && org.id) {
              orgMap.set(org.id, {
                id: org.id,
                name: org.name,
                slug: org.slug,
                created_by: org.created_by,
                created_at: org.created_at,
                avatarUrl: getDiceBearOrgAvatarUrl(org.id),
                role: m.role || 'member',
              });
            }
          }
        }
      } catch (memLookupEx) {
        console.warn('[Supabase] Exception querying organization_members:', memLookupEx);
      }

      // 3. If membership rows existed but embedded organizations was omitted, query them by id
      if (memberOrgIds.length > 0 && orgMap.size < memberOrgIds.length) {
        const missingIds = memberOrgIds.filter((id) => !orgMap.has(id));
        if (missingIds.length > 0) {
          try {
            const { data: fetchedOrgs, error: fetchErr } = await sb
              .from('organizations')
              .select('*')
              .in('id', missingIds);

            if (!fetchErr && fetchedOrgs) {
              for (const o of fetchedOrgs) {
                orgMap.set(o.id, {
                  id: o.id,
                  name: o.name,
                  slug: o.slug,
                  created_by: o.created_by,
                  created_at: o.created_at,
                  avatarUrl: getDiceBearOrgAvatarUrl(o.id),
                  role: 'member',
                });
              }
            }
          } catch (e) {
            console.warn('[Supabase] Exception fetching orgs by id list:', e);
          }
        }
      }

      // 4. Also query organizations created by the user directly to guarantee all user orgs are visible
      try {
        const { data: directOrgs, error: orgErr } = await sb
          .from('organizations')
          .select('*')
          .eq('created_by', verifiedUserId);

        if (orgErr) {
          console.warn('[Supabase] Note on direct organizations lookup:', orgErr.message);
        } else if (directOrgs && Array.isArray(directOrgs)) {
          for (const o of directOrgs) {
            if (!orgMap.has(o.id)) {
              orgMap.set(o.id, {
                id: o.id,
                name: o.name,
                slug: o.slug,
                created_by: o.created_by,
                created_at: o.created_at,
                avatarUrl: getDiceBearOrgAvatarUrl(o.id),
                role: 'owner',
              });

              // Self-heal: ensure creator is recorded in organization_members
              sb.from('organization_members')
                .insert({
                  organization_id: o.id,
                  user_id: verifiedUserId,
                  role: 'owner',
                })
                .then(({ error }: any) => {
                  if (error && error.code !== '23505') {
                    console.warn('[Supabase] Note on self-healing organization membership:', error.message);
                  }
                });
            } else {
              // If already found and created_by matches, ensure role is owner
              const existing = orgMap.get(o.id);
              if (existing && existing.created_by === verifiedUserId) {
                existing.role = 'owner';
              }
            }
          }
        }
      } catch (directLookupEx) {
        console.warn('[Supabase] Exception querying direct organizations:', directLookupEx);
      }

      const results = Array.from(orgMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log('[Supabase] Loaded organizations count for user:', results.length);
      return results;
    } catch (err) {
      console.error('[Supabase] Error in getUserOrganizations:', err);
      throw err;
    }
  },

  /**
   * Create a new organization in `public.organizations` and member in `public.organization_members`
   */
  async createOrganization(_userIdParam?: string, name?: string, customSlug?: string): Promise<Organization> {
    const sb = getSupabase();
    if (!sb) {
      console.error('[Supabase] Supabase client is not available in createOrganization.');
      throw new Error('Supabase client is not available.');
    }

    // 1. Resolve and verify the currently authenticated Supabase user
    // CRITICAL: Always use authenticated user from sb.auth.getUser() to satisfy RLS: created_by = (select auth.uid())
    const { data: authData, error: authErr } = await sb.auth.getUser();
    const verifiedUser = authData?.user;
    if (authErr || !verifiedUser?.id) {
      console.error('[Supabase] Auth session error in createOrganization:', authErr);
      throw new Error('You must be signed in with an active account to create an organization.');
    }
    const verifiedUserId = verifiedUser.id;

    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Organization name is required.');
    }

    const baseSlug = (customSlug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'org';
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
    const orgId = crypto.randomUUID();

    console.log('[Supabase] Creating organization in public.organizations:', {
      id: orgId,
      name: cleanName,
      slug,
      created_by: verifiedUserId,
    });

    // Step 1: organizations INSERT
    const orgPayload = {
      id: orgId,
      name: cleanName,
      slug,
      created_by: verifiedUserId,
    };

    const { data: insertedOrg, error: orgErr } = await sb
      .from('organizations')
      .insert(orgPayload)
      .select()
      .maybeSingle();

    if (orgErr) {
      console.error('[Supabase] Error inserting organization into public.organizations:', orgErr);
      throw orgErr;
    }

    const finalOrg = insertedOrg || orgPayload;

    // Step 2: organization_members INSERT
    // Creator automatically becomes role = 'owner'
    const { error: memErr } = await sb.from('organization_members').insert({
      organization_id: finalOrg.id,
      user_id: verifiedUserId,
      role: 'owner',
    });

    if (memErr) {
      // Ignore 23505 (unique violation) in case a DB trigger already created the membership record
      if (memErr.code !== '23505') {
        console.error('[Supabase] Error inserting owner into public.organization_members:', memErr);
        throw new Error(`Failed to assign organization membership: ${memErr.message}`);
      }
    }

    return {
      id: finalOrg.id,
      name: finalOrg.name,
      slug: finalOrg.slug,
      created_by: finalOrg.created_by,
      created_at: finalOrg.created_at || new Date().toISOString(),
      avatarUrl: getDiceBearOrgAvatarUrl(finalOrg.id),
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

    const { data: pData, error: projErr } = await sb
      .from('projects')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (projErr) {
      console.error('[Supabase] Error querying public.projects:', projErr);
      throw projErr;
    }

    const projectsData = pData || [];

    // Also fetch latest deployment for each project from public.deployments
    let deploymentsByProject: Record<string, DeploymentItem> = {};
    try {
      const { data: dData } = await sb
        .from('deployments')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (dData) {
        for (const d of dData) {
          if (!deploymentsByProject[d.project_id]) {
            deploymentsByProject[d.project_id] = {
              id: d.id,
              projectId: d.project_id,
              organizationId: d.organization_id,
              userId: d.user_id,
              projectName: d.project_name || '',
              status: d.status || 'ready',
              url: d.deployment_url || d.url || '',
              deploymentUrl: d.deployment_url || d.url || '',
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
      const prodDomain =
        latestDep?.deploymentUrl ||
        latestDep?.url ||
        p.production_domain ||
        (latestDep?.id ? `/api/deployments/${latestDep.id}/` : `https://${p.slug}.optic.doy.best`);
      return {
        id: p.id,
        organization_id: p.organization_id || orgId,
        name: p.name,
        slug: p.slug,
        description: p.description || undefined,
        framework: p.framework || 'react',
        buildCommand: p.build_command || p.buildConfig?.buildCommand || undefined,
        outputDirectory: p.output_directory || p.buildConfig?.outputDirectory || undefined,
        packageManager: p.package_manager || p.buildConfig?.packageManager || undefined,
        nodeVersion: p.node_version || p.buildConfig?.nodeVersion || undefined,
        installCommand: p.install_command || p.buildConfig?.installCommand || undefined,
        rootDirectory: p.root_directory || p.buildConfig?.rootDirectory || undefined,
        buildConfig: p.build_config || undefined,
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
      framework?: string;
      gitRepo?: string;
      gitBranch?: string;
      creatorName?: string;
      userId?: string;
      buildCommand?: string;
      outputDirectory?: string;
      packageManager?: string;
      nodeVersion?: string;
      installCommand?: string;
      rootDirectory?: string;
      buildConfig?: any;
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
      buildCommand: input.buildCommand,
      outputDirectory: input.outputDirectory,
      packageManager: input.packageManager,
    });

    // Resolve authenticated user to preserve creator/user relationship and satisfy RLS
    const { data: authData } = await sb.auth.getUser();
    const verifiedUserId = authData?.user?.id || input.userId;

    const projectInsertPayload: any = {
      organization_id: orgId,
      name: cleanName,
      slug,
      framework: input.framework || 'static',
      production_domain: productionDomain,
      custom_domains: [],
      git_repo: input.gitRepo || null,
      git_branch: input.gitBranch || 'main',
      status: 'ready',
    };

    if (verifiedUserId) {
      projectInsertPayload.user_id = verifiedUserId;
      projectInsertPayload.created_by = verifiedUserId;
    }

    if (input.buildCommand) projectInsertPayload.build_command = input.buildCommand;
    if (input.outputDirectory) projectInsertPayload.output_directory = input.outputDirectory;
    if (input.packageManager) projectInsertPayload.package_manager = input.packageManager;
    if (input.nodeVersion) projectInsertPayload.node_version = input.nodeVersion;
    if (input.installCommand) projectInsertPayload.install_command = input.installCommand;
    if (input.rootDirectory) projectInsertPayload.root_directory = input.rootDirectory;
    if (input.buildConfig) projectInsertPayload.build_config = input.buildConfig;

    if (input.description) {
      projectInsertPayload.description = input.description.trim();
    }

    // Explicitly ensure assigned_subdomain is never included as it does not exist in public.projects
    delete projectInsertPayload.assigned_subdomain;

    let projectData = null;
    let currentPayload = { ...projectInsertPayload };
    let { data, error } = await sb
      .from('projects')
      .insert(currentPayload)
      .select()
      .single();

    // Self-healing schema loop: if any optional column is not present in public.projects schema cache,
    // strip the missing column and retry immediately
    let maxRetries = 8;
    while (error && maxRetries > 0) {
      maxRetries--;
      const msg = error.message || '';
      console.warn('[Supabase] Insert projects error attempt:', msg);

      // Check if error is "Could not find the 'xyz' column of 'projects' in the schema cache"
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && currentPayload[match[1]] !== undefined) {
        const missingCol = match[1];
        console.warn(`[Supabase] Stripping non-existent column '${missingCol}' from projects insert and retrying...`);
        delete currentPayload[missingCol];
        const res = await sb.from('projects').insert(currentPayload).select().single();
        data = res.data;
        error = res.error;
        continue;
      }

      // Check if user_id or created_by caused an error
      if (msg.includes('user_id') && currentPayload.user_id) {
        delete currentPayload.user_id;
        const res = await sb.from('projects').insert(currentPayload).select().single();
        data = res.data;
        error = res.error;
        continue;
      }
      if (msg.includes('created_by') && currentPayload.created_by) {
        delete currentPayload.created_by;
        const res = await sb.from('projects').insert(currentPayload).select().single();
        data = res.data;
        error = res.error;
        continue;
      }

      // Fallback: minimal standard columns
      const minimalPayload: any = {
        organization_id: orgId,
        name: cleanName,
        slug,
      };
      if (currentPayload.framework) minimalPayload.framework = currentPayload.framework;
      if (currentPayload.description) minimalPayload.description = currentPayload.description;
      if (verifiedUserId) minimalPayload.created_by = verifiedUserId;

      const fallbackRes = await sb.from('projects').insert(minimalPayload).select().single();
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
        break;
      } else if (fallbackRes.error?.message?.includes('created_by')) {
        delete minimalPayload.created_by;
        if (verifiedUserId) minimalPayload.user_id = verifiedUserId;
        const res2 = await sb.from('projects').insert(minimalPayload).select().single();
        if (!res2.error && res2.data) {
          data = res2.data;
          error = null;
          break;
        }
      }
      break;
    }

    if (error) {
      console.error('[Supabase] Failed to insert project into public.projects:', error);
      throw error;
    }

    projectData = data;

    const newProject: HostingProject = {
      id: projectData.id,
      organization_id: projectData.organization_id || orgId,
      name: projectData.name,
      slug: projectData.slug,
      description: projectData.description,
      framework: projectData.framework,
      buildCommand: projectData.build_command || input.buildCommand,
      outputDirectory: projectData.output_directory || input.outputDirectory,
      packageManager: projectData.package_manager || input.packageManager,
      nodeVersion: projectData.node_version || input.nodeVersion,
      installCommand: projectData.install_command || input.installCommand,
      rootDirectory: projectData.root_directory || input.rootDirectory,
      buildConfig: projectData.build_config || input.buildConfig,
      productionDomain: projectData.production_domain || productionDomain,
      assignedSubdomain: projectData.assigned_subdomain || subdomain,
      customDomains: projectData.custom_domains || [],
      gitRepo: projectData.git_repo || undefined,
      gitBranch: projectData.git_branch || 'main',
      status: projectData.status || 'ready',
      createdAt: projectData.created_at,
      updatedAt: projectData.updated_at,
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
    framework?: string;
    buildCommand?: string;
    outputDirectory?: string;
    packageManager?: string;
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
      framework: params.framework,
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

    if (params.framework) payload.framework = params.framework;
    if (params.buildCommand) payload.build_command = params.buildCommand;
    if (params.outputDirectory) payload.output_directory = params.outputDirectory;
    if (params.packageManager) payload.package_manager = params.packageManager;

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
        console.warn('[Supabase] Trying fallback insert to hosting_deployments:', retryRes.error.message);
        const hdPayload = {
          project_id: params.projectId,
          organization_id: params.organizationId,
          status: params.status,
          url: params.deploymentUrl,
        };
        const hdRes = await sb
          .from('hosting_deployments')
          .insert(hdPayload)
          .select()
          .single();

        if (hdRes.error) {
          console.error('[Supabase] Failed to insert deployment record:', hdRes.error);
          throw hdRes.error;
        }
        data = hdRes.data;
      } else {
        data = retryRes.data;
      }
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
      framework: data.framework || params.framework,
      buildCommand: data.build_command || params.buildCommand,
      outputDirectory: data.output_directory || params.outputDirectory,
      packageManager: data.package_manager || params.packageManager,
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
        console.warn('[Supabase] Error updating deployment status, trying hosting_deployments:', error.message);
        await sb
          .from('hosting_deployments')
          .update(updatePayload)
          .eq('id', deploymentId);
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

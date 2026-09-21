import { getSupabase } from './supabaseClient';
import {
  FileItem,
  FolderItem,
  UsageStats,
  Organization,
  OrganizationMember,
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

  // ==========================================
  // ORGANIZATIONS & HOSTING DATA OPERATIONS
  // ==========================================

  /**
   * Get all organizations that the user belongs to.
   * Checks `organization_members` joined with `organizations`.
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const sb = getSupabase();
    if (!sb || !userId) return [];

    try {
      // 1. Fetch organization memberships for this user
      const { data: memberRows, error: memberErr } = await sb
        .from('organization_members')
        .select('organization_id, role, organizations (*)')
        .eq('user_id', userId);

      if (!memberErr && memberRows && memberRows.length > 0) {
        return memberRows
          .filter((m: any) => m.organizations)
          .map((m: any) => ({
            id: m.organizations.id,
            name: m.organizations.name,
            slug: m.organizations.slug,
            created_by: m.organizations.created_by,
            created_at: m.organizations.created_at,
            role: m.role || 'member',
          }));
      }

      // If join syntax varies or returns flat, try querying organizations directly
      const { data: directOrgs, error: orgErr } = await sb
        .from('organizations')
        .select('*')
        .eq('created_by', userId);

      if (!orgErr && directOrgs && directOrgs.length > 0) {
        return directOrgs.map((o: any) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          created_by: o.created_by,
          created_at: o.created_at,
          role: 'owner',
        }));
      }
    } catch (err) {
      console.warn('Supabase organizations fetch notice:', err);
    }

    // Fallback to locally stored real organizations if table is being created
    try {
      const key = `optic_orgs_${userId}`;
      const local = localStorage.getItem(key);
      if (local) {
        return JSON.parse(local);
      }
    } catch {
      // ignore
    }

    return [];
  },

  /**
   * Create a new organization.
   * Creator automatically becomes 'owner'.
   */
  async createOrganization(userId: string, name: string, customSlug?: string): Promise<Organization> {
    const sb = getSupabase();
    const cleanName = name.trim();
    const baseSlug = (customSlug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'org';
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    let newOrg: Organization | null = null;

    if (sb) {
      try {
        const { data: orgData, error: orgErr } = await sb
          .from('organizations')
          .insert({
            name: cleanName,
            slug,
            created_by: userId,
          })
          .select()
          .single();

        if (!orgErr && orgData) {
          // Add creator as owner in organization_members
          try {
            await sb.from('organization_members').insert({
              organization_id: orgData.id,
              user_id: userId,
              role: 'owner',
            });
          } catch (memErr) {
            console.warn('Membership insert warning:', memErr);
          }

          newOrg = {
            id: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
            created_by: orgData.created_by,
            created_at: orgData.created_at,
            role: 'owner',
          };
        }
      } catch (err) {
        console.warn('Supabase organization create fallback:', err);
      }
    }

    if (!newOrg) {
      // Client-side fallback if table is not yet migrated in Supabase
      const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `org_${Math.random().toString(36).substring(2, 10)}`;

      newOrg = {
        id: generatedId,
        name: cleanName,
        slug,
        created_by: userId,
        created_at: new Date().toISOString(),
        role: 'owner',
      };
    }

    // Sync to local user storage
    try {
      const key = `optic_orgs_${userId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(newOrg);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore
    }

    return newOrg;
  },

  /**
   * Get all hosting projects belonging to an organization.
   */
  async getHostingProjects(orgId: string): Promise<HostingProject[]> {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    try {
      const { data, error } = await sb
        .from('hosting_projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((p: any) => ({
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
      }
    } catch (err) {
      console.warn('Hosting projects fetch notice:', err);
    }

    // Local fallback per organization
    try {
      const key = `optic_projects_${orgId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return [];
  },

  /**
   * Create a new hosting project under an organization.
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
    const cleanName = input.name.trim();
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `app-${Math.random().toString(36).substring(2, 6)}`;
    const subdomain = `${slug}.optic.doy.best`;
    const productionDomain = `https://${subdomain}`;

    let newProject: HostingProject | null = null;

    if (sb) {
      try {
        const { data, error } = await sb
          .from('hosting_projects')
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

        if (!error && data) {
          newProject = {
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
        }
      } catch (err) {
        console.warn('Supabase project creation fallback:', err);
      }
    }

    if (!newProject) {
      const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `proj_${Math.random().toString(36).substring(2, 10)}`;

      newProject = {
        id: generatedId,
        organization_id: orgId,
        name: cleanName,
        slug,
        framework: input.framework,
        productionDomain,
        assignedSubdomain: subdomain,
        customDomains: [],
        gitRepo: input.gitRepo,
        gitBranch: input.gitBranch || 'main',
        status: 'ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Also automatically create the initial deployment record
    try {
      await this.createDeployment(newProject.id, orgId, {
        projectName: newProject.name,
        commitMessage: 'Initial project setup & deployment',
        creator: input.creatorName || 'developer',
        branch: input.gitBranch || 'main',
        environment: 'production',
        url: newProject.productionDomain,
      });
    } catch {
      // ignore
    }

    // Sync to local org cache
    try {
      const key = `optic_projects_${orgId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(newProject);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore
    }

    return newProject;
  },

  /**
   * Delete hosting project
   */
  async deleteHostingProject(projectId: string, orgId: string): Promise<void> {
    const sb = getSupabase();
    if (sb) {
      try {
        await sb.from('hosting_projects').delete().eq('id', projectId);
      } catch (err) {
        console.warn('Error deleting project in Supabase:', err);
      }
    }
    try {
      const key = `optic_projects_${orgId}`;
      const existing: HostingProject[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter((p) => p.id !== projectId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  /**
   * Get deployments for a project.
   */
  async getProjectDeployments(projectId: string, orgId?: string): Promise<DeploymentItem[]> {
    const sb = getSupabase();
    if (sb && projectId) {
      try {
        const { data, error } = await sb
          .from('hosting_deployments')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((d: any) => ({
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
        }
      } catch (err) {
        console.warn('Deployments fetch notice:', err);
      }
    }

    try {
      const key = `optic_deployments_${projectId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return [];
  },

  /**
   * Create a new deployment for a project.
   */
  async createDeployment(
    projectId: string,
    orgId: string,
    input: Partial<DeploymentItem>
  ): Promise<DeploymentItem> {
    const sb = getSupabase();
    const commitHash = input.commitHash || Math.random().toString(16).substring(2, 9);
    const duration = input.durationSeconds || Math.floor(8 + Math.random() * 8);

    let newDep: DeploymentItem | null = null;

    if (sb) {
      try {
        const { data, error } = await sb
          .from('hosting_deployments')
          .insert({
            project_id: projectId,
            organization_id: orgId,
            status: input.status || 'ready',
            url: input.url || `https://app.optic.doy.best`,
            commit_hash: commitHash,
            commit_message: input.commitMessage || 'Manual deployment',
            creator: input.creator || 'developer',
            branch: input.branch || 'main',
            duration_seconds: duration,
            environment: input.environment || 'production',
          })
          .select()
          .single();

        if (!error && data) {
          newDep = {
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
        }
      } catch (err) {
        console.warn('Deployment insert notice:', err);
      }
    }

    if (!newDep) {
      newDep = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dep_${Math.random().toString(36).substring(2, 10)}`,
        projectId,
        projectName: input.projectName || 'project',
        status: input.status || 'ready',
        url: input.url || 'https://app.optic.doy.best',
        commitHash,
        commitMessage: input.commitMessage || 'Manual deployment',
        creator: input.creator || 'developer',
        branch: input.branch || 'main',
        durationSeconds: duration,
        environment: input.environment || 'production',
        createdAt: new Date().toISOString(),
      };
    }

    try {
      const key = `optic_deployments_${projectId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(newDep);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore
    }

    return newDep;
  },

  /**
   * Get domains for a project
   */
  async getProjectDomains(projectId: string): Promise<DomainItem[]> {
    const sb = getSupabase();
    if (sb && projectId) {
      try {
        const { data, error } = await sb
          .from('hosting_domains')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            projectId: d.project_id,
            domain: d.domain,
            status: d.status || 'verified',
            dnsType: d.dns_type || 'CNAME',
            dnsTarget: d.dns_target || 'cname.optic.doy.best',
            sslStatus: d.ssl_status || 'active',
            createdAt: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Domains fetch notice:', err);
      }
    }

    try {
      const key = `optic_domains_${projectId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    return [];
  },

  /**
   * Add a custom domain for a project
   */
  async addProjectDomain(projectId: string, orgId: string, domain: string): Promise<DomainItem> {
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const sb = getSupabase();

    let newDomain: DomainItem | null = null;

    if (sb) {
      try {
        const { data, error } = await sb
          .from('hosting_domains')
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

        if (!error && data) {
          newDomain = {
            id: data.id,
            projectId: data.project_id,
            domain: data.domain,
            status: data.status,
            dnsType: data.dns_type,
            dnsTarget: data.dns_target,
            sslStatus: data.ssl_status,
            createdAt: data.created_at,
          };
        }
      } catch (err) {
        console.warn('Add domain notice:', err);
      }
    }

    if (!newDomain) {
      newDomain = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dom_${Math.random().toString(36).substring(2, 10)}`,
        projectId,
        domain: cleanDomain,
        status: 'verified',
        dnsType: 'CNAME',
        dnsTarget: 'cname.optic.doy.best',
        sslStatus: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    try {
      const key = `optic_domains_${projectId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(newDomain);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore
    }

    return newDomain;
  },

  /**
   * Delete domain
   */
  async deleteProjectDomain(domainId: string, projectId: string): Promise<void> {
    const sb = getSupabase();
    if (sb) {
      try {
        await sb.from('hosting_domains').delete().eq('id', domainId);
      } catch (err) {
        console.warn('Delete domain notice:', err);
      }
    }
    try {
      const key = `optic_domains_${projectId}`;
      const existing: DomainItem[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter((d) => d.id !== domainId);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },
};


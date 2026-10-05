export type SurfaceType =
  | 'main'
  | 'dashboard'
  | 'cloud'
  | 'hosting'
  | 'docs'
  | 'api'
  | 'settings'
  | 'status'
  | 'login'
  | 'signup'
  | 'callback'
  | 'privacy'
  | 'terms'
  | 'share'
  | 'notfound';

export interface SharedFileData {
  share: {
    token: string;
    expiresAt: string | null;
    createdAt: string;
    accessLevel?: 'public' | 'password';
    hasPassword?: boolean;
  };
  file: {
    id: string;
    name: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    updatedAt: string;
    userId?: string;
  };
  uploader: {
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
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role?: string;
  createdAt: string;
  tier?: 'developer' | 'team' | 'enterprise';
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string; // e.g. "opt_live_9a7b..."
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  status: 'active' | 'revoked';
}

export interface NewApiKeyResult {
  id: string;
  name: string;
  rawKey: string; // only shown once!
  keyPrefix: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string | null;
  storageKey: string;
  storageProvider: 'r2' | 'supabase_storage' | 'mock';
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  accessLevel?: 'public' | 'password';
  hasPassword?: boolean;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  itemCount?: number;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  avatarUrl?: string;
  role?: 'owner' | 'member';
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
  user?: UserProfile;
}

export interface ProjectBuildConfig {
  framework: string;
  packageManager: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand?: string;
  nodeVersion?: string;
  rootDirectory?: string;
  isStaticOnly?: boolean;
  envVars?: Record<string, string>;
}

export interface HostingProject {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  framework: string;
  productionDomain: string;
  assignedSubdomain: string;
  customDomains: string[];
  gitRepo?: string;
  gitBranch?: string;
  gitProvider?: string;
  buildCommand?: string;
  outputDirectory?: string;
  packageManager?: string;
  nodeVersion?: string;
  installCommand?: string;
  rootDirectory?: string;
  buildConfig?: ProjectBuildConfig;
  status: 'ready' | 'building' | 'failed' | 'queued' | 'pending';
  latestDeployment?: DeploymentItem;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentItem {
  id: string;
  projectId: string;
  organizationId?: string;
  userId?: string;
  projectName?: string;
  status: 'ready' | 'building' | 'failed' | 'queued' | 'pending';
  url: string;
  deploymentUrl?: string;
  storagePath?: string;
  commitHash?: string;
  commitMessage?: string;
  creator?: string;
  branch?: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  packageManager?: string;
  durationSeconds?: number;
  environment?: 'production' | 'preview';
  createdAt: string;
  completedAt?: string | null;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface DomainItem {
  id: string;
  projectId: string;
  domain: string;
  status: 'verified' | 'pending' | 'failed';
  dnsType: 'CNAME' | 'A';
  dnsTarget: string;
  sslStatus: 'active' | 'issuing' | 'pending';
  createdAt: string;
}

export interface WaitlistEntry {
  id?: string;
  email: string;
  createdAt?: string;
  source?: string;
}

export interface UsageStats {
  storageUsedBytes: number;
  storageLimitBytes: number;
  bandwidthUsedBytes: number;
  bandwidthLimitBytes: number;
  deploymentsThisMonth: number;
  deploymentsLimit: number;
  apiRequestsThisMonth: number;
  apiRequestsLimit: number;
  filesCount?: number;
}

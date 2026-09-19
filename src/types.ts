export type SurfaceType = 'main' | 'dashboard' | 'cloud' | 'hosting' | 'docs' | 'settings' | 'login' | 'signup' | 'callback' | 'privacy' | 'terms';

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
  folderPath?: string;
  storageKey: string;
  storageProvider: 'r2' | 'supabase_storage' | 'mock';
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  path: string;
  itemCount: number;
  createdAt: string;
}

export interface HostingProject {
  id: string;
  name: string;
  slug: string;
  framework: 'static' | 'react' | 'vite' | 'nextjs' | 'astro' | 'html';
  productionDomain: string;
  assignedSubdomain: string;
  customDomains: string[];
  gitRepo?: string;
  gitBranch?: string;
  status: 'ready' | 'building' | 'failed' | 'queued';
  latestDeployment?: DeploymentItem;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentItem {
  id: string;
  projectId: string;
  projectName: string;
  status: 'ready' | 'building' | 'failed' | 'queued';
  url: string;
  commitHash?: string;
  commitMessage?: string;
  creator: string;
  branch: string;
  durationSeconds?: number;
  environment: 'production' | 'preview';
  createdAt: string;
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
}

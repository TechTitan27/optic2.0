import { getSupabase } from './supabaseClient';
import { SanitizedGitHubRepository, SanitizedGitHubBranch } from '../server/githubServer';

export interface GitHubStatusResult {
  success: boolean;
  configured: boolean;
  connected: boolean;
  account?: {
    username: string;
    avatarUrl?: string;
    githubUserId?: number;
    connectedAt?: string;
  };
  error?: string;
}

export interface GitHubAuthUrlResult {
  success: boolean;
  configured?: boolean;
  url?: string;
  state?: string;
  error?: string;
}

export interface GitHubRepositoriesResult {
  success: boolean;
  repositories: SanitizedGitHubRepository[];
  error?: string;
}

export interface GitHubBranchesResult {
  success: boolean;
  branches: SanitizedGitHubBranch[];
  error?: string;
}

class GitHubService {
  private async getAuthToken(): Promise<string | null> {
    try {
      const sb = getSupabase();
      if (!sb) return null;
      const { data: { session } } = await sb.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Check connection status of authenticated user's GitHub account
   */
  async getStatus(): Promise<GitHubStatusResult> {
    try {
      const token = await this.getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/hosting?action=github-status', {
        headers,
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        configured: true,
        connected: false,
        error: err?.message || 'Failed to check GitHub connection status.',
      };
    }
  }

  /**
   * Request GitHub OAuth authorization URL for popup or redirect flow
   */
  async getAuthUrl(returnUrl?: string): Promise<GitHubAuthUrlResult> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'Please sign in to Optic before connecting your GitHub account.',
        };
      }

      const defaultReturn =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/hosting/new';
      const targetReturn = returnUrl || defaultReturn;

      const res = await fetch(
        `/api/hosting?action=github-auth-url&returnUrl=${encodeURIComponent(targetReturn)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to generate GitHub authorization URL.',
      };
    }
  }

  /**
   * Disconnect user's GitHub account
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Unauthorized' };
      }

      const res = await fetch('/api/hosting?action=github-disconnect', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to disconnect GitHub account.',
      };
    }
  }

  /**
   * Fetch repositories accessible to the user
   */
  async getRepositories(search?: string): Promise<GitHubRepositoriesResult> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          repositories: [],
          error: 'Please sign in to view your repositories.',
        };
      }

      let fetchUrl = '/api/hosting?action=github-repos';
      if (search && search.trim()) {
        fetchUrl += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await fetch(fetchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok && data?.error) {
        return {
          success: false,
          repositories: [],
          error: data.error,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        repositories: [],
        error: err?.message || 'Failed to load GitHub repositories.',
      };
    }
  }

  /**
   * Fetch branches for a specific repository
   */
  async getBranches(owner: string, repo: string): Promise<GitHubBranchesResult> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          branches: [],
          error: 'Please sign in to view repository branches.',
        };
      }

      const fetchUrl = `/api/hosting?action=github-branches&owner=${encodeURIComponent(
        owner
      )}&repo=${encodeURIComponent(repo)}`;

      const res = await fetch(fetchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok && data?.error) {
        return {
          success: false,
          branches: [],
          error: data.error,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        branches: [],
        error: err?.message || 'Failed to load repository branches.',
      };
    }
  }

  /**
   * Save / confirm project configuration with GitHub repository targeting
   */
  async saveProject(params: {
    orgId: string;
    name: string;
    slug: string;
    description?: string;
    framework: string;
    gitRepo: string;
    gitBranch: string;
    buildCommand?: string;
    outputDirectory?: string;
    rootDirectory?: string;
  }): Promise<{ success: boolean; project?: any; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'Unauthorized. Sign in required.' };
      }

      const res = await fetch('/api/hosting?action=github-save-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to save GitHub project configuration.',
      };
    }
  }

  /**
   * Detect framework and runtime from repository files
   */
  async detectFramework(
    owner: string,
    repo: string,
    branch: string = 'main',
    rootDirectory: string = ''
  ): Promise<{ success: boolean; detection?: any; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Unauthorized.' };

      const res = await fetch('/api/hosting?action=detect-framework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ owner, repo, branch, rootDirectory }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Framework detection failed' };
    }
  }

  /**
   * Rollback project to previous deployment
   */
  async rollbackDeployment(
    projectId: string,
    deploymentId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, error: 'Unauthorized.' };

      const res = await fetch('/api/hosting?action=rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, deploymentId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Rollback failed' };
    }
  }
}

export const githubService = new GitHubService();
export type { SanitizedGitHubRepository, SanitizedGitHubBranch };

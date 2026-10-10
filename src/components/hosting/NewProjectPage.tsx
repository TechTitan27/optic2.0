import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Globe,
  Check,
  AlertCircle,
  Building2,
  Server,
  GitBranch,
  Search,
  Lock,
  ExternalLink,
  RotateCw,
  Unlink,
  FolderGit2,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { supabaseData } from '../../lib/supabaseData';
import { HostingProject, DeploymentItem } from '../../types';
import { storageService } from '../../lib/storageService';
import { useToast } from '../../context/ToastContext';
import {
  githubService,
  GitHubStatusResult,
  SanitizedGitHubRepository,
  SanitizedGitHubBranch,
} from '../../lib/githubService';

// Custom sleek GitHub SVG icon
function GitHubLogoIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface NewProjectPageProps {
  onBackToHosting: () => void;
  onProjectCreated: (project: HostingProject, initialDeployment?: DeploymentItem) => void;
}

type ImportSource = 'github' | 'manual';
export type FrameworkKey =
  | 'vite'
  | 'react'
  | 'nextjs'
  | 'nextjs-ssr'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'angular'
  | 'astro'
  | 'fastapi'
  | 'flask'
  | 'django'
  | 'express'
  | 'nestjs'
  | 'go'
  | 'rust'
  | 'php'
  | 'static';

export interface FrameworkOption {
  key: FrameworkKey;
  label: string;
  badge: string;
  defaultBuildCommand: string;
  defaultOutputDirectory: string;
  runtimeType: 'static' | 'server';
}

export const FRAMEWORKS: FrameworkOption[] = [
  {
    key: 'vite',
    label: 'Vite / React / Vue',
    badge: 'Standard',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    runtimeType: 'static',
  },
  {
    key: 'nextjs',
    label: 'Next.js (Static Export)',
    badge: 'Export',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'out',
    runtimeType: 'static',
  },
  {
    key: 'nextjs-ssr',
    label: 'Next.js (SSR / Hybrid)',
    badge: 'Server',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: '.next',
    runtimeType: 'server',
  },
  {
    key: 'svelte',
    label: 'Svelte / SvelteKit',
    badge: 'Fast',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    runtimeType: 'static',
  },
  {
    key: 'angular',
    label: 'Angular',
    badge: 'Enterprise',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    runtimeType: 'static',
  },
  {
    key: 'astro',
    label: 'Astro',
    badge: 'Content',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    runtimeType: 'static',
  },
  {
    key: 'fastapi',
    label: 'Python FastAPI',
    badge: 'Python',
    defaultBuildCommand: 'pip install -r requirements.txt',
    defaultOutputDirectory: '.',
    runtimeType: 'server',
  },
  {
    key: 'flask',
    label: 'Python Flask',
    badge: 'Python',
    defaultBuildCommand: 'pip install -r requirements.txt',
    defaultOutputDirectory: '.',
    runtimeType: 'server',
  },
  {
    key: 'django',
    label: 'Python Django',
    badge: 'Python',
    defaultBuildCommand: 'pip install -r requirements.txt && python manage.py collectstatic --noinput',
    defaultOutputDirectory: 'staticfiles',
    runtimeType: 'server',
  },
  {
    key: 'express',
    label: 'Node.js Express / Fastify',
    badge: 'Node.js',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: '.',
    runtimeType: 'server',
  },
  {
    key: 'nestjs',
    label: 'NestJS Backend',
    badge: 'TypeScript',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    runtimeType: 'server',
  },
  {
    key: 'go',
    label: 'Go Web Application',
    badge: 'Go',
    defaultBuildCommand: 'go build -o app .',
    defaultOutputDirectory: '.',
    runtimeType: 'server',
  },
  {
    key: 'rust',
    label: 'Rust Application',
    badge: 'Rust',
    defaultBuildCommand: 'cargo build --release',
    defaultOutputDirectory: 'target/release',
    runtimeType: 'server',
  },
  {
    key: 'php',
    label: 'PHP / Laravel',
    badge: 'PHP',
    defaultBuildCommand: 'composer install --no-dev --optimize-autoloader',
    defaultOutputDirectory: 'public',
    runtimeType: 'server',
  },
  {
    key: 'static',
    label: 'Static HTML / CSS / JS',
    badge: 'Zero Config',
    defaultBuildCommand: '',
    defaultOutputDirectory: '.',
    runtimeType: 'static',
  },
];

export const NewProjectPage: React.FC<NewProjectPageProps> = ({
  onBackToHosting,
  onProjectCreated,
}) => {
  const { user, profile, accessToken } = useAuth();
  const { currentOrg, organizations, setCurrentOrg } = useOrganization();
  const toast = useToast();

  const activeCreator =
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'developer';

  // Navigation / Source mode
  const [sourceMode, setSourceMode] = useState<ImportSource>('github');

  // GitHub integration states
  const [checkingGithub, setCheckingGithub] = useState(true);
  const [githubStatus, setGithubStatus] = useState<GitHubStatusResult>({
    success: true,
    configured: true,
    connected: false,
  });
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [disconnectingGithub, setDisconnectingGithub] = useState(false);

  // Repositories states
  const [repositories, setRepositories] = useState<SanitizedGitHubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [selectedRepo, setSelectedRepo] = useState<SanitizedGitHubRepository | null>(null);

  // Branches states
  const [branches, setBranches] = useState<SanitizedGitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('main');

  // Project configuration
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>('vite');
  const [rootDirectory, setRootDirectory] = useState('');
  const [customBuildCommand, setCustomBuildCommand] = useState<string>('');
  const [customOutputDirectory, setCustomOutputDirectory] = useState<string>('');
  const [autoDetected, setAutoDetected] = useState<{ frameworkName: string; languageName: string } | null>(null);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);

  // Load GitHub connection status
  const checkStatus = async () => {
    setCheckingGithub(true);
    try {
      const res = await githubService.getStatus();
      setGithubStatus(res);
      if (res.connected) {
        loadRepositories();
      }
    } catch (err: any) {
      console.warn('Error loading GitHub status:', err);
    } finally {
      setCheckingGithub(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [user?.id]);

  // Load Repositories from GitHub
  const loadRepositories = async (search?: string) => {
    setLoadingRepos(true);
    setErrorMessage(null);
    try {
      const res = await githubService.getRepositories(search);
      if (res.success) {
        setRepositories(res.repositories || []);
      } else {
        setErrorMessage(res.error || 'Failed to retrieve GitHub repositories.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error communicating with GitHub API.');
    } finally {
      setLoadingRepos(false);
    }
  };

  // Listen for OAuth completion from popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Validate origin if available
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        setConnectingGithub(false);
        toast.success(
          event.data.username
            ? `Connected to GitHub as @${event.data.username}`
            : 'GitHub account connected successfully!',
          'GitHub Connected'
        );
        checkStatus();
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Connect GitHub popup launcher
  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    setErrorMessage(null);

    try {
      const res = await githubService.getAuthUrl();
      if (!res.success || !res.url) {
        throw new Error(res.error || 'Unable to generate GitHub authorization link.');
      }

      // Open OAuth popup window directly to GitHub authorize URL
      const width = 600;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        res.url,
        'github_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      popupRef.current = popup;

      if (!popup) {
        toast.info('Popup blocked by browser. Redirecting directly to GitHub...', 'Redirecting');
        window.location.href = res.url;
        return;
      }

      // Polling fallback check in case postMessage is blocked
      const pollTimer = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          setConnectingGithub(false);
          // Check if connection succeeded
          const checkRes = await githubService.getStatus();
          if (checkRes.connected) {
            setGithubStatus(checkRes);
            loadRepositories();
          }
        }
      }, 1500);
    } catch (err: any) {
      setConnectingGithub(false);
      const msg = err?.message || 'Failed to start GitHub connection.';
      setErrorMessage(msg);
      toast.error(msg, 'Connection Error');
    }
  };

  // Disconnect GitHub account
  const handleDisconnectGithub = async () => {
    if (!window.confirm('Are you sure you want to disconnect your GitHub account from Optic?')) {
      return;
    }

    setDisconnectingGithub(true);
    try {
      const res = await githubService.disconnect();
      if (res.success) {
        setGithubStatus({
          success: true,
          configured: true,
          connected: false,
        });
        setRepositories([]);
        setSelectedRepo(null);
        setBranches([]);
        toast.success('GitHub account disconnected.', 'Disconnected');
      } else {
        throw new Error(res.error || 'Failed to disconnect account');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect.', 'Error');
    } finally {
      setDisconnectingGithub(false);
    }
  };

  // Handle repository selection
  const handleSelectRepository = async (repo: SanitizedGitHubRepository) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.defaultBranch || 'main');
    setErrorMessage(null);

    // Auto-populate Project Name and Slug
    setProjectName(repo.name);
    const generatedSlug = repo.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setProjectSlug(generatedSlug);
    setIsSlugManuallyEdited(false);

    if (repo.description) {
      setProjectDescription(repo.description);
    }

    // Fetch branches for this repo
    setLoadingBranches(true);
    try {
      const bRes = await githubService.getBranches(repo.owner.login, repo.name);
      if (bRes.success && bRes.branches.length > 0) {
        setBranches(bRes.branches);
        const defaultB = bRes.branches.find((b) => b.isDefault) || bRes.branches[0];
        setSelectedBranch(defaultB.name);
      } else {
        setBranches([{ name: repo.defaultBranch || 'main', commitSha: 'HEAD', isDefault: true }]);
      }
    } catch (err: any) {
      console.warn('Error loading branches:', err);
      setBranches([{ name: repo.defaultBranch || 'main', commitSha: 'HEAD', isDefault: true }]);
    } finally {
      setLoadingBranches(false);
    }

    // Auto-detect framework and language from repository files
    try {
      const detectRes = await githubService.detectFramework(
        repo.owner.login,
        repo.name,
        repo.defaultBranch || 'main'
      );
      if (detectRes.success && detectRes.detection) {
        const detectedFw = detectRes.detection.framework as FrameworkKey;
        const matched = FRAMEWORKS.find((f) => f.key === detectedFw);
        if (matched) {
          setSelectedFramework(matched.key);
          setCustomBuildCommand(detectRes.detection.buildCommand || matched.defaultBuildCommand);
          setCustomOutputDirectory(detectRes.detection.outputDir || matched.defaultOutputDirectory);
          setAutoDetected({
            frameworkName: detectRes.detection.frameworkName,
            languageName: detectRes.detection.languageName,
          });
          toast.success(
            `Auto-detected ${detectRes.detection.frameworkName} (${detectRes.detection.languageName})`,
            'Framework Detected'
          );
        }
      }
    } catch {
      // Non-fatal fallback
    }
  };

  // Update slug automatically when project name changes
  const handleNameChange = (val: string) => {
    setProjectName(val);
    setErrorMessage(null);
    if (!isSlugManuallyEdited) {
      const generated = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setProjectSlug(generated);
    }
  };

  const handleSlugChange = (val: string) => {
    setIsSlugManuallyEdited(true);
    setErrorMessage(null);
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setProjectSlug(cleaned);
  };

  // Live computed production domain preview
  const displaySlug =
    projectSlug ||
    projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
    'my-project';
  const previewDomain = `${displaySlug}.host.doy.best`;

  // Submit project configuration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setErrorMessage('Project name is required.');
      return;
    }

    if (!currentOrg?.id) {
      setErrorMessage('Please select or create an organization first.');
      return;
    }

    if (sourceMode === 'github' && !selectedRepo) {
      setErrorMessage('Please select a GitHub repository to continue.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanSlug =
        projectSlug.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') ||
        projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const fw = FRAMEWORKS.find((f) => f.key === selectedFramework) || FRAMEWORKS[0];

      let newProject: HostingProject;

      if (sourceMode === 'github' && selectedRepo) {
        // Guarantee fullName is formatted strictly as owner/repository-name
        const repoFullName = selectedRepo.fullName.includes('/')
          ? selectedRepo.fullName
          : `${selectedRepo.owner.login}/${selectedRepo.name}`;

        newProject = await supabaseData.createHostingProject(currentOrg.id, {
          name: projectName.trim(),
          slug: cleanSlug,
          description: projectDescription.trim() || undefined,
          framework: selectedFramework,
          creatorName: activeCreator,
          userId: user?.id,
          gitRepo: repoFullName,
          gitBranch: selectedBranch || selectedRepo.defaultBranch || 'main',
          gitOwner: selectedRepo.owner.login,
          gitRepoName: selectedRepo.name,
          gitRepoDetails: {
            githubRepoId: selectedRepo.id,
            owner: selectedRepo.owner.login,
            name: selectedRepo.name,
            fullName: repoFullName,
            defaultBranch: selectedRepo.defaultBranch || 'main',
            selectedBranch: selectedBranch || selectedRepo.defaultBranch || 'main',
          },
          buildCommand: fw.defaultBuildCommand,
          outputDirectory: fw.defaultOutputDirectory,
          rootDirectory: rootDirectory.trim() || undefined,
        });

        // Immediately trigger complete GitHub deployment
        const deployBranch = selectedBranch || selectedRepo.defaultBranch || 'main';
        let initialDeployment: DeploymentItem | undefined;

        try {
          const token = accessToken || (await storageService.getAuthToken());
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          if (user?.id) headers['x-user-id'] = user.id;

          const deployRes = await fetch('/api/hosting?action=github-deploy', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              projectId: newProject.id,
              organizationId: currentOrg.id,
              branch: deployBranch,
              owner: selectedRepo.owner.login,
              repo: selectedRepo.name,
              gitRepo: repoFullName,
              projectSlug: newProject.slug,
              deploymentNote: `Initial deploy from ${repoFullName}@${deployBranch}`,
              framework: selectedFramework,
              buildCommand: customBuildCommand || fw.defaultBuildCommand,
              outputDirectory: customOutputDirectory || fw.defaultOutputDirectory,
              rootDirectory: rootDirectory.trim() || undefined,
            }),
          });

          const deployData = await deployRes.json();
          if (deployData.success && deployData.deploymentId) {
            initialDeployment = {
              id: deployData.deploymentId,
              projectId: newProject.id,
              organizationId: currentOrg.id,
              userId: user?.id,
              projectName: newProject.name,
              status: 'ready',
              url: deployData.deploymentUrl || `https://${newProject.slug}.host.doy.best`,
              deploymentUrl: deployData.deploymentUrl || `https://${newProject.slug}.host.doy.best`,
              storagePath: `deployments/${currentOrg.id}/${newProject.id}/${deployData.deploymentId}`,
              commitHash: deployData.commitSha || 'HEAD',
              commitMessage: `Initial deploy from ${selectedRepo.name}@${deployBranch}`,
              branch: deployBranch,
              creator: activeCreator,
              durationSeconds: 10,
              environment: 'production',
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            };

            toast.success(
              `Deployed ${deployData.fileCount} file(s) from ${repoFullName} (${deployBranch}) to production!`,
              'Deployment Live'
            );
          } else {
            if (deployData.deploymentId) {
              initialDeployment = {
                id: deployData.deploymentId,
                projectId: newProject.id,
                organizationId: currentOrg.id,
                userId: user?.id,
                projectName: newProject.name,
                status: 'failed',
                url: deployData.deploymentUrl || `https://${newProject.slug}.host.doy.best`,
                deploymentUrl: deployData.deploymentUrl || `https://${newProject.slug}.host.doy.best`,
                storagePath: `deployments/${currentOrg.id}/${newProject.id}/${deployData.deploymentId}`,
                commitHash: deployData.commitSha || 'HEAD',
                commitMessage: `Initial deploy from ${selectedRepo.name}@${deployBranch}`,
                branch: deployBranch,
                creator: activeCreator,
                durationSeconds: 5,
                environment: 'production',
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
              };
            }

            if (deployData.error === 'GitHub authorization expired/reconnect GitHub') {
              toast.error(
                'GitHub authorization expired. Please reconnect your GitHub account.',
                'GitHub Authorization Expired'
              );
            } else {
              toast.error(
                deployData.error || `Failed to deploy ${repoFullName}. Check deployment logs.`,
                'Deployment Failed'
              );
            }
          }
        } catch (deployErr: any) {
          console.warn('[NewProjectPage] Initial deploy error:', deployErr.message);
          toast.error(
            deployErr?.message || 'Deployment error. Check GitHub repository connection.',
            'Deployment Error'
          );
        }

        onProjectCreated(newProject, initialDeployment);
        return;
      } else {
        // Create manual / static project
        newProject = await supabaseData.createHostingProject(currentOrg.id, {
          name: projectName.trim(),
          slug: cleanSlug,
          description: projectDescription.trim() || undefined,
          framework: selectedFramework,
          creatorName: activeCreator,
          userId: user?.id,
          buildCommand: fw.defaultBuildCommand,
          outputDirectory: fw.defaultOutputDirectory,
        });

        toast.success(
          `Project "${newProject.name}" created under ${currentOrg.name}.`,
          'Project Ready'
        );

        onProjectCreated(newProject);
        return;
      }
    } catch (err: any) {
      console.error('[NewProjectPage] Project creation error:', err);
      const msg = err?.message || 'Failed to create project. Please verify your connection and try again.';
      setErrorMessage(msg);
      toast.error(msg, 'Creation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered repositories based on search and visibility
  const filteredRepositories = repositories.filter((r) => {
    if (visibilityFilter === 'public' && r.isPrivate) return false;
    if (visibilityFilter === 'private' && !r.isPrivate) return false;
    if (!repoSearchQuery.trim()) return true;
    const q = repoSearchQuery.toLowerCase().trim();
    return (
      r.name.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      {/* Top Header / Breadcrumb */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <button
            onClick={onBackToHosting}
            className="hover:text-zinc-200 transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={13} />
            <span>Projects</span>
          </button>
          <span>/</span>
          <span className="text-zinc-200 font-medium">New Project</span>
        </div>

        {/* Escape / Cancel */}
        <button
          onClick={onBackToHosting}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Page Heading */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Edge Hosting
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-xs text-zinc-500 font-mono">Phase 1</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          {sourceMode === 'github' ? (
            <>
              <GitHubLogoIcon size={22} className="text-white shrink-0" />
              <span>Deploy from GitHub</span>
            </>
          ) : (
            <span>Deploy Static Files</span>
          )}
        </h1>
        <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
          {sourceMode === 'github'
            ? 'Import and connect an accessible GitHub repository to configure edge hosting deployments.'
            : 'Deploy, host, and scale websites on Optic Edge Hosting from static assets.'}
        </p>
      </div>

      {/* Source Selection Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setSourceMode('github');
            setErrorMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            sourceMode === 'github'
              ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <GitHubLogoIcon size={15} />
          <span>Import from GitHub</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Phase 1
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSourceMode('manual');
            setErrorMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            sourceMode === 'manual'
              ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Server size={14} />
          <span>Deploy Static Files / Manual</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: GITHUB REPOSITORY IMPORT FLOW */}
      {/* ========================================================================= */}
      {sourceMode === 'github' && (
        <div className="space-y-6">
          {/* GitHub Config Check Notification (if environment credentials not set) */}
          {!checkingGithub && !githubStatus.configured && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Info size={15} />
                <span>GitHub OAuth Configuration Required</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                To connect GitHub accounts securely, provide your GitHub OAuth App credentials in your server environment variables:
              </p>
              <div className="p-2.5 rounded-lg bg-zinc-950 font-mono text-[11px] text-zinc-300 space-y-1">
                <div>GITHUB_CLIENT_ID=your_client_id</div>
                <div>GITHUB_CLIENT_SECRET=your_client_secret</div>
              </div>
              <p className="text-[11px] text-zinc-400">
                Set Authorization callback URL in your GitHub App to:{' '}
                <span className="font-mono text-zinc-200 select-all">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/api/hosting/github/callback`
                    : 'https://optic.doy.best/api/hosting/github/callback'}
                </span>
              </p>
            </div>
          )}

          {/* STATE A: Loading GitHub connection */}
          {checkingGithub && (
            <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-zinc-400">Checking GitHub authorization status...</p>
            </div>
          )}

          {/* STATE B: Not Connected to GitHub -> Connect GitHub Card */}
          {!checkingGithub && !githubStatus.connected && (
            <div className="p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center space-y-6 backdrop-blur-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shadow-inner">
                <GitHubLogoIcon size={30} />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Connect your GitHub Account
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Authenticate with GitHub using OAuth to browse accessible repositories, configure branch targeting, and enable edge hosting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left text-xs text-zinc-300">
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Check size={13} />
                    <span>Public &amp; Private</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Full access to personal &amp; organization repos.</p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Check size={13} />
                    <span>Branch Targeting</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Select production or preview branches.</p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Check size={13} />
                    <span>Server-Side RLS</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Tokens encrypted at rest. Zero browser leaks.</p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={handleConnectGithub}
                  loading={connectingGithub}
                  icon={<GitHubLogoIcon size={15} />}
                  className="px-6 py-2.5 font-semibold bg-white hover:bg-zinc-200 text-zinc-950 text-xs shadow-lg"
                >
                  Connect with GitHub
                </Button>
              </div>
            </div>
          )}

          {/* STATE C: Connected to GitHub -> Show Account Bar + Repository / Branch Picker */}
          {!checkingGithub && githubStatus.connected && (
            <div className="space-y-6">
              {/* Connected GitHub Account Indicator */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {githubStatus.account?.avatarUrl ? (
                    <img
                      src={githubStatus.account.avatarUrl}
                      alt={githubStatus.account.username}
                      className="w-9 h-9 rounded-full border border-zinc-700 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                      <GitHubLogoIcon size={18} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">
                        @{githubStatus.account?.username}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Connected GitHub Account · Accessible repositories loaded
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => loadRepositories(repoSearchQuery)}
                    disabled={loadingRepos}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                    title="Refresh repositories"
                  >
                    <RotateCw size={12} className={loadingRepos ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDisconnectGithub}
                    loading={disconnectingGithub}
                    icon={<Unlink size={12} />}
                    className="text-xs text-zinc-400 hover:text-red-400 border-zinc-800"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Error banner if repository query or branches failed */}
              {errorMessage && !selectedRepo && (
                <div className="p-3.5 rounded-xl border border-red-900/60 bg-red-950/20 text-xs text-red-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={15} className="shrink-0 text-red-400" />
                    <span className="truncate">{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadRepositories(repoSearchQuery)}
                    className="px-2.5 py-1 rounded-md bg-red-900/40 hover:bg-red-900/60 text-red-200 text-[11px] font-medium transition-colors shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* STEP 1: PICK REPOSITORY (If not yet selected) */}
              {!selectedRepo && (
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white tracking-tight">Select a Repository</h2>
                        {!loadingRepos && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            {filteredRepositories.length} available
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        Choose a repository from your GitHub account to connect and deploy.
                      </p>
                    </div>

                    {/* Visibility Filter Tabs */}
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setVisibilityFilter('all')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          visibilityFilter === 'all'
                            ? 'bg-zinc-800 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibilityFilter('public')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          visibilityFilter === 'public'
                            ? 'bg-zinc-800 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Public
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibilityFilter('private')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          visibilityFilter === 'private'
                            ? 'bg-zinc-800 text-white font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Private
                      </button>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <input
                      type="text"
                      placeholder="Search repositories by name or owner (e.g. SpiderLabs/optic-site)..."
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
                    />
                    {repoSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRepoSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Repositories List */}
                  {loadingRepos ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 animate-pulse flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
                            <div className="space-y-2 flex-1">
                              <div className="w-48 h-3.5 bg-zinc-800 rounded" />
                              <div className="w-72 h-2.5 bg-zinc-800/60 rounded" />
                            </div>
                          </div>
                          <div className="w-16 h-7 bg-zinc-800 rounded-lg shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : filteredRepositories.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
                      <FolderGit2 size={26} className="mx-auto text-zinc-500" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-zinc-200">No repositories found</p>
                        <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                          {repoSearchQuery
                            ? `No repositories match "${repoSearchQuery}". Try a different search term or clear the filter.`
                            : 'No repositories accessible for this GitHub account.'}
                        </p>
                      </div>
                      {repoSearchQuery && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRepoSearchQuery('')}
                          className="text-xs text-zinc-300 hover:text-white border-zinc-800"
                        >
                          Clear Search
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredRepositories.map((repo) => (
                        <div
                          key={repo.id}
                          className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-zinc-700/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          {/* Left: Owner Avatar & Repository Details */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {repo.owner?.avatarUrl ? (
                              <img
                                src={repo.owner.avatarUrl}
                                alt={repo.owner.login}
                                className="w-7 h-7 rounded-md border border-zinc-800 shrink-0 mt-0.5 object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                                <GitHubLogoIcon size={14} />
                              </div>
                            )}

                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* Repository Full Name: owner/repository-name */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  Repo
                                </span>
                                <span className="text-xs font-mono font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                                  <span className="text-zinc-400 font-normal">{repo.owner.login}/</span>
                                  <span className="text-white font-bold">{repo.name}</span>
                                </span>

                                {repo.isPrivate ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                                    <Lock size={9} />
                                    Private
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Globe size={9} />
                                    Public
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                  <GitBranch size={10} className="text-emerald-400" />
                                  <span>{repo.defaultBranch}</span>
                                </span>
                              </div>

                              {/* Explicit metadata breakdown: owner & name */}
                              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                                <span>Owner: <strong className="text-zinc-300 font-normal">{repo.owner.login}</strong></span>
                                <span className="text-zinc-700">·</span>
                                <span>Name: <strong className="text-zinc-200 font-semibold">{repo.name}</strong></span>
                                <span className="text-zinc-700">·</span>
                                <span>Full: <span className="text-zinc-400">{repo.fullName}</span></span>
                              </div>

                              {repo.description && (
                                <p className="text-[11px] text-zinc-400 line-clamp-1">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: External link & Import button */}
                          <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-900"
                              title="View on GitHub"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={13} />
                            </a>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectRepository(repo)}
                              className="text-xs hover:border-emerald-500 hover:text-emerald-400 font-medium px-3"
                            >
                              Select
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: REPOSITORY SELECTED -> CONFIGURE BRANCH & CONFIRM PROJECT */}
              {selectedRepo && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Selected Repository Card */}
                  <div className="p-4 rounded-xl border border-emerald-500/40 bg-zinc-900/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedRepo.owner?.avatarUrl ? (
                        <img
                          src={selectedRepo.owner.avatarUrl}
                          alt={selectedRepo.owner.login}
                          className="w-10 h-10 rounded-lg border border-emerald-500/40 shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                          <GitHubLogoIcon size={20} />
                        </div>
                      )}

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                          <span>Repository:</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-950 text-zinc-400 border border-zinc-800 lowercase">
                            {selectedRepo.isPrivate ? 'private' : 'public'}
                          </span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white flex items-center gap-1 truncate">
                          <span className="text-zinc-400 font-normal">{selectedRepo.owner.login}/</span>
                          <span className="text-white font-bold">{selectedRepo.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 flex items-center gap-2">
                          <span>
                            Default branch: <span className="font-mono text-zinc-300">{selectedRepo.defaultBranch}</span>
                          </span>
                          {selectedRepo.description && (
                            <>
                              <span className="text-zinc-600">·</span>
                              <span className="truncate max-w-xs">{selectedRepo.description}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRepo(null);
                        setBranches([]);
                      }}
                      className="text-xs text-zinc-300 hover:text-white border-zinc-700 shrink-0"
                    >
                      Change Repository
                    </Button>
                  </div>

                  {/* Branch Selection */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <GitBranch size={13} className="text-emerald-400" />
                        <span>Production Branch</span>
                      </label>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {loadingBranches ? 'Loading branches...' : `${branches.length} branch(es) found`}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400">
                      Select the branch that will trigger production edge deployments.
                    </p>

                    {loadingBranches ? (
                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 animate-pulse text-xs text-zinc-500 flex items-center gap-2">
                        <RotateCw size={12} className="animate-spin text-emerald-400" />
                        <span>Fetching branches from GitHub...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer"
                        >
                          {branches.map((b) => (
                            <option key={b.name} value={b.name}>
                              {b.name} {b.isDefault ? '(default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Organization Scope */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <Building2 size={16} className="text-zinc-400" />
                      <div>
                        <span className="text-xs text-zinc-200 font-medium">Organization</span>
                        <p className="text-[11px] text-zinc-500">
                          Deployments and production domains will belong to this organization.
                        </p>
                      </div>
                    </div>

                    {organizations.length > 1 ? (
                      <select
                        value={currentOrg?.id}
                        onChange={(e) => {
                          const found = organizations.find((o) => o.id === e.target.value);
                          if (found) setCurrentOrg(found);
                        }}
                        className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-mono font-medium text-zinc-300 px-2 py-1 rounded bg-zinc-800 border border-zinc-700/60">
                        {currentOrg?.name}
                      </span>
                    )}
                  </div>

                  {/* Project Name & Slug */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                    <Input
                      label="Project Name"
                      placeholder="e.g. My GitHub Project"
                      value={projectName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                    />

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-300">Project Slug</label>
                      <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono focus-within:border-zinc-600 transition-colors">
                        <input
                          type="text"
                          value={projectSlug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          placeholder="my-project"
                          className="bg-transparent text-zinc-200 focus:outline-none w-full"
                        />
                      </div>
                    </div>

                    {/* Domain Preview Card */}
                    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs space-y-1">
                      <span className="text-[10px] uppercase font-mono text-zinc-500">
                        Assigned Production URL
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                        <Globe size={13} className="shrink-0" />
                        <span className="truncate">https://{previewDomain}</span>
                      </div>
                    </div>
                  </div>

                  {/* Framework Preset Selection */}
                  <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">Framework & Runtime Preset</label>
                      {autoDetected && (
                        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles size={10} /> Auto-detected: {autoDetected.frameworkName}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {FRAMEWORKS.map((fw) => {
                        const selected = selectedFramework === fw.key;
                        return (
                          <button
                            key={fw.key}
                            type="button"
                            onClick={() => {
                              setSelectedFramework(fw.key);
                              setCustomBuildCommand(fw.defaultBuildCommand);
                              setCustomOutputDirectory(fw.defaultOutputDirectory);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                              selected
                                ? 'border-emerald-500 bg-emerald-950/20 text-white'
                                : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium">{fw.label}</div>
                              <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                                <span>{fw.badge}</span>
                                <span>•</span>
                                <span className={fw.runtimeType === 'server' ? 'text-amber-400' : 'text-blue-400'}>
                                  {fw.runtimeType}
                                </span>
                              </div>
                            </div>
                            {selected && <Check size={14} className="text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Build Command and Output Directory Overrides */}
                    <div className="pt-3 border-t border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">Build Command</label>
                        <input
                          type="text"
                          value={customBuildCommand}
                          onChange={(e) => setCustomBuildCommand(e.target.value)}
                          placeholder="npm run build"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400 block mb-1">Output Directory</label>
                        <input
                          type="text"
                          value={customOutputDirectory}
                          onChange={(e) => setCustomOutputDirectory(e.target.value)}
                          placeholder="dist"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-600"
                        />
                      </div>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/20 text-xs text-red-400 flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRepo(null)}
                      disabled={submitting}
                    >
                      Back
                    </Button>

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={submitting}
                      disabled={!projectName.trim() || submitting}
                      icon={<GitHubLogoIcon size={14} />}
                      className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-4 py-2"
                    >
                      Deploy Project
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MANUAL / STATIC FILE UPLOAD FLOW (Preserved existing flow) */}
      {/* ========================================================================= */}
      {sourceMode === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Organization Scope */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Building2 size={16} className="text-zinc-400" />
              <div>
                <span className="text-xs text-zinc-200 font-medium">Organization</span>
                <p className="text-[11px] text-zinc-500">
                  Deployments and production domains will belong to this organization.
                </p>
              </div>
            </div>

            {organizations.length > 1 ? (
              <select
                value={currentOrg?.id}
                onChange={(e) => {
                  const found = organizations.find((o) => o.id === e.target.value);
                  if (found) setCurrentOrg(found);
                }}
                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono font-medium text-zinc-300 px-2 py-1 rounded bg-zinc-800 border border-zinc-700/60">
                {currentOrg?.name}
              </span>
            )}
          </div>

          {/* Project Name & Slug */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
            <Input
              label="Project Name"
              placeholder="e.g. My Portfolio"
              value={projectName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Project Slug</label>
              <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono focus-within:border-zinc-600 transition-colors">
                <input
                  type="text"
                  value={projectSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-portfolio"
                  className="bg-transparent text-zinc-200 focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Domain Preview Card */}
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-500">
                Assigned Production URL
              </span>
              <div className="flex items-center gap-1.5 font-mono text-indigo-400">
                <Globe size={13} className="shrink-0" />
                <span className="truncate">https://{previewDomain}</span>
              </div>
            </div>
          </div>

          {/* Framework Preset Selection */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
            <label className="text-xs font-medium text-zinc-300">Framework Preset</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FRAMEWORKS.map((fw) => {
                const selected = selectedFramework === fw.key;
                return (
                  <button
                    key={fw.key}
                    type="button"
                    onClick={() => setSelectedFramework(fw.key)}
                    className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                      selected
                        ? 'border-indigo-500 bg-indigo-950/20 text-white'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium">{fw.label}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{fw.badge}</div>
                    </div>
                    {selected && <Check size={14} className="text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/20 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToHosting}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!projectName.trim() || submitting}
              icon={<Server size={13} />}
            >
              Create Project
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

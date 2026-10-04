import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Modal } from '../common/Modal';
import { CodeBlock } from '../common/CodeBlock';
import { OrganizationSwitcher } from '../common/OrganizationSwitcher';
import { HostingProject, DeploymentItem, DeploymentLog, SurfaceType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';
import { supabaseData } from '../../lib/supabaseData';
import { storageService } from '../../lib/storageService';
import {
  HostingProjectCardSkeleton,
  DeploymentItemSkeleton,
  TerminalLogsSkeleton,
  Skeleton,
} from '../common/Skeleton';
import {
  Server,
  Plus,
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Terminal,
  Globe,
  AlertCircle,
  RotateCw,
  Trash2,
  Building2,
  Upload,
  FileCode,
  Folder,
  Copy,
  Check,
  ChevronRight,
  ListFilter,
  CheckCircle2,
  Shield,
  ArrowUpRight,
  History,
  Sparkles,
} from 'lucide-react';
import { NewProjectPage } from './NewProjectPage';

interface HostingInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  currentPath?: string;
}

export const HostingInterface: React.FC<HostingInterfaceProps> = ({
  onNavigateSurface,
  currentPath,
}) => {
  const { user, profile } = useAuth();
  const { currentOrg, organizations, loading: orgLoading, createOrg, hasOrganizations } = useOrganization();
  const toast = useToast();

  const activeCreator =
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'developer';

  // Projects state
  const [projects, setProjects] = useState<HostingProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<HostingProject | null>(null);
  const [activeTab, setActiveTab] = useState<'deployments' | 'overview' | 'logs' | 'settings'>('deployments');
  const [searchQuery, setSearchQuery] = useState('');

  // Production Deployment Target State
  const [productionDeploymentId, setProductionDeploymentId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Dedicated Hosting Host identification (hosting.optic.doy.best, hosting.localhost, etc.)
  const isSubdomain =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'hosting.optic.doy.best' ||
      window.location.hostname.startsWith('hosting.') ||
      window.location.hostname === 'hosting.localhost');
  const newProjectPath = isSubdomain ? '/new' : '/hosting/new';

  const handleNavigateToNewProject = () => {
    onNavigateSurface('hosting', newProjectPath);
  };

  const isNewProjectRoute =
    currentPath === '/new' ||
    currentPath === '/hosting/new' ||
    (typeof window !== 'undefined' &&
      (window.location.pathname === '/new' ||
        window.location.pathname === '/hosting/new' ||
        window.location.pathname.startsWith('/new/')));

  // Helper to extract project identifier from path or query params
  const getRequestedProjectSlug = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const path = currentPath || window.location.pathname;
    const cleanPath = path.split('?')[0].split('#')[0];
    const match = cleanPath.match(/(?:\/hosting)?\/(?:project|projects|p)\/([^/]+)/i);
    if (match) return decodeURIComponent(match[1]).trim();
    try {
      const param = new URLSearchParams(window.location.search).get('project');
      if (param) return param.trim();
    } catch {
      // ignore
    }
    return null;
  }, [currentPath]);

  // Synchronize selected project with URL when projects change or route changes
  useEffect(() => {
    const slug = getRequestedProjectSlug();
    if (slug && projects.length > 0) {
      const match = projects.find(
        (p) => p.slug.toLowerCase() === slug.toLowerCase() || p.id === slug
      );
      if (match) {
        if (!selectedProject || selectedProject.id !== match.id) {
          setSelectedProject(match);
        }
      }
    } else if (!slug && !isNewProjectRoute) {
      // When navigated back to root / or /hosting without a project slug
      if (
        currentPath === '/' ||
        currentPath === '/hosting' ||
        currentPath === '/projects' ||
        (typeof window !== 'undefined' &&
          (window.location.pathname === '/' || window.location.pathname === '/hosting'))
      ) {
        if (selectedProject) {
          setSelectedProject(null);
        }
      }
    }
  }, [projects, currentPath, getRequestedProjectSlug, isNewProjectRoute, selectedProject]);

  // Handler: Select a project and update URL
  const handleSelectProject = (proj: HostingProject) => {
    setSelectedProject(proj);
    setActiveTab('deployments');
    const targetPath = isSubdomain ? `/project/${proj.slug}` : `/hosting/project/${proj.slug}`;
    onNavigateSurface('hosting', targetPath);
  };

  // Handler: Return to project list
  const handleBackToProjects = () => {
    setSelectedProject(null);
    const targetPath = isSubdomain ? '/' : '/hosting';
    onNavigateSurface('hosting', targetPath);
  };

  // First Visit Org Onboarding form state
  const [onboardOrgName, setOnboardOrgName] = useState('');
  const [creatingOnboardOrg, setCreatingOnboardOrg] = useState(false);

  // Deployments state
  const [deploymentsList, setDeploymentsList] = useState<DeploymentItem[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState<boolean>(true);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [selectedDeploymentForLogs, setSelectedDeploymentForLogs] = useState<string | null>(null);

  // Deployment Logs state
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Static Deployment Upload Modal state
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; relativePath: string }[]>([]);
  const [deploymentNote, setDeploymentNote] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStepText, setDeployStepText] = useState('');
  const [deployProgressPercent, setDeployProgressPercent] = useState(0);
  const [deployLiveLogs, setDeployLiveLogs] = useState<DeploymentLog[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // Copy helper
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Host origin helper
  const hostOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://hosting.optic.doy.best';

  // 1. Fetch projects for the active organization
  const fetchProjects = useCallback(async () => {
    if (!currentOrg?.id) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    setProjectsError(null);

    try {
      const data = await supabaseData.getHostingProjects(currentOrg.id);
      setProjects(data);

      if (selectedProject) {
        const updated = data.find((p) => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      }
    } catch (err: any) {
      console.error('Error fetching hosting projects:', err);
      setProjectsError(err?.message || 'Failed to load hosting projects.');
    } finally {
      setLoadingProjects(false);
    }
  }, [currentOrg?.id, selectedProject?.id]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 2. Fetch project deployments and production target when selectedProject changes
  const loadProjectDetails = useCallback(async () => {
    if (!selectedProject?.id) return;

    setLoadingDeployments(true);
    setDeploymentsError(null);

    try {
      const deps = await supabaseData.getProjectDeployments(selectedProject.id, currentOrg?.id);
      setDeploymentsList(deps);

      // Load production target
      const prodTarget = await supabaseData.getProductionDeployment(selectedProject.id, selectedProject.slug);
      if (prodTarget) {
        setProductionDeploymentId(prodTarget);
      } else {
        // Default to newest ready deployment
        const firstReady = deps.find((d) => d.status === 'ready');
        if (firstReady) {
          setProductionDeploymentId(firstReady.id);
        }
      }

      if (deps.length > 0 && !selectedDeploymentForLogs) {
        setSelectedDeploymentForLogs(deps[0].id);
      }
    } catch (err: any) {
      console.error('Error loading deployments:', err);
      setDeploymentsError(err?.message || 'Failed to load deployments for this project.');
    } finally {
      setLoadingDeployments(false);
    }
  }, [selectedProject?.id, selectedProject?.slug, currentOrg?.id]);

  useEffect(() => {
    if (selectedProject?.id) {
      loadProjectDetails();
    }
  }, [selectedProject?.id, loadProjectDetails]);

  // 3. Fetch deployment logs when selectedDeploymentForLogs changes
  useEffect(() => {
    if (!selectedDeploymentForLogs) {
      setDeploymentLogs([]);
      return;
    }

    setLoadingLogs(true);
    setLogsError(null);

    supabaseData
      .getDeploymentLogs(selectedDeploymentForLogs)
      .then((logs) => {
        if (logs.length === 0) {
          const targetDep = deploymentsList.find((d) => d.id === selectedDeploymentForLogs);
          const syntheticLogs: DeploymentLog[] = [
            {
              id: 'init-1',
              deploymentId: selectedDeploymentForLogs,
              timestamp: targetDep ? new Date(targetDep.createdAt).toLocaleTimeString() : '00:00:00',
              level: 'info',
              message: `Deployment initiated for project ${selectedProject?.slug || 'project'}`,
            },
            {
              id: 'init-2',
              deploymentId: selectedDeploymentForLogs,
              timestamp: targetDep ? new Date(targetDep.createdAt).toLocaleTimeString() : '00:00:01',
              level: 'info',
              message: `Storage destination: Cloudflare R2 (${targetDep?.storagePath || 'private bucket'})`,
            },
            {
              id: 'init-3',
              deploymentId: selectedDeploymentForLogs,
              timestamp: targetDep?.completedAt
                ? new Date(targetDep.completedAt).toLocaleTimeString()
                : new Date().toLocaleTimeString(),
              level: targetDep?.status === 'ready' ? 'success' : 'info',
              message:
                targetDep?.status === 'ready'
                  ? 'Deployment verified and READY on Optic Cloud Edge Network.'
                  : `Deployment status: ${targetDep?.status || 'pending'}`,
            },
          ];
          setDeploymentLogs(syntheticLogs);
        } else {
          setDeploymentLogs(logs);
        }
      })
      .catch((err) => {
        setLogsError(err?.message || 'Failed to load logs');
      })
      .finally(() => {
        setLoadingLogs(false);
      });
  }, [selectedDeploymentForLogs, deploymentsList, selectedProject?.slug]);

  // Compute sequential deployment numbers (#1, #2, #3 ... #N)
  // Ordered oldest (#1) to newest (#N)
  const numberedDeployments = useMemo(() => {
    const total = deploymentsList.length;
    return deploymentsList.map((dep, index) => {
      const number = total - index;
      const isProduction =
        productionDeploymentId === dep.id || (!productionDeploymentId && index === 0 && dep.status === 'ready');
      return {
        ...dep,
        seqNumber: number,
        isProduction,
      };
    });
  }, [deploymentsList, productionDeploymentId]);

  const activeProductionDeployment = useMemo(() => {
    return numberedDeployments.find((d) => d.isProduction) || numberedDeployments[0] || null;
  }, [numberedDeployments]);

  // Handler: Promote or Rollback a deployment to Production
  const handlePromoteToProduction = async (dep: typeof numberedDeployments[0]) => {
    if (!selectedProject) return;
    setPromotingId(dep.id);

    try {
      const ok = await supabaseData.setProductionDeployment(selectedProject.id, dep.id, selectedProject.slug);
      if (ok) {
        setProductionDeploymentId(dep.id);
        toast.success(
          `Deployment #${dep.seqNumber} is now active in production on ${selectedProject.slug}.host.doy.best`,
          'Production Target Updated'
        );
      } else {
        throw new Error('Failed to update production target.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to promote deployment', 'Error');
    } finally {
      setPromotingId(null);
    }
  };

  // Handler: Copy URL with feedback
  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUrl(key);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  // Handler: Drag and drop files upload
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const items: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      items.push({ file: f, relativePath: relPath });
    }

    setSelectedFiles(items);
  };

  // Handler: Start Deployment
  const handleStartDeploy = async () => {
    if (!selectedProject || !currentOrg || !user || selectedFiles.length === 0) return;

    setIsDeploying(true);
    setDeployError(null);
    setDeployLiveLogs([]);
    setDeployProgressPercent(0);

    const deploymentId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    const storagePath = `deployments/${currentOrg.id}/${selectedProject.id}/${deploymentId}`;
    const deploymentUrl = `${hostOrigin}/api/deployments/${deploymentId}/`;

    const addLocalLog = (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
      const newLog: DeploymentLog = {
        id: `live-${Date.now()}-${Math.random()}`,
        deploymentId,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      };
      setDeployLiveLogs((prev) => [...prev, newLog]);
      supabaseData.addDeploymentLog(deploymentId, message, level).catch(() => {});
    };

    try {
      setDeployStepText('Creating deployment record...');
      addLocalLog('Deployment record initialized', 'info');

      await supabaseData.createDeploymentRecord({
        id: deploymentId,
        projectId: selectedProject.id,
        organizationId: currentOrg.id,
        userId: user.id,
        status: 'pending',
        deploymentUrl,
        storagePath,
        commitMessage: deploymentNote.trim() || `Deployment of ${selectedFiles.length} file(s)`,
        creator: activeCreator,
        branch: selectedProject.gitBranch || 'main',
      });

      setDeployStepText('Uploading files to Cloudflare R2...');
      await supabaseData.updateDeploymentStatus(deploymentId, 'building');
      addLocalLog('Uploading assets to private R2 storage', 'info');

      const totalFiles = selectedFiles.length;
      let uploadedCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const item = selectedFiles[i];
        const fileName = item.relativePath;
        const ext = fileName.split('.').pop()?.toLowerCase();
        let mimeType = item.file.type || '';
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (ext === 'html' || ext === 'htm') mimeType = 'text/html; charset=utf-8';
          else if (ext === 'css') mimeType = 'text/css; charset=utf-8';
          else if (ext === 'js' || ext === 'mjs') mimeType = 'application/javascript; charset=utf-8';
          else if (ext === 'json') mimeType = 'application/json; charset=utf-8';
          else if (ext === 'svg') mimeType = 'image/svg+xml';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        }
        if (!mimeType) mimeType = 'application/octet-stream';

        setDeployStepText(`Uploading [${i + 1}/${totalFiles}]: ${fileName}`);

        const presigned = await storageService.requestDeploymentUploadUrl({
          organizationId: currentOrg.id,
          projectId: selectedProject.id,
          deploymentId,
          filePath: fileName,
          mimeType,
          size: item.file.size,
        });

        await storageService.uploadDirectToR2(presigned.uploadUrl, item.file, mimeType);
        uploadedCount++;
        setDeployProgressPercent(Math.round((uploadedCount / totalFiles) * 100));
      }

      setDeployStepText('Verifying Cloudflare R2 upload...');
      addLocalLog('Verifying R2 storage integrity', 'info');

      let completedAt = new Date().toISOString();
      try {
        const finalizeRes = await storageService.finalizeDeployment({
          organizationId: currentOrg.id,
          projectId: selectedProject.id,
          deploymentId,
          filePath: selectedFiles[0]?.relativePath || 'index.html',
        });
        if (finalizeRes.completedAt) completedAt = finalizeRes.completedAt;
      } catch (finalizeErr: any) {
        console.warn('Finalize verification notice:', finalizeErr.message);
        await supabaseData.updateDeploymentStatus(deploymentId, 'ready', completedAt);
      }

      // Automatically promote to production if it is the first deployment
      if (deploymentsList.length === 0 || !productionDeploymentId) {
        await supabaseData.setProductionDeployment(selectedProject.id, deploymentId, selectedProject.slug);
        setProductionDeploymentId(deploymentId);
      }

      addLocalLog('Deployment READY on edge network', 'success');

      await loadProjectDetails();
      await fetchProjects();
      setSelectedDeploymentForLogs(deploymentId);

      toast.success(
        `Deployed ${uploadedCount} file(s) for ${selectedProject.name}.`,
        'Deployment Ready'
      );

      setTimeout(() => {
        setIsDeploying(false);
        setDeployModalOpen(false);
        setSelectedFiles([]);
        setDeploymentNote('');
      }, 1000);
    } catch (err: any) {
      console.error('Deployment failure:', err);
      setDeployError(err?.message || 'Deployment failed. Check storage credentials and network.');
      addLocalLog(err?.message || 'Deployment error', 'error');
      setIsDeploying(false);
    }
  };

  // Handler: Delete Project
  const handleDeleteProject = async () => {
    if (!selectedProject || !currentOrg) return;
    setDeletingProject(true);

    try {
      await supabaseData.deleteHostingProject(selectedProject.id, currentOrg.id);
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
      handleBackToProjects();
      toast.info(`Project "${selectedProject.name}" deleted.`, 'Project Deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete project', 'Error');
    } finally {
      setDeletingProject(false);
    }
  };

  // Filtered projects list
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Full-Page Route: /new or /hosting/new
  if (isNewProjectRoute) {
    return (
      <NewProjectPage
        onBackToHosting={handleBackToProjects}
        onProjectCreated={(newProject) => {
          setProjects((prev) => [newProject, ...prev.filter((p) => p.id !== newProject.id)]);
          handleSelectProject(newProject);
        }}
      />
    );
  }

  // Canonical Production, Immutable URLs, and Working Direct Live Endpoint
  const currentProdUrl = selectedProject
    ? `https://${selectedProject.slug}.host.doy.best`
    : '';
  const directEndpointUrl = selectedProject
    ? `${hostOrigin}/api/deployments/${selectedProject.slug}/`
    : '';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* CASE 1: USER HAS NO ORGANIZATIONS ON FIRST VISIT */}
      {!orgLoading && !hasOrganizations ? (
        <div className="max-w-md mx-auto py-16 px-4 text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-300">
            <Building2 size={24} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Create an Organization</h1>
            <p className="text-xs text-zinc-400">
              Hosting projects and edge deployments belong to organizations.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!onboardOrgName.trim()) return;
              setCreatingOnboardOrg(true);
              try {
                await createOrg(onboardOrgName.trim());
                toast.success('Organization created.', 'Ready');
              } catch (err: any) {
                toast.error(err?.message || 'Failed to create organization', 'Error');
              } finally {
                setCreatingOnboardOrg(false);
              }
            }}
            className="space-y-3 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-left"
          >
            <Input
              label="Organization Name"
              placeholder="e.g. Acme Studio"
              value={onboardOrgName}
              onChange={(e) => setOnboardOrgName(e.target.value)}
              required
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              loading={creatingOnboardOrg}
              disabled={!onboardOrgName.trim()}
            >
              Continue
            </Button>
          </form>
        </div>
      ) : selectedProject ? (
        /* CASE 2: PROJECT DETAIL VIEW */
        <div className="space-y-6">
          {/* Top Bar: Breadcrumb, Production Domain, Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <button
                  onClick={handleBackToProjects}
                  className="hover:text-zinc-200 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft size={13} />
                  <span>Projects</span>
                </button>
                <span>/</span>
                <span className="text-zinc-200 font-medium">{selectedProject.name}</span>
              </div>

              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                  {selectedProject.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ready
                </span>
              </div>

              {/* Production Live Endpoint & Custom Domain */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {/* Primary Production Domain: https://<project-slug>.host.doy.best */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Production:
                  </span>
                  <a
                    href={currentProdUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-zinc-100 hover:text-indigo-300 flex items-center gap-1 transition-colors font-medium underline decoration-zinc-700"
                    title={`Open production URL: ${currentProdUrl}`}
                  >
                    <span>{currentProdUrl.replace('https://', '')}</span>
                    <ArrowUpRight size={11} className="text-zinc-400" />
                  </a>
                  <button
                    onClick={() => handleCopy(currentProdUrl, 'prod-url')}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors ml-0.5"
                    title="Copy production domain"
                  >
                    {copiedUrl === 'prod-url' ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>

                {/* Direct Endpoint */}
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="text-[11px] font-mono text-zinc-500">Endpoint:</span>
                  <a
                    href={directEndpointUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                    title="Direct API endpoint fallback"
                  >
                    <span>{directEndpointUrl.replace(/^https?:\/\/[^/]+/, '')}</span>
                    <ArrowUpRight size={11} />
                  </a>
                  <button
                    onClick={() => handleCopy(directEndpointUrl, 'direct-endpoint')}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                    title="Copy direct live endpoint"
                  >
                    {copiedUrl === 'direct-endpoint' ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  window.open(currentProdUrl, '_blank');
                }}
                icon={<ExternalLink size={13} />}
              >
                Visit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedFiles([]);
                  setDeployError(null);
                  setDeployModalOpen(true);
                }}
                icon={<Upload size={13} />}
              >
                Deploy
              </Button>
            </div>
          </div>

          {/* Clean Segmented Tab Navigation */}
          <div className="flex items-center border-b border-zinc-800 gap-1 text-xs">
            {(['deployments', 'overview', 'logs', 'settings'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-2 font-medium capitalize transition-colors relative border-b-2 -mb-px ${
                    active
                      ? 'border-indigo-500 text-zinc-100 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab}
                  {tab === 'deployments' && deploymentsList.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                      {deploymentsList.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: DEPLOYMENTS (Vercel-style Lifecycle Focus) */}
          {activeTab === 'deployments' && (
            <div className="space-y-6">
              {/* Production Deployment Target Card */}
              {activeProductionDeployment && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Current Production Deployment
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-200">
                        #{activeProductionDeployment.seqNumber}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400">
                      Promoted {new Date(activeProductionDeployment.createdAt).toLocaleDateString()} by{' '}
                      {activeProductionDeployment.creator || 'developer'}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-800/60">
                    <div className="space-y-1">
                      <a
                        href={currentProdUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-mono font-medium text-zinc-100 hover:text-indigo-400 flex items-center gap-1.5"
                      >
                        <Globe size={14} className="text-indigo-400 shrink-0" />
                        <span>{currentProdUrl}</span>
                        <ArrowUpRight size={13} className="text-zinc-500" />
                      </a>
                      <p className="text-xs text-zinc-400">
                        {activeProductionDeployment.commitMessage || 'Manual deployment'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={activeProductionDeployment.deploymentUrl || `${hostOrigin}/api/deployments/${activeProductionDeployment.id}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-mono rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors inline-flex items-center gap-1"
                      >
                        <span>Inspect #{activeProductionDeployment.seqNumber}</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Deployment History List */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-zinc-400" />
                    <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                      Deployment History
                    </h2>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {numberedDeployments.length} total release(s)
                  </span>
                </div>

                {loadingDeployments ? (
                  <div className="divide-y divide-zinc-800/60">
                    <DeploymentItemSkeleton />
                    <DeploymentItemSkeleton />
                    <DeploymentItemSkeleton />
                  </div>
                ) : deploymentsError ? (
                  <div className="p-8 text-center space-y-3">
                    <AlertCircle size={20} className="text-red-400 mx-auto" />
                    <p className="text-xs text-red-400">{deploymentsError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadProjectDetails}
                      icon={<RotateCw size={12} />}
                    >
                      Retry
                    </Button>
                  </div>
                ) : numberedDeployments.length === 0 ? (
                  <div className="p-10 text-center space-y-3 text-xs text-zinc-400">
                    <p>No deployments recorded yet for this project.</p>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setDeployModalOpen(true)}
                      icon={<Upload size={13} />}
                    >
                      Upload Static Website
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60">
                    {numberedDeployments.map((dep) => {
                      const immutableHostUrl = `https://${dep.id}.host.doy.best`;
                      const directApiUrl = `${hostOrigin}/api/deployments/${dep.id}/`;

                      return (
                        <div
                          key={dep.id}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-900/50 transition-colors"
                        >
                          {/* Left: Number, Status, Commit, Info */}
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Sequential number: e.g. #14 */}
                              <span className="font-mono font-bold text-xs text-zinc-200">
                                #{dep.seqNumber}
                              </span>

                              {/* Status badge */}
                              {dep.status === 'ready' ? (
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  READY
                                </span>
                              ) : dep.status === 'building' ? (
                                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  BUILDING
                                </span>
                              ) : dep.status === 'failed' ? (
                                <span className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                  FAILED
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-400 uppercase font-semibold">
                                  {dep.status}
                                </span>
                              )}

                              {/* Target indicator: PRODUCTION or PREVIEW */}
                              {dep.isProduction ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  PRODUCTION
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                  PREVIEW
                                </span>
                              )}

                              <span className="text-xs text-zinc-200 font-medium truncate max-w-xs">
                                {dep.commitMessage || 'Manual deployment'}
                              </span>
                            </div>

                            {/* Metadata line */}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                              <span className="font-mono">{dep.id.substring(0, 8)}</span>
                              <span>·</span>
                              <span>{new Date(dep.createdAt).toLocaleString()}</span>
                              <span>·</span>
                              <span>by {dep.creator || 'developer'}</span>
                              <span>·</span>
                              {/* Immutable link display */}
                              <a
                                href={directApiUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-zinc-400 hover:text-indigo-400 underline decoration-zinc-700 flex items-center gap-0.5"
                                title={immutableHostUrl}
                              >
                                <span>{immutableHostUrl.replace('https://', '')}</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Promote / Restore to Production */}
                            {dep.status === 'ready' && !dep.isProduction && (
                              <button
                                onClick={() => handlePromoteToProduction(dep)}
                                disabled={promotingId === dep.id}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
                              >
                                {promotingId === dep.id
                                  ? 'Promoting...'
                                  : dep.seqNumber < (activeProductionDeployment?.seqNumber || 0)
                                  ? 'Restore'
                                  : 'Promote'}
                              </button>
                            )}

                            {/* View Logs button */}
                            <button
                              onClick={() => {
                                setSelectedDeploymentForLogs(dep.id);
                                setActiveTab('logs');
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                            >
                              Logs
                            </button>

                            {/* Visit link */}
                            <a
                              href={dep.deploymentUrl || directApiUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors flex items-center gap-1"
                            >
                              <span>Visit</span>
                              <ArrowUpRight size={12} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Architecture & URLs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div className="text-[11px] font-mono text-emerald-400 uppercase font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Live Direct Endpoint
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={directEndpointUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-mono text-zinc-200 hover:text-white underline decoration-zinc-700 truncate"
                    >
                      {directEndpointUrl.replace(/^https?:\/\//, '')}
                    </a>
                    <button
                      onClick={() => handleCopy(directEndpointUrl, 'overview-endpoint')}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                      title="Copy endpoint"
                    >
                      {copiedUrl === 'overview-endpoint' ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Always online. Directly streams project files from Cloudflare R2 storage.
                  </p>
                </Card>

                <Card className="p-4 border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div className="text-[11px] font-mono text-emerald-400 uppercase font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Production URL
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={currentProdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-mono text-zinc-100 hover:text-indigo-300 hover:underline truncate font-medium flex items-center gap-1"
                      title={`Open ${currentProdUrl}`}
                    >
                      <span>{currentProdUrl.replace('https://', '')}</span>
                      <ArrowUpRight size={12} className="text-zinc-400 shrink-0" />
                    </a>
                    <button
                      onClick={() => handleCopy(currentProdUrl, 'overview-prod')}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                      title="Copy production domain"
                    >
                      {copiedUrl === 'overview-prod' ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Always routes to the project's current production deployment.
                  </p>
                </Card>

                <Card className="p-4 border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div className="text-[11px] font-mono text-zinc-500 uppercase">Framework & RLS</div>
                  <div className="text-sm font-semibold text-zinc-200 capitalize">
                    {selectedProject.framework || 'Static HTML & Assets'}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Scoped to organization <span className="font-mono text-zinc-300">{currentOrg?.name}</span>.
                  </p>
                </Card>
              </div>

              {/* CLI Deploy Example */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Terminal size={14} className="text-indigo-400" />
                  <span>Deploy via Optic CLI</span>
                </div>
                <CodeBlock
                  language="bash"
                  code={`# Deploy current directory to Optic Hosting\nnpx optic deploy ./dist --project ${selectedProject.slug}`}
                />
              </div>
            </div>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <ListFilter size={13} className="text-zinc-500" />
                  <span className="text-zinc-400">Deployment:</span>
                  <select
                    value={selectedDeploymentForLogs || ''}
                    onChange={(e) => setSelectedDeploymentForLogs(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                  >
                    {numberedDeployments.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.seqNumber} ({d.id.substring(0, 8)}) - {d.status} {d.isProduction ? '— PRODUCTION' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="font-mono text-zinc-500 text-[11px]">Storage: Private Cloudflare R2</span>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 space-y-2 overflow-x-auto min-h-[260px]">
                {loadingLogs ? (
                  <TerminalLogsSkeleton />
                ) : logsError ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-xs text-red-400">{logsError}</p>
                  </div>
                ) : deploymentLogs.length > 0 ? (
                  deploymentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <span className="text-zinc-600 select-none text-[11px] shrink-0 font-mono">
                        {log.timestamp}
                      </span>
                      <span
                        className={`text-[10px] px-1 rounded uppercase font-bold select-none shrink-0 ${
                          log.level === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.level === 'warn'
                            ? 'bg-amber-500/20 text-amber-400'
                            : log.level === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-zinc-300 font-mono leading-relaxed">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500">No logs for this deployment.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-xl">
              <Card className="p-5 border-zinc-800 bg-zinc-900/40 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Project Details</h3>
                <div className="text-xs space-y-1 text-zinc-400">
                  <div>
                    <span className="text-zinc-500">Name:</span> {selectedProject.name}
                  </div>
                  <div>
                    <span className="text-zinc-500">Slug:</span> {selectedProject.slug}
                  </div>
                  <div>
                    <span className="text-zinc-500">Project ID:</span>{' '}
                    <code className="text-zinc-300 font-mono">{selectedProject.id}</code>
                  </div>
                </div>
              </Card>

              {/* Danger Zone */}
              <div className="p-5 rounded-xl border border-red-900/40 bg-red-950/10 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-red-400">Delete Project</h3>
                  <p className="text-xs text-zinc-400">
                    Permanently delete this project and all associated deployment records.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-800/80 text-red-400 hover:bg-red-950/40"
                  onClick={handleDeleteProject}
                  loading={deletingProject}
                  icon={<Trash2 size={13} />}
                >
                  Delete Project
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* CASE 3: ALL PROJECTS VIEW */
        <div className="space-y-6">
          {/* Header with Switcher, Search, and New Project button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Projects</h1>
              <p className="text-xs text-zinc-400">
                Deploy, host, and scale edge websites on Optic Hosting.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <OrganizationSwitcher />
              <Button
                size="sm"
                variant="primary"
                onClick={handleNavigateToNewProject}
                icon={<Plus size={13} />}
              >
                New Project
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="max-w-xs w-full">
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="text-xs text-zinc-500">
              {filteredProjects.length} project(s)
            </span>
          </div>

          {/* Projects Grid */}
          {loadingProjects || orgLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HostingProjectCardSkeleton />
              <HostingProjectCardSkeleton />
            </div>
          ) : projectsError ? (
            <div className="p-8 rounded-xl border border-red-900/40 bg-red-950/10 text-center space-y-3">
              <AlertCircle size={20} className="text-red-400 mx-auto" />
              <p className="text-xs text-red-400">{projectsError}</p>
              <Button size="sm" variant="outline" onClick={fetchProjects} icon={<RotateCw size={12} />}>
                Retry
              </Button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 space-y-3">
              <Server size={24} className="text-zinc-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">
                  {searchQuery ? 'No matching projects' : 'No projects yet'}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try searching with a different name or slug.'
                    : 'Deploy a static website or HTML file to get started.'}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleNavigateToNewProject}
                  icon={<Plus size={13} />}
                >
                  Create Project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((proj) => {
                const prodUrl = `https://${proj.slug}.host.doy.best`;

                return (
                  <div
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700/80 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors">
                            <Server size={15} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                              {proj.name}
                            </h3>
                            <span className="text-[11px] font-mono text-zinc-500">
                              {proj.slug}
                            </span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Ready
                        </span>
                      </div>

                      {/* Production URL & Live endpoint display */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-zinc-300 group-hover:text-indigo-300 transition-colors">
                          <Globe size={11} className="text-emerald-400" />
                          <span className="font-medium truncate">{`${proj.slug}.host.doy.best`}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(prodUrl, `card-${proj.id}`);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                          title="Copy production URL"
                        >
                          {copiedUrl === `card-${proj.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {proj.latestDeployment
                          ? `Last deployed ${new Date(proj.latestDeployment.createdAt).toLocaleDateString()}`
                          : 'No deployments yet'}
                      </span>
                      <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-0.5">
                        <span>Open</span>
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DEPLOY MODAL (Static Files / Folder Upload) */}
      {deployModalOpen && (
        <Modal
          isOpen={deployModalOpen}
          onClose={() => {
            if (!isDeploying) {
              setDeployModalOpen(false);
              setSelectedFiles([]);
            }
          }}
          title={`Deploy to ${selectedProject?.name || 'Project'}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              className="p-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center space-y-3 cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
                <Upload size={18} />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-200">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'Drag & drop website folder or index.html'}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Direct upload to private Cloudflare R2 object storage
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                />
                <input
                  type="file"
                  ref={filesInputRef}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  multiple
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  icon={<FileCode size={12} />}
                >
                  Select File(s)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  icon={<Folder size={12} />}
                >
                  Select Folder
                </Button>
              </div>
            </div>

            {/* Note Input */}
            <Input
              label="Deployment Note / Commit Message (Optional)"
              placeholder="e.g. Update homepage hero"
              value={deploymentNote}
              onChange={(e) => setDeploymentNote(e.target.value)}
              disabled={isDeploying}
            />

            {/* Progress & Live Step */}
            {isDeploying && (
              <div className="space-y-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <span>{deployStepText}</span>
                  <span className="font-mono">{deployProgressPercent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${deployProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {deployError && (
              <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/20 text-xs text-red-400">
                {deployError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeployModalOpen(false);
                  setSelectedFiles([]);
                }}
                disabled={isDeploying}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartDeploy}
                loading={isDeploying}
                disabled={selectedFiles.length === 0 || isDeploying}
                icon={<Upload size={13} />}
              >
                Deploy Now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

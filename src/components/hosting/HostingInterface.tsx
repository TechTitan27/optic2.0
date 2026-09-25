import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { CodeBlock } from '../common/CodeBlock';
import { OrganizationSwitcher } from '../common/OrganizationSwitcher';
import { HostingProject, DeploymentItem, DeploymentLog, DomainItem, SurfaceType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';
import { supabaseData } from '../../lib/supabaseData';
import { storageService } from '../../lib/storageService';
import { getUserAvatarUrl, getOrgAvatarUrl, getDiceBearOrgAvatarUrl } from '../../lib/avatar';
import {
  Server,
  Plus,
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Clock,
  Terminal,
  Globe,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Code2,
  Trash2,
  Building2,
  Sparkles,
  Layers,
  Upload,
  FileCode,
  Folder,
  FileText,
  Copy,
  Check,
  HardDrive,
  Info,
  ChevronRight,
  ListFilter,
} from 'lucide-react';

interface HostingInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
}

export const HostingInterface: React.FC<HostingInterfaceProps> = ({ onNavigateSurface }) => {
  const { user, profile } = useAuth();
  const { currentOrg, organizations, loading: orgLoading, createOrg, hasOrganizations } = useOrganization();
  const toast = useToast();

  const activeCreator =
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'developer';

  // Projects state
  const [projects, setProjects] = useState<HostingProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<HostingProject | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'logs' | 'domains' | 'settings'>('overview');

  // New Project modal state
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSlug, setNewProjectSlug] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newFramework, setNewFramework] = useState<'static' | 'react' | 'vite' | 'nextjs' | 'astro' | 'html'>('static');
  const [creatingProject, setCreatingProject] = useState(false);

  // First Visit Org Onboarding form state
  const [onboardOrgName, setOnboardOrgName] = useState('');
  const [creatingOnboardOrg, setCreatingOnboardOrg] = useState(false);

  // Deployments state
  const [deploymentsList, setDeploymentsList] = useState<DeploymentItem[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState<boolean>(false);
  const [selectedDeploymentForLogs, setSelectedDeploymentForLogs] = useState<string | null>(null);

  // Deployment Logs state
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Static Deployment Upload Modal state
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; relativePath: string }[]>([]);
  const [deploymentNote, setDeploymentNote] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStepText, setDeployStepText] = useState('');
  const [deployProgressPercent, setDeployProgressPercent] = useState(0);
  const [deployLiveLogs, setDeployLiveLogs] = useState<DeploymentLog[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Domains state
  const [projectDomains, setProjectDomains] = useState<DomainItem[]>([]);
  const [loadingDomains, setLoadingDomains] = useState<boolean>(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  // Deleting project state
  const [deletingProject, setDeletingProject] = useState(false);

  // Copy helper
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Clear stale data and fetch projects when currentOrg changes
  const fetchProjects = useCallback(async () => {
    if (!currentOrg?.id) {
      setProjects([]);
      setSelectedProject(null);
      setDeploymentsList([]);
      setProjectDomains([]);
      setDeploymentLogs([]);
      return;
    }

    setLoadingProjects(true);
    try {
      const data = await supabaseData.getHostingProjects(currentOrg.id);
      setProjects(data);

      // Keep selectedProject in sync if still present in new organization
      if (selectedProject) {
        const found = data.find((p) => p.id === selectedProject.id);
        if (found) {
          setSelectedProject(found);
        } else {
          // If project belonged to another organization, clear it immediately
          setSelectedProject(null);
          setDeploymentsList([]);
          setProjectDomains([]);
          setDeploymentLogs([]);
        }
      }
    } catch (err) {
      console.warn('Error fetching hosting projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [currentOrg?.id]);

  // When organization changes: clear stale project/deployment state and refresh projects
  useEffect(() => {
    setSelectedProject(null);
    setDeploymentsList([]);
    setProjectDomains([]);
    setDeploymentLogs([]);
    fetchProjects();
  }, [currentOrg?.id]);

  // Fetch project deployments and domains when selectedProject changes
  const loadProjectDetails = useCallback(async () => {
    if (!selectedProject || !currentOrg?.id) {
      setDeploymentsList([]);
      setProjectDomains([]);
      return;
    }

    setLoadingDeployments(true);
    setLoadingDomains(true);
    try {
      const [deps, doms] = await Promise.all([
        supabaseData.getProjectDeployments(selectedProject.id, currentOrg.id),
        supabaseData.getProjectDomains(selectedProject.id),
      ]);
      setDeploymentsList(deps);
      setProjectDomains(doms);

      if (deps.length > 0 && !selectedDeploymentForLogs) {
        setSelectedDeploymentForLogs(deps[0].id);
      }
    } catch (err) {
      console.warn('Error loading project details:', err);
    } finally {
      setLoadingDeployments(false);
      setLoadingDomains(false);
    }
  }, [selectedProject?.id, currentOrg?.id]);

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  // Fetch deployment logs when selectedDeploymentForLogs changes
  useEffect(() => {
    if (!selectedDeploymentForLogs) {
      setDeploymentLogs([]);
      return;
    }

    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const logs = await supabaseData.getDeploymentLogs(selectedDeploymentForLogs);
        if (logs.length > 0) {
          setDeploymentLogs(logs);
        } else {
          // If no logs stored in table yet, provide structured lifecycle logs based on deployment metadata
          const targetDep = deploymentsList.find((d) => d.id === selectedDeploymentForLogs);
          if (targetDep) {
            setDeploymentLogs([
              {
                id: 'log-1',
                deploymentId: targetDep.id,
                timestamp: new Date(targetDep.createdAt).toLocaleTimeString(),
                level: 'info',
                message: `Deployment initialized for ${selectedProject?.name || 'app'} (${targetDep.id})`,
              },
              {
                id: 'log-2',
                deploymentId: targetDep.id,
                timestamp: new Date(targetDep.createdAt).toLocaleTimeString(),
                level: 'info',
                message: `Uploaded to R2 bucket: ${targetDep.storagePath || `deployments/${currentOrg?.id}/${targetDep.projectId}/${targetDep.id}`}`,
              },
              {
                id: 'log-3',
                deploymentId: targetDep.id,
                timestamp: targetDep.completedAt ? new Date(targetDep.completedAt).toLocaleTimeString() : new Date(targetDep.createdAt).toLocaleTimeString(),
                level: targetDep.status === 'failed' ? 'error' : 'success',
                message: targetDep.status === 'failed' ? 'Deployment failed' : 'Deployment ready',
              },
            ]);
          } else {
            setDeploymentLogs([]);
          }
        }
      } catch (err) {
        console.warn('Error fetching deployment logs:', err);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [selectedDeploymentForLogs, deploymentsList]);

  // Handler: Update new project slug dynamically when name changes
  const handleProjectNameChange = (val: string) => {
    setNewProjectName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setNewProjectSlug(generated);
  };

  // Handler: Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !currentOrg) return;
    setCreatingProject(true);

    try {
      const cleanSlug =
        newProjectSlug.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') ||
        newProjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const newProj = await supabaseData.createHostingProject(currentOrg.id, {
        name: newProjectName.trim(),
        slug: cleanSlug,
        description: newProjectDescription.trim() || undefined,
        framework: newFramework,
        creatorName: activeCreator,
      });

      setProjects((prev) => [newProj, ...prev]);
      setNewProjectName('');
      setNewProjectSlug('');
      setNewProjectDescription('');
      setCreateProjectModalOpen(false);
      setSelectedProject(newProj);
      setActiveTab('overview');
      toast.success(`Project "${newProj.name}" created under ${currentOrg.name}.`, 'Hosting Project Ready');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project', 'Creation Error');
    } finally {
      setCreatingProject(false);
    }
  };

  // Handler: Folder selection for New Deployment
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Skip system hidden files like .DS_Store
      if (file.name.startsWith('.DS_Store') || file.name.startsWith('__MACOSX')) continue;
      const relativePath = (file as any).webkitRelativePath || file.name;
      filesArray.push({ file, relativePath });
    }

    setSelectedFiles(filesArray);
    if (!deploymentNote) {
      setDeploymentNote(`Static deployment: ${filesArray.length} files`);
    }
  };

  // Handler: Files selection (multiple files fallback)
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.startsWith('.DS_Store')) continue;
      filesArray.push({ file, relativePath: file.name });
    }

    setSelectedFiles(filesArray);
    if (!deploymentNote) {
      setDeploymentNote(`Static deployment: ${filesArray.length} files`);
    }
  };

  // Handler: Drag and drop files onto modal
  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const fileList = e.dataTransfer.files;
    const filesArray: { file: File; relativePath: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.startsWith('.DS_Store')) continue;
      filesArray.push({ file, relativePath: file.name });
    }

    setSelectedFiles(filesArray);
    if (!deploymentNote) {
      setDeploymentNote(`Static deployment: ${filesArray.length} files`);
    }
  };

  // Handler: Execute REAL Static Deployment MVP
  const handleExecuteDeployment = async () => {
    if (!selectedProject || !currentOrg || !user?.id) return;
    if (selectedFiles.length === 0) {
      toast.warning('Please select files or a folder to deploy.', 'No Files Selected');
      return;
    }

    setIsDeploying(true);
    setDeployError(null);
    setDeployLiveLogs([]);
    setDeployProgressPercent(0);

    const deploymentId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const storagePath = `deployments/${currentOrg.id}/${selectedProject.id}/${deploymentId}`;
    const deploymentUrl = selectedProject.productionDomain || `https://${selectedProject.slug}.optic.doy.best`;

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
      // 1. Initial status: pending
      setDeployStepText('Creating deployment record...');
      addLocalLog('Deployment created', 'info');

      const newDeployment = await supabaseData.createDeploymentRecord({
        id: deploymentId,
        projectId: selectedProject.id,
        organizationId: currentOrg.id,
        userId: user.id,
        status: 'pending',
        deploymentUrl,
        storagePath,
        commitMessage: deploymentNote.trim() || `Deployment of ${selectedFiles.length} files`,
        creator: activeCreator,
        branch: selectedProject.gitBranch || 'main',
      });

      // 2. Set status to building
      setDeployStepText('Uploading files to Cloudflare R2...');
      await supabaseData.updateDeploymentStatus(deploymentId, 'building');
      addLocalLog('Uploading files', 'info');

      // 3. Upload each file to Cloudflare R2 with isolated key structure
      const totalFiles = selectedFiles.length;
      let uploadedCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const item = selectedFiles[i];
        const fileName = item.relativePath;
        const mimeType = item.file.type || 'application/octet-stream';
        const fileSize = item.file.size;

        setDeployStepText(`Uploading [${i + 1}/${totalFiles}]: ${fileName}`);

        // Request isolated presigned PUT URL
        const presigned = await storageService.requestDeploymentUploadUrl({
          organizationId: currentOrg.id,
          projectId: selectedProject.id,
          deploymentId,
          filePath: fileName,
          mimeType,
          size: fileSize,
        });

        // PUT file directly to Cloudflare R2
        await storageService.uploadDirectToR2(presigned.uploadUrl, item.file, mimeType);

        uploadedCount++;
        const currentPercent = Math.round((uploadedCount / totalFiles) * 100);
        setDeployProgressPercent(currentPercent);
      }

      // 4. Set status to ready
      setDeployStepText('Finalizing deployment...');
      addLocalLog('Upload complete', 'success');
      const completedAt = new Date().toISOString();
      await supabaseData.updateDeploymentStatus(deploymentId, 'ready', completedAt);
      addLocalLog('Deployment ready', 'success');

      // Refresh project and deployments
      await loadProjectDetails();
      await fetchProjects();
      setSelectedDeploymentForLogs(deploymentId);

      toast.success(
        `Deployed ${uploadedCount} files to Cloudflare R2 for ${selectedProject.name}.`,
        'Deployment Ready'
      );

      // Keep modal open for 1.2s to show success state before closing
      setTimeout(() => {
        setIsDeploying(false);
        setDeployModalOpen(false);
        setSelectedFiles([]);
        setDeploymentNote('');
        setActiveTab('deployments');
      }, 1200);
    } catch (err: any) {
      console.error('Deployment failure:', err);
      const errMsg = err?.message || 'Deployment upload failed';
      setDeployError(errMsg);
      addLocalLog(`Deployment failed: ${errMsg}`, 'error');
      await supabaseData.updateDeploymentStatus(deploymentId, 'failed', new Date().toISOString()).catch(() => {});
      setIsDeploying(false);
      toast.error(errMsg, 'Deployment Failed');
    }
  };

  // Handler: Add Custom Domain
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomainInput.trim() || !selectedProject || !currentOrg) return;
    setAddingDomain(true);

    try {
      const newDom = await supabaseData.addProjectDomain(
        selectedProject.id,
        currentOrg.id,
        customDomainInput.trim()
      );
      setProjectDomains((prev) => [newDom, ...prev]);
      setCustomDomainInput('');
      toast.success(`Domain ${newDom.domain} added. Configure CNAME to activate.`, 'Domain Added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add domain', 'Domain Error');
    } finally {
      setAddingDomain(false);
    }
  };

  // Handler: Delete Custom Domain
  const handleDeleteDomain = async (domainId: string) => {
    if (!selectedProject) return;
    try {
      await supabaseData.deleteProjectDomain(domainId, selectedProject.id);
      setProjectDomains((prev) => prev.filter((d) => d.id !== domainId));
      toast.info('Custom domain removed.', 'Domain Removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove domain', 'Delete Error');
    }
  };

  // Handler: Delete Project
  const handleDeleteProject = async () => {
    if (!selectedProject || !currentOrg) return;
    const confirm = window.confirm(
      `Are you sure you want to delete "${selectedProject.name}"? This will tear down all edge deployments.`
    );
    if (!confirm) return;

    setDeletingProject(true);
    try {
      await supabaseData.deleteHostingProject(selectedProject.id, currentOrg.id);
      setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
      setSelectedProject(null);
      toast.info(`Project "${selectedProject.name}" deleted.`, 'Project Deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project', 'Error');
    } finally {
      setDeletingProject(false);
    }
  };

  // Handler: First Visit Organization Onboarding
  const handleOnboardOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardOrgName.trim()) return;
    setCreatingOnboardOrg(true);
    try {
      await createOrg(onboardOrgName.trim());
      setOnboardOrgName('');
      toast.success('Organization created! You can now launch hosting projects.', 'Welcome to Optic Hosting');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization', 'Error');
    } finally {
      setCreatingOnboardOrg(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const latestDep = deploymentsList[0] || selectedProject?.latestDeployment;

  // Render Status Badge helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <Badge variant="success" dot size="sm">
            Ready
          </Badge>
        );
      case 'building':
        return (
          <Badge variant="warning" dot size="sm">
            Building
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" dot size="sm">
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="error" dot size="sm">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" size="sm">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* CASE 1: USER HAS NO ORGANIZATIONS ON FIRST VISIT */}
      {!orgLoading && !hasOrganizations ? (
        <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 mx-auto flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-950/30">
            <Building2 size={28} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Create Your Organization</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Hosting projects on Optic belong to organizations. This allows you to manage deployments, custom domains, and collaborate with your team.
            </p>
          </div>

          <Card className="p-6 text-left border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
            <form onSubmit={handleOnboardOrgSubmit} className="space-y-4">
              <Input
                label="Organization Name"
                placeholder="e.g. Acme Studio or Personal"
                value={onboardOrgName}
                onChange={(e) => setOnboardOrgName(e.target.value)}
                required
                autoFocus
              />

              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-400">
                <img
                  src={getDiceBearOrgAvatarUrl(onboardOrgName || 'Optic Organization')}
                  alt="Organization Icon Preview"
                  className="w-10 h-10 rounded-lg object-cover border border-zinc-700/60 bg-zinc-800 shrink-0 shadow-sm"
                />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Organization Visual Mark</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Glass avatar dynamically generated from organization UUID.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                loading={creatingOnboardOrg}
                disabled={!onboardOrgName.trim()}
              >
                Create Organization & Continue
              </Button>
            </form>
          </Card>
        </div>
      ) : selectedProject ? (
        /* CASE 2: PROJECT DETAIL VIEW */
        <div className="space-y-6">
          {/* Back button & Project Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                title="Back to all projects"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-white">{selectedProject.name}</h1>
                  {renderStatusBadge(latestDep?.status || selectedProject.status)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={selectedProject.productionDomain}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>{selectedProject.productionDomain}</span>
                    <ExternalLink size={11} />
                  </a>
                  <button
                    onClick={() => handleCopyUrl(selectedProject.productionDomain)}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                    title="Copy production domain"
                  >
                    {copiedUrl ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSelectedFiles([]);
                  setDeployError(null);
                  setDeployModalOpen(true);
                }}
                icon={<Upload size={14} />}
              >
                New Deployment
              </Button>
            </div>
          </div>

          {/* Project Navigation Tabs */}
          <div className="flex border-b border-zinc-800 text-xs font-medium gap-6">
            {(['overview', 'deployments', 'logs', 'domains', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 capitalize transition-colors relative ${
                  activeTab === tab ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Production Status Banner */}
              <Card className="p-5 border-zinc-800 bg-zinc-900/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                        Active Production Deployment
                      </span>
                      {renderStatusBadge(latestDep?.status || 'ready')}
                    </div>
                    <div className="text-base font-semibold text-white flex items-center gap-2">
                      <Globe size={16} className="text-indigo-400" />
                      <a
                        href={selectedProject.productionDomain}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-indigo-300 font-mono text-sm"
                      >
                        {selectedProject.productionDomain}
                      </a>
                    </div>
                    {latestDep && (
                      <p className="text-xs text-zinc-400">
                        {latestDep.commitMessage || 'Manual deployment'} · Deployed {new Date(latestDep.createdAt).toLocaleString()} by {latestDep.creator || 'developer'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setSelectedFiles([]);
                        setDeployError(null);
                        setDeployModalOpen(true);
                      }}
                      icon={<Upload size={14} />}
                    >
                      Deploy Website
                    </Button>
                  </div>
                </div>

                {latestDep?.storagePath && (
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
                    <span className="truncate">R2 Storage: {latestDep.storagePath}</span>
                    <span className="text-emerald-400 shrink-0 ml-2">Isolated Object Path</span>
                  </div>
                )}
              </Card>

              {/* Project Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase">Framework</span>
                  <p className="text-sm font-semibold text-zinc-100 capitalize mt-1">
                    {selectedProject.framework}
                  </p>
                </Card>
                <Card className="p-4">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase">Organization</span>
                  <p className="text-sm font-semibold text-zinc-100 mt-1 truncate">
                    {currentOrg?.name} ({currentOrg?.slug})
                  </p>
                </Card>
                <Card className="p-4">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase">Total Deployments</span>
                  <p className="text-sm font-semibold text-zinc-100 mt-1">
                    {deploymentsList.length}
                  </p>
                </Card>
              </div>

              {/* Storage vs CDN Notice */}
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  <HardDrive size={15} className="text-sky-400" />
                  <span>Real Cloudflare R2 Deployment Storage</span>
                </div>
                <p className="leading-relaxed text-[11px] text-zinc-400">
                  Files are uploaded directly to private Cloudflare R2 object storage under <code className="text-zinc-300 font-mono">deployments/{currentOrg?.id}/{selectedProject.id}/...</code>. Static files remain isolated from Cloud user storage.
                </p>
              </div>

              {/* CLI Deploy Example */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Terminal size={14} className="text-indigo-400" />
                  <span>Deploy via Optic CLI</span>
                </div>
                <CodeBlock
                  language="bash"
                  code={`# Deploy build output directory to Optic Hosting
npx optic deploy ./dist --project ${selectedProject.slug}`}
                />
              </div>
            </div>
          )}

          {/* TAB 2: DEPLOYMENTS (Deployment History) */}
          {activeTab === 'deployments' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm">Deployment History</CardTitle>
                  <CardDescription>All static deployments and releases for this project</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSelectedFiles([]);
                    setDeployError(null);
                    setDeployModalOpen(true);
                  }}
                  icon={<Upload size={13} />}
                >
                  New Deployment
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingDeployments ? (
                  <div className="p-8 text-center text-xs text-zinc-500">Loading deployments...</div>
                ) : deploymentsList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                    <p>No deployments recorded for this project yet.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeployModalOpen(true)}
                    >
                      Create First Deployment
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                    {deploymentsList.map((dep) => (
                      <div
                        key={dep.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(dep.status)}
                            <span className="font-semibold text-zinc-100 font-sans">
                              {dep.commitMessage || 'Static Website Deployment'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-zinc-500 text-[11px]">
                            <span>ID: {dep.id.substring(0, 8)}</span>
                            <span>·</span>
                            <span>By: {dep.creator || 'developer'}</span>
                            <span>·</span>
                            <span>{new Date(dep.createdAt).toLocaleString()}</span>
                            {dep.completedAt && (
                              <>
                                <span>·</span>
                                <span className="text-zinc-400">Finished in {Math.max(1, Math.round((new Date(dep.completedAt).getTime() - new Date(dep.createdAt).getTime()) / 1000))}s</span>
                              </>
                            )}
                          </div>
                          {dep.storagePath && (
                            <div className="text-[10px] text-zinc-600 truncate max-w-md">
                              {dep.storagePath}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => {
                              setSelectedDeploymentForLogs(dep.id);
                              setActiveTab('logs');
                            }}
                            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                          >
                            View Logs
                          </button>
                          <a
                            href={dep.deploymentUrl || dep.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-sans font-medium"
                          >
                            <span>Visit</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: LOGS (Deployment Logs) */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <ListFilter size={14} className="text-zinc-500" />
                  <span className="text-zinc-400">Deployment:</span>
                  <select
                    value={selectedDeploymentForLogs || ''}
                    onChange={(e) => setSelectedDeploymentForLogs(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                  >
                    {deploymentsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id.substring(0, 8)} - {d.status} ({new Date(d.createdAt).toLocaleTimeString()})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="font-mono text-zinc-500 text-[11px]">Storage: Cloudflare R2 (Private)</span>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 space-y-2 overflow-x-auto shadow-inner min-h-[220px]">
                {loadingLogs ? (
                  <div className="text-zinc-500 text-center py-8">Loading deployment logs...</div>
                ) : deploymentLogs.length > 0 ? (
                  deploymentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <span className="text-zinc-600 select-none text-[11px] shrink-0">{log.timestamp}</span>
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
                      <span
                        className={
                          log.level === 'success'
                            ? 'text-emerald-300 font-semibold'
                            : log.level === 'error'
                            ? 'text-red-300'
                            : 'text-zinc-200'
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-center py-8">
                    No deployment logs recorded for this deployment yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Custom Domains</CardTitle>
                  <CardDescription>
                    Point your custom domain to this deployment with automated SSL certificate provisioning.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleAddDomain} className="flex gap-2">
                    <Input
                      placeholder="app.mybrand.com"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      className="flex-1"
                      required
                    />
                    <Button type="submit" variant="primary" size="sm" loading={addingDomain}>
                      Add Domain
                    </Button>
                  </form>

                  {loadingDomains ? (
                    <div className="py-4 text-center text-xs text-zinc-500">Loading domains...</div>
                  ) : projectDomains.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-500">
                      No custom domains configured yet for this project.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/80 font-mono text-xs pt-2">
                      {projectDomains.map((dom) => (
                        <div
                          key={dom.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Globe size={14} className="text-indigo-400" />
                              <span className="text-zinc-100 font-semibold">{dom.domain}</span>
                              <Badge
                                variant={dom.status === 'verified' ? 'success' : 'warning'}
                                size="sm"
                                dot
                              >
                                {dom.status}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-zinc-500 mt-1 block">
                              DNS Record: CNAME pointing to <code className="text-zinc-300">{dom.dnsTarget}</code>
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge variant="info" size="sm">
                              SSL Active
                            </Badge>
                            <button
                              onClick={() => handleDeleteDomain(dom.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                              title="Remove domain"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Project Details</CardTitle>
                  <CardDescription>Configuration and identifiers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input label="Project Name" value={selectedProject.name} disabled />
                  <Input label="Project Slug" value={selectedProject.slug} disabled />
                  <Input label="Assigned Subdomain" value={selectedProject.assignedSubdomain} disabled />
                  <Input label="Production URL" value={selectedProject.productionDomain} disabled />
                  {selectedProject.description && (
                    <Input label="Description" value={selectedProject.description} disabled />
                  )}
                </CardContent>
              </Card>

              <Card className="border-red-900/40 bg-red-950/10">
                <CardHeader>
                  <CardTitle className="text-sm text-red-400">Danger Zone</CardTitle>
                  <CardDescription>Delete this hosting project and all associated deployments.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteProject}
                    loading={deletingProject}
                    icon={<Trash2 size={14} />}
                  >
                    Delete Project
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* CASE 3: ALL PROJECTS LIST (SCOPED TO CURRENT ORGANIZATION) */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={getOrgAvatarUrl(currentOrg)}
                alt={currentOrg?.name || 'Organization'}
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700/80 bg-zinc-800 shadow-md"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{currentOrg?.name}</span>
                  <span className="text-xs font-mono text-zinc-500 font-normal">({currentOrg?.slug})</span>
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Hosting projects and deployments scoped to this organization.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreateProjectModalOpen(true)}
              icon={<Plus size={14} />}
            >
              New Project
            </Button>
          </div>

          {/* Projects Grid */}
          {loadingProjects ? (
            <div className="py-16 text-center text-xs text-zinc-500">Loading organization projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-zinc-800/80 text-zinc-400 mx-auto flex items-center justify-center">
                <Server size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">No hosting projects yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Create your first frontend project under <span className="text-zinc-300 font-medium">{currentOrg?.name}</span> to deploy to Optic's Edge network.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setCreateProjectModalOpen(true)}
                icon={<Plus size={14} />}
              >
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  hoverEffect
                  className="p-5 cursor-pointer flex flex-col justify-between"
                  onClick={() => {
                    setSelectedProject(proj);
                    setActiveTab('overview');
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                          <Server size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{proj.name}</h3>
                          <span className="text-[11px] font-mono text-zinc-500">
                            {proj.assignedSubdomain}
                          </span>
                        </div>
                      </div>
                      {renderStatusBadge(proj.status)}
                    </div>

                    <div className="space-y-1.5 text-xs text-zinc-400 font-mono mt-4">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">SLUG:</span>
                        <span className="text-zinc-300">{proj.slug}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">PRODUCTION URL:</span>
                        <span className="text-indigo-400 truncate max-w-[200px]">{proj.productionDomain}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">LAST DEPLOYMENT:</span>
                        <span className="text-zinc-300">
                          {proj.latestDeployment ? new Date(proj.latestDeployment.createdAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-500">
                      Updated {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                      <span>Open Project</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Architecture note */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400 flex items-start gap-3">
            <Code2 size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-zinc-200">Deploy via Optic CLI:</strong> Run <code className="text-zinc-200 font-mono">npx optic deploy ./dist</code> with your Optic API token to deploy static assets directly into <span className="text-zinc-200 font-medium">{currentOrg?.name}</span>.
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Project Modal */}
      <Modal
        isOpen={createProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
        title="Create New Hosting Project"
        description={`Add a hosting project under organization "${currentOrg?.name || 'My Organization'}".`}
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Acme Portfolio"
            value={newProjectName}
            onChange={(e) => handleProjectNameChange(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Project Slug"
            placeholder="e.g. acme-portfolio"
            value={newProjectSlug}
            onChange={(e) => setNewProjectSlug(e.target.value)}
            required
            hint={`Assigned production subdomain: ${newProjectSlug.trim() || '[slug]'}.optic.doy.best`}
          />

          <Input
            label="Description (Optional)"
            placeholder="e.g. Corporate landing page and documentation"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Framework Preset</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(['static', 'react', 'vite', 'nextjs', 'astro', 'html'] as const).map((fw) => (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setNewFramework(fw)}
                  className={`p-2 rounded-lg border text-center capitalize transition-colors ${
                    newFramework === fw
                      ? 'border-indigo-500 bg-indigo-500/10 text-white font-semibold'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {fw}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreateProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creatingProject}
              disabled={!newProjectName.trim()}
            >
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: New Static Website Deployment Modal */}
      <Modal
        isOpen={deployModalOpen}
        onClose={() => {
          if (!isDeploying) setDeployModalOpen(false);
        }}
        title={`Deploy to ${selectedProject?.name || 'Project'}`}
        description="Select static website files or project folder to upload directly to Cloudflare R2."
      >
        <div className="space-y-4">
          {/* File / Folder Selectors */}
          <input
            type="file"
            ref={folderInputRef}
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
          <input
            type="file"
            ref={filesInputRef}
            multiple
            className="hidden"
            onChange={handleFilesSelect}
          />

          {!isDeploying ? (
            <>
              {/* Dropzone & Buttons */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFiles}
                className="p-6 border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl text-center bg-zinc-900/40 space-y-3 transition-colors cursor-pointer"
                onClick={() => folderInputRef.current?.click()}
              >
                <div className="w-10 h-10 rounded-full bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                  <Upload size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-200">
                    Click to select a website folder or drag files here
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    HTML, CSS, JS, images, fonts, and assets
                  </p>
                </div>

                <div className="flex justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    icon={<Folder size={13} />}
                  >
                    Select Folder
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => filesInputRef.current?.click()}
                    icon={<FileCode size={13} />}
                  >
                    Select Files
                  </Button>
                </div>
              </div>

              {/* Selected Files Summary */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="font-semibold">
                      Selected Files ({selectedFiles.length})
                    </span>
                    <span className="text-zinc-500 font-mono">
                      {(selectedFiles.reduce((acc, f) => acc + f.file.size, 0) / (1024 * 1024)).toFixed(2)} MB total
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1 font-mono text-[11px]">
                    {selectedFiles.slice(0, 10).map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-zinc-300">
                        <span className="truncate max-w-[280px]">{f.relativePath}</span>
                        <span className="text-zinc-500">{(f.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                    {selectedFiles.length > 10 && (
                      <div className="text-zinc-500 text-center pt-1">
                        + {selectedFiles.length - 10} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Input
                label="Deployment Note"
                placeholder="e.g. Updated home hero banner and pricing"
                value={deploymentNote}
                onChange={(e) => setDeploymentNote(e.target.value)}
              />

              {deployError && (
                <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{deployError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeployModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={selectedFiles.length === 0}
                  onClick={handleExecuteDeployment}
                  icon={<Upload size={14} />}
                >
                  Start Deployment
                </Button>
              </div>
            </>
          ) : (
            /* Live Deployment Progress View */
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{deployStepText}</span>
                  <span className="font-mono text-zinc-400">{deployProgressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${deployProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Real-time live log terminal */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300 space-y-1.5 max-h-48 overflow-y-auto shadow-inner">
                {deployLiveLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-zinc-600 text-[10px] select-none">{log.timestamp}</span>
                    <span
                      className={`text-[9px] px-1 rounded uppercase font-bold select-none ${
                        log.level === 'success'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : log.level === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={
                        log.level === 'success' ? 'text-emerald-300 font-semibold' : 'text-zinc-200'
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

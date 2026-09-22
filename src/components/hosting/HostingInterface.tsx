import React, { useState, useEffect, useCallback } from 'react';
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

  // State: projects loaded dynamically from Supabase
  const [projects, setProjects] = useState<HostingProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<HostingProject | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'logs' | 'domains' | 'settings'>('overview');

  // New Project modal
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newFramework, setNewFramework] = useState<'react' | 'static' | 'astro' | 'nextjs'>('react');
  const [creatingProject, setCreatingProject] = useState(false);

  // First Visit Org Onboarding form state
  const [onboardOrgName, setOnboardOrgName] = useState('');
  const [creatingOnboardOrg, setCreatingOnboardOrg] = useState(false);

  // Deployments
  const [deploymentsList, setDeploymentsList] = useState<DeploymentItem[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState<boolean>(false);
  const [triggerDeploying, setTriggerDeploying] = useState(false);

  // Domains
  const [projectDomains, setProjectDomains] = useState<DomainItem[]>([]);
  const [loadingDomains, setLoadingDomains] = useState<boolean>(false);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  // Deleting project state
  const [deletingProject, setDeletingProject] = useState(false);

  // Fetch projects when currentOrg changes
  const fetchProjects = useCallback(async () => {
    if (!currentOrg?.id) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }
    setLoadingProjects(true);
    try {
      const data = await supabaseData.getHostingProjects(currentOrg.id);
      setProjects(data);
      // Keep selectedProject in sync if still present
      if (selectedProject) {
        const found = data.find((p) => p.id === selectedProject.id);
        if (found) setSelectedProject(found);
      }
    } catch (err) {
      console.warn('Error fetching hosting projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [currentOrg?.id, selectedProject?.id]);

  useEffect(() => {
    fetchProjects();
  }, [currentOrg?.id]);

  // Fetch project deployments and domains when selectedProject changes
  useEffect(() => {
    if (!selectedProject || !currentOrg?.id) {
      setDeploymentsList([]);
      setProjectDomains([]);
      return;
    }

    const loadProjectDetails = async () => {
      setLoadingDeployments(true);
      setLoadingDomains(true);
      try {
        const [deps, doms] = await Promise.all([
          supabaseData.getProjectDeployments(selectedProject.id, currentOrg.id),
          supabaseData.getProjectDomains(selectedProject.id),
        ]);
        setDeploymentsList(deps);
        setProjectDomains(doms);
      } catch (err) {
        console.warn('Error loading project details:', err);
      } finally {
        setLoadingDeployments(false);
        setLoadingDomains(false);
      }
    };

    loadProjectDetails();
  }, [selectedProject?.id, currentOrg?.id]);

  // Handler: Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !currentOrg) return;
    setCreatingProject(true);

    try {
      const newProj = await supabaseData.createHostingProject(currentOrg.id, {
        name: newProjectName.trim(),
        framework: newFramework,
        creatorName: activeCreator,
      });

      setProjects((prev) => [newProj, ...prev]);
      setNewProjectName('');
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

  // Handler: Trigger Redeploy
  const handleTriggerDeploy = async () => {
    if (!selectedProject || !currentOrg) return;
    setTriggerDeploying(true);

    try {
      const newDep = await supabaseData.createDeployment(selectedProject.id, currentOrg.id, {
        projectName: selectedProject.name,
        commitMessage: 'manual: trigger new production edge build',
        creator: activeCreator,
        branch: selectedProject.gitBranch || 'main',
        environment: 'production',
        url: selectedProject.productionDomain,
      });

      setDeploymentsList((prev) => [newDep, ...prev]);
      setSelectedProject((prev) =>
        prev
          ? {
              ...prev,
              latestDeployment: newDep,
              updatedAt: new Date().toISOString(),
            }
          : null
      );
      toast.success('Production build deployed to Edge CDN successfully.', 'Deployment Live');
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger deployment', 'Deploy Error');
    } finally {
      setTriggerDeploying(false);
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

  // Dynamic logs generation based on actual deployments
  const latestDep = deploymentsList[0] || selectedProject?.latestDeployment;
  const dynamicLogs: DeploymentLog[] = latestDep
    ? [
        {
          id: 'l1',
          deploymentId: latestDep.id,
          timestamp: new Date(latestDep.createdAt).toLocaleTimeString(),
          level: 'info',
          message: `Received edge deployment for ${selectedProject?.name || 'app'} (${latestDep.id})`,
        },
        {
          id: 'l2',
          deploymentId: latestDep.id,
          timestamp: new Date(latestDep.createdAt).toLocaleTimeString(),
          level: 'info',
          message: `Triggered by ${latestDep.creator} on branch ${latestDep.branch}`,
        },
        {
          id: 'l3',
          deploymentId: latestDep.id,
          timestamp: new Date(latestDep.createdAt).toLocaleTimeString(),
          level: 'info',
          message: `Building static assets with ${selectedProject?.framework || 'react'} preset...`,
        },
        {
          id: 'l4',
          deploymentId: latestDep.id,
          timestamp: new Date(latestDep.createdAt).toLocaleTimeString(),
          level: 'info',
          message: `Assets compiled and synced to Optic Edge CDN (${latestDep.durationSeconds}s)`,
        },
        {
          id: 'l5',
          deploymentId: latestDep.id,
          timestamp: new Date(latestDep.createdAt).toLocaleTimeString(),
          level: 'success',
          message: `Deployed successfully! Active production URL: ${latestDep.url}`,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* CASE 1: USER HAS NO ORGANIZATIONS ON FIRST VISIT */}
        {!orgLoading && !hasOrganizations ? (
          <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 mx-auto flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-950/30">
              <Building2 size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Create Your Organization
              </h1>
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
                      Brand icon generated for <span className="text-zinc-200 font-medium">{onboardOrgName.trim() || 'your organization'}</span>.
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
            {/* Back button & Project Title */}
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
                    <h1 className="text-xl font-bold tracking-tight text-white">
                      {selectedProject.name}
                    </h1>
                    <Badge variant="success" dot size="sm">
                      {selectedProject.status}
                    </Badge>
                  </div>
                  <a
                    href={selectedProject.productionDomain}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5"
                  >
                    <span>{selectedProject.productionDomain}</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={triggerDeploying}
                  onClick={handleTriggerDeploy}
                  icon={<RotateCw size={13} />}
                >
                  Redeploy Latest
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

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Framework</span>
                    <p className="text-sm font-semibold text-zinc-100 capitalize mt-1">
                      {selectedProject.framework}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Git Branch</span>
                    <p className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5 mt-1 font-mono">
                      <GitBranch size={14} className="text-sky-400" />
                      {selectedProject.gitBranch || 'main'}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Organization</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1 truncate">
                      {currentOrg?.name}
                    </p>
                  </Card>
                </div>

                {/* CLI Deploy Example */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Terminal size={14} className="text-indigo-400" />
                    <span>Deploy from terminal via Optic CLI</span>
                  </div>
                  <CodeBlock
                    language="bash"
                    code={`# Deploy this project directly from your working directory
npx optic deploy ./dist --project ${selectedProject.slug}`}
                  />
                </div>
              </div>
            )}

            {/* TAB: DEPLOYMENTS */}
            {activeTab === 'deployments' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Deployment History</CardTitle>
                  <CardDescription>Live releases and build status</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingDeployments ? (
                    <div className="p-8 text-center text-xs text-zinc-500">Loading deployments...</div>
                  ) : deploymentsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      No deployments recorded for this project yet. Trigger a redeploy above.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                      {deploymentsList.map((dep) => (
                        <div
                          key={dep.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/40"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span className="font-semibold text-zinc-100 font-sans">
                                {dep.commitMessage}
                              </span>
                              <Badge
                                variant={dep.environment === 'production' ? 'info' : 'outline'}
                                size="sm"
                              >
                                {dep.environment}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-zinc-500 text-[11px] mt-1.5">
                              <span>commit {dep.commitHash}</span>
                              <span>·</span>
                              <span>{dep.branch}</span>
                              <span>·</span>
                              <span>{dep.durationSeconds}s</span>
                              <span>·</span>
                              <span>{new Date(dep.createdAt).toLocaleString()}</span>
                            </div>
                          </div>

                          <a
                            href={dep.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-sans font-medium"
                          >
                            <span>Visit URL</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TAB: LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Build Stream: {latestDep?.id || 'idle'}</span>
                  </div>
                  <span className="font-mono text-zinc-500 text-[11px]">Region: global-edge</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 space-y-1.5 overflow-x-auto shadow-inner">
                  {dynamicLogs.length > 0 ? (
                    dynamicLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <span className="text-zinc-600 select-none text-[11px]">{log.timestamp}</span>
                        <span
                          className={`text-[10px] px-1 rounded uppercase font-bold select-none ${
                            log.level === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : log.level === 'warn'
                              ? 'bg-amber-500/20 text-amber-400'
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
                    ))
                  ) : (
                    <div className="text-zinc-500 text-center py-4">No build logs available.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DOMAINS */}
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

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Project Details</CardTitle>
                    <CardDescription>Configuration and identifiers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input label="Project Name" value={selectedProject.name} disabled />
                    <Input label="Assigned Subdomain" value={selectedProject.assignedSubdomain} disabled />
                    <Input label="Production URL" value={selectedProject.productionDomain} disabled />
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
              <div className="py-16 text-center text-xs text-zinc-500">
                Loading organization projects...
              </div>
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
                        <Badge variant="success" dot size="sm">
                          {proj.status}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-zinc-400 font-mono mt-4">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">FRAMEWORK:</span>
                          <span className="capitalize text-zinc-300">{proj.framework}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">BRANCH:</span>
                          <span className="text-zinc-300">{proj.gitBranch || 'main'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-500">
                        Updated {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>
                      <span className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                        <span>Manage</span>
                        <ExternalLink size={12} />
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

      {/* Create Project Modal */}
      <Modal
        isOpen={createProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
        title="Create New Hosting Project"
        description={`Add a hosting project under organization "${currentOrg?.name || 'My Organization'}".`}
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. documentation-site"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            required
            autoFocus
            hint="Subdomain will be [slug].optic.doy.best"
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Framework Preset</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['react', 'static', 'astro', 'nextjs'] as const).map((fw) => (
                <button
                  key={fw}
                  type="button"
                  onClick={() => setNewFramework(fw)}
                  className={`p-2.5 rounded-lg border text-left capitalize transition-colors ${
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
    </div>
  );
};

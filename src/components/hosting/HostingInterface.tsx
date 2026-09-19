import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { CodeBlock } from '../common/CodeBlock';
import { OpticFooter } from '../common/OpticFooter';
import { HostingProject, DeploymentItem, DeploymentLog, DomainItem, SurfaceType } from '../../types';
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
  Play,
  RotateCw,
  Layers,
  Code2,
  Lock,
} from 'lucide-react';
import { OpticLogo } from '../brand/OpticLogo';

interface HostingInterfaceProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
}

export const HostingInterface: React.FC<HostingInterfaceProps> = ({ onNavigateSurface }) => {
  // State: projects list
  const [projects, setProjects] = useState<HostingProject[]>([
    {
      id: 'proj_1',
      name: 'my-portfolio',
      slug: 'my-portfolio',
      framework: 'react',
      productionDomain: 'https://my-portfolio.optic.doy.best',
      assignedSubdomain: 'my-portfolio.optic.doy.best',
      customDomains: ['portfolio.alexrivera.dev'],
      gitRepo: 'alexrivera/portfolio',
      gitBranch: 'main',
      status: 'ready',
      latestDeployment: {
        id: 'dep_101',
        projectId: 'proj_1',
        projectName: 'my-portfolio',
        status: 'ready',
        url: 'https://my-portfolio.optic.doy.best',
        commitHash: '9fa4c10',
        commitMessage: 'feat: add developer infrastructure case studies',
        creator: 'alex.developer',
        branch: 'main',
        durationSeconds: 14,
        environment: 'production',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'proj_2',
      name: 'example-site',
      slug: 'example-site',
      framework: 'static',
      productionDomain: 'https://example-site.optic.doy.best',
      assignedSubdomain: 'example-site.optic.doy.best',
      customDomains: [],
      gitRepo: 'alexrivera/example-site',
      gitBranch: 'preview',
      status: 'ready',
      latestDeployment: {
        id: 'dep_102',
        projectId: 'proj_2',
        projectName: 'example-site',
        status: 'ready',
        url: 'https://example-site.optic.doy.best',
        commitHash: '8b31ea9',
        commitMessage: 'fix: align navbar spacing for mobile',
        creator: 'alex.developer',
        branch: 'preview',
        durationSeconds: 9,
        environment: 'preview',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);

  const [selectedProject, setSelectedProject] = useState<HostingProject | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'logs' | 'domains' | 'settings'>('overview');

  // New Project modal
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newFramework, setNewFramework] = useState<'react' | 'static' | 'astro' | 'nextjs'>('react');
  const [creatingProject, setCreatingProject] = useState(false);

  // New Deployment Trigger
  const [triggerDeploying, setTriggerDeploying] = useState(false);

  // Project Domains
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [projectDomains, setProjectDomains] = useState<DomainItem[]>([
    {
      id: 'dom_1',
      projectId: 'proj_1',
      domain: 'portfolio.alexrivera.dev',
      status: 'verified',
      dnsType: 'CNAME',
      dnsTarget: 'cname.optic.doy.best',
      sslStatus: 'active',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ]);

  // Project Deployments History
  const [deploymentsList, setDeploymentsList] = useState<DeploymentItem[]>([
    {
      id: 'dep_101',
      projectId: 'proj_1',
      projectName: 'my-portfolio',
      status: 'ready',
      url: 'https://my-portfolio.optic.doy.best',
      commitHash: '9fa4c10',
      commitMessage: 'feat: add developer infrastructure case studies',
      creator: 'alex.developer',
      branch: 'main',
      durationSeconds: 14,
      environment: 'production',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'dep_100',
      projectId: 'proj_1',
      projectName: 'my-portfolio',
      status: 'ready',
      url: 'https://dep-100-my-portfolio.optic.doy.best',
      commitHash: '3c19f2a',
      commitMessage: 'chore: configure tailwind typography',
      creator: 'alex.developer',
      branch: 'main',
      durationSeconds: 18,
      environment: 'preview',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ]);

  // Deployment Logs
  const [logs, setLogs] = useState<DeploymentLog[]>([
    { id: 'l1', deploymentId: 'dep_101', timestamp: '14:02:01.120', level: 'info', message: 'Received deployment request from CLI token [opt_live_...]' },
    { id: 'l2', deploymentId: 'dep_101', timestamp: '14:02:02.040', level: 'info', message: 'Cloning repository alexrivera/portfolio (commit 9fa4c10)...' },
    { id: 'l3', deploymentId: 'dep_101', timestamp: '14:02:04.190', level: 'info', message: 'Running build command: npm run build' },
    { id: 'l4', deploymentId: 'dep_101', timestamp: '14:02:11.830', level: 'info', message: 'Dist directory generated: 28 static files (1.4 MB total)' },
    { id: 'l5', deploymentId: 'dep_101', timestamp: '14:02:13.200', level: 'info', message: 'Uploading assets to Optic Edge CDN...' },
    { id: 'l6', deploymentId: 'dep_101', timestamp: '14:02:15.110', level: 'success', message: 'Deployment complete in 14.02s! Assigned URL: https://my-portfolio.optic.doy.best' },
  ]);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);

    const slug = newProjectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const newProj: HostingProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: newProjectName.trim(),
      slug,
      framework: newFramework,
      productionDomain: `https://${slug}.optic.doy.best`,
      assignedSubdomain: `${slug}.optic.doy.best`,
      customDomains: [],
      gitBranch: 'main',
      status: 'ready',
      latestDeployment: {
        id: 'dep_' + Math.random().toString(36).substring(2, 8),
        projectId: 'proj_' + Math.random().toString(36).substring(2, 9),
        projectName: newProjectName.trim(),
        status: 'ready',
        url: `https://${slug}.optic.doy.best`,
        commitHash: 'init01',
        commitMessage: 'Initial site deployment',
        creator: 'alex.developer',
        branch: 'main',
        durationSeconds: 11,
        environment: 'production',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects([newProj, ...projects]);
    setNewProjectName('');
    setCreatingProject(false);
    setCreateProjectModalOpen(false);
    setSelectedProject(newProj);
  };

  const handleTriggerDeploy = () => {
    if (!selectedProject) return;
    setTriggerDeploying(true);

    setTimeout(() => {
      const newDep: DeploymentItem = {
        id: 'dep_' + Math.random().toString(36).substring(2, 8),
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        status: 'ready',
        url: selectedProject.productionDomain,
        commitHash: Math.random().toString(16).substring(2, 9),
        commitMessage: 'manual: trigger new production build',
        creator: 'alex.developer',
        branch: selectedProject.gitBranch || 'main',
        durationSeconds: 12,
        environment: 'production',
        createdAt: new Date().toISOString(),
      };

      setDeploymentsList([newDep, ...deploymentsList]);
      setSelectedProject({
        ...selectedProject,
        latestDeployment: newDep,
        updatedAt: new Date().toISOString(),
      });
      setTriggerDeploying(false);
    }, 1200);
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomainInput.trim() || !selectedProject) return;

    const newDom: DomainItem = {
      id: 'dom_' + Math.random().toString(36).substring(2, 8),
      projectId: selectedProject.id,
      domain: customDomainInput.trim().toLowerCase(),
      status: 'pending',
      dnsType: 'CNAME',
      dnsTarget: 'cname.optic.doy.best',
      sslStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    setProjectDomains([...projectDomains, newDom]);
    setCustomDomainInput('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigateSurface('dashboard', '/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <OpticLogo size={20} showWordmark={true} surfaceLabel="Hosting" />
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
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {selectedProject ? (
          /* PROJECT DETAIL VIEW */
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
                      Ready
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
                    activeTab === tab
                      ? 'text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Framework</span>
                    <p className="text-sm font-semibold text-zinc-100 capitalize mt-1">
                      {selectedProject.framework}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Branch</span>
                    <p className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5 mt-1 font-mono">
                      <GitBranch size={14} className="text-sky-400" />
                      {selectedProject.gitBranch || 'main'}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">Build Duration</span>
                    <p className="text-sm font-semibold text-zinc-100 mt-1 font-mono">
                      {selectedProject.latestDeployment?.durationSeconds || 14} seconds
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

            {activeTab === 'deployments' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Deployment History</CardTitle>
                  <CardDescription>Previous builds and releases</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
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
                            <Badge variant={dep.environment === 'production' ? 'info' : 'outline'} size="sm">
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
                </CardContent>
              </Card>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Build Worker Stream: dep_101</span>
                  </div>
                  <span className="font-mono text-zinc-500 text-[11px]">Worker node: ldn-edge-02</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 space-y-1.5 overflow-x-auto shadow-inner">
                  {logs.map((log) => (
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
                      <span className={log.level === 'success' ? 'text-emerald-300 font-semibold' : 'text-zinc-200'}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'domains' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Custom Domains</CardTitle>
                    <CardDescription>
                      Point your own domains to this deployment with automatic SSL certificate issuance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleAddDomain} className="flex gap-2">
                      <Input
                        placeholder="app.mybrand.com"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" variant="primary" size="sm">
                        Add Domain
                      </Button>
                    </form>

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

                          <div className="flex items-center gap-2">
                            <Badge variant="info" size="sm">
                              SSL Active
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'settings' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Project Settings</CardTitle>
                  <CardDescription>Configure build commands and directories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input label="Project Name" value={selectedProject.name} disabled />
                  <Input label="Build Command" defaultValue="npm run build" />
                  <Input label="Output Directory" defaultValue="dist" />
                  <div className="pt-2">
                    <Button variant="primary" size="sm">
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* ALL PROJECTS LIST */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Hosting Projects</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Static sites, React, and frontend applications distributed across global CDN nodes.
                </p>
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
                        Ready
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-zinc-400 font-mono mt-4">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">FRAMEWORK:</span>
                        <span className="capitalize text-zinc-300">{proj.framework}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">LATEST COMMIT:</span>
                        <span className="text-zinc-300">{proj.latestDeployment?.commitHash || 'main'}</span>
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

            {/* Architecture note */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400 flex items-start gap-3">
              <Code2 size={18} className="text-indigo-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-zinc-200">Deploy via API:</strong> You can also deploy programmatically by POSTing your build tarball directly to <code className="text-zinc-200 font-mono">https://api.optic.doy.best/v1/deployments</code> using your Optic API Key.
              </div>
            </div>
          </div>
        )}
      </main>

      <OpticFooter onNavigateSurface={onNavigateSurface} compact={true} />

      {/* Create Project Modal */}
      <Modal
        isOpen={createProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
        title="Create New Hosting Project"
        description="Set up an Optic Hosting project for instant static and frontend deployments."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. documentation-site"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            required
            autoFocus
            hint="Assigned domain will be [name].optic.doy.best"
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
              onClick={() => setCreateProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creatingProject}
            >
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

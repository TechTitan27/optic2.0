import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Globe, Check, AlertCircle, ChevronDown, ChevronUp, Sparkles, Building2, Code2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { supabaseData } from '../../lib/supabaseData';
import { HostingProject } from '../../types';
import { useToast } from '../../context/ToastContext';

interface NewProjectPageProps {
  onBackToHosting: () => void;
  onProjectCreated: (project: HostingProject) => void;
}

type FrameworkKey = 'static' | 'react' | 'vite' | 'nextjs' | 'astro' | 'html';

interface FrameworkOption {
  key: FrameworkKey;
  label: string;
  badge: string;
  defaultBuildCommand: string;
  defaultOutputDirectory: string;
  defaultInstallCommand: string;
}

const FRAMEWORKS: FrameworkOption[] = [
  {
    key: 'static',
    label: 'Static HTML & Assets',
    badge: 'Zero Config',
    defaultBuildCommand: '',
    defaultOutputDirectory: '.',
    defaultInstallCommand: '',
  },
  {
    key: 'vite',
    label: 'Vite (React / Vue / Svelte)',
    badge: 'Popular',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    defaultInstallCommand: 'npm install',
  },
  {
    key: 'react',
    label: 'Create React App',
    badge: 'SPA',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'build',
    defaultInstallCommand: 'npm install',
  },
  {
    key: 'nextjs',
    label: 'Next.js (Static Export)',
    badge: 'Fullstack',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'out',
    defaultInstallCommand: 'npm install',
  },
  {
    key: 'astro',
    label: 'Astro',
    badge: 'Fast',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
    defaultInstallCommand: 'npm install',
  },
];

export const NewProjectPage: React.FC<NewProjectPageProps> = ({
  onBackToHosting,
  onProjectCreated,
}) => {
  const { user, profile } = useAuth();
  const { currentOrg, organizations, setCurrentOrg, loading: orgLoading } = useOrganization();
  const toast = useToast();

  const activeCreator =
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'developer';

  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>('static');

  // Simple project configuration
  const [showConfig, setShowConfig] = useState(false);
  const [buildCommand, setBuildCommand] = useState('');
  const [outputDirectory, setOutputDirectory] = useState('.');
  const [installCommand, setInstallCommand] = useState('');
  const [rootDirectory, setRootDirectory] = useState('./');

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  // Update slug automatically when project name changes, unless user manually customized slug
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

  // Sync framework defaults
  const handleFrameworkChange = (key: FrameworkKey) => {
    setSelectedFramework(key);
    const found = FRAMEWORKS.find((f) => f.key === key);
    if (found) {
      setBuildCommand(found.defaultBuildCommand);
      setOutputDirectory(found.defaultOutputDirectory);
      setInstallCommand(found.defaultInstallCommand);
    }
  };

  // Live computed production domain preview
  const displaySlug = projectSlug || projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my-project';
  const previewDomain = `${displaySlug}.optic.doy.best`;

  // Inline validation
  const isNameEmpty = nameTouched && !projectName.trim();

  // Keyboard shortcut listener (Esc to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onBackToHosting();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToHosting, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);

    if (!projectName.trim()) {
      setErrorMessage('Project name is required.');
      return;
    }

    if (!currentOrg?.id) {
      setErrorMessage('Please select or create an organization first.');
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

      const newProject = await supabaseData.createHostingProject(currentOrg.id, {
        name: projectName.trim(),
        slug: cleanSlug,
        description: projectDescription.trim() || undefined,
        framework: selectedFramework,
        creatorName: activeCreator,
        userId: user?.id,
        buildCommand: buildCommand.trim() || undefined,
        outputDirectory: outputDirectory.trim() || undefined,
        installCommand: installCommand.trim() || undefined,
        rootDirectory: rootDirectory.trim() || undefined,
      });

      toast.success(
        `Project "${newProject.name}" successfully created under ${currentOrg.name}.`,
        'Project Ready'
      );

      // Redirect directly to the new project's Hosting page
      onProjectCreated(newProject);
    } catch (err: any) {
      console.error('[NewProjectPage] Project creation error:', err);
      const msg = err?.message || 'Failed to create project. Please verify your connection and try again.';
      setErrorMessage(msg);
      toast.error(msg, 'Creation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10 px-4 space-y-6">
      {/* 1. Breadcrumb & Back Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={onBackToHosting}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Hosting
          </button>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-100 font-semibold">New Project</span>
        </div>

        <button
          type="button"
          onClick={onBackToHosting}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Hosting</span>
        </button>
      </div>

      {/* 2. Page Heading & Short Description */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Create a project
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Configure a new project for edge hosting on Optic. Connect continuous deployments, assign subdomains, and route custom domains.
        </p>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-900/60 bg-red-950/30 text-red-300 text-xs flex items-start gap-3 animate-in fade-in duration-150">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-red-200">Creation Error</span>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 3. Main Configuration Card */}
      {orgLoading && !currentOrg ? (
        <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-6 sm:p-8 space-y-6 animate-shimmer">
          <Skeleton className="w-48 h-5" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-36 h-5" />
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-24 h-9" />
        </div>
      ) : (
        <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Scope / Organization Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                Organization Scope
              </label>

              {organizations.length > 1 ? (
                <div className="relative">
                  <select
                    value={currentOrg?.id || ''}
                    onChange={(e) => {
                      const selected = organizations.find((o) => o.id === e.target.value);
                      if (selected) setCurrentOrg(selected);
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none appearance-none font-mono"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.slug})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-3.5 text-zinc-500 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200">
                      {currentOrg?.name?.charAt(0).toUpperCase() || 'O'}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">{currentOrg?.name || 'Default Organization'}</span>
                      <span className="text-[11px] font-mono text-zinc-500">slug: {currentOrg?.slug}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Active Scope
                  </span>
                </div>
              )}
              <p className="text-[11px] text-zinc-500 font-mono">
                Projects and deployments will belong to this organization.
              </p>
            </div>

            {/* Project Name */}
            <div className="space-y-1.5">
              <label htmlFor="project-name-input" className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                Project Name <span className="text-red-400">*</span>
              </label>
              <Input
                id="project-name-input"
                placeholder="e.g. acme-web-app"
                value={projectName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => setNameTouched(true)}
                error={isNameEmpty ? 'Project name cannot be empty.' : undefined}
                required
                autoFocus
              />
            </div>

            {/* Custom Slug & Live URL Preview */}
            <div className="space-y-2">
              <label htmlFor="project-slug-input" className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                Project Slug
              </label>
              <Input
                id="project-slug-input"
                placeholder="e.g. acme-web-app"
                value={projectSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
              />

              {/* Subdomain Preview Badge */}
              <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 truncate pr-2">
                  <Globe size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-zinc-500">Live URL:</span>
                  <span className="text-emerald-400 font-medium truncate">https://{previewDomain}</span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold shrink-0">Edge Anycast</span>
              </div>
            </div>

            {/* Description (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="project-desc-input" className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                Description <span className="text-zinc-500 font-normal lowercase">(optional)</span>
              </label>
              <Input
                id="project-desc-input"
                placeholder="e.g. Marketing landing page and documentation site"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>

            {/* Framework Preset Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-zinc-200 block uppercase tracking-wider font-mono">
                Framework Preset
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FRAMEWORKS.map((fw) => {
                  const isSelected = selectedFramework === fw.key;
                  return (
                    <button
                      key={fw.key}
                      type="button"
                      onClick={() => handleFrameworkChange(fw.key)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500/80 bg-emerald-950/20 text-white shadow-xs'
                          : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-mono ${
                            isSelected
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                          }`}
                        >
                          <Code2 size={14} />
                        </div>
                        <div>
                          <span className="text-xs font-medium block">{fw.label}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{fw.badge}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simple Project Configuration (Accordion) */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-white py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span>Build & Output Settings</span>
                  <span className="text-zinc-600">({showConfig ? 'collapse' : 'optional'})</span>
                </span>
                {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showConfig && (
                <div className="mt-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 space-y-3.5 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-zinc-400 block">Build Command</label>
                    <Input
                      placeholder="e.g. npm run build"
                      value={buildCommand}
                      onChange={(e) => setBuildCommand(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-zinc-400 block">Output Directory</label>
                    <Input
                      placeholder="e.g. dist or ."
                      value={outputDirectory}
                      onChange={(e) => setOutputDirectory(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-zinc-400 block">Install Command</label>
                      <Input
                        placeholder="e.g. npm install"
                        value={installCommand}
                        onChange={(e) => setInstallCommand(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-zinc-400 block">Root Directory</label>
                      <Input
                        placeholder="e.g. ./"
                        value={rootDirectory}
                        onChange={(e) => setRootDirectory(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Action & Cancel Navigation */}
            <div className="pt-4 border-t border-zinc-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onBackToHosting}
                disabled={submitting}
                className="text-xs text-zinc-400 hover:text-white justify-center"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[11px] font-mono text-zinc-500">
                  Press ↵ to create
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={submitting || !projectName.trim()}
                  icon={<Plus size={15} />}
                  className="w-full sm:w-auto justify-center text-xs"
                >
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

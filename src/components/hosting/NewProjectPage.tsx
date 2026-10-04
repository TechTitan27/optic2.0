import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Check, AlertCircle, Building2, Code2, Server, ArrowUpRight } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { supabaseData } from '../../lib/supabaseData';
import { HostingProject } from '../../types';
import { useToast } from '../../context/ToastContext';

interface NewProjectPageProps {
  onBackToHosting: () => void;
  onProjectCreated: (project: HostingProject) => void;
}

type FrameworkKey = 'static' | 'vite' | 'react' | 'nextjs' | 'astro';

interface FrameworkOption {
  key: FrameworkKey;
  label: string;
  badge: string;
  defaultBuildCommand: string;
  defaultOutputDirectory: string;
}

const FRAMEWORKS: FrameworkOption[] = [
  {
    key: 'static',
    label: 'Static HTML / Assets',
    badge: 'Zero Config',
    defaultBuildCommand: '',
    defaultOutputDirectory: '.',
  },
  {
    key: 'vite',
    label: 'Vite / React / Vue',
    badge: 'Popular',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
  },
  {
    key: 'nextjs',
    label: 'Next.js (Static)',
    badge: 'Export',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'out',
  },
  {
    key: 'astro',
    label: 'Astro',
    badge: 'Fast',
    defaultBuildCommand: 'npm run build',
    defaultOutputDirectory: 'dist',
  },
];

export const NewProjectPage: React.FC<NewProjectPageProps> = ({
  onBackToHosting,
  onProjectCreated,
}) => {
  const { user, profile } = useAuth();
  const { currentOrg, organizations, setCurrentOrg } = useOrganization();
  const toast = useToast();

  const activeCreator =
    profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'developer';

  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>('static');

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Escape key handler
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
      });

      toast.success(
        `Project "${newProject.name}" created under ${currentOrg.name}.`,
        'Project Ready'
      );

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
    <div className="max-w-2xl mx-auto py-4 space-y-6">
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
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Create a New Project</h1>
        <p className="text-xs text-zinc-400">
          Set up an edge hosting project on Optic. Upload static HTML or bundle files for zero-cold-start hosting.
        </p>
      </div>

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
            <span className="text-[10px] uppercase font-mono text-zinc-500">Assigned Production URL</span>
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
    </div>
  );
};

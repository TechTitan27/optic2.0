import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { SurfaceType, FileItem, DeploymentItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  HardDrive,
  Globe,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onSelectNav: (tab: 'overview' | 'keys' | 'settings') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateSurface,
}) => {
  const { user, profile } = useAuth();
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [recentDeployments, setRecentDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Welcome back';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [filesRes, depRes] = await Promise.all([
          fetch('/api/cloud/files?limit=4'),
          fetch('/api/hosting/deployments?limit=4'),
        ]);

        if (filesRes.ok) {
          const fData = await filesRes.json();
          setRecentFiles(fData.files || []);
        }
        if (depRes.ok) {
          const dData = await depRes.json();
          setRecentDeployments(dData.deployments || []);
        }
      } catch {
        // Fallback default sample records
        setRecentFiles([
          {
            id: 'f_1',
            name: 'logo.svg',
            extension: 'SVG',
            mimeType: 'image/svg+xml',
            sizeBytes: 12288,
            storageKey: 'assets/logo.svg',
            storageProvider: 'r2',
            createdAt: new Date(Date.now() - 120000).toISOString(),
            updatedAt: new Date(Date.now() - 120000).toISOString(),
          },
          {
            id: 'f_2',
            name: 'website.zip',
            extension: 'ZIP',
            mimeType: 'application/zip',
            sizeBytes: 4404019,
            storageKey: 'builds/website.zip',
            storageProvider: 'r2',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);

        setRecentDeployments([
          {
            id: 'dep_1',
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
            id: 'dep_2',
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
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const userName = profile?.fullName || user?.email?.split('@')[0] || 'developer';

  return (
    <div className="space-y-8">
      {/* Top Greeting */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {getGreeting()}, {userName}.
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Your infrastructure at a glance.
        </p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2 font-medium">
            Storage
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            7.2 GB <span className="text-xs font-normal text-zinc-500">/ 10 GB</span>
          </div>
          <div className="mt-3 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full rounded-full" style={{ width: '72%' }} />
          </div>
        </div>

        {/* Bandwidth */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2 font-medium">
            Bandwidth
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            14.8 GB <span className="text-xs font-normal text-zinc-500">/ 50 GB</span>
          </div>
          <div className="mt-3 w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '29.6%' }} />
          </div>
        </div>

        {/* Projects */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2 font-medium">
            Projects
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            2 <span className="text-xs font-normal text-zinc-500">Active</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-3 font-mono">my-portfolio, example-site</p>
        </div>

        {/* Deployments */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2 font-medium">
            Deployments
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            12 <span className="text-xs font-normal text-zinc-500">Total</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-3 font-mono">100% successful</p>
        </div>
      </div>

      {/* Cloud & Hosting Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cloud Launch */}
        <div className="p-5 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-2">
              <HardDrive size={15} className="text-sky-400" />
              <span>CLOUD</span>
            </div>
            <h3 className="text-base font-semibold text-white">Manage your files</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Store, organize, preview, and generate download links for assets and release bundles.
            </p>
          </div>
          <div className="mt-5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateSurface('cloud', '/')}
              className="text-xs"
              icon={<ArrowRight size={14} />}
            >
              Open Cloud
            </Button>
          </div>
        </div>

        {/* Hosting Launch */}
        <div className="p-5 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-2">
              <Globe size={15} className="text-emerald-400" />
              <span>HOSTING</span>
            </div>
            <h3 className="text-base font-semibold text-white">Deploy your projects</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Connect Git repositories, monitor live deployment logs, and configure custom domains.
            </p>
          </div>
          <div className="mt-5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateSurface('hosting', '/')}
              className="text-xs"
              icon={<ArrowRight size={14} />}
            >
              Open Hosting
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white tracking-tight">Recent activity</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Files */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
              <span className="text-xs font-medium text-zinc-300">Recent files</span>
              <button
                onClick={() => onNavigateSurface('cloud', '/')}
                className="text-[11px] font-mono text-zinc-400 hover:text-white"
              >
                View all →
              </button>
            </div>
            <div className="space-y-2.5">
              {recentFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FileText size={14} className="text-zinc-500 shrink-0" />
                    <span className="text-zinc-300 truncate">{f.name}</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {(f.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Deployments */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
              <span className="text-xs font-medium text-zinc-300">Recent deployments</span>
              <button
                onClick={() => onNavigateSurface('hosting', '/')}
                className="text-[11px] font-mono text-zinc-400 hover:text-white"
              >
                View all →
              </button>
            </div>
            <div className="space-y-2.5">
              {recentDeployments.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-zinc-300 truncate">{d.projectName}</span>
                    <span className="text-zinc-600">({d.commitHash})</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">{d.environment}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

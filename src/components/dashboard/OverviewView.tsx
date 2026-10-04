import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { SurfaceType, FileItem, DeploymentItem, UsageStats } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { supabaseData } from '../../lib/supabaseData';
import { ServiceStatus } from './ServiceStatus';
import { Skeleton } from '../common/Skeleton';
import {
  HardDrive,
  Globe,
  ArrowRight,
  CheckCircle2,
  FileText,
  Upload,
  Plus,
  Server,
  Activity,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  onSelectNav: (tab: 'overview' | 'keys' | 'settings') => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateSurface,
  onSelectNav,
}) => {
  const { user, profile, loading: authLoading } = useAuth();
  const { currentOrg } = useOrganization();
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [recentDeployments, setRecentDeployments] = useState<DeploymentItem[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    storageUsedBytes: 0,
    storageLimitBytes: 10 * 1024 * 1024 * 1024,
    bandwidthUsedBytes: 0,
    bandwidthLimitBytes: 50 * 1024 * 1024 * 1024,
    deploymentsThisMonth: 0,
    deploymentsLimit: 100,
    apiRequestsThisMonth: 0,
    apiRequestsLimit: 100000,
    filesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Time of day greeting: Good morning / Good afternoon
  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : 'Good afternoon';
  };

  useEffect(() => {
    let mounted = true;

    const loadRealDashboardData = async () => {
      setLoading(true);
      try {
        const userId = user?.id || '';

        const depUrl = currentOrg?.id
          ? `/api/hosting/deployments?orgId=${currentOrg.id}&limit=4`
          : '/api/hosting/deployments?limit=4';

        const [usage, files, depRes, hostingProjects] = await Promise.all([
          userId ? supabaseData.getUserUsage(userId) : Promise.resolve(null),
          userId ? supabaseData.getRecentFiles(userId, 4) : Promise.resolve([]),
          fetch(depUrl).catch(() => null),
          currentOrg?.id ? supabaseData.getHostingProjects(currentOrg.id).catch(() => []) : Promise.resolve([]),
        ]);

        if (!mounted) return;

        if (usage) {
          setUsageStats(usage);
        }

        if (files) {
          setRecentFiles(files);
        }

        if (hostingProjects) {
          setProjectsCount(hostingProjects.length);
        }

        if (depRes && depRes.ok) {
          const dData = await depRes.json();
          setRecentDeployments(dData.deployments || []);
        } else {
          setRecentDeployments([]);
        }
      } catch (err) {
        console.warn('[Overview] Data fetch notification:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadRealDashboardData();

    return () => {
      mounted = false;
    };
  }, [user?.id, currentOrg?.id]);

  // Resolve user display name
  const rawName = profile?.fullName || user?.user_metadata?.full_name || user?.user_metadata?.name;
  const firstName = rawName
    ? rawName.trim().split(' ')[0]
    : user?.email ? user.email.split('@')[0] : 'Desmond';
  const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const avatarUrl = profile?.avatarUrl;

  const totalFiles = usageStats.filesCount ?? recentFiles.length;

  const storageUsedGB = (usageStats.storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const storageLimitGB = (usageStats.storageLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const storagePct = Math.min(
    100,
    Math.max(usageStats.storageUsedBytes > 0 ? 1 : 0, (usageStats.storageUsedBytes / usageStats.storageLimitBytes) * 100)
  ).toFixed(1);

  const bandwidthUsedGB = (usageStats.bandwidthUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const bandwidthLimitGB = (usageStats.bandwidthLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const bandwidthPct = Math.min(
    100,
    Math.max(0, (usageStats.bandwidthUsedBytes / usageStats.bandwidthLimitBytes) * 100)
  ).toFixed(1);

  return (
    <div className="space-y-8">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3.5">
          {authLoading && !user && !profile ? (
            <div className="flex items-center gap-3.5 animate-shimmer" aria-hidden="true">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="w-48 h-6" />
                <Skeleton className="w-36 h-3" />
              </div>
            </div>
          ) : (
            <>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={capitalizedFirstName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl border border-zinc-800 object-cover shadow-sm shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-semibold text-zinc-200 text-base shadow-sm shrink-0">
                  {capitalizedFirstName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                  Overview
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {getGreeting()}, {capitalizedFirstName}.
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono flex items-center gap-2">
                  <span>{user?.email || 'developer@optic.doy.best'}</span>
                  <span>•</span>
                  <span className="text-zinc-500 capitalize">{profile?.tier || 'developer'} tier</span>
                  {currentOrg?.name && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-400">{currentOrg.name}</span>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Primary Actions: Upload + New Project */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateSurface('cloud', '/cloud')}
            icon={<Upload size={14} />}
            className="text-xs"
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => onNavigateSurface('hosting', '/hosting/new')}
            icon={<Plus size={14} />}
            className="text-xs"
          >
            New Project
          </Button>
        </div>
      </div>

      {/* 2. YOUR WORKSPACE — FIRST (Core Optic Products) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight">Your Workspace</h2>
          <span className="text-xs text-zinc-500 font-mono">Core Products</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Optic Cloud Card */}
          <div className="p-5 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-mono font-medium">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <HardDrive size={15} />
                  </div>
                  <span>OPTIC CLOUD</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Object Storage</span>
              </div>

              <h3 className="text-base font-semibold text-white">Cloud Storage</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Store, organize into folders, view metadata, and generate secure share links with direct uploads.
              </p>

              {/* Status & count summary */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                {loading ? (
                  <Skeleton className="w-36 h-4" />
                ) : (
                  <span className="text-zinc-300">
                    <strong className="text-white font-semibold">{totalFiles}</strong> {totalFiles === 1 ? 'file' : 'files'}
                    <span className="text-zinc-500 mx-1.5">•</span>
                    <span className="text-zinc-400">{storageUsedGB} GB used</span>
                  </span>
                )}
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Active
                </span>
              </div>
            </div>

            <div className="mt-5 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigateSurface('cloud', '/cloud')}
                className="text-xs"
                icon={<ArrowRight size={14} />}
              >
                Open Cloud
              </Button>
            </div>
          </div>

          {/* Optic Hosting Card */}
          <div className="p-5 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-medium">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Globe size={15} />
                  </div>
                  <span>OPTIC HOSTING</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Edge Network</span>
              </div>

              <h3 className="text-base font-semibold text-white">Web Hosting</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Connect Git repositories, monitor build pipelines, and manage custom apex and subdomains.
              </p>

              {/* Status & count summary */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                {loading ? (
                  <Skeleton className="w-36 h-4" />
                ) : (
                  <span className="text-zinc-300">
                    <strong className="text-white font-semibold">{projectsCount}</strong> {projectsCount === 1 ? 'project' : 'projects'}
                    <span className="text-zinc-500 mx-1.5">•</span>
                    <span className="text-zinc-400">
                      {recentDeployments.length} {recentDeployments.length === 1 ? 'deployment' : 'deployments'}
                    </span>
                  </span>
                )}
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Live
                </span>
              </div>
            </div>

            <div className="mt-5 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigateSurface('hosting', '/hosting')}
                className="text-xs"
                icon={<ArrowRight size={14} />}
              >
                Open Hosting
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RECENT ACTIVITY (Recent Uploads & Deployments) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight">Recent Activity</h2>
          <span className="text-xs text-zinc-500 font-mono">Latest updates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Uploads */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <FileText size={15} className="text-sky-400" />
                  Recent Uploads
                </span>
                <button
                  onClick={() => onNavigateSurface('cloud', '/cloud')}
                  className="text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  View in Cloud →
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="w-36 h-3.5" />
                    </div>
                    <Skeleton className="w-12 h-3" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="w-28 h-3.5" />
                    </div>
                    <Skeleton className="w-14 h-3" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="w-44 h-3.5" />
                    </div>
                    <Skeleton className="w-10 h-3" />
                  </div>
                </div>
              ) : recentFiles.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center">
                    <HardDrive size={18} />
                  </div>
                  <p className="text-xs font-medium text-zinc-200">No files uploaded yet</p>
                  <p className="text-[11px] text-zinc-400 max-w-xs">
                    Upload your first file to get started with Optic Cloud object storage.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSurface('cloud', '/cloud')}
                    icon={<Upload size={13} />}
                    className="text-xs mt-1"
                  >
                    Upload File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between text-xs font-mono py-1 border-b border-zinc-900/60 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText size={14} className="text-zinc-500 shrink-0" />
                        <span className="text-zinc-300 truncate font-sans">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-zinc-400 shrink-0">
                        <span>{formatFileSize(f.sizeBytes)}</span>
                        {f.createdAt && (
                          <span className="text-zinc-500 hidden sm:inline">
                            {formatRelativeTime(f.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Deployments */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  Recent Deployments
                </span>
                <button
                  onClick={() => onNavigateSurface('hosting', '/hosting')}
                  className="text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  View in Hosting →
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded-full" />
                      <Skeleton className="w-32 h-3.5" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                    <Skeleton className="w-14 h-3" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded-full" />
                      <Skeleton className="w-40 h-3.5" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                    <Skeleton className="w-14 h-3" />
                  </div>
                </div>
              ) : recentDeployments.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center">
                    <Server size={18} />
                  </div>
                  <p className="text-xs font-medium text-zinc-200">No deployments yet</p>
                  <p className="text-[11px] text-zinc-400 max-w-xs">
                    Deploy your first project or website to the Optic global edge network.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateSurface('hosting', '/hosting')}
                    icon={<Plus size={13} />}
                    className="text-xs mt-1"
                  >
                    Deploy Website
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentDeployments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between text-xs font-mono py-1 border-b border-zinc-900/60 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span className="text-zinc-300 truncate font-sans font-medium">{d.projectName}</span>
                        {d.commitHash && <span className="text-zinc-500 font-mono text-[10px]">({d.commitHash.slice(0, 7)})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] shrink-0">
                        <span className="text-zinc-400 capitalize">{d.environment || 'production'}</span>
                        {d.createdAt && (
                          <span className="text-zinc-500 hidden sm:inline">
                            {formatRelativeTime(d.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. RESOURCES (Compact Metrics, Not Huge Stacked Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight">Resources</h2>
          <span className="text-xs text-zinc-500 font-mono">Quota & Usage</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 animate-shimmer">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-full h-1 rounded" />
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 animate-shimmer">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-24 h-5" />
              <Skeleton className="w-full h-1 rounded" />
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 animate-shimmer">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-14 h-5" />
              <Skeleton className="w-20 h-3" />
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 animate-shimmer">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-14 h-5" />
              <Skeleton className="w-20 h-3" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Storage Metric */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Storage
                </span>
                <span className="text-[10px] font-mono text-sky-400">{storagePct}%</span>
              </div>
              <div className="text-base font-bold text-white tracking-tight">
                {storageUsedGB} <span className="text-xs font-normal text-zinc-400">/ {storageLimitGB} GB</span>
              </div>
              <div className="mt-2.5 w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>

            {/* Bandwidth Metric */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Bandwidth
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Active</span>
              </div>
              <div className="text-base font-bold text-white tracking-tight">
                {bandwidthUsedGB} <span className="text-xs font-normal text-zinc-400">/ {bandwidthLimitGB} GB</span>
              </div>
              <div className="mt-2.5 w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${bandwidthPct}%` }}
                />
              </div>
            </div>

            {/* Files Metric */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Files
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Cloud</span>
              </div>
              <div className="text-base font-bold text-white tracking-tight">
                {totalFiles}{' '}
                <span className="text-xs font-normal text-zinc-400">
                  {totalFiles === 1 ? 'file' : 'active files'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono truncate">
                {totalFiles > 0 ? 'Managed in object store' : 'No files stored'}
              </p>
            </div>

            {/* Deployments Metric */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Deployments
                </span>
                <span className="text-[10px] font-mono text-indigo-400">Hosting</span>
              </div>
              <div className="text-base font-bold text-white tracking-tight">
                {recentDeployments.length}{' '}
                <span className="text-xs font-normal text-zinc-400">
                  {recentDeployments.length === 1 ? 'release' : 'releases'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono truncate">
                {projectsCount > 0 ? `${projectsCount} active projects` : 'Edge network ready'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5. SYSTEM STATUS — LAST (Compact Summary with link to detailed health view) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-tight">System Status</h2>
          <span className="text-xs text-zinc-500 font-mono">Live health</span>
        </div>

        {/* Compact "All systems operational" summary */}
        <div className="p-4 sm:p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  All systems operational
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  99.99% Uptime
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Global edge CDN, object storage gateway, and deployment runners active across all regions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateSurface('status', '/status')}
              icon={<Activity size={13} className="text-emerald-400" />}
              className="text-xs"
            >
              Infrastructure Health
            </Button>
          </div>
        </div>

        {/* Detailed Infrastructure Health Modal (Full monitoring panel rendered here, not directly on the Overview page) */}
        <Modal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title="Infrastructure Health & Diagnostics"
          description="Live latency metrics, edge Points of Presence, and 30-day reliability diagnostics across Optic services."
          maxWidth="3xl"
        >
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <ServiceStatus compact={false} onNavigateSurface={onNavigateSurface} />
          </div>
        </Modal>
      </div>
    </div>
  );
};

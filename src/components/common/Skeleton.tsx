import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  shimmer?: boolean;
}

/**
 * Base atomic Skeleton component with subtle restrained shimmer
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  shimmer = true,
  ...props
}) => {
  return (
    <div
      className={`bg-zinc-800/70 dark:bg-zinc-800/70 rounded-md transition-opacity duration-200 ${
        shimmer ? 'animate-shimmer' : 'animate-pulse'
      } ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

/**
 * Text line skeleton
 */
export const SkeletonText: React.FC<{
  className?: string;
  width?: string;
  height?: string;
}> = ({ className = '', width = 'w-full', height = 'h-4' }) => {
  return <Skeleton className={`${height} ${width} ${className}`} />;
};

/**
 * Card skeleton with single-elevation depth
 */
export const SkeletonCard: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className = '', children }) => {
  return (
    <div
      className={`p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 relative ${className}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
};

/**
 * Hosting Project Card Skeleton: matches the exact layout of project cards in HostingInterface
 */
export const HostingProjectCardSkeleton: React.FC = () => {
  return (
    <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 flex flex-col justify-between min-h-[224px] animate-shimmer">
      <div>
        {/* Header: Icon, Name, Subdomain & Status badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="w-28 h-4" />
              <Skeleton className="w-36 h-3" />
            </div>
          </div>
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>

        {/* Metadata lines */}
        <div className="space-y-2 mt-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="w-14 h-3" />
            <Skeleton className="w-24 h-3" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="w-28 h-3" />
            <Skeleton className="w-36 h-3" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-20 h-3" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <Skeleton className="w-24 h-3" />
        <Skeleton className="w-20 h-3" />
      </div>
    </div>
  );
};

/**
 * Hosting Project Details Skeleton: matches project header, overview cards, and status banners
 */
export const HostingProjectDetailsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-shimmer" aria-hidden="true">
      {/* Back button & Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-md" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-48 h-6" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-36 h-3.5" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-32 h-8 rounded-lg" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-6 pb-3">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-20 h-4" />
        <Skeleton className="w-12 h-4" />
        <Skeleton className="w-14 h-4" />
        <Skeleton className="w-14 h-4" />
      </div>

      {/* Production Banner Skeleton */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-40 h-3" />
            <Skeleton className="w-14 h-4 rounded-full" />
          </div>
          <Skeleton className="w-64 h-5" />
          <Skeleton className="w-48 h-3" />
        </div>
        <Skeleton className="w-28 h-8 rounded-lg" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <Skeleton className="w-36 h-4" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-28 h-3" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="w-24 h-3" />
              <Skeleton className="w-20 h-3" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <Skeleton className="w-32 h-4" />
          <div className="space-y-3">
            <Skeleton className="w-full h-8 rounded-lg" />
            <Skeleton className="w-full h-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hosting Deployment Table / List Row Skeleton (Matches lines in Deployment History tab)
 */
export const DeploymentItemSkeleton: React.FC = () => {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-shimmer">
      <div className="space-y-1.5 flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="w-14 h-4 rounded-full" />
          <Skeleton className="w-48 h-4" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-32 h-3" />
          <Skeleton className="w-20 h-3" />
        </div>
        <Skeleton className="w-56 h-2.5 mt-1" />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Skeleton className="w-18 h-7 rounded-md" />
        <Skeleton className="w-14 h-7 rounded-md" />
      </div>
    </div>
  );
};

/**
 * Hosting Deployment Table Row Skeleton
 */
export const DeploymentRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-zinc-800/50">
      <td className="py-3 px-4">
        <div className="space-y-1.5">
          <Skeleton className="w-44 h-4" />
          <Skeleton className="w-24 h-3" />
        </div>
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-28 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-14 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-3" />
      </td>
      <td className="py-3 px-4 text-right">
        <Skeleton className="w-8 h-8 rounded-lg ml-auto" />
      </td>
    </tr>
  );
};

/**
 * Domain Row Skeleton for Custom Domains tab
 */
export const DomainRowSkeleton: React.FC = () => {
  return (
    <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30 flex items-center justify-between animate-shimmer">
      <div className="flex items-center gap-3">
        <Skeleton className="w-4 h-4 rounded" />
        <div className="space-y-1">
          <Skeleton className="w-36 h-4" />
          <Skeleton className="w-48 h-3" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    </div>
  );
};

/**
 * Cloud Folder Card Skeleton: matches folder cards in CloudInterface (52px height)
 */
export const CloudFolderCardSkeleton: React.FC = () => {
  return (
    <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between h-[54px] animate-shimmer">
      <div className="flex items-center gap-2.5 flex-1">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-24 h-3.5" />
      </div>
      <div className="flex items-center gap-1">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-5 h-5 rounded" />
      </div>
    </div>
  );
};

/**
 * Cloud File Table Row Skeleton: matches file rows in CloudInterface
 */
export const CloudFileRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-zinc-800/50 animate-shimmer">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-4 h-4 rounded shrink-0" />
          <Skeleton className="w-36 sm:w-48 h-4" />
        </div>
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-8 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-14 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-20 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-14 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
        </div>
      </td>
    </tr>
  );
};

/**
 * Cloud Breadcrumb Bar Skeleton
 */
export const CloudBreadcrumbSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-2 py-1 animate-shimmer">
      <Skeleton className="w-14 h-4 rounded" />
      <Skeleton className="w-3 h-3 rounded" />
      <Skeleton className="w-20 h-4 rounded" />
    </div>
  );
};

/**
 * Cloud Storage Allocation & Direct Upload Skeletons
 */
export const CloudStorageSectionSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-shimmer" aria-hidden="true">
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="w-28 h-3" />
          <Skeleton className="w-16 h-4 rounded" />
        </div>
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-full h-1.5 rounded-full mt-2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>

      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-28 h-4" />
          <Skeleton className="w-80 max-w-full h-3" />
        </div>
        <Skeleton className="w-28 h-8 rounded-lg" />
      </div>
    </div>
  );
};

/**
 * Terminal Logs Skeleton: matches the dark terminal log output box
 */
export const TerminalLogsSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono space-y-3 min-h-[180px] animate-shimmer" aria-hidden="true">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded" />
          <Skeleton className="w-32 h-3" />
        </div>
        <Skeleton className="w-20 h-3" />
      </div>
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-12 h-3.5 rounded" />
          <Skeleton className="w-64 sm:w-80 h-3" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-12 h-3.5 rounded" />
          <Skeleton className="w-72 sm:w-96 h-3" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-12 h-3.5 rounded" />
          <Skeleton className="w-52 sm:w-64 h-3" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-12 h-3.5 rounded" />
          <Skeleton className="w-48 sm:w-72 h-3" />
        </div>
      </div>
    </div>
  );
};

/**
 * Organization Switcher Trigger Skeleton: matches top bar org button
 */
export const OrgSwitcherSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800/80 animate-shimmer h-[34px] w-[140px]" aria-hidden="true">
      <Skeleton className="w-5 h-5 rounded-md shrink-0" />
      <Skeleton className="w-16 h-3.5 flex-1" />
      <Skeleton className="w-3 h-3 rounded shrink-0" />
    </div>
  );
};

/**
 * Usage Metric Card Skeleton
 */
export const UsageCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3 animate-shimmer" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-12 h-3" />
      </div>
      <Skeleton className="w-32 h-6" />
      <Skeleton className="w-full h-1.5 rounded-full" />
    </div>
  );
};

/**
 * Account / Profile Settings Skeleton
 */
export const AccountSettingsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-shimmer" aria-hidden="true">
      <div>
        <Skeleton className="w-32 h-7" />
        <Skeleton className="w-72 h-3.5 mt-2" />
      </div>

      <div className="flex gap-4 border-b border-zinc-800 pb-2">
        <Skeleton className="w-28 h-6 rounded" />
        <Skeleton className="w-28 h-6 rounded" />
        <Skeleton className="w-28 h-6 rounded" />
      </div>

      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="w-36 h-4" />
            <Skeleton className="w-48 h-3" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-full h-9 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-full h-9 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-full h-9 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-full h-9 rounded-lg" />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-800">
          <Skeleton className="w-28 h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * Public Share Page Skeleton (Matches shared file view)
 */
export const PublicShareSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-shimmer" aria-hidden="true">
      {/* File card header */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 sm:w-64 h-5" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-24 h-3" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-28 h-9 rounded-lg" />
          <Skeleton className="w-9 h-9 rounded-lg" />
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 flex flex-col items-center justify-center min-h-[360px] space-y-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <Skeleton className="w-56 h-4" />
        <Skeleton className="w-40 h-3" />
      </div>

      {/* Metadata card */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-24 h-4" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-4" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-28 h-4" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-4" />
        </div>
      </div>
    </div>
  );
};

/**
 * API Key Table Row Skeleton: matches API keys table columns
 */
export const ApiKeyRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-zinc-800/50 animate-shimmer" aria-hidden="true">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded shrink-0" />
          <Skeleton className="w-28 h-4" />
        </div>
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-32 h-4 rounded" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-20 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-14 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Skeleton className="w-16 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
        </div>
      </td>
    </tr>
  );
};



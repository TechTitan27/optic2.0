import React from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { OpticFooter } from '../common/OpticFooter';
import { ServiceStatus } from '../dashboard/ServiceStatus';
import { SurfaceType } from '../../types';
import { ArrowLeft, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';

interface StatusPageProps {
  onNavigate: (
    surface: SurfaceType,
    path?: string,
    tab?: 'overview' | 'keys' | 'settings'
  ) => void;
}

export const StatusPage: React.FC<StatusPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('main', '/')}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <OpticLogo size={22} showWordmark={true} />
            </button>
            <span className="text-zinc-600 font-mono">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Status
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('dashboard', '/dashboard')}
              icon={<LayoutDashboard size={13} />}
              className="text-xs"
            >
              Dashboard
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('main', '/')}
              icon={<ArrowLeft size={13} />}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Hero Section */}
        <div className="space-y-3 pb-6 border-b border-zinc-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Optic Platform &amp; Edge Network Health</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            System Status &amp; Real-time Diagnostics
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Live uptime metrics, edge Points of Presence latency, and 30-day reliability diagnostics across Optic Cloud (S3 Object Storage) and Optic Edge Hosting services.
          </p>
        </div>

        {/* Live Service Status Board */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <ServiceStatus compact={false} onNavigateSurface={onNavigate} />
        </div>
      </main>

      {/* Footer */}
      <OpticFooter onNavigateSurface={onNavigate} compact={false} />
    </div>
  );
};

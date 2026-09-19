import React from 'react';
import { Lock, Globe, HardDrive, Server, LayoutDashboard, BookOpen } from 'lucide-react';
import { SurfaceType } from '../../types';

interface DomainSwitcherProps {
  currentSurface: SurfaceType;
  currentPath: string;
  onNavigate: (surface: SurfaceType, path?: string) => void;
  userEmail?: string | null;
}

export const DomainSwitcher: React.FC<DomainSwitcherProps> = ({
  currentSurface,
  currentPath,
  onNavigate,
  userEmail,
}) => {
  return (
    <div className="w-full bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 z-40 select-none">
      {/* Domain Simulator Browser Pill */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
          Domain:
        </span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-[11px]">
          <Lock size={12} className="text-emerald-400" />
          <span className="text-zinc-400">https://</span>
          {currentSurface === 'cloud' && (
            <span className="text-sky-400 font-semibold">cloud.</span>
          )}
          {currentSurface === 'hosting' && (
            <span className="text-indigo-400 font-semibold">hosting.</span>
          )}
          {currentSurface === 'docs' && (
            <span className="text-teal-400 font-semibold">docs.</span>
          )}
          <span className="text-zinc-100">optic.doy.best</span>
          {currentSurface === 'dashboard' && (
            <span className="text-sky-400">/dashboard</span>
          )}
          {currentSurface === 'login' && (
            <span className="text-zinc-400">/login</span>
          )}
          {currentSurface === 'signup' && (
            <span className="text-zinc-400">/signup</span>
          )}
          {currentPath &&
            currentPath !== '/' &&
            !['dashboard', 'login', 'signup'].includes(currentSurface) && (
              <span className="text-zinc-400">{currentPath}</span>
            )}
        </div>
      </div>

      {/* Surface Quick-Jump Tabs - Pure UI Labels, No Raw URLs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onNavigate('main', '/')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
            currentSurface === 'main'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Optic Home"
        >
          <Globe size={13} className="text-sky-400" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onNavigate('dashboard', '/dashboard')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
            currentSurface === 'dashboard'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Optic Dashboard"
        >
          <LayoutDashboard size={13} className="text-zinc-300" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('cloud', '/')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
            currentSurface === 'cloud'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Optic Cloud"
        >
          <HardDrive size={13} className="text-sky-400" />
          <span>Cloud</span>
        </button>

        <button
          onClick={() => onNavigate('hosting', '/')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
            currentSurface === 'hosting'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Optic Hosting"
        >
          <Server size={13} className="text-indigo-400" />
          <span>Hosting</span>
        </button>

        <button
          onClick={() => onNavigate('docs', '/')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
            currentSurface === 'docs'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Optic Documentation"
        >
          <BookOpen size={13} className="text-teal-400" />
          <span>Docs</span>
        </button>

        {userEmail && (
          <div className="hidden md:flex items-center ml-2 pl-2 border-l border-zinc-800 text-[11px] text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            <span className="truncate max-w-[130px]">{userEmail}</span>
          </div>
        )}
      </div>
    </div>
  );
};

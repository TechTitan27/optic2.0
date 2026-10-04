import React, { useState } from 'react';
import { OpticLogo } from '../brand/OpticLogo';
import { OpticFooter } from '../common/OpticFooter';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { getUserAvatarUrl } from '../../lib/avatar';
import { OrganizationSwitcher } from '../common/OrganizationSwitcher';
import { SurfaceType } from '../../types';
import {
  LayoutDashboard,
  HardDrive,
  Globe,
  Key,
  Code2,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';

interface DashboardLayoutProps {
  currentSurface?: SurfaceType;
  currentTab?: 'overview' | 'keys' | 'settings';
  onSelectTab?: (tab: 'overview' | 'keys' | 'settings') => void;
  onNavigateSurface: (surface: SurfaceType, path?: string) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentSurface = 'dashboard',
  currentTab = 'overview',
  onSelectTab,
  onNavigateSurface,
  children,
}) => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isOverviewActive = (currentSurface === 'dashboard' || !currentSurface) && currentTab === 'overview';
  const isCloudActive = currentSurface === 'cloud';
  const isHostingActive = currentSurface === 'hosting';
  const isKeysActive = (currentSurface === 'dashboard' || !currentSurface) && currentTab === 'keys';
  const isApiActive = currentSurface === 'api';
  const isDocsActive = currentSurface === 'docs';
  const isSettingsActive = (currentSurface === 'dashboard' || !currentSurface) && currentTab === 'settings';

  const getPageTitle = () => {
    if (currentSurface === 'share') return 'Shared File';
    if (currentSurface === 'cloud') return 'Cloud Storage';
    if (currentSurface === 'hosting') return 'Hosting & Deployments';
    if (currentSurface === 'api') return 'Developer API';
    if (currentSurface === 'docs') return 'Documentation';
    if (currentTab === 'keys') return 'API Keys';
    if (currentTab === 'settings') return 'Settings';
    return 'Overview';
  };

  const isWideSurface = ['cloud', 'hosting', 'docs', 'api', 'share'].includes(currentSurface);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-zinc-800 bg-zinc-950 shrink-0">
        {/* Sidebar Header */}
        <div className="h-14 px-5 border-b border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => onNavigateSurface('main', '/')}
            className="focus:outline-none"
            title="Optic Home"
          >
            <OpticLogo size={20} showWordmark={true} />
          </button>
          <ThemeToggle />
        </div>

        {/* Sidebar Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Organization Switcher */}
          <div>
            <span className="px-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block mb-1.5">
              ORGANIZATION
            </span>
            <OrganizationSwitcher />
          </div>

          {/* Overview */}
          <div>
            <button
              onClick={() => {
                if (onSelectTab) onSelectTab('overview');
                onNavigateSurface('dashboard', '/dashboard');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isOverviewActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <LayoutDashboard
                size={15}
                className={isOverviewActive ? 'text-white' : 'text-zinc-400'}
              />
              <span>Overview</span>
            </button>
          </div>

          {/* PRODUCTS */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              PRODUCTS
            </span>
            <button
              onClick={() => onNavigateSurface('cloud', '/cloud')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isCloudActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HardDrive
                  size={15}
                  className={isCloudActive ? 'text-white' : 'text-zinc-400'}
                />
                <span>Cloud</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateSurface('hosting', '/hosting')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isHostingActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe
                  size={15}
                  className={isHostingActive ? 'text-white' : 'text-zinc-400'}
                />
                <span>Hosting</span>
              </div>
            </button>
          </div>

          {/* DEVELOPER */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              DEVELOPER
            </span>
            <button
              onClick={() => {
                if (onSelectTab) onSelectTab('keys');
                onNavigateSurface('dashboard', '/dashboard/keys');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isKeysActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <Key
                size={15}
                className={isKeysActive ? 'text-white' : 'text-zinc-400'}
              />
              <span>API Keys</span>
            </button>

            <button
              onClick={() => onNavigateSurface('api', '/api')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isApiActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Code2
                  size={15}
                  className={isApiActive ? 'text-white' : 'text-zinc-400'}
                />
                <span>API</span>
              </div>
            </button>

            <button
              onClick={() => onNavigateSurface('docs', '/docs')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isDocsActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen
                  size={15}
                  className={isDocsActive ? 'text-white' : 'text-zinc-400'}
                />
                <span>Docs</span>
              </div>
            </button>
          </div>

          {/* ACCOUNT */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              ACCOUNT
            </span>
            <button
              onClick={() => {
                if (onSelectTab) onSelectTab('settings');
                onNavigateSurface('dashboard', '/dashboard/settings');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isSettingsActive
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <Settings
                size={15}
                className={isSettingsActive ? 'text-white' : 'text-zinc-400'}
              />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: User profile & Logout */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 space-y-2.5">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              {authLoading && !user ? (
                <>
                  <div className="w-6 h-6 rounded-md bg-zinc-800 animate-shimmer shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="w-16 h-2.5 bg-zinc-800 rounded animate-shimmer" />
                    <div className="w-24 h-2 bg-zinc-800 rounded animate-shimmer" />
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={getUserAvatarUrl(user)}
                    alt={user?.email || 'User'}
                    className="w-6 h-6 rounded-md object-cover border border-zinc-700/80 shrink-0 bg-zinc-800"
                  />
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-medium text-zinc-200 truncate">
                      {profile?.fullName || user?.email?.split('@')[0] || 'developer'}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {user?.email || 'developer@optic.doy.best'}
                    </p>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => signOut()}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
              title="Sign Out"
            >
              <LogOut size={13} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-zinc-500">
            <button
              onClick={() => onNavigateSurface('privacy', '/privacy')}
              className="hover:text-zinc-300 transition-colors"
            >
              Privacy
            </button>
            <span>•</span>
            <button
              onClick={() => onNavigateSurface('terms', '/terms')}
              className="hover:text-zinc-300 transition-colors"
            >
              Terms
            </button>
            <span>•</span>
            <button
              onClick={() => onNavigateSurface('docs', '/docs')}
              className="hover:text-zinc-300 transition-colors"
            >
              Docs
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800"
              aria-label="Open sidebar"
            >
              <Menu size={16} />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-mono">optic</span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-200 font-semibold">{getPageTitle()}</span>
            </div>
          </div>

          {/* Quick switcher buttons */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
              <button
                onClick={() => {
                  if (onSelectTab) onSelectTab('overview');
                  onNavigateSurface('dashboard', '/dashboard');
                }}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isOverviewActive
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => onNavigateSurface('cloud', '/cloud')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isCloudActive
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Cloud
              </button>
              <button
                onClick={() => onNavigateSurface('hosting', '/hosting')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isHostingActive
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Hosting
              </button>
              <button
                onClick={() => onNavigateSurface('docs', '/docs')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isDocsActive
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Docs
              </button>
              <button
                onClick={() => onNavigateSurface('api', '/api')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  isApiActive
                    ? 'bg-zinc-800 text-white font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                API
              </button>
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <div className={isWideSurface ? 'max-w-7xl mx-auto w-full' : 'max-w-5xl mx-auto w-full'}>
              {children}
            </div>
          </div>
          <OpticFooter onNavigateSurface={onNavigateSurface} compact={true} />
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 bg-zinc-950 border-r border-zinc-800 p-5 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <OpticLogo size={20} showWordmark={true} />
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs font-medium">
                <div>
                  <button
                    onClick={() => {
                      if (onSelectTab) onSelectTab('overview');
                      onNavigateSurface('dashboard', '/dashboard');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isOverviewActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <LayoutDashboard size={15} />
                    <span>Overview</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    PRODUCTS
                  </span>
                  <button
                    onClick={() => {
                      onNavigateSurface('cloud', '/cloud');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isCloudActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <HardDrive size={15} />
                    <span>Cloud</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigateSurface('hosting', '/hosting');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isHostingActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <Globe size={15} />
                    <span>Hosting</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    DEVELOPER
                  </span>
                  <button
                    onClick={() => {
                      if (onSelectTab) onSelectTab('keys');
                      onNavigateSurface('dashboard', '/dashboard/keys');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isKeysActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <Key size={15} />
                    <span>API Keys</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigateSurface('api', '/api');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isApiActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <Code2 size={15} />
                    <span>API</span>
                  </button>
                  <button
                    onClick={() => {
                      onNavigateSurface('docs', '/docs');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isDocsActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <BookOpen size={15} />
                    <span>Docs</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    ACCOUNT
                  </span>
                  <button
                    onClick={() => {
                      if (onSelectTab) onSelectTab('settings');
                      onNavigateSurface('dashboard', '/dashboard/settings');
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isSettingsActive
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <Settings size={15} />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <Button
                variant="ghost"
                className="w-full text-zinc-400 text-xs"
                onClick={() => {
                  signOut();
                  setMobileNavOpen(false);
                }}
              >
                Sign out
              </Button>

              <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-zinc-500">
                <button
                  onClick={() => {
                    onNavigateSurface('privacy', '/privacy');
                    setMobileNavOpen(false);
                  }}
                  className="hover:text-zinc-300"
                >
                  Privacy
                </button>
                <span>•</span>
                <button
                  onClick={() => {
                    onNavigateSurface('terms', '/terms');
                    setMobileNavOpen(false);
                  }}
                  className="hover:text-zinc-300"
                >
                  Terms
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

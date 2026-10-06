import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SurfaceType } from './types';
import {
  resolveSurfaceState,
  getDomainInfo,
  isCrossSubdomainNavigation,
  getSurfaceUrl,
} from './lib/domainNavigation';
import { LandingPage } from './components/landing/LandingPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { OverviewView } from './components/dashboard/OverviewView';
import { ApiKeysView } from './components/dashboard/ApiKeysView';
import { SettingsView } from './components/dashboard/SettingsView';
import { CloudInterface } from './components/cloud/CloudInterface';
import { HostingInterface } from './components/hosting/HostingInterface';
import { DocsInterface } from './components/docs/DocsInterface';
import { ApiInterface } from './components/api/ApiInterface';
import { AuthPage } from './components/auth/AuthPage';
import { AuthGate } from './components/auth/AuthGate';
import { PrivacyPage } from './components/legal/PrivacyPage';
import { TermsPage } from './components/legal/TermsPage';
import { StatusPage } from './components/status/StatusPage';
import { PublicSharePage } from './components/share/PublicSharePage';
import { NotFoundPage } from './components/common/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainApp() {
  const { user } = useAuth();

  // Public deployment route guard: *.host.* and /api/deployments/* are served by the deployment server
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('.host.') ||
      window.location.pathname.startsWith('/api/deployments') ||
      window.location.pathname.includes('/api/deployments/'))
  ) {
    return null;
  }

  // 1. Initial surface detection with hostname as primary source of truth
  const initial = resolveSurfaceState();
  const domainInfo = getDomainInfo();

  // Enforce host lock: cloud.optic.doy.best can ONLY render 'cloud' (or auth or share)
  const effectiveInitialSurface: SurfaceType = domainInfo.lockedSurface
    ? ['login', 'signup', 'callback', 'share'].includes(initial.surface)
      ? initial.surface
      : domainInfo.lockedSurface
    : initial.surface;

  const [currentSurface, setCurrentSurface] = useState<SurfaceType>(effectiveInitialSurface);
  const [currentPath, setCurrentPath] = useState<string>(initial.path);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'keys' | 'settings'>(
    initial.tab || 'overview'
  );

  // Dynamic redirect target matching the current product subdomain
  const getContextualRedirect = (): { surface: SurfaceType; path: string } => {
    if (domainInfo.productHost === 'cloud') {
      return { surface: 'cloud', path: '/' };
    }
    if (domainInfo.productHost === 'hosting') {
      return { surface: 'hosting', path: '/' };
    }
    if (domainInfo.productHost === 'docs') {
      return { surface: 'docs', path: '/' };
    }
    if (domainInfo.productHost === 'api') {
      return { surface: 'api', path: '/api' };
    }
    return { surface: 'dashboard', path: '/dashboard' };
  };

  const [redirectTarget, setRedirectTarget] = useState<{ surface: SurfaceType; path: string }>(
    getContextualRedirect
  );

  // Surface navigation handler
  const handleNavigateSurface = (
    surface: SurfaceType,
    path: string = '/',
    tab?: 'overview' | 'keys' | 'settings'
  ) => {
    // 1. Check if navigating to target surface requires crossing subdomains in production
    if (isCrossSubdomainNavigation(surface)) {
      const destinationUrl = getSurfaceUrl(surface, path);
      if (typeof window !== 'undefined') {
        window.location.href = destinationUrl;
      }
      return;
    }

    // 2. Enforce hostname lock if on a dedicated product subdomain
    const currentInfo = getDomainInfo();
    if (currentInfo.lockedSurface) {
      const isAllowedSurface =
        ['login', 'signup', 'callback', 'share'].includes(surface) ||
        surface === currentInfo.lockedSurface;
      if (!isAllowedSurface) {
        // Attempting to render a different product locally on a locked subdomain:
        // Must perform cross-subdomain navigation to the destination
        const destinationUrl = getSurfaceUrl(surface, path);
        if (typeof window !== 'undefined') {
          window.location.href = destinationUrl;
        }
        return;
      }
    }

    // 3. Perform internal client-side navigation within current subdomain or local environment
    setCurrentSurface(surface);
    setCurrentPath(path);
    if (tab) {
      setDashboardTab(tab);
    }

    if (typeof window !== 'undefined') {
      let nextUrl = path;
      if (currentInfo.lockedSurface) {
        // Keep URL clean on dedicated subdomains (cloud.optic.doy.best / hosting.optic.doy.best)
        if (currentInfo.lockedSurface === 'hosting') {
          if (
            path === '/login' ||
            path === '/signup' ||
            path === '/auth/callback' ||
            path === '/new' ||
            path.startsWith('/new') ||
            path.startsWith('/project/') ||
            path.startsWith('/projects/') ||
            path.startsWith('/p/')
          ) {
            nextUrl = path;
          } else if (path === '/hosting/new') {
            nextUrl = '/new';
          } else {
            nextUrl = '/';
          }
        } else {
          nextUrl =
            path === '/login' ||
            path === '/signup' ||
            path === '/auth/callback' ||
            path.startsWith('/s/') ||
            path.startsWith('/share/')
              ? path
              : '/';
        }
      } else {
        if (surface === 'share') {
          nextUrl = path.startsWith('/s/') ? path : `/s/${path}`;
        } else if (surface === 'dashboard') {
          if (tab === 'keys') nextUrl = '/dashboard/keys';
          else if (tab === 'settings') nextUrl = '/dashboard/settings';
          else nextUrl = '/dashboard';
        } else if (surface === 'cloud') {
          nextUrl = '/cloud';
        } else if (surface === 'hosting') {
          nextUrl = path === '/new' || path === '/hosting/new' ? '/hosting/new' : '/hosting';
        } else if (surface === 'docs') nextUrl = '/docs';
        else if (surface === 'api') nextUrl = '/api';
        else if (surface === 'privacy') nextUrl = '/privacy';
        else if (surface === 'terms') nextUrl = '/terms';
        else if (surface === 'status') nextUrl = '/status';
        else if (surface === 'login') nextUrl = '/login';
        else if (surface === 'signup') nextUrl = '/signup';
        else if (surface === 'callback') nextUrl = '/auth/callback';
        else if (surface === 'main') nextUrl = '/';
      }

      try {
        window.history.pushState({ surface, tab }, '', nextUrl);
      } catch {
        // ignore if in sandboxed iframe
      }
    }
  };

  // Sync with browser back/forward buttons:
  // The hostname always wins over the history state when deciding which product shell to render.
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolveSurfaceState();
      const currentInfo = getDomainInfo();

      if (currentInfo.lockedSurface) {
        const isAllowedSurface =
          ['login', 'signup', 'callback', 'share'].includes(resolved.surface) ||
          resolved.surface === currentInfo.lockedSurface;
        if (!isAllowedSurface) {
          // Force locked surface
          setCurrentSurface(currentInfo.lockedSurface);
          setCurrentPath('/');
          try {
            window.history.replaceState(null, '', '/');
          } catch {
            // ignore
          }
          return;
        }
      }

      setCurrentSurface(resolved.surface);
      setCurrentPath(resolved.path);
      if (resolved.tab) {
        setDashboardTab(resolved.tab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Active Surface Router */}
      <div className="flex-1 flex flex-col">
        {currentSurface === 'main' && (
          <LandingPage
            onNavigateSurface={handleNavigateSurface}
            onOpenAuth={(mode) =>
              handleNavigateSurface(
                mode === 'signup' ? 'signup' : 'login',
                mode === 'signup' ? '/signup' : '/login'
              )
            }
          />
        )}

        {/* Dedicated Auth Pages */}
        {currentSurface === 'login' && (
          <AuthPage
            mode="login"
            redirectSurface={redirectTarget.surface}
            redirectPath={redirectTarget.path}
            onNavigate={handleNavigateSurface}
          />
        )}

        {currentSurface === 'signup' && (
          <AuthPage
            mode="signup"
            redirectSurface={redirectTarget.surface}
            redirectPath={redirectTarget.path}
            onNavigate={handleNavigateSurface}
          />
        )}

        {currentSurface === 'callback' && (
          <AuthPage
            mode="callback"
            redirectSurface={redirectTarget.surface}
            redirectPath={redirectTarget.path}
            onNavigate={handleNavigateSurface}
          />
        )}

        {/* Protected Dashboard */}
        {currentSurface === 'dashboard' && (
          <AuthGate
            surfaceName="Optic Dashboard"
            onOpenAuth={() => {
              setRedirectTarget({ surface: 'dashboard', path: '/dashboard' });
              handleNavigateSurface('login', '/login');
            }}
            onGoHome={() => handleNavigateSurface('main', '/')}
          >
            <DashboardLayout
              currentSurface="dashboard"
              currentTab={dashboardTab}
              onSelectTab={setDashboardTab}
              onNavigateSurface={handleNavigateSurface}
            >
              {dashboardTab === 'overview' && (
                <OverviewView
                  onNavigateSurface={handleNavigateSurface}
                  onSelectNav={(tab) => setDashboardTab(tab as any)}
                />
              )}
              {dashboardTab === 'keys' && <ApiKeysView />}
              {dashboardTab === 'settings' && <SettingsView />}
            </DashboardLayout>
          </AuthGate>
        )}

        {/* Protected Cloud Storage */}
        {currentSurface === 'cloud' && (
          <AuthGate
            surfaceName="Optic Cloud Storage"
            onOpenAuth={() => {
              setRedirectTarget({ surface: 'cloud', path: '/' });
              handleNavigateSurface('login', '/login');
            }}
            onGoHome={() => handleNavigateSurface('main', '/')}
          >
            <DashboardLayout
              currentSurface="cloud"
              onNavigateSurface={handleNavigateSurface}
            >
              <CloudInterface onNavigateSurface={handleNavigateSurface} />
            </DashboardLayout>
          </AuthGate>
        )}

        {/* Protected Hosting */}
        {currentSurface === 'hosting' && (
          <AuthGate
            surfaceName="Optic Hosting"
            onOpenAuth={() => {
              setRedirectTarget({ surface: 'hosting', path: '/' });
              handleNavigateSurface('login', '/login');
            }}
            onGoHome={() => handleNavigateSurface('main', '/')}
          >
            <DashboardLayout
              currentSurface="hosting"
              onNavigateSurface={handleNavigateSurface}
            >
              <HostingInterface
                onNavigateSurface={handleNavigateSurface}
                currentPath={currentPath}
              />
            </DashboardLayout>
          </AuthGate>
        )}

        {/* Public Docs */}
        {currentSurface === 'docs' && (
          <DashboardLayout
            currentSurface="docs"
            onNavigateSurface={handleNavigateSurface}
          >
            <DocsInterface onNavigateSurface={handleNavigateSurface} />
          </DashboardLayout>
        )}

        {/* Optic Developer API */}
        {currentSurface === 'api' && (
          <DashboardLayout
            currentSurface="api"
            onNavigateSurface={handleNavigateSurface}
          >
            <ApiInterface
              onNavigateSurface={handleNavigateSurface}
              onOpenAuth={(mode) => {
                setRedirectTarget({ surface: 'api', path: '/api' });
                handleNavigateSurface(
                  mode === 'signup' ? 'signup' : 'login',
                  mode === 'signup' ? '/signup' : '/login'
                );
              }}
            />
          </DashboardLayout>
        )}

        {/* Legal Pages */}
        {currentSurface === 'privacy' && (
          <PrivacyPage onNavigateSurface={handleNavigateSurface} />
        )}

        {currentSurface === 'terms' && (
          <TermsPage onNavigateSurface={handleNavigateSurface} />
        )}

        {/* Platform Infrastructure Health & Status Page */}
        {currentSurface === 'status' && (
          <StatusPage onNavigate={handleNavigateSurface} />
        )}

        {/* Public Shared File View Page (No Login Required) */}
        {currentSurface === 'share' && (
          <PublicSharePage
            path={currentPath}
            onNavigate={handleNavigateSurface}
          />
        )}

        {/* 404 Fallback Surface */}
        {currentSurface === 'notfound' && (
          <NotFoundPage onNavigate={handleNavigateSurface} path={currentPath} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
              <MainApp />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SurfaceType } from './types';
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
import { NotFoundPage } from './components/common/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainApp() {
  const { user, loading } = useAuth();

  // Detect surface from hostname or pathname
  const detectInitialSurface = (): {
    surface: SurfaceType;
    path: string;
    tab?: 'overview' | 'keys' | 'settings';
  } => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      // 1. OAuth callback detection (route or OAuth tokens/codes)
      if (
        path.startsWith('/auth/callback') ||
        path.startsWith('/callback') ||
        path.startsWith('/auth/v1/callback') ||
        hash.includes('access_token=') ||
        hash.includes('refresh_token=') ||
        search.includes('code=') ||
        search.includes('error_description=')
      ) {
        return { surface: 'callback', path: path || '/auth/callback' };
      }

      // 2. Authentication routes
      if (path === '/login' || path === '/signin' || path === '/auth/login') {
        return { surface: 'login', path: '/login' };
      }
      if (path === '/signup' || path === '/register' || path === '/auth/signup') {
        return { surface: 'signup', path: '/signup' };
      }

      // 3. Legal pages
      if (path.startsWith('/privacy') || path.startsWith('/legal/privacy')) {
        return { surface: 'privacy', path: '/privacy' };
      }
      if (path.startsWith('/terms') || path.startsWith('/legal/terms')) {
        return { surface: 'terms', path: '/terms' };
      }

      // 4. Subdomain-based product surfaces
      // - cloud.optic.doy.best → Optic Cloud
      // - hosting.optic.doy.best → Optic Hosting
      // - docs.optic.doy.best → Optic Docs
      // - api.optic.doy.best → Optic API
      if (host.startsWith('cloud.') || host === 'cloud.localhost') return { surface: 'cloud', path: path || '/' };
      if (host.startsWith('hosting.') || host === 'hosting.localhost') return { surface: 'hosting', path: path || '/' };
      if (host.startsWith('docs.') || host === 'docs.localhost') return { surface: 'docs', path: path || '/' };
      if (host.startsWith('api.') || host === 'api.localhost') return { surface: 'api', path: path || '/' };

      // 5. Dashboard routes and specific sub-tabs
      if (
        path === '/keys' ||
        path === '/apikeys' ||
        path === '/api-keys' ||
        path.startsWith('/dashboard/keys')
      ) {
        return { surface: 'dashboard', path: '/dashboard/keys', tab: 'keys' };
      }
      if (
        path === '/settings' ||
        path === '/account' ||
        path.startsWith('/dashboard/settings')
      ) {
        return { surface: 'dashboard', path: '/dashboard/settings', tab: 'settings' };
      }
      if (path === '/dashboard' || path.startsWith('/dashboard')) {
        return { surface: 'dashboard', path: '/dashboard', tab: 'overview' };
      }

      // 6. Cloud Storage & Buckets (local development fallback or direct path)
      if (
        path.startsWith('/cloud') ||
        path.startsWith('/storage') ||
        path.startsWith('/buckets')
      ) {
        return { surface: 'cloud', path: '/cloud' };
      }

      // 7. Hosting & Deployments (local development fallback or direct path)
      if (
        path.startsWith('/hosting') ||
        path.startsWith('/sites') ||
        path.startsWith('/deploy') ||
        path.startsWith('/deployments')
      ) {
        return { surface: 'hosting', path: '/hosting' };
      }

      // 8. Documentation (local development fallback or direct path)
      if (
        path.startsWith('/docs') ||
        path.startsWith('/documentation') ||
        path.startsWith('/guide') ||
        path.startsWith('/api-docs')
      ) {
        return { surface: 'docs', path: '/docs' };
      }

      // 9. Developer API area (local development fallback or direct path)
      if (
        path === '/api' ||
        path.startsWith('/api/') ||
        path.startsWith('/developer')
      ) {
        return { surface: 'api', path: '/api' };
      }

      // 10. Root landing page
      if (path === '/' || path === '') {
        return { surface: 'main', path: '/' };
      }

      // 11. Unmatched path -> in-app 404 page with navigation options
      return { surface: 'notfound', path };
    }
    return { surface: 'main', path: '/' };
  };

  const initial = detectInitialSurface();
  const [currentSurface, setCurrentSurface] = useState<SurfaceType>(initial.surface);
  const [currentPath, setCurrentPath] = useState<string>(initial.path);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'keys' | 'settings'>(
    initial.tab || 'overview'
  );
  const [redirectTarget, setRedirectTarget] = useState<{ surface: SurfaceType; path: string }>({
    surface: initial.surface === 'main' || initial.surface === 'login' || initial.surface === 'signup'
      ? 'dashboard'
      : initial.surface,
    path: initial.path === '/' || initial.path === '/login' || initial.path === '/signup'
      ? '/dashboard'
      : initial.path,
  });

  // Surface navigation handler
  const handleNavigateSurface = (
    surface: SurfaceType,
    path: string = '/',
    tab?: 'overview' | 'keys' | 'settings'
  ) => {
    // Perform instant client-side surface navigation
    setCurrentSurface(surface);
    setCurrentPath(path);
    if (tab) {
      setDashboardTab(tab);
    }
    if (typeof window !== 'undefined') {
      let nextUrl = path;
      if (surface === 'dashboard') {
        if (tab === 'keys') nextUrl = '/dashboard/keys';
        else if (tab === 'settings') nextUrl = '/dashboard/settings';
        else nextUrl = '/dashboard';
      } else if (surface === 'cloud') nextUrl = '/cloud';
      else if (surface === 'hosting') nextUrl = '/hosting';
      else if (surface === 'docs') nextUrl = '/docs';
      else if (surface === 'api') nextUrl = '/api';
      else if (surface === 'privacy') nextUrl = '/privacy';
      else if (surface === 'terms') nextUrl = '/terms';
      else if (surface === 'login') nextUrl = '/login';
      else if (surface === 'signup') nextUrl = '/signup';
      else if (surface === 'callback') nextUrl = '/auth/callback';
      else if (surface === 'main') nextUrl = '/';

      try {
        window.history.pushState({ surface, tab }, '', nextUrl);
      } catch {
        // ignore if in restricted iframe
      }
    }
  };

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const detected = detectInitialSurface();
      setCurrentSurface(detected.surface);
      setCurrentPath(detected.path);
      if (detected.tab) {
        setDashboardTab(detected.tab);
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
              setRedirectTarget({ surface: 'cloud', path: '/cloud' });
              handleNavigateSurface('login', '/login');
            }}
            onGoHome={() => handleNavigateSurface('main', '/')}
          >
            <CloudInterface onNavigateSurface={handleNavigateSurface} />
          </AuthGate>
        )}

        {/* Protected Hosting */}
        {currentSurface === 'hosting' && (
          <AuthGate
            surfaceName="Optic Hosting"
            onOpenAuth={() => {
              setRedirectTarget({ surface: 'hosting', path: '/hosting' });
              handleNavigateSurface('login', '/login');
            }}
            onGoHome={() => handleNavigateSurface('main', '/')}
          >
            <HostingInterface onNavigateSurface={handleNavigateSurface} />
          </AuthGate>
        )}

        {/* Public Docs */}
        {currentSurface === 'docs' && (
          <DocsInterface onNavigateSurface={handleNavigateSurface} />
        )}

        {/* Optic Developer API */}
        {currentSurface === 'api' && (
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
        )}

        {/* Legal Pages */}
        {currentSurface === 'privacy' && (
          <PrivacyPage onNavigateSurface={handleNavigateSurface} />
        )}

        {currentSurface === 'terms' && (
          <TermsPage onNavigateSurface={handleNavigateSurface} />
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
            <MainApp />
          </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

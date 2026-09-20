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
import { AuthPage } from './components/auth/AuthPage';
import { PrivacyPage } from './components/legal/PrivacyPage';
import { TermsPage } from './components/legal/TermsPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainApp() {
  const { user, loading } = useAuth();

  // Detect surface from hostname or pathname
  const detectInitialSurface = (): { surface: SurfaceType; path: string } => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      if (path === '/login') return { surface: 'login', path: '/login' };
      if (path === '/signup') return { surface: 'signup', path: '/signup' };
      if (path.startsWith('/auth/callback')) return { surface: 'callback', path };

      if (path.startsWith('/privacy')) return { surface: 'privacy', path: '/privacy' };
      if (path.startsWith('/terms')) return { surface: 'terms', path: '/terms' };

      if (host.startsWith('cloud.')) return { surface: 'cloud', path: '/' };
      if (host.startsWith('hosting.')) return { surface: 'hosting', path: '/' };
      if (host.startsWith('docs.')) return { surface: 'docs', path: '/' };

      if (path.startsWith('/dashboard')) return { surface: 'dashboard', path: '/dashboard' };
      if (path.startsWith('/cloud')) return { surface: 'cloud', path: '/cloud' };
      if (path.startsWith('/hosting')) return { surface: 'hosting', path: '/hosting' };
      if (path.startsWith('/docs')) return { surface: 'docs', path: '/docs' };
    }
    return { surface: 'main', path: '/' };
  };

  const initial = detectInitialSurface();
  const [currentSurface, setCurrentSurface] = useState<SurfaceType>(initial.surface);
  const [currentPath, setCurrentPath] = useState<string>(initial.path);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'keys' | 'settings'>('overview');
  const [redirectTarget, setRedirectTarget] = useState<{ surface: SurfaceType; path: string }>({
    surface: 'dashboard',
    path: '/dashboard',
  });

  // Surface navigation handler
  const handleNavigateSurface = (surface: SurfaceType, path: string = '/') => {
    setCurrentSurface(surface);
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      let nextUrl = path;
      if (surface === 'dashboard') nextUrl = '/dashboard';
      if (surface === 'cloud') nextUrl = '/cloud';
      if (surface === 'hosting') nextUrl = '/hosting';
      if (surface === 'docs') nextUrl = '/docs';
      if (surface === 'privacy') nextUrl = '/privacy';
      if (surface === 'terms') nextUrl = '/terms';
      if (surface === 'login') nextUrl = '/login';
      if (surface === 'signup') nextUrl = '/signup';
      if (surface === 'callback') nextUrl = '/auth/callback';
      if (surface === 'main') nextUrl = '/';
      window.history.pushState({ surface }, '', nextUrl);
    }
  };

  // Sync with browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const detected = detectInitialSurface();
      setCurrentSurface(detected.surface);
      setCurrentPath(detected.path);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Protected route enforcement
  useEffect(() => {
    if (!loading && !user) {
      if (currentSurface === 'dashboard' || currentSurface === 'cloud' || currentSurface === 'hosting') {
        setRedirectTarget({ surface: currentSurface, path: currentPath });
        handleNavigateSurface('login', '/login');
      }
    }
  }, [user, loading, currentSurface, currentPath]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Active Surface Router */}
      <div className="flex-1 flex flex-col">
        {currentSurface === 'main' && (
          <LandingPage
            onNavigateSurface={handleNavigateSurface}
            onOpenAuth={(mode) =>
              handleNavigateSurface(mode === 'signup' ? 'signup' : 'login', mode === 'signup' ? '/signup' : '/login')
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
        {currentSurface === 'dashboard' && user && (
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
        )}

        {/* Protected Cloud Storage */}
        {currentSurface === 'cloud' && user && (
          <CloudInterface onNavigateSurface={handleNavigateSurface} />
        )}

        {/* Protected Hosting */}
        {currentSurface === 'hosting' && user && (
          <HostingInterface onNavigateSurface={handleNavigateSurface} />
        )}

        {/* Public Docs */}
        {currentSurface === 'docs' && (
          <DocsInterface onNavigateSurface={handleNavigateSurface} />
        )}

        {/* Legal Pages */}
        {currentSurface === 'privacy' && (
          <PrivacyPage onNavigateSurface={handleNavigateSurface} />
        )}

        {currentSurface === 'terms' && (
          <TermsPage onNavigateSurface={handleNavigateSurface} />
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

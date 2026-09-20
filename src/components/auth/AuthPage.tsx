import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { OpticLogo } from '../brand/OpticLogo';
import { getSupabase } from '../../lib/supabaseClient';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { SurfaceType } from '../../types';
import LoginCardSection from '@/components/ui/login-signup';
import RegisterCardSection from '@/components/ui/register-card';

interface AuthPageProps {
  mode: 'login' | 'signup' | 'callback';
  redirectSurface?: SurfaceType;
  redirectPath?: string;
  onNavigate: (surface: SurfaceType, path?: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  mode: initialMode,
  redirectSurface = 'dashboard',
  redirectPath = '/dashboard',
  onNavigate,
}) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'callback'>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [callbackState, setCallbackState] = useState<'verifying' | 'success' | 'error'>('verifying');

  // If user is already authenticated, redirect to destination
  useEffect(() => {
    if (user && mode !== 'callback') {
      onNavigate(redirectSurface, redirectPath);
    }
  }, [user, mode, redirectSurface, redirectPath, onNavigate]);

  // Handle OAuth or email confirmation callback
  useEffect(() => {
    if (mode === 'callback') {
      const handleCallback = async () => {
        setCallbackState('verifying');
        try {
          const sb = getSupabase();
          if (sb) {
            // Check session from URL hash / query parameters
            const { data, error: sessionErr } = await sb.auth.getSession();
            if (sessionErr) throw sessionErr;

            if (data.session) {
              setCallbackState('success');
              // If opened in popup, postMessage to parent opener and close
              if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => {
                  window.close();
                }, 400);
                return;
              }

              setTimeout(() => {
                onNavigate(redirectSurface, redirectPath);
              }, 500);
              return;
            }
          }

          // In case the session is still exchanging in background
          if (window.opener && window.opener !== window) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            setTimeout(() => {
              window.close();
            }, 500);
            return;
          }

          setCallbackState('success');
          setTimeout(() => {
            onNavigate(redirectSurface, redirectPath);
          }, 600);
        } catch (err: any) {
          setError(err?.message || 'Authentication verification failed.');
          setCallbackState('error');
        }
      };

      handleCallback();
    }
  }, [mode, redirectSurface, redirectPath, onNavigate]);

  // Render callback state
  if (mode === 'callback') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-100">
        <div className="w-full max-w-sm p-8 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center text-center">
          <OpticLogo size={32} showWordmark={false} className="mb-6" />
          {callbackState === 'verifying' && (
            <>
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin mb-4" />
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Authenticating with Optic</h2>
              <p className="text-xs text-zinc-400">Verifying your credentials and session...</p>
            </>
          )}
          {callbackState === 'success' && (
            <>
              <CheckCircle2 size={24} className="text-emerald-400 mb-3" />
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Authenticated</h2>
              <p className="text-xs text-zinc-400">Redirecting to your Optic workspace...</p>
            </>
          )}
          {callbackState === 'error' && (
            <>
              <AlertCircle size={24} className="text-red-400 mb-3" />
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Authentication Error</h2>
              <p className="text-xs text-red-400 mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={() => setMode('login')}>
                Return to Log in
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <RegisterCardSection
        brandTitle="Optic Cloud"
        brandDomain="optic.doy.best"
        onNavigateToLogin={() => setMode('login')}
        onNavigateToHome={() => onNavigate('main', '/')}
        onContact={() => onNavigate('docs', '/')}
        onSuccess={() => onNavigate(redirectSurface, redirectPath)}
      />
    );
  }

  return (
    <LoginCardSection
      brandTitle="Optic Cloud"
      brandDomain="optic.doy.best"
      onNavigateToSignup={() => setMode('signup')}
      onNavigateToHome={() => onNavigate('main', '/')}
      onContact={() => onNavigate('docs', '/')}
      onSuccess={() => onNavigate(redirectSurface, redirectPath)}
    />
  );
};

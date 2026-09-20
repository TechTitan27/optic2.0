import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notifyToast } from '../../context/ToastContext';
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
      let cancelled = false;
      const handleCallback = async () => {
        setCallbackState('verifying');
        try {
          const searchParams = new URLSearchParams(window.location.search);
          const rawHash = window.location.hash.startsWith('#')
            ? window.location.hash.substring(1)
            : window.location.hash;
          const hashParams = new URLSearchParams(rawHash);

          // 1. Check for error parameters returned by OAuth provider or Supabase
          const errorDesc =
            searchParams.get('error_description') ||
            searchParams.get('error') ||
            hashParams.get('error_description') ||
            hashParams.get('error');

          if (errorDesc) {
            const decoded = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
            if (!cancelled) {
              setError(decoded);
              setCallbackState('error');
              notifyToast({
                type: 'error',
                title: 'Authentication Callback Failed',
                message: decoded,
              });
            }
            return;
          }

          const sb = getSupabase();
          if (!sb) {
            if (!cancelled) {
              setError('Supabase client is not configured.');
              setCallbackState('error');
            }
            return;
          }

          // 2. PKCE code exchange if 'code' is present
          const code = searchParams.get('code');
          if (code) {
            try {
              const { data: exchangeData, error: exchangeErr } =
                await sb.auth.exchangeCodeForSession(code);
              if (exchangeErr) {
                console.warn('PKCE exchange error:', exchangeErr.message);
              } else if (exchangeData?.session) {
                if (cancelled) return;
                setCallbackState('success');
                notifyToast({
                  type: 'success',
                  title: 'Sign-in Successful',
                  message: `Welcome back, ${exchangeData.session.user?.email || 'developer'}!`,
                });
                if (window.opener && window.opener !== window) {
                  try {
                    window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  } catch {
                    // ignore
                  }
                  setTimeout(() => window.close(), 300);
                  return;
                }
                setTimeout(() => {
                  onNavigate(redirectSurface, redirectPath);
                }, 400);
                return;
              }
            } catch (pkceErr: any) {
              console.warn('PKCE exception:', pkceErr);
            }
          }

          // 3. Check existing session (Supabase automatically parses hash tokens)
          const { data, error: sessionErr } = await sb.auth.getSession();
          if (sessionErr) throw sessionErr;

          if (data.session) {
            if (cancelled) return;
            setCallbackState('success');
            notifyToast({
              type: 'success',
              title: 'Sign-in Successful',
              message: `Welcome back, ${data.session.user?.email || 'developer'}!`,
            });
            if (window.opener && window.opener !== window) {
              try {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              } catch {
                // ignore
              }
              setTimeout(() => window.close(), 300);
              return;
            }
            setTimeout(() => {
              onNavigate(redirectSurface, redirectPath);
            }, 400);
            return;
          }

          // 4. Brief retry cycle (in case Supabase onAuthStateChange is asynchronously finishing token storage)
          for (let attempt = 0; attempt < 4; attempt++) {
            await new Promise((r) => setTimeout(r, 500));
            if (cancelled) return;
            const { data: retryData } = await sb.auth.getSession();
            if (retryData?.session) {
              setCallbackState('success');
              notifyToast({
                type: 'success',
                title: 'Sign-in Successful',
                message: `Welcome back, ${retryData.session.user?.email || 'developer'}!`,
              });
              if (window.opener && window.opener !== window) {
                try {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                } catch {
                  // ignore
                }
                setTimeout(() => window.close(), 300);
                return;
              }
              setTimeout(() => {
                onNavigate(redirectSurface, redirectPath);
              }, 400);
              return;
            }
          }

          // If reached here with no session and no error in params
          if (!cancelled) {
            setError('No active session found from this authentication callback. Please sign in again.');
            setCallbackState('error');
          }
        } catch (err: any) {
          if (!cancelled) {
            const msg = err?.message || 'Authentication verification failed.';
            setError(msg);
            setCallbackState('error');
            notifyToast({
              type: 'error',
              title: 'Authentication Callback Error',
              message: msg,
            });
          }
        }
      };

      handleCallback();
      return () => {
        cancelled = true;
      };
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

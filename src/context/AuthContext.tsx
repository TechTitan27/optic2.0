import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  getSupabase,
  checkSupabaseConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGoogle as supGoogleSignIn,
  signOutUser,
  getActiveSupabaseUrl,
  getActiveAnonKey,
  updateUserProfile,
} from '../lib/supabaseClient';
import { UserProfile } from '../types';
import { notifyToast } from './ToastContext';
import { getUserAvatarUrl, isThirdPartyOAuthAvatar } from '../lib/avatar';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  supabaseUrl: string;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (fullName: string, avatarUrl?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'optic_auth_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user && !parsed.user.id?.startsWith('usr_google_') && parsed.user.email !== 'alex.developer@optic.doy.best') {
          return parsed.user;
        }
      }
    } catch {}
    return null;
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.profile && !parsed.user?.id?.startsWith('usr_google_') && parsed.user?.email !== 'alex.developer@optic.doy.best') {
          return parsed.profile;
        }
      }
    } catch {}
    return null;
  });

  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(() => checkSupabaseConfigured());

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const syncUserFromSession = useCallback((currentSession: Session | null) => {
    setSession(currentSession);
    setAccessToken(currentSession?.access_token || null);
    if (currentSession?.user) {
      const u = currentSession.user;
      setUser(u);
      const fullName =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split('@')[0] ||
        'Optic Developer';
      // Strictly compute deterministic DiceBear Notionists avatar based on user's name
      const avatarUrl = getUserAvatarUrl(u);

      const userProf: UserProfile = {
        id: u.id,
        email: u.email || 'developer@optic.doy.best',
        fullName,
        avatarUrl,
        createdAt: u.created_at,
        tier: 'developer',
      };
      setProfile(userProf);
      try {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: u, profile: userProf }));
      } catch {
        // ignore
      }

      // If Supabase user_metadata currently stores a Google OAuth image, automatically
      // persist the DiceBear avatar to Supabase in the background
      const meta = u.user_metadata;
      if (
        isThirdPartyOAuthAvatar(meta?.avatar_url) ||
        isThirdPartyOAuthAvatar(meta?.picture) ||
        (!meta?.avatar_url && !meta?.optic_avatar_url)
      ) {
        updateUserProfile(fullName, avatarUrl).catch(() => {
          // silently handle network or unconfigured error
        });
      }
    } else {
      setUser(null);
      setProfile(null);
      try {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const configured = checkSupabaseConfigured();
    setIsConfigured(configured);

    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.auth.getSession();
        if (error) throw error;
        if (data?.session) {
          syncUserFromSession(data.session);
          return;
        }

        // If getSession was null or expired, try explicitly refreshing token
        const { data: refData, error: refErr } = await sb.auth.refreshSession().catch(() => ({ data: null, error: null }));
        if (!refErr && refData?.session) {
          syncUserFromSession(refData.session);
          return;
        }

        syncUserFromSession(null);
      } catch (err: any) {
        console.warn('[AuthContext] Session refresh notice:', err?.message || err);
      }
    }
  }, [syncUserFromSession]);

  useEffect(() => {
    let mounted = true;

    // Purge any legacy fake demo mock accounts stored in localStorage
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed.user?.id?.startsWith('usr_google_') ||
          parsed.user?.email === 'alex.developer@optic.doy.best' ||
          parsed.profile?.fullName === 'Alex Rivera'
        ) {
          localStorage.removeItem(LOCAL_SESSION_KEY);
        } else if (
          isThirdPartyOAuthAvatar(parsed.profile?.avatarUrl) ||
          isThirdPartyOAuthAvatar(parsed.user?.user_metadata?.avatar_url) ||
          isThirdPartyOAuthAvatar(parsed.user?.user_metadata?.picture)
        ) {
          if (parsed.profile) {
            parsed.profile.avatarUrl = getUserAvatarUrl(parsed.user || parsed.profile);
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(parsed));
          }
        }
      }
    } catch {
      // ignore
    }

    const configured = checkSupabaseConfigured();
    setIsConfigured(configured);

    const sb = getSupabase();

    if (sb) {
      // 1. Check existing Supabase session on boot
      sb.auth
        .getSession()
        .then(async ({ data: { session: initSession }, error }) => {
          if (!mounted) return;
          if (error) {
            console.warn('Initial session lookup warning:', error.message);
          }
          if (initSession) {
            syncUserFromSession(initSession);
            setLoading(false);
          } else {
            // Attempt auto-refresh in case access token expired while tab was closed
            const { data: refData } = await sb.auth.refreshSession().catch(() => ({ data: null }));
            if (!mounted) return;
            syncUserFromSession(refData?.session || null);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!mounted) return;
          console.warn('Could not retrieve Supabase session:', err);
          setLoading(false);
        });

      // 2. Real-time auth state subscription
      const {
        data: { subscription },
      } = sb.auth.onAuthStateChange((event, newSession) => {
        if (!mounted) return;
        syncUserFromSession(newSession);
        setLoading(false);
        if (event === 'SIGNED_IN' && newSession?.user) {
          notifyToast({
            type: 'success',
            title: 'Authenticated',
            message: `Signed in as ${newSession.user.email || 'developer'}`,
          });
        }
      });

      // 3. Popup OAuth message listener
      const handlePopupMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          const { data } = await sb.auth.getSession();
          if (data.session && mounted) {
            syncUserFromSession(data.session);
            notifyToast({
              type: 'success',
              title: 'Google Login Successful',
              message: `Welcome, ${data.session.user.email}!`,
            });
          }
        }
      };
      window.addEventListener('message', handlePopupMessage);

      // 4. Tab focus and visibility change listener: prevent session expiration when tab is backgrounded
      const handleVisibilityOrFocus = async () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          try {
            const { data: currData } = await sb.auth.getSession();
            if (currData?.session) {
              if (mounted) syncUserFromSession(currData.session);
            } else {
              const { data: refData } = await sb.auth.refreshSession().catch(() => ({ data: null }));
              if (mounted && refData?.session) {
                syncUserFromSession(refData.session);
              }
            }
          } catch (e) {
            // ignore background refresh errors
          }
        }
      };
      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);

      // 5. Cross-subdomain & cross-tab sync via storage events and BroadcastChannel
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'optic-auth-session' || e.key === LOCAL_SESSION_KEY) {
          refreshSession();
        }
      };
      window.addEventListener('storage', handleStorage);

      let channel: BroadcastChannel | null = null;
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          channel = new BroadcastChannel('optic_auth_sync');
          channel.onmessage = (ev) => {
            if (ev.data?.type === 'AUTH_UPDATED' && mounted) {
              refreshSession();
            }
          };
        }
      } catch {}

      return () => {
        mounted = false;
        subscription.unsubscribe();
        window.removeEventListener('message', handlePopupMessage);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('storage', handleStorage);
        channel?.close();
      };
    } else {
      // Supabase is not configured yet with an Anon Key
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, [syncUserFromSession, refreshSession]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const configured = checkSupabaseConfigured();
      if (!configured) {
        const errorMsg =
          'Supabase publishable key is not configured. Please set VITE_SUPABASE_PUBLISHABLE_KEY in your environment, or configure your Supabase Anon Key in Settings.';
        notifyToast({
          type: 'error',
          title: 'Sign In Failed: Backend Not Configured',
          message: errorMsg,
          duration: 9000,
        });
        throw new Error(errorMsg);
      }

      const res = await signInWithEmailPassword(email, password);
      if (res.session) {
        syncUserFromSession(res.session);
        notifyToast({
          type: 'success',
          title: 'Welcome Back',
          message: `Successfully signed in as ${res.user?.email}`,
        });
      }
    } catch (err: any) {
      notifyToast({
        type: 'error',
        title: 'Authentication Failed',
        message: err?.message || 'Invalid email or password.',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    try {
      const configured = checkSupabaseConfigured();
      if (!configured) {
        const errorMsg =
          'Supabase publishable key is not configured. Please set VITE_SUPABASE_PUBLISHABLE_KEY in your environment, or configure your Supabase Anon Key in Settings.';
        notifyToast({
          type: 'error',
          title: 'Sign Up Failed: Backend Not Configured',
          message: errorMsg,
          duration: 9000,
        });
        throw new Error(errorMsg);
      }

      const res = await signUpWithEmailPassword(email, password, fullName);
      if (res.session) {
        syncUserFromSession(res.session);
        notifyToast({
          type: 'success',
          title: 'Account Created',
          message: `Welcome to Optic, ${fullName || email}!`,
        });
      } else {
        notifyToast({
          type: 'info',
          title: 'Verification Email Sent',
          message: `Please check ${email} to verify your email address.`,
        });
      }
    } catch (err: any) {
      notifyToast({
        type: 'error',
        title: 'Sign Up Failed',
        message: err?.message || 'Could not complete registration.',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const configured = checkSupabaseConfigured();
    if (!configured) {
      const errorMsg =
        'Supabase publishable key is not configured. Please set VITE_SUPABASE_PUBLISHABLE_KEY in your environment, or configure your Supabase Anon Key in Settings to enable Google Authentication.';
      notifyToast({
        type: 'error',
        title: 'Google Login Unavailable',
        message: errorMsg,
        duration: 9000,
      });
      throw new Error(errorMsg);
    }

    try {
      notifyToast({
        type: 'info',
        title: 'Connecting to Google',
        message: 'Initializing Google OAuth with Supabase...',
        duration: 4000,
      });
      await supGoogleSignIn();
    } catch (err: any) {
      notifyToast({
        type: 'error',
        title: 'Google Login Error',
        message: err?.message || 'Failed to initialize Google OAuth.',
        duration: 8000,
      });
      throw err;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setUser(null);
      setProfile(null);
      setSession(null);
      setAccessToken(null);
      localStorage.removeItem(LOCAL_SESSION_KEY);
      notifyToast({
        type: 'info',
        title: 'Signed Out',
        message: 'You have been securely signed out.',
      });
    } catch (err: any) {
      notifyToast({
        type: 'error',
        title: 'Sign Out Error',
        message: err?.message || 'Error while signing out.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (newFullName: string, newAvatarUrl?: string) => {
    const cleanName = newFullName.trim();
    if (!cleanName) {
      throw new Error('Please enter a valid full name.');
    }
    const { user: updatedUser } = await updateUserProfile(cleanName, newAvatarUrl);
    if (updatedUser) {
      syncUserFromSession(
        session
          ? { ...session, user: updatedUser }
          : ({ user: updatedUser, access_token: accessToken || '' } as any)
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        accessToken,
        loading,
        isSupabaseConfigured: isConfigured,
        supabaseUrl: getActiveSupabaseUrl(),
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshSession,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import {
  getSupabase,
  isSupabaseConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGoogle as supGoogleSignIn,
  signOutUser,
  SUPABASE_URL,
} from '../lib/supabaseClient';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
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
  demoLogin: (role?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for cross-surface session simulation when local keys are being configured
const LOCAL_SESSION_KEY = 'optic_auth_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  useEffect(() => {
    let mounted = true;
    const sb = getSupabase();

    if (sb) {
      // Real Supabase Auth listener
      sb.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          setProfile({
            id: session.user.id,
            email: session.user.email || 'developer@optic.doy.best',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
            tier: 'developer',
          });
        }
        setLoading(false);
      });

      const {
        data: { subscription },
      } = sb.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          setProfile({
            id: session.user.id,
            email: session.user.email || 'developer@optic.doy.best',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            avatarUrl: session.user.user_metadata?.avatar_url,
            createdAt: session.user.created_at,
            tier: 'developer',
          });
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } else {
      // If publishable key is not set yet in Vercel, check if there's an active local preview session
      try {
        const stored = localStorage.getItem(LOCAL_SESSION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed.user);
          setProfile(parsed.profile);
        }
      } catch {
        // ignore
      }
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        await signInWithEmailPassword(email, password);
      } else {
        // Offline/pending publishable key mode
        const mockUser: any = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          user_metadata: { full_name: email.split('@')[0] },
          created_at: new Date().toISOString(),
        };
        const mockProfile: UserProfile = {
          id: mockUser.id,
          email,
          fullName: email.split('@')[0],
          createdAt: new Date().toISOString(),
          tier: 'developer',
        };
        setUser(mockUser);
        setProfile(mockProfile);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: mockUser, profile: mockProfile }));
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        await signUpWithEmailPassword(email, password, fullName);
      } else {
        const mockUser: any = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          user_metadata: { full_name: fullName || email.split('@')[0] },
          created_at: new Date().toISOString(),
        };
        const mockProfile: UserProfile = {
          id: mockUser.id,
          email,
          fullName: fullName || email.split('@')[0],
          createdAt: new Date().toISOString(),
          tier: 'developer',
        };
        setUser(mockUser);
        setProfile(mockProfile);
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: mockUser, profile: mockProfile }));
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSupabaseConfigured) {
      await supGoogleSignIn();
    } else {
      // Preview demonstration
      const demoEmail = 'developer.google@optic.doy.best';
      const mockUser: any = {
        id: 'usr_google_' + Math.random().toString(36).substring(2, 9),
        email: demoEmail,
        user_metadata: {
          full_name: 'Alex Rivera',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop&crop=face',
        },
        created_at: new Date().toISOString(),
      };
      const mockProfile: UserProfile = {
        id: mockUser.id,
        email: demoEmail,
        fullName: 'Alex Rivera',
        avatarUrl: mockUser.user_metadata.avatar_url,
        createdAt: new Date().toISOString(),
        tier: 'developer',
      };
      setUser(mockUser);
      setProfile(mockProfile);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: mockUser, profile: mockProfile }));
    }
  };

  const demoLogin = (name = 'Alex Rivera') => {
    const demoEmail = 'alex.developer@optic.doy.best';
    const mockUser: any = {
      id: 'usr_demo_dev',
      email: demoEmail,
      user_metadata: { full_name: name },
      created_at: new Date().toISOString(),
    };
    const mockProfile: UserProfile = {
      id: mockUser.id,
      email: demoEmail,
      fullName: name,
      createdAt: new Date().toISOString(),
      tier: 'developer',
    };
    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user: mockUser, profile: mockProfile }));
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        await signOutUser();
      }
      setUser(null);
      setProfile(null);
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSupabaseConfigured,
        supabaseUrl: SUPABASE_URL,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        demoLogin,
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

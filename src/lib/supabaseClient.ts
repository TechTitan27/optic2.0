import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read public environment variables from both Vite (import.meta.env) and process.env
const DEFAULT_SUPABASE_URL = 'https://dsrvkqutqxuvmfhbcuvy.supabase.co';

export const SUPABASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_ANON_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 10);

// Initialize Supabase client
let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'optic-auth-session',
      },
    });
  }
  return clientInstance;
}

export const supabase = isSupabaseConfigured ? getSupabase() : null;

// Auth helper functions
export async function signInWithGoogle(redirectToOrigin?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase publishable key is not yet configured. Please set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your environment.');
  }

  const baseOrigin = redirectToOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://optic.doy.best');
  const redirectUrl = `${baseOrigin}/auth/callback`;

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase publishable key not configured.');
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmailPassword(email: string, password: string, fullName?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase publishable key not configured.');
  }
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

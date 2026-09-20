import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dsrvkqutqxuvmfhbcuvy.supabase.co';

export const getStoredAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('OPTIC_SUPABASE_ANON_KEY');
      if (stored && stored.trim().length > 10) return stored.trim();
    } catch {
      // ignore
    }
  }
  return '';
};

export const getStoredSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('OPTIC_SUPABASE_URL');
      if (stored && stored.trim().length > 5) return stored.trim();
    } catch {
      // ignore
    }
  }
  return '';
};

export const getActiveSupabaseUrl = (): string => {
  return (
    getStoredSupabaseUrl() ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' &&
      (process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) ||
    DEFAULT_SUPABASE_URL
  );
};

export const getActiveAnonKey = (): string => {
  return (
    getStoredAnonKey() ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof process !== 'undefined' &&
      (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
    ''
  );
};

export const SUPABASE_URL = getActiveSupabaseUrl();
export const SUPABASE_ANON_KEY = getActiveAnonKey();

export const isSupabaseConfigured = Boolean(
  getActiveSupabaseUrl() && getActiveAnonKey() && getActiveAnonKey().length > 10
);

export function checkSupabaseConfigured(): boolean {
  const url = getActiveSupabaseUrl();
  const key = getActiveAnonKey();
  return Boolean(url && key && key.length > 10);
}

// Client singleton instance
let clientInstance: SupabaseClient | null = null;
let currentKeyUsed: string = '';

export function getSupabase(): SupabaseClient | null {
  const key = getActiveAnonKey();
  const url = getActiveSupabaseUrl();

  if (!key || key.length < 10) {
    return null;
  }

  // If key changed or instance not created yet, re-create
  if (!clientInstance || currentKeyUsed !== key) {
    currentKeyUsed = key;
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'optic-auth-session',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce',
      },
    });
  }

  return clientInstance;
}

export const supabase = getSupabase();

export function setCustomAnonKey(key: string, customUrl?: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('OPTIC_SUPABASE_ANON_KEY', key.trim());
    if (customUrl) {
      localStorage.setItem('OPTIC_SUPABASE_URL', customUrl.trim());
    }
    // Invalidate client instance
    clientInstance = null;
    currentKeyUsed = '';
  }
}

export function clearCustomAnonKey() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('OPTIC_SUPABASE_ANON_KEY');
    localStorage.removeItem('OPTIC_SUPABASE_URL');
    clientInstance = null;
    currentKeyUsed = '';
  }
}

/**
 * Verify key by calling Supabase Auth settings endpoint
 */
export async function verifySupabaseKey(
  key: string,
  url: string = getActiveSupabaseUrl()
): Promise<{ valid: boolean; error?: string; googleAuthEnabled?: boolean }> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: key.trim(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      const googleAuthEnabled = Boolean(data?.external?.google);
      return { valid: true, googleAuthEnabled };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: errData.message || `Supabase returned HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Network error connecting to Supabase instance',
    };
  }
}

// Auth helper functions
export async function signInWithGoogle(redirectToOrigin?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'Supabase publishable key is not configured. Please provide VITE_SUPABASE_PUBLISHABLE_KEY in your environment, or configure your Supabase Anon Key in Settings to enable Google Authentication.'
    );
  }

  const baseOrigin =
    redirectToOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://optic.doy.best');
  const redirectUrl = `${baseOrigin}/auth/callback`;

  // Request OAuth URL from Supabase with skipBrowserRedirect so we can open it in popup or tab
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(`Google authentication failed: ${error.message}`);
  }

  if (!data?.url) {
    throw new Error('Supabase did not return an authorization URL for Google OAuth.');
  }

  if (typeof window !== 'undefined') {
    const width = 560;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      'optic_google_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // If browser blocked popup, inform or navigate directly
      window.location.href = data.url;
    }
  }

  return data;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'Supabase publishable key is not configured. Please provide VITE_SUPABASE_PUBLISHABLE_KEY to sign in.'
    );
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function signUpWithEmailPassword(email: string, password: string, fullName?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'Supabase publishable key is not configured. Please provide VITE_SUPABASE_PUBLISHABLE_KEY to sign up.'
    );
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
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('optic-auth-session');
    localStorage.removeItem('optic_local_session');
  }
}

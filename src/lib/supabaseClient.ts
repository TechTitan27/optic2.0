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

// Shared cookie storage for cross-subdomain session persistence (*.optic.doy.best)
function getSharedCookieDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'optic.doy.best' || hostname.endsWith('.optic.doy.best')) {
    return '.optic.doy.best';
  }
  return null;
}

function setCrossSubdomainCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const domain = getSharedCookieDomain();
  const domainStr = domain ? `; domain=${domain}` : '';
  const secureStr = window.location.protocol === 'https:' ? '; Secure' : '';

  // Clean previous cookies / chunks
  removeCrossSubdomainCookie(name);

  if (value.length <= 3500) {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
      value
    )}; path=/; max-age=31536000; SameSite=Lax${domainStr}${secureStr}`;
    return;
  }

  // Chunk large session payload
  const chunkSize = 3000;
  const totalChunks = Math.ceil(value.length / chunkSize);
  document.cookie = `${encodeURIComponent(name)}=__chunks__:${totalChunks}; path=/; max-age=31536000; SameSite=Lax${domainStr}${secureStr}`;
  for (let i = 0; i < totalChunks; i++) {
    const chunk = value.slice(i * chunkSize, (i + 1) * chunkSize);
    document.cookie = `${encodeURIComponent(`${name}.${i}`)}=${encodeURIComponent(
      chunk
    )}; path=/; max-age=31536000; SameSite=Lax${domainStr}${secureStr}`;
  }
}

function getCrossSubdomainCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const getSingle = (k: string): string | null => {
    const prefix = encodeURIComponent(k) + '=';
    const parts = document.cookie.split(';');
    for (let part of parts) {
      part = part.trim();
      if (part.indexOf(prefix) === 0) {
        return decodeURIComponent(part.substring(prefix.length));
      }
    }
    return null;
  };

  const val = getSingle(name);
  if (!val) return null;
  if (val.startsWith('__chunks__:')) {
    const total = parseInt(val.replace('__chunks__:', ''), 10);
    let full = '';
    for (let i = 0; i < total; i++) {
      const part = getSingle(`${name}.${i}`);
      if (part) full += part;
    }
    return full || null;
  }
  return val;
}

function removeCrossSubdomainCookie(name: string) {
  if (typeof document === 'undefined') return;
  const domain = getSharedCookieDomain();
  const domainStr = domain ? `; domain=${domain}` : '';
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax${domainStr}`;
  for (let i = 0; i < 6; i++) {
    document.cookie = `${encodeURIComponent(`${name}.${i}`)}=; path=/; max-age=0; SameSite=Lax${domainStr}`;
  }
}

export const opticCrossDomainStorage = {
  getItem: (key: string): string | null => {
    // 1. Try shared cookie first
    const cookieVal = getCrossSubdomainCookie(key);
    if (cookieVal) {
      try {
        localStorage.setItem(key, cookieVal);
      } catch {}
      return cookieVal;
    }
    // 2. Fallback to localStorage (and backfill to cookie)
    try {
      const localVal = localStorage.getItem(key);
      if (localVal) {
        setCrossSubdomainCookie(key, localVal);
        return localVal;
      }
    } catch {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    setCrossSubdomainCookie(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    removeCrossSubdomainCookie(key);
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

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
        storage: opticCrossDomainStorage,
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
  const cleanName = fullName?.trim() || email.split('@')[0] || 'Optic Developer';
  const avatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(cleanName)}`;

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: cleanName,
        name: cleanName,
        avatar_url: avatarUrl,
      },
    },
  });
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateUserProfile(fullName: string, customAvatarUrl?: string) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase publishable key is not configured.');
  }
  const cleanName = fullName.trim() || 'Optic Developer';
  const avatarUrl =
    customAvatarUrl ||
    `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(cleanName)}`;

  const { data, error } = await sb.auth.updateUser({
    data: {
      full_name: cleanName,
      name: cleanName,
      avatar_url: avatarUrl,
      optic_avatar_url: avatarUrl,
      picture: avatarUrl,
    },
  });
  if (error) {
    throw new Error(error.message);
  }
  return { user: data.user, avatarUrl };
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

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://dsrvkqutqxuvmfhbcuvy.supabase.co'
  );
}

export function getSupabaseSecretKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  );
}

let serverClientInstance: SupabaseClient | null = null;
let lastServerKey: string = '';

export function getSupabaseServerClient(userToken?: string): SupabaseClient | null {
  const serviceKey = getSupabaseSecretKey();
  const anonKey = getSupabaseAnonKey();
  const keyToUse = serviceKey || userToken || anonKey;
  if (!keyToUse) return null;

  const url = getSupabaseUrl();

  if (userToken && !serviceKey) {
    // Client with user's JWT so RLS is respected when no service role key is provided
    return createClient(url, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
          apikey: keyToUse,
        },
      },
    });
  }

  if (!serverClientInstance || lastServerKey !== keyToUse) {
    serverClientInstance = createClient(url, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    lastServerKey = keyToUse;
  }
  return serverClientInstance;
}

export async function verifyUserToken(authHeader?: string): Promise<{ id: string; email?: string } | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const url = getSupabaseUrl();
    const serviceKey = getSupabaseSecretKey();
    const anonKey = getSupabaseAnonKey();
    const keyToUse = serviceKey || anonKey || token;
    const sb = createClient(url, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: keyToUse,
        },
      },
    });

    const { data: { user }, error } = await sb.auth.getUser(token);
    if (!error && user?.id) {
      return { id: user.id, email: user.email };
    }
  } catch (sbErr) {
    // Fallback to direct REST endpoint
  }

  try {
    const url = getSupabaseUrl();
    const serviceKey = getSupabaseSecretKey();
    const anonKey = getSupabaseAnonKey();
    const resp = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceKey || anonKey || token,
      },
    });

    if (resp.ok) {
      const userData = (await resp.json()) as any;
      if (userData?.id) {
        return { id: userData.id, email: userData.email };
      }
    }
  } catch (err) {
    console.error('[verifyUserToken] Error verifying token:', err);
  }

  return null;
}

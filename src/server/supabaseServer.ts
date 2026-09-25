import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://dsrvkqutqxuvmfhbcuvy.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

let serverClientInstance: SupabaseClient | null = null;

export function getSupabaseServerClient(userToken?: string): SupabaseClient | null {
  const keyToUse = SUPABASE_SERVICE_ROLE_KEY || userToken || SUPABASE_ANON_KEY;
  if (!keyToUse) return null;

  if (userToken && !SUPABASE_SERVICE_ROLE_KEY) {
    // Client with user's JWT so RLS is respected when no service role key is provided
    return createClient(SUPABASE_URL, keyToUse, {
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

  if (!serverClientInstance) {
    serverClientInstance = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return serverClientInstance;
}

export async function verifyUserToken(authHeader?: string): Promise<{ id: string; email?: string } | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || token;
    const sb = createClient(SUPABASE_URL, keyToUse, {
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
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || token,
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

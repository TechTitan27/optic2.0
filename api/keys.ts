import crypto from 'crypto';
import { getSupabaseServerClient, verifyUserToken } from '../src/server/supabaseServer.js';

function extractAction(req: any): string {
  if (req.query?.action) {
    return String(req.query.action).toLowerCase().trim();
  }
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  // e.g. /api/keys/list -> parts = ['api', 'keys', 'list']
  if (parts.length >= 3) {
    return parts[2].toLowerCase().trim();
  }
  return '';
}

async function resolveUser(req: any): Promise<{ userId: string; token?: string }> {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (token) {
    const verified = await verifyUserToken(authHeader);
    if (verified) {
      return { userId: verified.id, token };
    }
  }

  const headerUserId = req.headers['x-user-id'];
  return { userId: headerUserId || 'usr_dev', token };
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    return res.status(200).end();
  }

  let action = extractAction(req);
  const method = req.method || 'GET';

  if (!action) {
    if (method === 'GET') action = 'list';
    else if (method === 'POST') action = 'create';
    else if (method === 'DELETE') action = 'delete';
  }

  // 1. List API Keys: GET /api/keys?action=list or GET /api/keys
  if (action === 'list') {
    if (method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const { userId, token } = await resolveUser(req);
      const sb = getSupabaseServerClient(token);

      if (!sb) {
        // Fallback for local demo if database is unconfigured
        return res.status(200).json({
          success: true,
          keys: [
            {
              id: 'key_default_cli',
              name: 'My CLI key',
              keyPrefix: 'opt_live_9a7b4f2c...',
              status: 'active',
              createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
              lastUsedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            },
          ],
        });
      }

      // Select only non-sensitive metadata: NEVER select or return key_hash
      const { data, error } = await sb
        .from('api_keys')
        .select('id, name, created_at, last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[API /api/keys?action=list] Supabase error:', error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Database error fetching API keys',
        });
      }

      const keys = (data || []).map((k: any) => ({
        id: k.id,
        name: k.name,
        keyPrefix: `opt_live_${k.id.substring(0, 8)}...`,
        status: 'active',
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      }));

      return res.status(200).json({ success: true, keys });
    } catch (err: any) {
      console.error('[API /api/keys?action=list] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to list keys' });
    }
  }

  // 2. Create API Key: POST /api/keys?action=create or POST /api/keys
  if (action === 'create') {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const name = (body.name || '').trim();
      const { userId, token } = await resolveUser(req);

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'API key name is required.',
        });
      }

      // Cryptographically secure token generation
      const randomEntropy = crypto.randomBytes(24).toString('hex');
      const rawKey = `opt_live_${randomEntropy}`;
      const keyPrefix = `opt_live_${randomEntropy.substring(0, 8)}...`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const sb = getSupabaseServerClient(token);
      if (sb) {
        const { data, error } = await sb
          .from('api_keys')
          .insert({
            user_id: userId,
            name,
            key_hash: keyHash,
          })
          .select()
          .single();

        if (error) {
          console.error('[API /api/keys?action=create] Supabase insert error:', error);
          return res.status(500).json({
            success: false,
            error: error.message || 'Database error creating API key',
          });
        }

        return res.status(201).json({
          success: true,
          key: {
            id: data.id,
            name: data.name,
            rawKey, // returned ONLY once to developer
            keyPrefix,
            createdAt: data.created_at,
          },
        });
      }

      // Fallback in-memory response if database is unavailable
      const id = 'key_' + crypto.randomBytes(8).toString('hex');
      return res.status(201).json({
        success: true,
        key: {
          id,
          name,
          rawKey,
          keyPrefix,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[API /api/keys?action=create] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to create key' });
    }
  }

  // 3. Revoke API Key: POST /api/keys?action=revoke
  if (action === 'revoke') {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const id = body.id || req.query?.id;
      const { userId, token } = await resolveUser(req);

      if (!id) {
        return res.status(400).json({ success: false, error: 'Key id is required' });
      }

      const sb = getSupabaseServerClient(token);
      if (sb) {
        // Since api_keys schema has no status column, revoking deletes the key record
        const { error } = await sb
          .from('api_keys')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (error) {
          console.error('[API /api/keys?action=revoke] Supabase error:', error);
          return res.status(500).json({ success: false, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Key revoked successfully',
      });
    } catch (err: any) {
      console.error('[API /api/keys?action=revoke] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to revoke key' });
    }
  }

  // 4. Delete API Key: DELETE/POST /api/keys?action=delete
  if (action === 'delete') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const id = body.id || req.query?.id;
      const { userId, token } = await resolveUser(req);

      if (!id) {
        return res.status(400).json({ success: false, error: 'Key id is required' });
      }

      const sb = getSupabaseServerClient(token);
      if (sb) {
        const { error } = await sb
          .from('api_keys')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (error) {
          console.error('[API /api/keys?action=delete] Supabase error:', error);
          return res.status(500).json({ success: false, error: error.message });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Key deleted successfully',
      });
    } catch (err: any) {
      console.error('[API /api/keys?action=delete] Error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete key' });
    }
  }

  return res.status(400).json({
    success: false,
    error: `Unknown action: '${action}'. Valid actions: list, create, revoke, delete.`,
  });
}

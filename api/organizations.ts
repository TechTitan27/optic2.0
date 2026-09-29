import { verifyUserToken, getSupabaseServerClient } from '../src/server/supabaseServer.js';

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { userId, token } = await resolveUser(req);
    const sb = getSupabaseServerClient(token);

    if (sb && userId) {
      const orgMap = new Map<string, any>();

      // Query organizations where user is a member
      const { data: memberData, error: memErr } = await sb
        .from('organizations')
        .select('*, organization_members!inner(user_id, role)')
        .eq('organization_members.user_id', userId);

      if (!memErr && memberData) {
        for (const item of memberData) {
          orgMap.set(item.id, item);
        }
      }

      // Also query organizations created by the user directly
      const { data: createdData, error: createErr } = await sb
        .from('organizations')
        .select('*')
        .eq('created_by', userId);

      if (!createErr && createdData) {
        for (const item of createdData) {
          if (!orgMap.has(item.id)) {
            orgMap.set(item.id, {
              ...item,
              organization_members: [{ user_id: userId, role: 'owner' }],
            });
          }
        }
      }

      return res.status(200).json({ success: true, organizations: Array.from(orgMap.values()) });
    }

    return res.status(200).json({ success: true, organizations: [] });
  } catch (err: any) {
    console.error('[API /api/organizations] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch organizations' });
  }
}

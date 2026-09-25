import { verifyUserToken } from '../../src/server/supabaseServer';
import { cleanupOrphanedObject } from '../../src/server/r2Storage';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const authHeader = req.headers['authorization'];
    const user = await verifyUserToken(authHeader);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { storageKey } = body;

    if (!storageKey) {
      return res.status(400).json({ success: false, error: 'storageKey is required.' });
    }

    const cleaned = await cleanupOrphanedObject({
      userId: user.id,
      storageKey,
    });

    return res.status(200).json({
      success: true,
      cleaned,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to cleanup object.',
    });
  }
}

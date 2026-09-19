import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const name = (body.name || '').trim();
    const userId = req.headers['x-user-id'] || 'usr_dev';

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

    const id = 'key_' + crypto.randomBytes(6).toString('hex');
    const createdAt = new Date().toISOString();

    // In a production database, store { id, userId, name, keyPrefix, keyHash, status: 'active', createdAt }
    // Never store rawKey!
    return res.status(201).json({
      success: true,
      key: {
        id,
        name,
        rawKey, // Returned ONLY once to the developer
        keyPrefix,
        createdAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create key' });
  }
}

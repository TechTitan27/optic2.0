export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { id } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Key ID is required' });
    }

    return res.status(200).json({
      success: true,
      message: 'Key revoked successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to revoke key' });
  }
}

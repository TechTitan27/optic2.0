export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Return public non-sensitive metadata for API keys
  const keys = [
    {
      id: 'key_default_cli',
      name: 'My CLI key',
      keyPrefix: 'opt_live_9a7b4f2c...',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ];

  return res.status(200).json({
    success: true,
    keys,
  });
}

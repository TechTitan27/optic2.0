import { verifyUserToken } from '../../src/server/supabaseServer';
import { deleteStorageFile, getR2Config } from '../../src/server/r2Storage';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const authHeader = req.headers['authorization'];
    const user = await verifyUserToken(authHeader);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Please sign in to delete files.',
      });
    }

    const fileId = req.query?.fileId || req.query?.id;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'fileId parameter is required.' });
    }

    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    const result = await deleteStorageFile({
      userId: user.id,
      fileId,
      userToken: token,
    });

    return res.status(200).json({
      message: 'File deleted successfully from R2 and database.',
      ...result,
    });
  } catch (err: any) {
    console.error('[API /api/storage/files] Error:', err);
    const message = err?.message || 'Failed to delete file.';
    const status = message.includes('permission')
      ? 403
      : message.includes('not found')
      ? 404
      : 500;

    return res.status(status).json({
      success: false,
      error: message,
    });
  }
}

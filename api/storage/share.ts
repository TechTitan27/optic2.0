import { getSupabaseServerClient } from '../../src/server/supabaseServer.js';
import { createSharePresignedUrls, getR2Config } from '../../src/server/r2Storage.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const token = req.query?.token || req.query?.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Share token is required.',
      });
    }

    const sb = getSupabaseServerClient();
    if (!sb) {
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable.',
      });
    }

    // 1. Find share_links row by token
    const { data: shareLink, error: shareErr } = await sb
      .from('share_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (shareErr) {
      console.error('[API /api/storage/share] Supabase query error:', shareErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to look up share link.',
      });
    }

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        notFound: true,
        error: 'Share link not found.',
      });
    }

    // 2. Check if expired
    if (shareLink.expires_at) {
      const isExpired = new Date(shareLink.expires_at).getTime() < Date.now();
      if (isExpired) {
        return res.status(410).json({
          success: false,
          expired: true,
          error: 'This link has expired.',
        });
      }
    }

    // 3. Fetch associated file from public.files
    const { data: file, error: fileErr } = await sb
      .from('files')
      .select('id, user_id, name, extension, mime_type, size_bytes, storage_key, created_at, updated_at')
      .eq('id', shareLink.file_id)
      .maybeSingle();

    if (fileErr || !file) {
      return res.status(404).json({
        success: false,
        notFound: true,
        error: 'File not found.',
      });
    }

    // 4. Retrieve uploader's display name from profiles table (explicitly do NOT expose email)
    let uploaderName = 'Optic User';
    try {
      const { data: profile } = await sb
        .from('profiles')
        .select('id, display_name, full_name, name')
        .eq('id', file.user_id)
        .maybeSingle();

      if (profile) {
        uploaderName =
          profile.display_name || profile.full_name || profile.name || 'Optic User';
      }
    } catch (pErr) {
      console.warn('[API /api/storage/share] Profile query warning:', pErr);
    }

    // 5. Generate short-lived presigned GET URLs from R2
    let previewUrl = '';
    let downloadUrl = '';
    const r2Config = getR2Config();

    if (r2Config.isConfigured && file.storage_key) {
      try {
        const urls = await createSharePresignedUrls({
          storageKey: file.storage_key,
          filename: file.name,
          mimeType: file.mime_type || 'application/octet-stream',
        });
        previewUrl = urls.previewUrl;
        downloadUrl = urls.downloadUrl;
      } catch (r2Err) {
        console.error('[API /api/storage/share] Presigned URL error:', r2Err);
      }
    }

    // If ?download=1 was requested, redirect directly to download URL
    if (req.query?.download === '1' && downloadUrl) {
      return res.redirect(302, downloadUrl);
    }

    return res.status(200).json({
      success: true,
      share: {
        token: shareLink.token,
        expiresAt: shareLink.expires_at || null,
        createdAt: shareLink.created_at,
      },
      file: {
        id: file.id,
        name: file.name,
        extension: file.extension || (file.name.includes('.') ? file.name.split('.').pop() : ''),
        mimeType: file.mime_type || 'application/octet-stream',
        sizeBytes: file.size_bytes || 0,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
      },
      uploader: {
        name: uploaderName,
      },
      previewUrl,
      downloadUrl,
    });
  } catch (err: any) {
    console.error('[API /api/storage/share] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to process share link',
    });
  }
}

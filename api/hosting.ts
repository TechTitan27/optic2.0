import { verifyUserToken, getSupabaseServerClient } from '../src/server/supabaseServer.js';
import { createDeploymentPresignedUploadUrl, getR2Config } from '../src/server/r2Storage.js';

function extractAction(req: any): string {
  if (req.query?.action) {
    return String(req.query.action).toLowerCase().trim();
  }
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const parts = pathname.split('/').filter(Boolean);
  // e.g. /api/hosting/upload-url -> parts = ['api', 'hosting', 'upload-url']
  // e.g. /api/hosting/deployments/upload-url -> parts = ['api', 'hosting', 'deployments', 'upload-url']
  if (parts.length >= 3) {
    if (parts.includes('upload-url')) return 'upload-url';
    if (parts.includes('projects')) return 'projects';
    if (parts.includes('deployments')) return 'deployments';
    return parts[2].toLowerCase().trim();
  }
  return '';
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    return res.status(200).end();
  }

  const action = extractAction(req);
  const method = req.method || 'GET';

  // 1. Presigned Upload URL for Deployment: POST /api/hosting?action=upload-url
  if (action === 'upload-url' || (action.includes('upload') && method === 'POST')) {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const user = await verifyUserToken(authHeader);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. Please sign in to create hosting deployments.',
        });
      }

      const r2Config = getR2Config();
      if (!r2Config.isConfigured) {
        return res.status(503).json({
          success: false,
          error:
            'Storage is not configured. Server environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required.',
        });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { organizationId, projectId, deploymentId, filePath, mimeType, size } = body;

      if (!organizationId || !projectId || !deploymentId || !filePath) {
        return res.status(400).json({
          success: false,
          error: 'organizationId, projectId, deploymentId, and filePath are required.',
        });
      }

      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      const result = await createDeploymentPresignedUploadUrl({
        userId: user.id,
        organizationId,
        projectId,
        deploymentId,
        filePath,
        mimeType: mimeType || 'application/octet-stream',
        size: Number(size || 0),
        userToken: token,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/hosting?action=upload-url] Error:', err);
      const message = err?.message || 'Failed to generate deployment upload URL.';
      const status =
        message.includes('permission') || message.includes('Unauthorized')
          ? 403
          : message.includes('not found') || message.includes('belong')
          ? 404
          : message.includes('too large') || message.includes('exceeds')
          ? 400
          : message.includes('Storage is not configured')
          ? 503
          : 500;

      return res.status(status).json({ success: false, error: message });
    }
  }

  // 2. Hosting Projects: GET /api/hosting?action=projects&orgId=...
  if (action === 'projects') {
    if (method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      const sb = getSupabaseServerClient(token);
      const orgId = req.query?.orgId;

      if (sb && orgId) {
        const { data, error } = await sb
          .from('projects')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[API /api/hosting?action=projects] Error querying public.projects:', error.message);
        }

        if (data) {
          return res.status(200).json({ success: true, projects: data });
        }
      }

      return res.status(200).json({ success: true, projects: [] });
    } catch (err: any) {
      console.error('[API /api/hosting?action=projects] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch projects' });
    }
  }

  // 3. Hosting Deployments: GET /api/hosting?action=deployments&projectId=...
  if (action === 'deployments') {
    if (method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` });
    }

    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      const sb = getSupabaseServerClient(token);
      const projectId = req.query?.projectId;
      const orgId = req.query?.orgId;

      if (sb) {
        let query = sb.from('deployments').select('*').order('created_at', { ascending: false });
        if (projectId) query = query.eq('project_id', projectId);
        if (orgId) query = query.eq('organization_id', orgId);

        let { data, error } = await query;
        if (error) {
          let hQuery = sb.from('hosting_deployments').select('*').order('created_at', { ascending: false });
          if (projectId) hQuery = hQuery.eq('project_id', projectId);
          if (orgId) hQuery = hQuery.eq('organization_id', orgId);
          const hRes = await hQuery;
          data = hRes.data;
        }

        if (data) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            projectId: d.project_id,
            projectName: d.project_name || 'project',
            status: d.status || 'ready',
            url: d.deployment_url || d.url || '',
            deploymentUrl: d.deployment_url || d.url || '',
            storagePath: d.storage_path,
            commitHash: d.commit_hash || 'HEAD',
            commitMessage: d.commit_message || 'Deployment update',
            creator: d.creator || 'developer',
            branch: d.branch || 'main',
            durationSeconds: d.duration_seconds || 12,
            environment: d.environment || 'production',
            createdAt: d.created_at,
            completedAt: d.completed_at,
          }));
          return res.status(200).json({ success: true, deployments: mapped });
        }
      }

      return res.status(200).json({ success: true, deployments: [] });
    } catch (err: any) {
      console.error('[API /api/hosting?action=deployments] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch deployments' });
    }
  }

  return res.status(400).json({
    success: false,
    error: `Unknown action: '${action}'. Valid actions: upload-url, projects, deployments.`,
  });
}

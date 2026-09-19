import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

interface WaitlistEntry {
  email: string;
  source: string;
  createdAt: string;
}

interface StoredApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
}

// In-memory persistent state during server lifetime
const waitlist: WaitlistEntry[] = [];
const apiKeys: StoredApiKey[] = [
  {
    id: 'key_default_cli',
    userId: 'usr_dev',
    name: 'Production CLI Deployer',
    keyPrefix: 'opt_live_9a7b4f2c...',
    keyHash: crypto.createHash('sha256').update('opt_live_sample_hash').digest('hex'),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastUsedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const url = req.url || '';

  if (!url.startsWith('/api/')) {
    return next();
  }

  const method = req.method || 'GET';

  // 1. POST /api/waitlist
  if (url === '/api/waitlist' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();

      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Please provide a valid developer email address.',
        });
      }

      // Check duplicate
      const exists = waitlist.some((w) => w.email === email);
      if (exists) {
        return sendJson(res, 200, {
          success: true,
          message: "You're already on the Optic early access waitlist.",
        });
      }

      // Store in list
      waitlist.push({
        email,
        source: body.source || 'landing_page',
        createdAt: new Date().toISOString(),
      });

      return sendJson(res, 200, {
        success: true,
        message: "You're on the waitlist. We'll invite you to the private beta soon.",
      });
    } catch {
      return sendJson(res, 500, { success: false, error: 'Internal server error' });
    }
  }

  // 2. POST /api/keys/create
  if (url === '/api/keys/create' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      const userId = (req.headers['x-user-id'] as string) || 'usr_dev';

      if (!name) {
        return sendJson(res, 400, {
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

      const newKeyEntry: StoredApiKey = {
        id,
        userId,
        name,
        keyPrefix,
        keyHash,
        status: 'active',
        createdAt,
        lastUsedAt: null,
      };

      apiKeys.unshift(newKeyEntry);

      return sendJson(res, 201, {
        success: true,
        key: {
          id,
          name,
          rawKey, // returned only once
          keyPrefix,
          createdAt,
        },
      });
    } catch {
      return sendJson(res, 500, { success: false, error: 'Failed to create key' });
    }
  }

  // 3. GET /api/keys/list
  if (url === '/api/keys/list' && method === 'GET') {
    // Only return non-sensitive fields. NEVER return keyHash or rawKey.
    const publicList = apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));

    return sendJson(res, 200, {
      success: true,
      keys: publicList,
    });
  }

  // 4. POST /api/keys/revoke
  if (url === '/api/keys/revoke' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { id } = body;

      const target = apiKeys.find((k) => k.id === id);
      if (!target) {
        return sendJson(res, 404, { success: false, error: 'Key not found' });
      }

      target.status = 'revoked';
      return sendJson(res, 200, { success: true, message: 'Key revoked' });
    } catch {
      return sendJson(res, 500, { success: false, error: 'Failed to revoke key' });
    }
  }

  // 5. GET /api/cloud/files
  if (url.startsWith('/api/cloud/files') && method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      files: [
        {
          id: 'f_1',
          name: 'logo.svg',
          extension: 'SVG',
          mimeType: 'image/svg+xml',
          sizeBytes: 12288,
          storageKey: 'assets/logo.svg',
          storageProvider: 'r2',
          publicUrl: 'https://cdn.optic.doy.best/assets/logo.svg',
          createdAt: new Date(Date.now() - 120000).toISOString(),
          updatedAt: new Date(Date.now() - 120000).toISOString(),
          isPublic: true,
        },
        {
          id: 'f_2',
          name: 'website.zip',
          extension: 'ZIP',
          mimeType: 'application/zip',
          sizeBytes: 4404019,
          storageKey: 'builds/website.zip',
          storageProvider: 'r2',
          publicUrl: 'https://cdn.optic.doy.best/builds/website.zip',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          isPublic: false,
        },
        {
          id: 'f_3',
          name: 'photo.png',
          extension: 'PNG',
          mimeType: 'image/png',
          sizeBytes: 1887436,
          storageKey: 'media/photo.png',
          storageProvider: 'r2',
          publicUrl: 'https://cdn.optic.doy.best/media/photo.png',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          isPublic: true,
        },
      ],
      folders: [
        {
          id: 'fold_assets',
          name: 'brand-assets',
          path: '/brand-assets',
          itemCount: 4,
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: 'fold_builds',
          name: 'release-artifacts',
          path: '/release-artifacts',
          itemCount: 2,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ],
    });
  }

  // 6. GET /api/hosting/deployments
  if (url.startsWith('/api/hosting/deployments') && method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      deployments: [
        {
          id: 'dep_1',
          projectId: 'proj_1',
          projectName: 'my-portfolio',
          status: 'ready',
          url: 'https://my-portfolio.optic.doy.best',
          commitHash: '9fa4c10',
          commitMessage: 'feat: modern developer showcase',
          creator: 'alex.developer',
          branch: 'main',
          durationSeconds: 14,
          environment: 'production',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'dep_2',
          projectId: 'proj_2',
          projectName: 'example-site',
          status: 'ready',
          url: 'https://example-site.optic.doy.best',
          commitHash: '8b31ea9',
          commitMessage: 'docs: updated API reference',
          creator: 'alex.developer',
          branch: 'preview-docs',
          durationSeconds: 19,
          environment: 'preview',
          createdAt: new Date(Date.now() - 14400000).toISOString(),
        },
      ],
    });
  }

  return next();
}

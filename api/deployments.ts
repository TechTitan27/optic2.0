import type { IncomingMessage, ServerResponse } from 'http';
import { handleDeploymentRequest } from '../src/server/deploymentServer.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '';
  const parsed = new URL(url, 'http://localhost');
  const pathParam = parsed.searchParams.get('path');
  const depIdParam = parsed.searchParams.get('deploymentId');
  const subpathParam = parsed.searchParams.get('subpath');

  if (depIdParam) {
    req.url = `/api/deployments/${depIdParam}/${subpathParam || ''}${parsed.search}`;
  } else if (pathParam) {
    req.url = `/api/deployments/${pathParam}${parsed.search}`;
  } else if (!url.startsWith('/api/deployments')) {
    req.url = `/api/deployments${url.startsWith('/') ? '' : '/'}${url}`;
  }

  return handleDeploymentRequest(req, res);
}

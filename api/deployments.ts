import type { IncomingMessage, ServerResponse } from 'http';
import { handleDeploymentRequest } from '../src/server/deploymentServer.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '';
  const parsed = new URL(url, 'http://localhost');
  const pathParam = parsed.searchParams.get('path');
  const depIdParam = parsed.searchParams.get('deploymentId');
  const subpathParam = parsed.searchParams.get('subpath');

  if (depIdParam) {
    const sub = subpathParam ? (subpathParam.startsWith('/') ? subpathParam : `/${subpathParam}`) : '/';
    req.url = `/api/deployments/${depIdParam}${sub}`;
  } else if (pathParam) {
    const cleanPath = pathParam.startsWith('/') ? pathParam : `/${pathParam}`;
    req.url = `/api/deployments${cleanPath}`;
  } else if (!url.startsWith('/api/deployments')) {
    req.url = `/api/deployments${url.startsWith('/') ? '' : '/'}${url}`;
  }

  return handleDeploymentRequest(req, res);
}

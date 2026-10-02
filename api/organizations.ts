import type { IncomingMessage, ServerResponse } from 'http';
import { handleApiRequest } from '../src/server/apiHandler.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) {
    req.url = '/api/organizations';
  } else if (!req.url.startsWith('/api/organizations')) {
    req.url = `/api/organizations${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return handleApiRequest(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Organizations endpoint not found' }));
  });
}

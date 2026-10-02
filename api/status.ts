import type { IncomingMessage, ServerResponse } from 'http';
import { handleApiRequest } from '../src/server/apiHandler.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) {
    req.url = '/api/status';
  } else if (!req.url.startsWith('/api/status') && !req.url.startsWith('/status')) {
    req.url = `/api/status${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return handleApiRequest(req, res, () => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'Optic API' }));
  });
}

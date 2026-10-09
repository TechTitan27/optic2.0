import type { IncomingMessage, ServerResponse } from 'http';
import { handleDeploymentRequest } from '../../../src/server/deploymentServer.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleDeploymentRequest(req, res);
}

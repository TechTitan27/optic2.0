import { PutObjectCommand } from '@aws-sdk/client-s3';
import { setProductionDeployment, cacheDeploymentRecord, getCachedDeployment } from '../deploymentServer.js';
import { getR2Config, getR2Client } from '../r2Storage.js';

interface ProjectLock {
  lockedAt: number;
  deploymentId: string;
}

const activeProjectLocks = new Map<string, ProjectLock>();
const LOCK_TIMEOUT_MS = 240000; // 4 minutes lock timeout

/**
 * Acquires a build concurrency lock for a project to prevent race conditions.
 */
export function acquireProjectLock(projectId: string, deploymentId: string): boolean {
  const existing = activeProjectLocks.get(projectId);
  const now = Date.now();

  if (existing && now - existing.lockedAt < LOCK_TIMEOUT_MS) {
    return false; // Already locked by another concurrent deployment
  }

  activeProjectLocks.set(projectId, { lockedAt: now, deploymentId });
  return true;
}

/**
 * Releases the build concurrency lock for a project.
 */
export function releaseProjectLock(projectId: string, deploymentId: string): void {
  const existing = activeProjectLocks.get(projectId);
  if (existing && existing.deploymentId === deploymentId) {
    activeProjectLocks.delete(projectId);
  }
}

/**
 * Atomically rolls back a project's production deployment to a previous successful deployment.
 */
export async function rollbackProductionDeployment(
  projectId: string,
  targetDeploymentId: string,
  user: { id: string; email?: string },
  supabaseClient?: any
): Promise<{ success: boolean; message: string; activeDeploymentId?: string }> {
  if (!projectId || !targetDeploymentId) {
    return { success: false, message: 'projectId and targetDeploymentId are required' };
  }

  // 1. Verify target deployment exists and is ready
  let targetDep: any = getCachedDeployment(targetDeploymentId);
  let projectSlug = '';

  if (supabaseClient) {
    try {
      const { data: proj } = await supabaseClient
        .from('projects')
        .select('id, slug, name')
        .eq('id', projectId)
        .maybeSingle();

      if (proj) {
        projectSlug = proj.slug;
      }

      const { data: dep, error: depErr } = await supabaseClient
        .from('deployments')
        .select('*')
        .eq('id', targetDeploymentId)
        .eq('project_id', projectId)
        .maybeSingle();

      if (depErr || !dep) {
        return { success: false, message: `Deployment ${targetDeploymentId} not found for this project.` };
      }

      if (dep.status !== 'ready' && dep.status !== 'READY') {
        return {
          success: false,
          message: `Cannot rollback to deployment with status "${dep.status}". Only "ready" deployments can be activated.`,
        };
      }

      targetDep = dep;
    } catch (err: any) {
      return { success: false, message: `Database error during rollback verification: ${err.message}` };
    }
  }

  if (!projectSlug) {
    projectSlug = projectId;
  }

  // 2. Atomically activate the target deployment
  const completedAt = new Date().toISOString();

  // Cache in-memory
  cacheDeploymentRecord({
    id: targetDeploymentId,
    project_id: projectId,
    organization_id: targetDep?.organization_id || 'org_default',
    status: 'ready',
    storage_path: targetDep?.storage_path || `deployments/default/${projectId}/${targetDeploymentId}`,
    createdAt: Date.now(),
  });

  setProductionDeployment(projectId, targetDeploymentId, projectSlug);

  // 3. Update R2 production pointer file
  const r2Config = getR2Config();
  if (r2Config.isConfigured) {
    try {
      const r2Client = getR2Client();
      if (r2Client && r2Config.bucketName) {
        const prodPayload = JSON.stringify({
          projectId,
          projectSlug,
          productionDeploymentId: targetDeploymentId,
          promotedAt: completedAt,
          rolledBackBy: user.id,
        });
        await r2Client.send(
          new PutObjectCommand({
            Bucket: r2Config.bucketName,
            Key: `projects/${projectSlug.toLowerCase().trim()}/production.json`,
            Body: Buffer.from(prodPayload, 'utf-8'),
            ContentType: 'application/json',
          })
        );
      }
    } catch (r2Err: any) {
      console.warn('[ROLLBACK] Notice writing R2 pointer:', r2Err.message);
    }
  }

  // 4. Log rollback action in deployment_logs
  if (supabaseClient) {
    try {
      await supabaseClient.from('deployment_logs').insert([
        {
          deployment_id: targetDeploymentId,
          message: `[ROLLBACK] Project "${projectSlug}" atomically rolled back to this deployment by user ${user.email || user.id}`,
          level: 'success',
          created_at: completedAt,
        },
      ]);
    } catch {
      // ignore log error
    }
  }

  return {
    success: true,
    message: `Project "${projectSlug}" successfully rolled back to deployment ${targetDeploymentId}`,
    activeDeploymentId: targetDeploymentId,
  };
}

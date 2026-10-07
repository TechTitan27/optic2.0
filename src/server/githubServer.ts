import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage } from 'http';
import JSZip from 'jszip';
import { getSupabaseServerClient } from './supabaseServer.js';
import { getR2Client, getR2Config } from './r2Storage.js';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface GitHubConnectionRecord {
  id?: string;
  userId: string;
  githubUserId: number;
  githubUsername: string;
  avatarUrl?: string;
  accessToken: string;
  scope?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedGitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    avatarUrl: string;
    type: string;
  };
  isPrivate: boolean;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
  htmlUrl: string;
}

export interface SanitizedGitHubBranch {
  name: string;
  commitSha: string;
  isDefault: boolean;
}

// In-memory fallback cache
const memoryConnections = new Map<string, GitHubConnectionRecord>();

// Helper for local disk persistence
function getLocalDiskPath(userId: string): string {
  const sanitizedId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join('/tmp', `optic_gh_${sanitizedId}.json`);
}

function saveToDisk(userId: string, data: any) {
  try {
    const p = getLocalDiskPath(userId);
    fs.writeFileSync(p, JSON.stringify(data), 'utf-8');
  } catch {
    // non-blocking
  }
}

function readFromDisk(userId: string): any | null {
  try {
    const p = getLocalDiskPath(userId);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // non-blocking
  }
  return null;
}

function deleteFromDisk(userId: string) {
  try {
    const p = getLocalDiskPath(userId);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  } catch {
    // non-blocking
  }
}

function getCandidateSecrets(): string[] {
  const candidates: string[] = [];
  if (process.env.GITHUB_CLIENT_SECRET) candidates.push(process.env.GITHUB_CLIENT_SECRET);
  if (process.env.SUPABASE_SECRET_KEY) candidates.push(process.env.SUPABASE_SECRET_KEY);
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) candidates.push(process.env.SUPABASE_SERVICE_ROLE_KEY);
  candidates.push('optic_default_encryption_salt_2026');
  return candidates;
}

// Helper for encryption of access tokens at rest
function getEncryptionKey(): Buffer {
  const secret =
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    'optic_default_encryption_salt_2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(token: string): string {
  if (!token) return '';
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.warn('[GitHubServer] Token encryption warning, falling back to plaintext:', err);
    return token;
  }
}

export function decryptToken(encryptedString: string): string {
  if (!encryptedString) return '';
  // Plaintext tokens starting with GitHub prefixes are returned directly
  if (
    encryptedString.startsWith('gho_') ||
    encryptedString.startsWith('ghp_') ||
    encryptedString.startsWith('ghu_') ||
    encryptedString.startsWith('github_pat_')
  ) {
    return encryptedString;
  }

  if (!encryptedString.includes(':')) {
    return encryptedString;
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    return '';
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const secrets = getCandidateSecrets();

  for (const secret of secrets) {
    try {
      const key = crypto.createHash('sha256').update(secret).digest();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted && !decrypted.includes(':')) {
        return decrypted;
      }
    } catch {
      // try next secret candidate
    }
  }

  return '';
}

/**
 * Send the correct GitHub Authorization header format for the credential type being used
 */
export function formatGitHubAuthHeader(token: string): string {
  const clean = (token || '').trim();
  if (clean.startsWith('Bearer ') || clean.startsWith('token ')) {
    return clean;
  }
  return `Bearer ${clean}`;
}

/**
 * Verify credential validity before downloading or executing actions.
 * Never logs or exposes credentials.
 */
export async function verifyGitHubToken(token: string): Promise<{
  valid: boolean;
  user?: { id: number; login: string };
  error?: string;
}> {
  if (!token || typeof token !== 'string' || token.trim().length < 8 || token.includes(':')) {
    return {
      valid: false,
      error: 'GitHub authorization expired/reconnect GitHub',
    };
  }

  const authHeader = formatGitHubAuthHeader(token);

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Optic-Hosting',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        valid: true,
        user: { id: data.id, login: data.login },
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error: 'GitHub authorization expired/reconnect GitHub',
      };
    }

    return {
      valid: false,
      error: `GitHub verification failed (${res.status})`,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Failed to verify GitHub token',
    };
  }
}

/**
 * Returns GitHub OAuth App configuration
 */
export function getGithubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
  const configured = Boolean(clientId && clientSecret);
  return {
    configured,
    clientId,
    clientSecret,
  };
}

/**
 * Create a signed, tamper-proof state parameter containing userId, timestamp, and optional returnUrl
 */
export function createOAuthState(userId: string, returnUrl: string = '/hosting/new'): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const safeReturn = encodeURIComponent(returnUrl || '/hosting/new');
  const data = `${userId}:${timestamp}:${nonce}:${safeReturn}`;
  const hmac = crypto
    .createHmac('sha256', process.env.GITHUB_CLIENT_SECRET || 'optic_oauth_secret')
    .update(data)
    .digest('hex');
  const combined = `${data}:${hmac}`;
  return Buffer.from(combined).toString('base64url');
}

/**
 * Verify signed state parameter and extract verified userId and returnUrl
 */
export function verifyOAuthState(stateString: string): { userId: string; returnUrl: string } | null {
  try {
    const raw = Buffer.from(stateString, 'base64url').toString('utf8');
    const parts = raw.split(':');
    
    // Support 5-part state (userId:timestamp:nonce:returnUrl:hmac)
    if (parts.length === 5) {
      const [userId, timestampStr, nonce, safeReturn, receivedHmac] = parts;
      const timestamp = parseInt(timestampStr, 10);
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.warn('[GitHubServer] OAuth state expired.');
        return null;
      }
      const data = `${userId}:${timestampStr}:${nonce}:${safeReturn}`;
      const expectedHmac = crypto
        .createHmac('sha256', process.env.GITHUB_CLIENT_SECRET || 'optic_oauth_secret')
        .update(data)
        .digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
        const decodedReturn = decodeURIComponent(safeReturn);
        return { userId, returnUrl: decodedReturn.startsWith('/') ? decodedReturn : '/hosting/new' };
      }
      return null;
    }

    // Support legacy 4-part state (userId:timestamp:nonce:hmac)
    if (parts.length === 4) {
      const [userId, timestampStr, nonce, receivedHmac] = parts;
      const timestamp = parseInt(timestampStr, 10);
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.warn('[GitHubServer] OAuth state expired.');
        return null;
      }
      const data = `${userId}:${timestampStr}:${nonce}`;
      const expectedHmac = crypto
        .createHmac('sha256', process.env.GITHUB_CLIENT_SECRET || 'optic_oauth_secret')
        .update(data)
        .digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
        return { userId, returnUrl: '/hosting/new' };
      }
      return null;
    }

    return null;
  } catch (err) {
    console.error('[GitHubServer] Error verifying OAuth state:', err);
    return null;
  }
}

/**
 * Compute the canonical redirect URI for GitHub OAuth callback
 */
export function getGitHubRedirectUri(req: IncomingMessage): string {
  if (process.env.GITHUB_REDIRECT_URI) {
    return process.env.GITHUB_REDIRECT_URI;
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, '')}/api/hosting/github/callback`;
  }
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    'localhost:3000';
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/hosting/github/callback`;
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(
  req: IncomingMessage,
  userId: string,
  returnUrl?: string
): { url: string; state: string } {
  const { clientId, configured } = getGithubOAuthConfig();
  if (!configured) {
    throw new Error(
      'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your environment variables.'
    );
  }
  const redirectUri = getGitHubRedirectUri(req);
  const state = createOAuthState(userId, returnUrl);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo,read:user',
    state,
    allow_signup: 'true',
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return { url, state };
}

/**
 * Exchange OAuth authorization code for GitHub access token
 */
export async function exchangeCodeForGitHubToken(code: string, redirectUri: string): Promise<{ accessToken: string; scope: string }> {
  const { clientId, clientSecret, configured } = getGithubOAuthConfig();
  if (!configured) {
    throw new Error('GitHub OAuth credentials are not configured on the server.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Optic-Hosting',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to exchange authorization code for token.');
  }

  return {
    accessToken: data.access_token,
    scope: data.scope || 'repo,read:user',
  };
}

/**
 * Fetch authenticated GitHub user details
 */
export async function fetchGitHubUserProfile(accessToken: string): Promise<{
  id: number;
  login: string;
  avatarUrl: string;
  name?: string;
  email?: string;
}> {
  const authHeader = formatGitHubAuthHeader(accessToken);
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: authHeader,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Optic-Hosting',
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('GitHub authorization expired/reconnect GitHub');
    }
    const errorBody = await res.text();
    throw new Error(`GitHub user query failed (${res.status}): ${errorBody}`);
  }

  const user = await res.json();
  return {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    name: user.name || user.login,
    email: user.email || undefined,
  };
}

/**
 * Save user GitHub connection securely in Supabase, local cache, and R2
 */
export async function saveGitHubConnection(
  userId: string,
  details: {
    githubUserId: number;
    githubUsername: string;
    avatarUrl?: string;
    accessToken: string;
    scope?: string;
  }
): Promise<GitHubConnectionRecord> {
  const now = new Date().toISOString();
  const rawToken = (details.accessToken || '').trim();
  const encrypted = encryptToken(rawToken);

  const record: GitHubConnectionRecord = {
    userId,
    githubUserId: details.githubUserId,
    githubUsername: details.githubUsername,
    avatarUrl: details.avatarUrl || `https://github.com/${details.githubUsername}.png`,
    accessToken: rawToken,
    scope: details.scope || 'repo,read:user',
    createdAt: now,
    updatedAt: now,
  };

  // 1. In-memory cache
  memoryConnections.set(userId, record);

  // 2. Local disk persistence
  saveToDisk(userId, {
    userId,
    githubUserId: details.githubUserId,
    githubUsername: details.githubUsername,
    avatarUrl: record.avatarUrl,
    token: rawToken,
    encryptedToken: encrypted,
    scope: record.scope,
    updatedAt: now,
  });

  // 3. Persist to Supabase public.github_connections (exact schema: id, user_id, github_user_id, github_username, created_at)
  const sb = getSupabaseServerClient();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('github_connections')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data: updated, error: updateErr } = await sb
          .from('github_connections')
          .update({
            github_user_id: details.githubUserId,
            github_username: details.githubUsername,
          })
          .eq('id', existing.id)
          .select('id')
          .maybeSingle();

        if (updateErr) {
          console.warn('[GitHubServer] Notice updating public.github_connections:', updateErr.message);
        } else if (updated?.id) {
          record.id = updated.id;
        }
      } else {
        const { data: inserted, error: insertErr } = await sb
          .from('github_connections')
          .insert({
            user_id: userId,
            github_user_id: details.githubUserId,
            github_username: details.githubUsername,
            created_at: now,
          })
          .select('id')
          .maybeSingle();

        if (insertErr) {
          console.warn('[GitHubServer] Notice inserting to public.github_connections:', insertErr.message);
        } else if (inserted?.id) {
          record.id = inserted.id;
        }
      }
    } catch (err: any) {
      console.warn('[GitHubServer] Database connection notice during github_connections save:', err.message);
    }
  }

  // 4. Persistence in private R2 storage
  const r2Client = getR2Client();
  const r2Config = getR2Config();
  if (r2Client && r2Config.bucketName) {
    try {
      const putCmd = new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `meta/github/${userId}/connection.json`,
        Body: Buffer.from(
          JSON.stringify({
            userId,
            githubUserId: details.githubUserId,
            githubUsername: details.githubUsername,
            avatarUrl: record.avatarUrl,
            token: rawToken,
            encryptedToken: encrypted,
            scope: record.scope,
            updatedAt: now,
          }),
          'utf-8'
        ),
        ContentType: 'application/json',
      });
      await r2Client.send(putCmd);
    } catch {
      // non-blocking
    }
  }

  return record;
}

/**
 * Retrieve GitHub connection and credential for a user
 */
export async function getGitHubConnection(userId: string): Promise<GitHubConnectionRecord | null> {
  let knownToken = '';
  let githubUserId = 0;
  let githubUsername = '';
  let avatarUrl = '';
  let scope = 'repo,read:user';
  let dbRecordId: string | undefined = undefined;
  let createdAt = new Date().toISOString();

  // 1. Check in-memory cache
  if (memoryConnections.has(userId)) {
    const mem = memoryConnections.get(userId)!;
    if (mem.accessToken && !mem.accessToken.includes(':')) {
      knownToken = mem.accessToken;
      githubUserId = mem.githubUserId;
      githubUsername = mem.githubUsername;
      avatarUrl = mem.avatarUrl || '';
      scope = mem.scope || scope;
      dbRecordId = mem.id;
      createdAt = mem.createdAt;
    }
  }

  // 2. Check local disk cache
  if (!knownToken) {
    const disk = readFromDisk(userId);
    if (disk) {
      const candidate =
        disk.token ||
        disk.accessToken ||
        (disk.encryptedToken ? decryptToken(disk.encryptedToken) : '');
      if (candidate && !candidate.includes(':')) {
        knownToken = candidate;
        githubUserId = disk.githubUserId || githubUserId;
        githubUsername = disk.githubUsername || githubUsername;
        avatarUrl = disk.avatarUrl || avatarUrl;
        scope = disk.scope || scope;
        createdAt = disk.updatedAt || createdAt;
      }
    }
  }

  // 3. Check private R2 backup
  if (!knownToken) {
    const r2Client = getR2Client();
    const r2Config = getR2Config();
    if (r2Client && r2Config.bucketName) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: r2Config.bucketName,
          Key: `meta/github/${userId}/connection.json`,
        });
        const res = await r2Client.send(getCmd);
        if (res.Body) {
          const text = await (res.Body as any).transformToString('utf-8');
          const parsed = JSON.parse(text);
          const candidate =
            parsed.token ||
            parsed.accessToken ||
            (parsed.encryptedToken ? decryptToken(parsed.encryptedToken) : '');
          if (candidate && !candidate.includes(':')) {
            knownToken = candidate;
            githubUserId = parsed.githubUserId || githubUserId;
            githubUsername = parsed.githubUsername || githubUsername;
            avatarUrl = parsed.avatarUrl || avatarUrl;
            scope = parsed.scope || scope;
            createdAt = parsed.updatedAt || createdAt;
          }
        }
      } catch {
        // not in R2
      }
    }
  }

  // 4. Query Supabase public.github_connections (schema: id, user_id, github_user_id, github_username, created_at)
  const sb = getSupabaseServerClient();
  let dbFound = false;
  if (sb) {
    try {
      const { data, error } = await sb
        .from('github_connections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        dbFound = true;
        dbRecordId = data.id;
        githubUserId = data.github_user_id || githubUserId;
        githubUsername = data.github_username || githubUsername;
        createdAt = data.created_at || createdAt;
      }
    } catch (err: any) {
      console.warn('[GitHubServer] Database read notice for github_connections:', err.message);
    }
  }

  // If neither token nor Supabase connection was found
  if (!knownToken && !dbFound && !githubUsername) {
    return null;
  }

  const record: GitHubConnectionRecord = {
    id: dbRecordId,
    userId,
    githubUserId,
    githubUsername,
    avatarUrl: avatarUrl || (githubUsername ? `https://github.com/${githubUsername}.png` : ''),
    accessToken: knownToken,
    scope,
    createdAt,
    updatedAt: createdAt,
  };

  memoryConnections.set(userId, record);
  if (knownToken) {
    saveToDisk(userId, {
      userId,
      githubUserId,
      githubUsername,
      avatarUrl: record.avatarUrl,
      token: knownToken,
      scope,
      updatedAt: createdAt,
    });
  }

  return record;
}

/**
 * Disconnect GitHub account for a user
 */
export async function disconnectGitHubConnection(userId: string): Promise<boolean> {
  memoryConnections.delete(userId);
  deleteFromDisk(userId);

  // 1. Delete from Supabase
  const sb = getSupabaseServerClient();
  if (sb) {
    try {
      await sb.from('github_connections').delete().eq('user_id', userId);
    } catch (err: any) {
      console.warn('[GitHubServer] Database deletion notice for github_connections:', err.message);
    }
  }

  // 2. Delete from R2
  const r2Client = getR2Client();
  const r2Config = getR2Config();
  if (r2Client && r2Config.bucketName) {
    try {
      const delCmd = new DeleteObjectCommand({
        Bucket: r2Config.bucketName,
        Key: `meta/github/${userId}/connection.json`,
      });
      await r2Client.send(delCmd);
    } catch {
      // non-blocking
    }
  }

  return true;
}

/**
 * Fetch repositories accessible to the user
 */
export async function fetchGitHubRepositories(
  accessToken: string,
  searchQuery?: string
): Promise<SanitizedGitHubRepository[]> {
  const authHeader = formatGitHubAuthHeader(accessToken);
  const url = 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member';
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Optic-Hosting',
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('GitHub authorization expired/reconnect GitHub');
    }
    const errorBody = await res.text();
    throw new Error(`GitHub repositories query failed (${res.status}): ${errorBody}`);
  }

  const rawRepos = await res.json();
  if (!Array.isArray(rawRepos)) {
    return [];
  }

  let mapped: SanitizedGitHubRepository[] = rawRepos.map((r: any) => {
    const ownerLogin = (r.owner?.login || (r.full_name ? r.full_name.split('/')[0] : '')).trim();
    const repoName = (r.name || (r.full_name ? r.full_name.split('/')[1] : '')).trim();
    const fullName =
      ownerLogin && repoName
        ? `${ownerLogin}/${repoName}`
        : (r.full_name || repoName || ownerLogin).trim();

    return {
      id: r.id,
      name: repoName || fullName,
      fullName: fullName,
      owner: {
        login: ownerLogin,
        avatarUrl: r.owner?.avatar_url || '',
        type: r.owner?.type || 'User',
      },
      isPrivate: Boolean(r.private),
      defaultBranch: r.default_branch || 'main',
      description: r.description || null,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url || `https://github.com/${fullName}`,
    };
  });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    mapped = mapped.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }

  return mapped;
}

/**
 * Fetch branches for a specific repository
 */
export async function fetchGitHubBranches(
  accessToken: string,
  owner: string,
  repo: string
): Promise<SanitizedGitHubBranch[]> {
  const authHeader = formatGitHubAuthHeader(accessToken);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Optic-Hosting',
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('GitHub authorization expired/reconnect GitHub');
    }
    const errorBody = await res.text();
    throw new Error(`GitHub branches query failed (${res.status}): ${errorBody}`);
  }

  const rawBranches = await res.json();
  if (!Array.isArray(rawBranches)) {
    return [];
  }

  // Also query default branch from repo details
  let defaultBranchName = 'main';
  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Optic-Hosting',
        },
      }
    );
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      defaultBranchName = repoData.default_branch || 'main';
    }
  } catch {
    // fallback to main
  }

  return rawBranches.map((b: any) => ({
    name: b.name,
    commitSha: b.commit?.sha || '',
    isDefault: b.name === defaultBranchName,
  }));
}

export interface GitHubRepositoryFile {
  relativePath: string;
  buffer: Buffer;
  size: number;
}

/**
 * Fetch the selected branch's ENTIRE repository recursively.
 * Includes all files and nested directories, preserving their exact relative paths.
 * Validates credential first, sends appropriate auth headers, handles codeload redirects cleanly.
 */
export async function fetchRepositoryContentsRecursive(
  accessToken: string,
  owner: string,
  repo: string,
  ref: string
): Promise<{ files: GitHubRepositoryFile[]; commitSha?: string }> {
  // 1. Verify credential format and validity before downloading
  const verification = await verifyGitHubToken(accessToken);
  if (!verification.valid) {
    console.warn('[GITHUB_FETCH_ZIP] Credential verification failed:', verification.error);
    throw new Error('GitHub authorization expired/reconnect GitHub');
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(ref)}`;
  const authHeader = formatGitHubAuthHeader(accessToken);

  // 2. Request zipball with manual redirect handling to prevent credential leaks / 404s on codeload
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Optic-Hosting',
    },
    redirect: 'manual',
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('GitHub authorization expired/reconnect GitHub');
  }

  if (res.status === 404) {
    throw new Error(`GitHub repository ${owner}/${repo} or branch "${ref}" not found.`);
  }

  let zipBuffer: Buffer;

  if (res.status === 302 || res.status === 301) {
    const redirectUrl = res.headers.get('location');
    if (!redirectUrl) {
      throw new Error('GitHub zipball redirect location missing');
    }

    // 3. Download the actual zip archive from codeload.github.com
    // IMPORTANT: Codeload MUST NOT receive Authorization header, as it causes 404
    const downloadRes = await fetch(redirectUrl, {
      headers: {
        'User-Agent': 'Optic-Hosting',
      },
      redirect: 'follow',
    });

    if (!downloadRes.ok) {
      if (downloadRes.status === 401 || downloadRes.status === 403) {
        throw new Error('GitHub authorization expired/reconnect GitHub');
      }
      const errorBody = await downloadRes.text().catch(() => '');
      throw new Error(`GitHub repository archive download failed (${downloadRes.status}): ${errorBody}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    zipBuffer = Buffer.from(arrayBuffer);
  } else if (res.ok) {
    const arrayBuffer = await res.arrayBuffer();
    zipBuffer = Buffer.from(arrayBuffer);
  } else {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`GitHub zipball download failed (${res.status}): ${errorBody}`);
  }

  console.log('[GITHUB_ZIP_DOWNLOADED]', { sizeBytes: zipBuffer.length });

  const zip = await JSZip.loadAsync(zipBuffer);
  const files: GitHubRepositoryFile[] = [];

  // Determine root directory prefix created by GitHub zipball (e.g. "owner-repo-commitSha/")
  const fileKeys = Object.keys(zip.files);
  let rootPrefix = '';
  if (fileKeys.length > 0) {
    const firstKey = fileKeys[0];
    const slashIdx = firstKey.indexOf('/');
    if (slashIdx !== -1) {
      rootPrefix = firstKey.substring(0, slashIdx + 1);
    }
  }

  let commitSha = '';
  if (rootPrefix) {
    const parts = rootPrefix.replace(/\/$/, '').split('-');
    if (parts.length > 0) {
      commitSha = parts[parts.length - 1];
    }
  }

  for (const [rawKey, zipObj] of Object.entries(zip.files)) {
    if (zipObj.dir) continue;

    // Strip top-level directory prefix
    let relativePath = rawKey;
    if (rootPrefix && relativePath.startsWith(rootPrefix)) {
      relativePath = relativePath.substring(rootPrefix.length);
    }

    // Normalize slashes and strip leading slashes
    relativePath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!relativePath) continue;

    // Skip git internal files
    if (relativePath.startsWith('.git/') || relativePath === '.git') continue;

    const fileBuf = await zipObj.async('nodebuffer');
    files.push({
      relativePath,
      buffer: fileBuf,
      size: fileBuf.length,
    });
  }

  console.log('[GITHUB_ZIP_EXTRACTED]', {
    fileCount: files.length,
    commitSha,
    fileSample: files.slice(0, 5).map((f) => f.relativePath),
  });

  return { files, commitSha };
}

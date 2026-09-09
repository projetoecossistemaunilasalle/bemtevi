import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createPublishedContentRepository,
  type PublishedContentGateway,
} from '../../src/app/content/publishedContentRepository';
import type { PublishedContentRow } from '../../src/app/content/publishedContent';
import type { Database } from '../../src/app/neon/database';
import { ContentAgentError, type ContentAgentSession, type ContentPublisher } from './server';

interface StoredSession {
  authUrl: string;
  dataApiUrl: string;
  cookie: string;
}

interface RemoteSession {
  session: { id?: string; token?: string; userId?: string };
  user: { id: string; email?: string };
}

type PublishedInsert = Database['public']['Tables']['published_content']['Insert'];
type PublishedUpdate = Database['public']['Tables']['published_content']['Update'];

export class AdminCredentialVault {
  private readonly filePath: string;

  constructor(directory = path.join(process.env.LOCALAPPDATA || os.homedir(), 'BemTeVi')) {
    this.filePath = path.join(directory, 'content-agent-session.dpapi');
  }

  async save(session: StoredSession): Promise<void> {
    const encrypted = protectForCurrentUser(JSON.stringify(session));
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, encrypted, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async load(): Promise<StoredSession | null> {
    try {
      const encrypted = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(unprotectForCurrentUser(encrypted)) as StoredSession;
      if (!parsed.authUrl || !parsed.dataApiUrl || !parsed.cookie) throw new Error('invalid session');
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new ContentAgentError('unauthorized', 'A sessão administrativa local não pôde ser aberta.');
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export async function loginAdmin(
  config: { authUrl: string; dataApiUrl: string },
  email: string,
  password: string,
  vault = new AdminCredentialVault(),
): Promise<{ id: string; email: string }> {
  const response = await fetch(authEndpoint(config.authUrl, 'sign-in/email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await safeJson(response)) as {
    user?: { id?: string; email?: string };
    data?: { user?: { id?: string; email?: string } };
  };
  const user = body.user ?? body.data?.user;
  const cookie = sessionCookie(response);
  if (!response.ok || !user?.id || !cookie) {
    throw new ContentAgentError('unauthorized', 'Credenciais administrativas inválidas.');
  }
  const stored = { ...config, cookie };
  const jwt = await getJwt(stored);
  if (!(await isAdmin(config.dataApiUrl, user.id, jwt))) {
    await revokeRemoteSession(stored);
    throw new ContentAgentError('unauthorized', 'Esta conta não possui acesso administrativo.');
  }
  await vault.save(stored);
  return { id: user.id, email: user.email ?? email };
}

export async function logoutAdmin(vault = new AdminCredentialVault()): Promise<void> {
  const stored = await vault.load();
  if (stored) await revokeRemoteSession(stored);
  await vault.clear();
}

export function createVaultContentPublisher(vault = new AdminCredentialVault()): ContentPublisher {
  let authenticated: { stored: StoredSession; remote: RemoteSession; jwt: string } | null = null;

  async function sessionContext() {
    const stored = await vault.load();
    if (!stored) throw new ContentAgentError('unauthorized', 'Execute pnpm content-agent:login antes de publicar.');
    const remote = await getRemoteSession(stored);
    const jwt = await getJwt(stored);
    if (!(await isAdmin(stored.dataApiUrl, remote.user.id, jwt))) {
      throw new ContentAgentError('unauthorized', 'A conta autenticada não possui acesso administrativo.');
    }
    authenticated = { stored, remote, jwt };
    return authenticated;
  }

  return {
    async getSession(): Promise<ContentAgentSession | null> {
      const { remote } = await sessionContext();
      const source = remote.session.id ?? remote.session.token ?? '';
      return {
        publisherId: remote.user.id,
        sessionId: createHash('sha256').update(source).digest('hex'),
      };
    },
    async publishContent(input) {
      const context = authenticated ?? (await sessionContext());
      if (context.remote.user.id !== input.publisherId) {
        throw new ContentAgentError('unauthorized', 'A identidade da sessão administrativa mudou.');
      }
      const repository = createPublishedContentRepository(
        createAuthenticatedGateway(context.stored.dataApiUrl, context.jwt),
      );
      return repository.publishContent(input);
    },
  };
}

function createAuthenticatedGateway(dataApiUrl: string, jwt: string): PublishedContentGateway {
  async function request(method: string, query: string, body?: PublishedInsert | PublishedUpdate) {
    const response = await fetch(dataEndpoint(dataApiUrl, `published_content${query}`), {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${jwt}`,
        Prefer: 'return=representation',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await safeJson(response);
    if (!response.ok) {
      const error = value as { code?: string; message?: string };
      return { data: null, error: { code: error.code, message: error.message ?? 'Falha na Data API.' } };
    }
    const rows = Array.isArray(value) ? value : [];
    return { data: (rows[0] as PublishedContentRow | undefined) ?? null, error: null };
  }
  return {
    readCurrent: () => request('GET', '?id=eq.current&select=*'),
    insertCurrent: (row) => request('POST', '', row),
    updateCurrent: (expectedRevision, row) => request('PATCH', `?id=eq.current&revision=eq.${expectedRevision}`, row),
  };
}

async function getRemoteSession(stored: StoredSession): Promise<RemoteSession> {
  const response = await fetch(authEndpoint(stored.authUrl, 'get-session'), {
    headers: { Accept: 'application/json', Cookie: stored.cookie },
  });
  const body = (await safeJson(response)) as { data?: RemoteSession | null } & Partial<RemoteSession>;
  const session = body.data ?? (body.session && body.user ? (body as RemoteSession) : null);
  if (!response.ok || !session?.user?.id || !session.session) {
    throw new ContentAgentError('unauthorized', 'A sessão administrativa expirou. Entre novamente.');
  }
  return session;
}

async function getJwt(stored: StoredSession): Promise<string> {
  const response = await fetch(authEndpoint(stored.authUrl, 'get-j-w-t-token'), {
    headers: { Accept: 'application/json', Cookie: stored.cookie },
  });
  const body = (await safeJson(response)) as { token?: string; data?: { token?: string } };
  const token = body.token ?? body.data?.token;
  if (!response.ok || !token)
    throw new ContentAgentError('unauthorized', 'Não foi possível renovar a sessão administrativa.');
  return token;
}

async function isAdmin(dataApiUrl: string, userId: string, jwt: string): Promise<boolean> {
  const query = `admin_users?select=user_id&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetch(dataEndpoint(dataApiUrl, query), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new ContentAgentError('unavailable', 'Não foi possível validar a associação administrativa.');
  const rows = await safeJson(response);
  return Array.isArray(rows) && rows.some((row) => (row as { user_id?: unknown }).user_id === userId);
}

async function revokeRemoteSession(stored: StoredSession): Promise<void> {
  try {
    await fetch(authEndpoint(stored.authUrl, 'sign-out'), {
      method: 'POST',
      headers: { Accept: 'application/json', Cookie: stored.cookie },
    });
  } catch {
    // Local removal is authoritative even if remote revocation is unavailable.
  }
}

function authEndpoint(base: string, action: string): string {
  return `${base.replace(/\/+$/, '')}/api/auth/${action}`;
}

function dataEndpoint(base: string, resource: string): string {
  return `${base.replace(/\/+$/, '')}/${resource}`;
}

function sessionCookie(response: Response): string {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = values.length > 0 ? values : (response.headers.get('set-cookie')?.split(/,(?=\s*[^;,]+=)/) ?? []);
  return raw
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ');
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function protectForCurrentUser(value: string): string {
  return runDpapi('Protect', value);
}

function unprotectForCurrentUser(value: string): string {
  return runDpapi('Unprotect', value);
}

function runDpapi(operation: 'Protect' | 'Unprotect', input: string): string {
  if (process.platform !== 'win32') {
    throw new ContentAgentError('unavailable', 'Nenhum cofre de credenciais compatível está disponível neste sistema.');
  }
  const source =
    operation === 'Protect'
      ? '$b=[Text.Encoding]::UTF8.GetBytes($i);$o=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Convert]::ToBase64String($o)'
      : '$b=[Convert]::FromBase64String($i);$o=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Text.Encoding]::UTF8.GetString($o)';
  const command = `$i=[Console]::In.ReadToEnd();${source}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    input,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new ContentAgentError('unavailable', 'O cofre de credenciais do Windows não está disponível.');
  }
  return result.stdout.trim();
}

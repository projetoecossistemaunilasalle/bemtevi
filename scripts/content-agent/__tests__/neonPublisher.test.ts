import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBundledContent } from '../../../src/app/content/bundledContent';
import { createVaultContentPublisher, loginAdmin } from '../neonPublisher';

const config = { authUrl: 'https://auth.test', dataApiUrl: 'https://data.test/rest/v1' };
const stored = { ...config, cookie: '__Secure-neon-auth.session_token=secret' };

afterEach(() => vi.unstubAllGlobals());

describe('publicador Neon do agente de conteúdo', () => {
  it('autentica, valida a associação administrativa e entrega a sessão ao cofre', async () => {
    const save = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/sign-in/email')) {
          return Response.json(
            { user: { id: 'admin-id', email: 'admin@bemtevi.test' } },
            { headers: { 'Set-Cookie': '__Secure-neon-auth.session_token=secret; Path=/; HttpOnly' } },
          );
        }
        if (url.endsWith('/get-j-w-t-token')) return Response.json({ token: 'jwt' });
        if (url.includes('/admin_users?')) return Response.json([{ user_id: 'admin-id' }]);
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    await expect(loginAdmin(config, 'admin@bemtevi.test', 'password', { save } as never)).resolves.toEqual({
      id: 'admin-id',
      email: 'admin@bemtevi.test',
    });
    expect(save).toHaveBeenCalledWith(stored);
  });

  it('deriva publisherId da sessão e faz PATCH condicional na revisão', async () => {
    const payload = getBundledContent();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/get-session')) {
          return Response.json({
            session: { id: 'session-id', token: 'session-token', userId: 'admin-id' },
            user: { id: 'admin-id', email: 'admin@bemtevi.test' },
          });
        }
        if (url.endsWith('/get-j-w-t-token')) return Response.json({ token: 'jwt' });
        if (url.includes('/admin_users?')) return Response.json([{ user_id: 'admin-id' }]);
        if (url.includes('/published_content?')) {
          expect(init?.method).toBe('PATCH');
          expect(url).toContain('revision=eq.40');
          const body = JSON.parse(String(init?.body)) as { published_by: string };
          expect(body.published_by).toBe('admin-id');
          return Response.json([
            {
              id: 'current',
              schema_version: '1.0.0',
              revision: 41,
              payload,
              published_at: '2026-09-09T12:00:00.000Z',
              published_by: 'admin-id',
            },
          ]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );
    const publisher = createVaultContentPublisher({ load: vi.fn(async () => stored) } as never);
    const session = await publisher.getSession();

    expect(session?.publisherId).toBe('admin-id');
    await expect(
      publisher.publishContent({ payload, expectedRevision: 40, publisherId: 'admin-id' }),
    ).resolves.toMatchObject({ revision: 41, publishedBy: 'admin-id' });
  });
});

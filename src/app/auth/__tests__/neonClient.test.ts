import { describe, expect, it, vi } from 'vitest';
import { createNeonAdminAuthBackend, type NeonAuthClient } from '../neonClient';

const adminData = {
  session: { id: 'session-id' },
  user: { id: 'admin-id', email: 'admin@bemtevi.test' },
};

function createClient(): NeonAuthClient {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
      signIn: {
        email: vi.fn().mockResolvedValue({ data: { user: adminData.user }, error: null }),
      },
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'admin-id' }], error: null }),
      }),
    }),
  };
}

describe('Neon admin auth backend', () => {
  it('stays disabled when no Neon client is provided', () => {
    expect(createNeonAdminAuthBackend(null)).toBeNull();
  });

  it('maps Neon Auth sessions and checks admin membership through the Data API', async () => {
    const client = createClient();
    const backend = createNeonAdminAuthBackend(client);

    expect(backend).not.toBeNull();
    await expect(backend!.signInWithPassword('admin@bemtevi.test', 'password')).resolves.toMatchObject({
      session: { user: { id: 'admin-id', email: 'admin@bemtevi.test' } },
      error: null,
    });
    await expect(backend!.isAdmin('admin-id')).resolves.toEqual({ isAdmin: true, error: null });
    expect(client.from).toHaveBeenCalledWith('admin_users');
  });

  it('rechecks the Neon session when another tab changes browser auth state', async () => {
    const client = createClient();
    vi.mocked(client.auth.getSession).mockResolvedValue({ data: adminData, error: null });
    const backend = createNeonAdminAuthBackend(client)!;
    const listener = vi.fn();

    const stop = backend.subscribe(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'better-auth.message' }));

    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({ user: { id: 'admin-id', email: 'admin@bemtevi.test' } }),
    );
    stop();
  });
});

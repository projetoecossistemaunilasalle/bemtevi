import { describe, expect, it, vi } from 'vitest';
import { AdminAuthError, createAdminAuthService, type AdminAuthBackend, type AuthSession } from '../adminAuth';

const adminSession: AuthSession = {
  user: { id: 'admin-user-id', email: 'admin@bemtevi.test' },
};

function createBackend(overrides: Partial<AdminAuthBackend> = {}): AdminAuthBackend {
  return {
    getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ session: adminSession, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    isAdmin: vi.fn().mockResolvedValue({ isAdmin: true, error: null }),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

describe('admin auth service', () => {
  it('logs in an account that has server-authorized admin membership', async () => {
    const backend = createBackend();
    const service = createAdminAuthService(backend);

    await expect(service.login('admin@bemtevi.test', 'correct-password')).resolves.toEqual({
      id: 'admin-user-id',
      email: 'admin@bemtevi.test',
    });
    expect(backend.signInWithPassword).toHaveBeenCalledWith('admin@bemtevi.test', 'correct-password');
    expect(backend.isAdmin).toHaveBeenCalledWith('admin-user-id');
  });

  it('reports invalid credentials without enabling admin access', async () => {
    const backend = createBackend({
      signInWithPassword: vi.fn().mockResolvedValue({ session: null, error: new Error('Invalid login credentials') }),
    });

    await expect(createAdminAuthService(backend).login('admin@bemtevi.test', 'wrong')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(backend.isAdmin).not.toHaveBeenCalled();
  });

  it('signs out a valid account that is not an administrator', async () => {
    const backend = createBackend({
      isAdmin: vi.fn().mockResolvedValue({ isAdmin: false, error: null }),
    });

    await expect(createAdminAuthService(backend).login('user@bemtevi.test', 'correct-password')).rejects.toMatchObject({
      code: 'not_admin',
    });
    expect(backend.signOut).toHaveBeenCalledOnce();
  });

  it('restores only an authorized admin session', async () => {
    const backend = createBackend({
      getSession: vi.fn().mockResolvedValue({ session: adminSession, error: null }),
    });

    await expect(createAdminAuthService(backend).restore()).resolves.toEqual({
      id: 'admin-user-id',
      email: 'admin@bemtevi.test',
    });
  });

  it('clears a restored session when the account is no longer an admin', async () => {
    const backend = createBackend({
      getSession: vi.fn().mockResolvedValue({ session: adminSession, error: null }),
      isAdmin: vi.fn().mockResolvedValue({ isAdmin: false, error: null }),
    });

    await expect(createAdminAuthService(backend).restore()).resolves.toBeNull();
    expect(backend.signOut).toHaveBeenCalledOnce();
  });

  it('reports missing backend configuration', async () => {
    const service = createAdminAuthService(null);

    await expect(service.restore()).rejects.toEqual(
      new AdminAuthError('not_configured', 'A autenticação administrativa não está configurada.'),
    );
  });

  it('delegates logout and session subscriptions to the backend', async () => {
    const unsubscribe = vi.fn();
    const backend = createBackend({
      subscribe: vi.fn().mockReturnValue(unsubscribe),
    });
    const service = createAdminAuthService(backend);
    const listener = vi.fn();

    const stop = service.subscribe(listener);
    await service.logout();
    stop();

    expect(backend.subscribe).toHaveBeenCalled();
    expect(backend.signOut).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('resolves admin membership after the auth callback releases its lock', async () => {
    let authListener: ((session: AuthSession | null) => void) | undefined;
    const backend = createBackend({
      subscribe: vi.fn((listener) => {
        authListener = listener;
        return () => undefined;
      }),
    });
    const listener = vi.fn();

    createAdminAuthService(backend).subscribe(listener);
    authListener?.(adminSession);

    expect(backend.isAdmin).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({ id: 'admin-user-id', email: 'admin@bemtevi.test' }));
  });

  it('ignores an old authorization result after a newer sign-out event', async () => {
    let authListener: ((session: AuthSession | null) => void) | undefined;
    let resolveMembership: ((result: { isAdmin: boolean; error: Error | null }) => void) | undefined;
    const membership = new Promise<{ isAdmin: boolean; error: Error | null }>((resolve) => {
      resolveMembership = resolve;
    });
    const backend = createBackend({
      isAdmin: vi.fn().mockReturnValue(membership),
      subscribe: vi.fn((listener) => {
        authListener = listener;
        return () => undefined;
      }),
    });
    const listener = vi.fn();

    createAdminAuthService(backend).subscribe(listener);
    authListener?.(adminSession);
    await Promise.resolve();
    authListener?.(null);
    resolveMembership?.({ isAdmin: true, error: null });

    await membership;
    await Promise.resolve();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledWith(null);
    expect(listener).not.toHaveBeenCalledWith({ id: 'admin-user-id', email: 'admin@bemtevi.test' });
  });
});

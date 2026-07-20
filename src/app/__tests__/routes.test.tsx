import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedContentContext } from '../content/PublishedContentContext';
import { getBundledContent } from '../content/bundledContent';
import { AdminAuthProvider } from '../auth/AdminAuthProvider';
import { AdminAuthError, type AdminAccount, type AdminAuthService } from '../auth/adminAuth';
import { Router } from '../router';

const admin: AdminAccount = { id: 'admin-id', email: 'admin@bemtevi.test' };

function createAuthService(initialAccount: AdminAccount | null = null): AdminAuthService {
  let currentAccount = initialAccount;
  return {
    restore: vi.fn(async () => currentAccount),
    login: vi.fn(async () => {
      currentAccount = admin;
      return admin;
    }),
    logout: vi.fn(async () => {
      currentAccount = null;
    }),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'false');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderRoute(initialEntry: string, authService = createAuthService()) {
  const payload = getBundledContent();
  const snapshot = {
    schemaVersion: '1.0.0',
    revision: 1,
    payload,
    publishedAt: '2026-07-15T00:00:00.000Z',
    publishedBy: 'admin',
  } as const;
  const contentValue = {
    content: payload,
    snapshot,
    source: 'bundled' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminAuthProvider service={authService}>
        <PublishedContentContext.Provider value={contentValue}>
          <Router />
        </PublishedContentContext.Provider>
      </AdminAuthProvider>
    </MemoryRouter>,
  );
  return authService;
}

describe('Router', () => {
  it.each([
    ['/', /bem-vindo ao bemtevi/i],
    ['/orientacao', /antes de começar/i],
    ['/apoio', /você não está sozinho/i],
    ['/contatos', /rede de apoio em canoas/i],
    ['/educacao', /biblioteca de educação/i],
  ])('renders the public route %s', (route, heading) => {
    renderRoute(route);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it.each(['/login', '/dashboard'])('redirects %s home when the dashboard feature is disabled', async (route) => {
    renderRoute(route);
    expect(await screen.findByRole('heading', { name: /bem-vindo ao bemtevi/i })).toBeInTheDocument();
  });

  it('redirects an unauthenticated dashboard request home without exposing login', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    renderRoute('/dashboard');

    expect(await screen.findByRole('heading', { name: /bem-vindo ao bemtevi/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /acesso administrativo/i })).not.toBeInTheDocument();
  });

  it('renders the private login route when admin access is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    renderRoute('/login');

    expect(await screen.findByRole('heading', { name: /acesso administrativo/i })).toBeInTheDocument();
  });

  it('logs an authorized admin in and redirects to the dashboard', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    const user = userEvent.setup();
    const authService = renderRoute('/login');

    await user.type(await screen.findByLabelText(/e-mail/i), 'admin@bemtevi.test');
    await user.type(screen.getByLabelText(/senha/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(authService.login).toHaveBeenCalledWith('admin@bemtevi.test', 'correct-password');
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows a safe error when credentials are rejected', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    const user = userEvent.setup();
    const authService = createAuthService();
    vi.mocked(authService.login).mockRejectedValue(
      new AdminAuthError('invalid_credentials', 'E-mail ou senha inválidos.'),
    );
    renderRoute('/login', authService);

    await user.type(await screen.findByLabelText(/e-mail/i), 'admin@bemtevi.test');
    await user.type(screen.getByLabelText(/senha/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('redirects a restored admin from login to the dashboard', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    renderRoute('/login', createAuthService(admin));

    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders the dashboard for a restored authorized admin', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    renderRoute('/dashboard', createAuthService(admin));

    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('revokes an active admin when route revalidation no longer finds membership', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
    const authService = createAuthService(admin);
    let resolveRevalidation: ((account: AdminAccount | null) => void) | undefined;
    vi.mocked(authService.restore)
      .mockResolvedValueOnce(admin)
      .mockReturnValueOnce(
        new Promise<AdminAccount | null>((resolve) => {
          resolveRevalidation = resolve;
        }),
      );
    renderRoute('/dashboard', authService);

    await vi.waitFor(() => expect(authService.restore).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();

    resolveRevalidation?.(null);
    expect(
      await screen.findByRole('heading', { name: /bem-vindo ao bemtevi/i }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});

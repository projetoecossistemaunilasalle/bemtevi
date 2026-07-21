import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthProvider } from '../../auth/AdminAuthProvider';
import type { AdminAccount, AdminAuthService } from '../../auth/adminAuth';
import { BottomNav } from '../BottomNav';
import { TopBar } from '../TopBar';

const admin: AdminAccount = { id: 'admin-id', email: 'admin@bemtevi.test' };

type TestAdminAuthService = AdminAuthService & { emit(account: AdminAccount | null): void };

function createAuthService(account: AdminAccount | null): TestAdminAuthService {
  let listener: ((account: AdminAccount | null) => void) | undefined;
  return {
    restore: vi.fn().mockResolvedValue(account),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((nextListener) => {
      listener = nextListener;
      return () => undefined;
    }),
    emit(nextAccount) {
      listener?.(nextAccount);
    },
  };
}

function renderNavigation(ui: React.ReactNode, account: AdminAccount | null = null) {
  const service = createAuthService(account);
  render(
    <MemoryRouter>
      <AdminAuthProvider service={service}>{ui}</AdminAuthProvider>
    </MemoryRouter>,
  );
  return service;
}

describe('app navigation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not show dashboard or admin controls to public users even when the feature is enabled', async () => {
    renderNavigation(<TopBar />);

    expect(await screen.findByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/admin@bemtevi.test/i)).not.toBeInTheDocument();
  });

  it('shows authorized admins a dashboard link and session controls in the top bar', async () => {
    renderNavigation(<TopBar />, admin);

    const desktopNav = await screen.findByRole('navigation', { name: /navegação principal/i });
    expect(within(desktopNav).getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(await screen.findByText('admin@bemtevi.test')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver site/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('keeps mobile bottom navigation public-only for admins', async () => {
    renderNavigation(<BottomNav />, admin);

    expect(await screen.findByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it('logs out and removes admin navigation immediately', async () => {
    const user = userEvent.setup();
    const service = renderNavigation(<TopBar />, admin);
    let rejectLogout: ((error: Error) => void) | undefined;
    vi.mocked(service.logout).mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectLogout = reject;
      }),
    );

    await user.click(await screen.findByRole('button', { name: /sair/i }));

    expect(service.logout).toHaveBeenCalledOnce();
    expect(screen.queryByText('admin@bemtevi.test')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();

    rejectLogout?.(new Error('network unavailable'));
    await Promise.resolve();
    service.emit(admin);

    await vi.waitFor(() => expect(service.logout).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('admin@bemtevi.test')).not.toBeInTheDocument();
  });
});

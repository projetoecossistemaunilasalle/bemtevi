import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../router';

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'false');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderRoute(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Router />
    </MemoryRouter>,
  );
}

describe('Router', () => {
  it('renders the home route', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: /bem-vindo ao secuida/i })).toBeInTheDocument();
  });

  it('renders the orientation route', () => {
    renderRoute('/orientacao');

    expect(screen.getByRole('heading', { name: /antes de começar/i })).toBeInTheDocument();
  });

  it('renders the support route', () => {
    renderRoute('/apoio');

    expect(screen.getByRole('heading', { name: /você não está sozinho/i })).toBeInTheDocument();
  });

  it('renders the contacts route', () => {
    renderRoute('/contatos');

    expect(screen.getByRole('heading', { name: /rede de apoio em canoas/i })).toBeInTheDocument();
  });

  it('renders the education route', () => {
    renderRoute('/educacao');

    expect(screen.getByRole('heading', { name: /biblioteca de educação/i })).toBeInTheDocument();
  });

  it('does not render the dashboard route by default', () => {
    renderRoute('/dashboard');

    expect(screen.queryByRole('heading', { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it('renders the dashboard route when the dev flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');

    renderRoute('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows dashboard navigation when the dev flag is enabled', () => {
    vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');

    renderRoute('/');

    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0);
  });
});

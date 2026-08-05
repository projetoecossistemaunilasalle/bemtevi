import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PageViewRepository } from '../pageViewRepository';
import { PageViewTracker } from '../PageViewTracker';

function createRepository(): PageViewRepository {
  return {
    recordPageView: vi.fn().mockResolvedValue(undefined),
    loadPageViewCounts: vi.fn().mockResolvedValue([]),
  };
}

function Harness({ repository }: { repository: PageViewRepository }) {
  const location = useLocation();
  return (
    <>
      <PageViewTracker repository={repository} enabled />
      <span>{location.pathname}</span>
      <Link to="/apoio?origem=inicio#telefones">Apoio</Link>
      <Link to="/educacao/material-identificavel">Material</Link>
      <Link to="/dashboard">Dashboard</Link>
    </>
  );
}

describe('PageViewTracker', () => {
  it('records one canonical page count on initial load, even in StrictMode', async () => {
    const repository = createRepository();

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/contatos?busca=caps#resultado']}>
          <Harness repository={repository} />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(repository.recordPageView).toHaveBeenCalledTimes(1));
    expect(repository.recordPageView).toHaveBeenCalledWith('/contatos');
  });

  it('tracks SPA navigation and removes the resource identifier', async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Harness repository={repository} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(repository.recordPageView).toHaveBeenCalledWith('/'));
    await user.click(screen.getByRole('link', { name: 'Apoio' }));
    await waitFor(() => expect(repository.recordPageView).toHaveBeenCalledWith('/apoio'));
    await user.click(screen.getByRole('link', { name: 'Material' }));
    await waitFor(() => expect(repository.recordPageView).toHaveBeenCalledWith('/educacao/:resourceId'));

    expect(repository.recordPageView).not.toHaveBeenCalledWith(expect.stringContaining('material-identificavel'));
  });

  it('ignores private and unknown paths', async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    render(
      <MemoryRouter initialEntries={['/rota-inexistente']}>
        <Harness repository={repository} />
      </MemoryRouter>,
    );

    await act(async () => undefined);
    expect(repository.recordPageView).not.toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(repository.recordPageView).not.toHaveBeenCalled();
  });

  it('never interrupts navigation when the aggregate increment fails', async () => {
    const repository = createRepository();
    vi.mocked(repository.recordPageView).mockRejectedValue(new Error('offline'));

    render(
      <MemoryRouter initialEntries={['/apoio']}>
        <Harness repository={repository} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('/apoio')).toBeInTheDocument();
    await waitFor(() => expect(repository.recordPageView).toHaveBeenCalledWith('/apoio'));
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PageViewRepositoryError,
  type PageViewCount,
  type PageViewRepository,
} from '../../../app/analytics/pageViewRepository';
import { AnalyticsDashboard } from '../AnalyticsDashboard';

function createRepository() {
  return {
    recordPageView: vi.fn(),
    loadPageViewCounts: vi.fn(),
  } satisfies PageViewRepository;
}

const rows = [
  { date: '2026-07-29', route: '/', count: 5 },
  { date: '2026-07-29', route: '/apoio', count: 2 },
  { date: '2026-07-30', route: '/', count: 3 },
  { date: '2026-07-30', route: '/educacao', count: 4 },
] satisfies PageViewCount[];

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the default 30-day period and summarizes aggregate page and daily counts', async () => {
    const repository = createRepository();
    repository.loadPageViewCounts.mockResolvedValue(rows);

    render(<AnalyticsDashboard repository={repository} />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando estatísticas');
    expect(repository.loadPageViewCounts).toHaveBeenCalledWith('2026-07-01');

    const summary = await screen.findByRole('region', { name: 'Resumo das estatísticas' });
    expect(within(summary).getByText('14')).toBeInTheDocument();
    expect(within(summary).getByText('14 visualizações no período')).toBeInTheDocument();
    expect(within(summary).getByText('Início')).toBeInTheDocument();
    expect(within(summary).getByText('8 visualizações')).toBeInTheDocument();

    const pageSection = screen.getByRole('heading', { name: 'Acessos por página' }).closest('section');
    expect(pageSection).not.toBeNull();
    expect(within(pageSection!).getByText('Biblioteca de educação')).toBeInTheDocument();
    expect(within(pageSection!).getByText('4 visualizações')).toBeInTheDocument();
    expect(within(pageSection!).getByText('Apoio imediato')).toBeInTheDocument();
    expect(within(pageSection!).getByText('2 visualizações')).toBeInTheDocument();

    const dailySection = screen.getByRole('heading', { name: 'Totais diários' }).closest('section');
    expect(dailySection).not.toBeNull();
    expect(within(dailySection!).getAllByText('7 visualizações')).toHaveLength(2);

    expect(screen.getByText('Somente dados agregados')).toBeInTheDocument();
    expect(
      screen.getByText(/não registram identidade, cookies de rastreamento, IDs de usuário ou sessão/i),
    ).toBeInTheDocument();
  });

  it('reloads data for 7- and 90-day filters and for manual refresh', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const repository = createRepository();
    repository.loadPageViewCounts.mockResolvedValue(rows);

    render(<AnalyticsDashboard repository={repository} />);
    await screen.findByRole('region', { name: 'Resumo das estatísticas' });

    await user.click(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() => expect(repository.loadPageViewCounts).toHaveBeenLastCalledWith('2026-07-24'));
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '90 dias' }));
    await waitFor(() => expect(repository.loadPageViewCounts).toHaveBeenLastCalledWith('2026-05-02'));
    expect(screen.getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'true');

    await screen.findByRole('region', { name: 'Resumo das estatísticas' });
    await user.click(screen.getByRole('button', { name: 'Atualizar estatísticas' }));
    await waitFor(() => expect(repository.loadPageViewCounts).toHaveBeenCalledTimes(4));
    expect(repository.loadPageViewCounts).toHaveBeenLastCalledWith('2026-05-02');
  });

  it('shows an accessible empty state when the period has no page views', async () => {
    const repository = createRepository();
    repository.loadPageViewCounts.mockResolvedValue([]);

    render(<AnalyticsDashboard repository={repository} />);

    expect(await screen.findByRole('heading', { name: 'Nenhum acesso neste período' })).toBeInTheDocument();
    expect(screen.getByText('Ainda não há visualizações agregadas para os últimos 30 dias.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acessos por página' })).not.toBeInTheDocument();
  });

  it('hides backend details in errors and recovers through refresh', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const repository = createRepository();
    repository.loadPageViewCounts
      .mockRejectedValueOnce(new PageViewRepositoryError('unavailable', 'secret endpoint and database details'))
      .mockResolvedValueOnce(rows);

    render(<AnalyticsDashboard repository={repository} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as estatísticas agora');
    expect(alert).not.toHaveTextContent('secret endpoint');

    await user.click(screen.getByRole('button', { name: 'Atualizar estatísticas' }));

    expect(await screen.findByRole('region', { name: 'Resumo das estatísticas' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import {
  defaultPageViewRepository,
  PageViewRepositoryError,
  type PageViewCount,
  type PageViewRepository,
} from '../../app/analytics/pageViewRepository';
import { Button } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';

const PERIOD_OPTIONS = [7, 30, 90] as const;
const numberFormatter = new Intl.NumberFormat('pt-BR');
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/orientacao': 'Orientação',
  '/apoio': 'Apoio imediato',
  '/contatos': 'Rede de apoio',
  '/educacao': 'Biblioteca de educação',
  '/educacao/:resourceId': 'Detalhe de material',
};

type PeriodDays = (typeof PERIOD_OPTIONS)[number];
type LoadState =
  | { status: 'loading'; rows: PageViewCount[] }
  | { status: 'ready'; rows: PageViewCount[] }
  | { status: 'error'; rows: PageViewCount[]; message: string };

interface PageTotal {
  route: PageViewCount['route'];
  count: number;
}

interface DailyTotal {
  date: string;
  count: number;
}

function startDateForPeriod(days: PeriodDays, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

function labelForRoute(route: PageViewCount['route']) {
  return routeLabels[route] ?? route;
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function formatViews(count: number) {
  const formatted = numberFormatter.format(count);
  return `${formatted} ${count === 1 ? 'visualização' : 'visualizações'}`;
}

function safeLoadError(error: unknown) {
  if (!(error instanceof PageViewRepositoryError)) {
    return 'Não foi possível carregar as estatísticas agora. Tente novamente em instantes.';
  }

  switch (error.code) {
    case 'not_configured':
      return 'A conexão com as estatísticas não está configurada.';
    case 'unauthorized':
      return 'Sua sessão não tem permissão para consultar estas estatísticas.';
    case 'invalid_data':
      return 'Os dados agregados recebidos não puderam ser lidos.';
    default:
      return 'Não foi possível carregar as estatísticas agora. Tente novamente em instantes.';
  }
}

function summarizeRows(rows: PageViewCount[]) {
  const pageCounts = new Map<PageViewCount['route'], number>();
  const dailyCounts = new Map<string, number>();

  rows.forEach((row) => {
    pageCounts.set(row.route, (pageCounts.get(row.route) ?? 0) + row.count);
    dailyCounts.set(row.date, (dailyCounts.get(row.date) ?? 0) + row.count);
  });

  const pages: PageTotal[] = Array.from(pageCounts, ([route, count]) => ({ route, count })).sort(
    (left, right) =>
      right.count - left.count || labelForRoute(left.route).localeCompare(labelForRoute(right.route), 'pt-BR'),
  );
  const days: DailyTotal[] = Array.from(dailyCounts, ([date, count]) => ({ date, count })).sort((left, right) =>
    right.date.localeCompare(left.date),
  );

  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    pages,
    days,
  };
}

export function AnalyticsDashboard({ repository = defaultPageViewRepository }: { repository?: PageViewRepository }) {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading', rows: [] });
  const startDate = startDateForPeriod(periodDays);

  useEffect(() => {
    let active = true;

    void repository
      .loadPageViewCounts(startDate)
      .then((rows) => {
        if (active) setState({ status: 'ready', rows });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ status: 'error', rows: current.rows, message: safeLoadError(error) }));
      });

    return () => {
      active = false;
    };
  }, [refreshSequence, repository, startDate]);

  const summary = useMemo(() => summarizeRows(state.rows), [state.rows]);
  const topPage = summary.pages[0] ?? null;

  function selectPeriod(days: PeriodDays) {
    if (days === periodDays) return;
    setState((current) => ({ status: 'loading', rows: current.rows }));
    setPeriodDays(days);
  }

  function refresh() {
    setState((current) => ({ status: 'loading', rows: current.rows }));
    setRefreshSequence((current) => current + 1);
  }

  return (
    <section className="flex flex-col gap-stack-md" aria-labelledby="analytics-dashboard-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="analytics-dashboard-title" className="font-headline-md text-on-surface">
            Estatísticas de acesso
          </h2>
          <p className="font-body-md text-on-surface-variant">
            Acompanhe quais páginas são mais acessadas sem identificar pessoas ou reconstruir trajetórias individuais.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={state.status === 'loading'}
          onClick={refresh}
          aria-label="Atualizar estatísticas"
        >
          <RefreshCw className={`h-4 w-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </Button>
      </header>

      <aside className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-fixed/25 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h3 className="font-headline-sm text-on-surface">Somente dados agregados</h3>
          <p className="font-body-md text-on-surface-variant">
            Estas estatísticas guardam apenas contagens por página e dia. Não registram identidade, cookies de
            rastreamento, IDs de usuário ou sessão, respostas, conversas, escola, localização ou histórico individual de
            navegação.
          </p>
        </div>
      </aside>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período das estatísticas">
          {PERIOD_OPTIONS.map((days) => {
            const selected = days === periodDays;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={selected}
                onClick={() => selectPeriod(days)}
                className={`min-h-10 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  selected
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {days} dias
              </button>
            );
          })}
        </div>
        <p className="font-label-sm text-on-surface-variant">
          Desde <time dateTime={startDate}>{formatDate(startDate)}</time>
        </p>
      </div>

      {state.status === 'loading' ? (
        <Card className="flex min-h-40 items-center justify-center p-6" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <span className="font-body-md">Carregando estatísticas...</span>
          </div>
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card className="border-error/30 bg-error-container/20 p-5" role="alert">
          <h3 className="font-headline-sm text-on-error-container">Estatísticas indisponíveis</h3>
          <p className="mt-1 font-body-md text-on-error-container">{state.message}</p>
        </Card>
      ) : null}

      {state.status === 'ready' && summary.total === 0 ? (
        <Card className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
          <BarChart3 className="h-8 w-8 text-secondary" aria-hidden="true" />
          <h3 className="font-headline-sm text-on-surface">Nenhum acesso neste período</h3>
          <p className="font-body-md text-on-surface-variant">
            Ainda não há visualizações agregadas para os últimos {periodDays} dias.
          </p>
        </Card>
      ) : null}

      {state.status === 'ready' && summary.total > 0 ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Resumo das estatísticas">
            <Card className="flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed/45 text-primary">
                <Eye className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-label-md text-on-surface-variant">Total de acessos</p>
                <p className="font-headline-lg text-on-surface">{numberFormatter.format(summary.total)}</p>
                <p className="font-label-sm text-on-surface-variant">{formatViews(summary.total)} no período</p>
              </div>
            </Card>

            <Card className="flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container/55 text-on-secondary-container">
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-label-md text-on-surface-variant">Página mais acessada</p>
                <p className="font-headline-sm text-on-surface">{topPage ? labelForRoute(topPage.route) : '—'}</p>
                <p className="font-label-sm text-on-surface-variant">
                  {topPage ? formatViews(topPage.count) : 'Sem acessos'}
                </p>
              </div>
            </Card>
          </section>

          <section
            className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5"
            aria-labelledby="page-view-totals-title"
          >
            <div>
              <h3 id="page-view-totals-title" className="font-headline-sm text-on-surface">
                Acessos por página
              </h3>
              <p className="mt-1 font-body-md text-on-surface-variant">
                Soma das visualizações de cada página no período selecionado.
              </p>
            </div>
            <BarList
              items={summary.pages.map((page) => ({
                id: page.route,
                label: labelForRoute(page.route),
                detail: page.route,
                count: page.count,
              }))}
            />
          </section>

          <section
            className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5"
            aria-labelledby="daily-view-totals-title"
          >
            <div>
              <h3 id="daily-view-totals-title" className="font-headline-sm text-on-surface">
                Totais diários
              </h3>
              <p className="mt-1 font-body-md text-on-surface-variant">
                Contagens combinadas de todas as páginas, sem horários ou eventos individuais.
              </p>
            </div>
            <BarList
              items={summary.days.map((day) => ({
                id: day.date,
                label: formatDate(day.date),
                detail: day.date,
                count: day.count,
              }))}
              useTime
            />
          </section>
        </>
      ) : null}
    </section>
  );
}

function BarList({
  items,
  useTime = false,
}: {
  items: Array<{ id: string; label: string; detail: string; count: number }>;
  useTime?: boolean;
}) {
  const largestCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => {
        const width = `${Math.max((item.count / largestCount) * 100, 3)}%`;
        return (
          <li
            key={item.id}
            className="grid gap-2 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.5fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-label-md text-on-surface">
                {useTime ? <time dateTime={item.detail}>{item.label}</time> : item.label}
              </p>
              {!useTime ? <p className="truncate font-label-sm text-on-surface-variant">{item.detail}</p> : null}
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width }} />
            </div>
            <span className="font-label-md tabular-nums text-on-surface">{formatViews(item.count)}</span>
          </li>
        );
      })}
    </ol>
  );
}

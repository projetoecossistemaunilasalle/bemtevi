import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CloudDownload, CloudUpload, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { isRecoverableDraftPayload, type ContentDraft } from '../draft-sync/contentDraft';
import { DraftSyncClient, DraftSyncError, draftSyncDefaults, pairDraftSync } from '../draft-sync/draftSyncClient';

interface McpDraftSectionProps {
  candidate: PublishedContentPayload;
  activeDraft: ContentDraft | null;
  activeDraftId?: string;
  activeDraftGeneration?: number;
  onOpen(draft: ContentDraft): void;
  onAttach?(draft: ContentDraft): void;
  onSynced(draft: ContentDraft): void;
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'syncing' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string; conflict?: boolean };

function readUrl() {
  try {
    return localStorage.getItem(draftSyncDefaults.urlStorageKey) || draftSyncDefaults.url;
  } catch {
    return draftSyncDefaults.url;
  }
}

function readToken() {
  try {
    return sessionStorage.getItem(draftSyncDefaults.tokenStorageKey) || '';
  } catch {
    return '';
  }
}

function describeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'data desconhecida'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function McpDraftSection({
  candidate,
  activeDraft,
  activeDraftId,
  activeDraftGeneration,
  onOpen,
  onAttach,
  onSynced,
}: McpDraftSectionProps) {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [loaded, setLoaded] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [token, setToken] = useState(readToken);
  const client = useMemo(() => new DraftSyncClient(readUrl(), { token }), [token]);

  async function refresh() {
    setStatus({ kind: 'loading' });
    try {
      if (!token) {
        setLoaded(true);
        setStatus({ kind: 'idle' });
        return;
      }
      const nextDrafts = draftId.trim()
        ? [await client.getDraft(draftId.trim())]
        : (await client.listDrafts({ limit: 100 })).drafts;
      setDrafts(nextDrafts);
      const attached = nextDrafts.find((draft) => draft.draftId === activeDraftId);
      if (attached) {
        const checkpoint =
          activeDraftGeneration !== undefined && attached.generation !== activeDraftGeneration
            ? await client.getDraft(attached.draftId, activeDraftGeneration)
            : attached;
        onAttach?.(checkpoint);
      }
      setLoaded(true);
      setStatus({ kind: 'idle' });
    } catch (error) {
      setLoaded(true);
      setStatus({
        kind: 'error',
        message:
          error instanceof DraftSyncError ? error.message : 'Não foi possível consultar os rascunhos do assistente.',
      });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    // The local service is not a source of realtime events. Refresh is explicit.
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pair() {
    setStatus({ kind: 'loading' });
    try {
      const nextToken = await pairDraftSync(readUrl(), pairCode);
      sessionStorage.setItem(draftSyncDefaults.tokenStorageKey, nextToken);
      setToken(nextToken);
      setPairCode('');
      setLoaded(false);
      setStatus({ kind: 'success', message: 'API local pareada. Atualize a lista para abrir um rascunho.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof DraftSyncError ? error.message : 'Não foi possível parear a API local.',
      });
    }
  }

  function disconnect() {
    sessionStorage.removeItem(draftSyncDefaults.tokenStorageKey);
    setToken('');
    setDrafts([]);
    setLoaded(false);
    setStatus({ kind: 'idle' });
  }

  async function sync() {
    if (!activeDraft) return;
    setStatus({ kind: 'syncing' });
    try {
      const next = await client.updateDraft({
        draftId: activeDraft.draftId,
        expectedGeneration: activeDraft.generation,
        candidate,
        idempotencyKey: crypto.randomUUID(),
      });
      onSynced(next);
      setDrafts((current) => [next, ...current.filter((item) => item.draftId !== next.draftId)]);
      setStatus({ kind: 'success', message: `Geração ${next.generation} sincronizada com o assistente.` });
    } catch (error) {
      const syncError = error instanceof DraftSyncError ? error : undefined;
      setStatus({
        kind: 'error',
        conflict: syncError?.code === 'stale_generation' || syncError?.code === 'revision_conflict',
        message: syncError?.message ?? 'Não foi possível sincronizar o rascunho do assistente.',
      });
    }
  }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-secondary/35 bg-secondary-container/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-headline-sm text-on-surface">Rascunhos do assistente</h2>
            <p className="mt-1 max-w-3xl font-body-md text-on-surface-variant">
              O MCP cria rascunhos no computador. Abra uma geração aqui para revisar no painel; nenhuma alteração remota
              é feita sem uma ação explícita.
            </p>
          </div>
        </div>
        {token && (
          <Button
            variant="secondary"
            size="sm"
            onClick={disconnect}
            disabled={status.kind === 'loading' || status.kind === 'syncing'}
          >
            Desconectar API
          </Button>
        )}
      </div>

      {!token && (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <p className="font-body-sm text-on-surface-variant">
            Inicie <code className="font-mono">pnpm content-agent:sync</code>, informe o código exibido no terminal e
            pareie esta aba.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex max-w-xs flex-1 flex-col gap-1.5 font-label-md text-on-surface">
              Código de pareamento
              <input
                value={pairCode}
                onChange={(event) => setPairCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="min-h-11 rounded-md border border-outline-variant bg-surface px-3 font-mono tracking-[0.25em] text-on-surface"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            <Button onClick={() => void pair()} disabled={pairCode.length !== 6 || status.kind === 'loading'}>
              Parear API local
            </Button>
          </div>
        </div>
      )}

      {token && (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 font-label-md text-on-surface">
            ID do rascunho (opcional)
            <input
              aria-label="ID do rascunho"
              value={draftId}
              onChange={(event) => setDraftId(event.target.value)}
              className="min-h-11 rounded-md border border-outline-variant bg-surface px-3 font-mono text-sm text-on-surface"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <Button onClick={() => void refresh()} disabled={status.kind === 'loading' || status.kind === 'syncing'}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {draftId.trim() ? 'Carregar rascunho' : 'Atualizar lista'}
          </Button>
        </div>
      )}

      {activeDraft && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary-container/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-label-lg font-semibold text-on-surface">Rascunho aberto</h3>
              <p className="mt-1 font-body-sm text-on-surface-variant">
                <code className="font-mono">{activeDraft.draftId}</code> · geração {activeDraft.generation} · atualizado
                em {describeDate(activeDraft.updatedAt)}
              </p>
            </div>
            <Button onClick={() => void sync()} disabled={status.kind === 'syncing'}>
              <CloudUpload aria-hidden="true" className="h-4 w-4" />
              {status.kind === 'syncing' ? 'Sincronizando…' : 'Sincronizar alterações'}
            </Button>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            A sincronização usa a geração esperada. Se outra sessão editar este rascunho, o painel preserva sua cópia e
            pede revisão do conflito.
          </p>
        </div>
      )}

      {!loaded && status.kind === 'loading' && (
        <p className="font-body-sm text-on-surface-variant">Consultando rascunhos locais…</p>
      )}
      {loaded && token && drafts.length === 0 && status.kind !== 'error' && (
        <p className="rounded-md bg-surface-container-low p-3 font-body-sm text-on-surface-variant">
          Nenhum rascunho do assistente foi encontrado. Crie um pelo MCP e clique em “Atualizar lista”.
        </p>
      )}
      {drafts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {drafts.map((draft) => (
            <article
              key={draft.draftId}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate font-label-lg font-semibold text-on-surface">{draft.draftId}</h3>
                <p className="mt-1 font-body-sm text-on-surface-variant">
                  Geração {draft.generation} · base {draft.base.revision ?? 'inicial'} · {describeDate(draft.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 font-label-sm ${draft.validation.valid ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'}`}
                >
                  {draft.validation.valid ? 'Validação aprovada' : `${draft.validation.issues.length} problema(s)`}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpen(draft)}
                  disabled={
                    !isRecoverableDraftPayload(draft.candidate) ||
                    (activeDraft?.draftId === draft.draftId && activeDraft.generation === draft.generation)
                  }
                >
                  <CloudDownload aria-hidden="true" className="h-4 w-4" />
                  Abrir geração
                </Button>
              </div>
              {!isRecoverableDraftPayload(draft.candidate) && (
                <p className="font-body-sm text-on-error-container">
                  Esta geração foi preservada, mas sua estrutura não pode ser aberta no editor. Corrija-a pelo
                  assistente antes de importar.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {status.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/35 p-4 text-on-error-container"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-label-md font-semibold">Não foi possível concluir a sincronização</p>
            <p className="mt-1 font-body-sm">{status.message}</p>
            {status.conflict && (
              <p className="mt-2 font-body-sm">
                Sua edição continua no painel. Atualize a lista e compare as gerações antes de tentar sincronizar
                novamente.
              </p>
            )}
          </div>
        </div>
      )}
      {status.kind === 'success' && (
        <p role="status" className="rounded-md bg-primary-container/20 p-3 font-body-sm text-on-primary-container">
          {status.message}
        </p>
      )}
    </section>
  );
}

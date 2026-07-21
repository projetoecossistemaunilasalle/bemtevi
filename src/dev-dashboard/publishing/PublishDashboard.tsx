import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import { PublishedContentRepositoryError } from '../../app/content/publishedContentRepository';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { computeChangeSummary, type RecordChangeCount } from './changeSummary';

import { ConfirmButton } from '../components/ConfirmButton';

interface PublishDashboardProps {
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  expectedRevision?: number | null;
  onPublished(snapshot: PublishedContentSnapshot): void;
  onResetDrafts(): void;
}

type PublishState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'pending' }
  | { kind: 'success'; publishedAt: string; revision: number }
  | { kind: 'error'; message: string };

function messageForPublishError(error: unknown) {
  if (!(error instanceof PublishedContentRepositoryError)) {
    return 'Não foi possível publicar agora. Tente novamente.';
  }
  switch (error.code) {
    case 'conflict':
      return 'Outra publicação foi salva antes desta. Recarregue o conteúdo publicado antes de tentar novamente.';
    case 'unauthorized':
      return 'Entre com uma conta administrativa real para publicar.';
    case 'not_configured':
      return 'A conexão pública com o Neon não está configurada.';
    case 'invalid_payload':
      return 'Revise o conteúdo e confirme que o total não excede 5 MiB.';
    default:
      return 'Não foi possível publicar agora. Tente novamente.';
  }
}

export function PublishDashboard({
  baseline,
  draft,
  validation,
  draftUpdatedAt,
  expectedRevision,
  onPublished,
  onResetDrafts,
}: PublishDashboardProps) {
  const { snapshot, publish } = usePublishedContent();
  const { account } = useAdminAuth();
  const [state, setState] = useState<PublishState>({ kind: 'idle' });

  const summary = useMemo(() => computeChangeSummary(baseline, draft), [baseline, draft]);
  const currentRevision = snapshot?.revision ?? 0;
  const hasErrors = validation.errors.length > 0;
  const hasChanges = summary.total > 0;
  const publishDisabled = hasErrors || !hasChanges;
  const isPending = state.kind === 'pending';

  async function confirmPublication() {
    if (isPending) return;

    if (!account) {
      setState({ kind: 'error', message: 'Entre com uma conta administrativa real para publicar.' });
      return;
    }

    setState({ kind: 'pending' });
    try {
      const publicationRevision = expectedRevision === undefined ? (snapshot?.revision ?? null) : expectedRevision;
      const next = await publish(draft, account.id, publicationRevision);
      setState({ kind: 'success', publishedAt: next.publishedAt, revision: next.revision });
      onPublished(next);
    } catch (error) {
      setState({ kind: 'error', message: messageForPublishError(error) });
    }
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <section className="flex flex-col gap-stack-md rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <div>
          <h2 className="font-headline-sm text-on-surface">Publicar conteúdo</h2>
          <p className="mt-2 font-body-md text-on-surface-variant">
            Publica as alterações no banco de dados público para todas as pessoas.
          </p>
          <p className="font-body-md text-on-surface-variant">Revisão atual: {currentRevision}</p>
        </div>

        {!hasChanges ? (
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="font-body-md text-on-surface-variant">
              Nada para publicar — todas as alterações coincidem com o conteúdo publicado.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChangeStat label="Fluxos" counts={summary.flows} />
              <ChangeStat label="Materiais" counts={summary.materials} />
              <ChangeStat label="Grupos" counts={summary.groups} />
              <ChangeStat label="Contatos" counts={summary.contacts} />
            </div>
            {summary.defaultGroupOrderChanged ? (
              <p className="mt-3 font-label-sm text-on-surface-variant">A ordem padrão dos grupos foi alterada.</p>
            ) : null}
          </div>
        )}

        {state.kind === 'error' ? (
          <p role="alert" className="font-body-md text-error">
            {state.message}
          </p>
        ) : null}

        {state.kind === 'success' ? (
          <p className="flex items-center gap-1.5 font-label-md text-on-surface-variant">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
            Publicado na revisão {state.revision}.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {state.kind === 'confirming' ? (
            <>
              <Button onClick={confirmPublication}>Confirmar publicação</Button>
              <Button variant="secondary" onClick={() => setState({ kind: 'idle' })}>
                Cancelar
              </Button>
            </>
          ) : isPending ? (
            <Button disabled>Publicando…</Button>
          ) : (
            <Button disabled={publishDisabled} onClick={() => setState({ kind: 'confirming' })}>
              Publicar alterações
            </Button>
          )}
          {draftUpdatedAt ? (
            <span className="font-label-sm text-on-surface-variant">Rascunho salvo neste navegador.</span>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error-container/10 p-5">
        <div>
          <h3 className="font-headline-sm text-error">Descartar rascunho local</h3>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Esta ação descarta apenas o rascunho local deste navegador (edições, adições e remoções pendentes em fluxos,
            materiais, grupos e contatos) e restaura tudo de volta ao conteúdo atualmente publicado. O conteúdo já
            publicado não será alterado ou apagado.
          </p>
        </div>
        <div>
          <ConfirmButton
            prompt="Limpar TODAS as alterações"
            confirmLabel="Confirmar e limpar tudo"
            cancelLabel="Cancelar"
            disabled={!hasChanges}
            onConfirm={onResetDrafts}
          />
        </div>
      </section>
    </div>
  );
}

function ChangeStat({ label, counts }: { label: string; counts: RecordChangeCount }) {
  const total = counts.added + counts.edited + counts.removed;
  if (total === 0) return <p className="font-label-md text-on-surface-variant">{label}: 0</p>;

  const parts: string[] = [];
  if (counts.added > 0) parts.push(`${counts.added} adicionado${counts.added === 1 ? '' : 's'}`);
  if (counts.edited > 0) parts.push(`${counts.edited} editado${counts.edited === 1 ? '' : 's'}`);
  if (counts.removed > 0) parts.push(`${counts.removed} removido${counts.removed === 1 ? '' : 's'}`);

  return (
    <div>
      <p className="font-label-sm text-on-surface-variant">{label}</p>
      <p className="font-label-md text-on-surface">{parts.join(', ')}</p>
    </div>
  );
}

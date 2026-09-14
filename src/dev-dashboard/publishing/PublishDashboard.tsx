import { useMemo, useState } from 'react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import { getPublishedPayloadSize, MAX_PUBLISHED_PAYLOAD_BYTES } from '../../app/content/publishedContent';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { PublishedContentRepositoryError } from '../../app/content/publishedContentRepository';
import type { DashboardValidationArea, DashboardValidationResult } from '../validation/validationTypes';
import { BlockingValidationNotice } from '../components/BlockingValidationNotice';
import { ConfirmButton } from '../components/ConfirmButton';
import { ContentComparison } from './ContentComparison';
import {
  compareContent,
  describePath,
  reconcileContent,
  type ConflictDecisions,
  type SemanticConflict,
  type ValueSlot,
} from './semanticDiff';
import type { PublicationPreview, PublicationPhase } from './usePublicationController';
import type { useLegacyDraftWorkspace } from '../draft-storage/useDraftWorkspace';

/**
 * Publication review surface (doc 06/16, INTEGRATION-02). Two coexisting
 * modes, selected exclusively by the route's editor flag: `legacy` keeps the
 * pre-V2 reconcile/review workflow and publishes through the caller-supplied
 * `legacyPublish` function backed by the temporary `legacyPublication.ts`
 * direct-table adapter; `v2` renders the guarded prepare/publish protocol of
 * `usePublicationController` (flush first, exact canonical snapshot, diff
 * versus live, explicit `Publicar`, replay-once, post-publish refreshes).
 * The component never talks to the database directly.
 */

interface PublishDashboardLegacyProps {
  mode: 'legacy';
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  expectedRevision?: number | null;
  basePayload?: PublishedContentPayload;
  workspaceStore?: ReturnType<typeof useLegacyDraftWorkspace>;
  /** Reads the latest published snapshot for the merge comparison. */
  refreshLatest?(): Promise<PublishedContentSnapshot | null>;
  /**
   * Publishes through the temporary `legacyPublication.ts` direct-table
   * adapter — reachable ONLY from the `v2Enabled=false` dashboard branch.
   */
  // prettier-ignore
  legacyPublish(payload: PublishedContentPayload, publisherId: string, expectedRevision: number | null): Promise<PublishedContentSnapshot>;
  onPublished(snapshot: PublishedContentSnapshot): void;
  onResetDrafts(): void;
  onDownloadBackup?(): void;
  onRestoreBackup?(): void;
  onOpenValidationArea?(area: DashboardValidationArea): void;
}

interface PublishDashboardV2Props {
  mode: 'v2';
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  phase: PublicationPhase;
  message: string | null;
  preview: PublicationPreview | null;
  busy: boolean;
  disabled: boolean;
  readOnly: boolean;
  onOpenReview(): void;
  onPublish(): void;
  onCloseReview(): void;
}

export type PublishDashboardProps = PublishDashboardLegacyProps | PublishDashboardV2Props;

export function PublishDashboard(props: PublishDashboardProps) {
  if (props.mode === 'v2') return <V2Publish {...props} />;
  return <LegacyPublish {...props} />;
}

function payloadExceeded(draft: PublishedContentPayload): boolean {
  try {
    return getPublishedPayloadSize(draft) > MAX_PUBLISHED_PAYLOAD_BYTES;
  } catch {
    return true;
  }
}

// prettier-ignore
function V2Publish({ baseline, draft, validation, phase, message, preview, busy, disabled, readOnly, onOpenReview, onPublish, onCloseReview }: PublishDashboardV2Props) {
  const liveDiff = useMemo(() => compareContent(baseline, draft), [baseline, draft]);
  const exceeded = payloadExceeded(draft);
  return (
    <div className="flex flex-col gap-stack-md text-on-surface">
      <section className="flex flex-col gap-5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h2 className="font-headline-sm">Publicar conteúdo</h2>
        {/* prettier-ignore */}
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">Revise as alterações salvas no BemTeVi e confirme a publicação. A confirmação compara o rascunho exato com a versão publicada; qualquer mudança recente encerra a revisão e exige uma nova conferência.</p>
        {/* prettier-ignore */}
        {readOnly && (
          <p role="status" className="max-w-[75ch] font-body-md text-on-surface-variant">
            A edição e a publicação estão temporariamente desativadas neste painel. As leituras, a comparação e o
            download de recuperação continuam disponíveis.
          </p>
        )}
        <BlockingValidationNotice validation={validation} actionLabel="publicar" />
        {/* prettier-ignore */}
        {exceeded && (
          <p role="alert">
            Limite de tamanho do conteúdo excedido ou conteúdo não serializável. Reduza o conteúdo para até 5 MiB.
          </p>
        )}
        {message && <p role={phase === 'error' ? 'alert' : 'status'}>{message}</p>}
        {liveDiff.ok && <ContentComparison changes={liveDiff.value} title="Alterações do seu rascunho" />}
        {!preview && liveDiff.ok && liveDiff.value.length === 0 && (
          <p>Nada para publicar: todas as alterações coincidem com a versão publicada.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || disabled || readOnly} onClick={onOpenReview}>
            {busy ? 'Aguarde…' : 'Publicar alterações'}
          </Button>
        </div>
        {/* prettier-ignore */}
        {preview && (
          <section className="flex flex-col gap-4">
            <h3 className="font-headline-sm">Revisão final antes de publicar</h3>
            {/* prettier-ignore */}
            <p className="max-w-[75ch] font-body-md text-on-surface-variant">Geração do rascunho: {preview.draft.generation} · Revisão publicada em comparação: {preview.liveRevision}. Nenhuma publicação acontece sem a sua confirmação.</p>
            <Button variant="secondary" disabled={busy} onClick={onCloseReview}>
              Encerrar revisão
            </Button>
            <Button disabled={busy || readOnly} onClick={onPublish}>
              {phase === 'publishing' ? 'Publicando…' : 'Publicar'}
            </Button>
          </section>
        )}
        {phase === 'success' && <p role="status">O conteúdo está publicado.</p>}
      </section>
    </div>
  );
}

// prettier-ignore
function LegacyPublish({ baseline, draft, validation, expectedRevision, basePayload, workspaceStore: store, refreshLatest, legacyPublish, onPublished, onResetDrafts, onDownloadBackup, onRestoreBackup, onOpenValidationArea }: PublishDashboardLegacyProps) {
  const { account: authAccount } = useAdminAuth();
  const { snapshot: contextSnapshot, refreshLatest: contextRefreshLatest } = usePublishedContent();
  const base = basePayload ?? baseline;
  const localDiff = useMemo(() => compareContent(base, draft), [base, draft]);
  // prettier-ignore
  interface LegacySession { remote: { revision: number | null; payload: PublishedContentPayload }; decisions: ConflictDecisions; candidateOverride?: PublishedContentPayload; reviewed?: boolean; local: PublishedContentPayload; base: PublishedContentPayload; }
  const [session, setSession] = useState<LegacySession | null>(null);
  const [limit, setLimit] = useState(50);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // prettier-ignore
  const allConflicts = session ? reconcileContent(session.base, session.local, session.remote.payload) : null;
  // prettier-ignore
  const merge = session ? reconcileContent(session.base, session.local, session.remote.payload, session.decisions) : null;
  // prettier-ignore
  const candidate = merge?.ok && merge.value.kind === 'complete' ? (session?.candidateOverride ?? merge.value.candidate) : null;
  const diff = candidate && session ? compareContent(session.remote.payload, candidate) : null;
  const remoteDiff = session ? compareContent(session.base, session.remote.payload) : null;
  // prettier-ignore
  const conflicts = allConflicts?.ok ? allConflicts.value.conflicts.filter((entry) => !pendingOnly || !session?.decisions[entry.id]) : [];
  const isBusy = busy;
  // prettier-ignore
  const comparisonFailed = !localDiff.ok || (merge !== null && !merge.ok) || (diff !== null && !diff.ok) || (remoteDiff !== null && !remoteDiff.ok);
  const exceeded = payloadExceeded(draft);
  // prettier-ignore
  async function decide(id: string, choice?: ValueSlot) {
    if (!session) return;
    const decisions = { ...session.decisions };
    if (choice) decisions[id] = choice; else delete decisions[id];
    setSession({ ...session, decisions, candidateOverride: undefined, reviewed: false });
  }
  function review() {
    if (session) setSession({ ...session, reviewed: true });
  }
  return (
    <div className="flex flex-col gap-stack-md text-on-surface">
      <section className="flex flex-col gap-5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h2 className="font-headline-sm">Publicar conteúdo</h2>
        {/* prettier-ignore */}
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">Revise suas alterações, resolva diferenças com a versão publicada e confirme o resultado. Atualizar a publicação não substitui seu rascunho.</p>
        <p className="font-body-md">
          Base do rascunho: {expectedRevision ?? 'sem publicação'}
          {session ? ` · Revisão publicada em comparação: ${session.remote.revision ?? 'inicial'}` : ''}
        </p>
        <BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={onOpenValidationArea} />
        {/* prettier-ignore */}
        {exceeded && (
          <p role="alert">
            Limite de tamanho do conteúdo excedido ou conteúdo não serializável. Reduza o conteúdo para até 5 MiB.
          </p>
        )}
        {/* prettier-ignore */}
        {comparisonFailed && (
          <p role="alert">
            Não foi possível comparar as alterações. Seu rascunho não foi descartado. Corrija IDs duplicados ou dados
            inválidos no editor e tente novamente.
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        {success && <p role="status">O conteúdo está publicado.</p>}
        {localDiff.ok && <ContentComparison changes={localDiff.value} title="Alterações do seu rascunho" />}
        {!session && localDiff.ok && localDiff.value.length === 0 && (
          <p>Nada para publicar: todas as alterações coincidem com a base do rascunho.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {/* prettier-ignore */}
          <Button disabled={isBusy || exceeded || validation.errors.length > 0 || comparisonFailed || !localDiff.ok || localDiff.value.length === 0 || store?.status === 'loading'}
            onClick={() => void runPrepare()}>
            {isBusy ? 'Aguarde…' : session ? 'Atualizar versão publicada e comparar' : 'Publicar alterações'}
          </Button>
        </div>
        {session && remoteDiff?.ok && <ContentComparison changes={remoteDiff.value} title="Alterações já publicadas" />}
        {session && allConflicts?.ok && allConflicts.value.conflicts.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="font-headline-sm">Resolver alterações simultâneas</h3>
            {/* prettier-ignore */}
            <p role="status">{merge?.ok ? merge.value.conflicts.length : 'Comparação indisponível'} conflitos pendentes</p>
            {/* prettier-ignore */}
            <label className="font-body-md">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => { setPendingOnly(e.target.checked); setLimit(50); }} />{' '}
              Mostrar apenas pendentes
            </label>
            {/* prettier-ignore */}
            {conflicts.slice(0, limit).map((conflict) => (
              <ConflictEditor
                key={conflict.id}
                conflict={conflict}
                decision={session.decisions[conflict.id]}
                disabled={isBusy}
                onDecide={(choice) => void decide(conflict.id, choice)}
              />
            ))}
            {/* prettier-ignore */}
            {conflicts.length > limit && (
              <Button variant="secondary" onClick={() => setLimit(limit + 50)}>
                Carregar mais conflitos
              </Button>
            )}
          </section>
        )}
        {candidate && diff?.ok && (
          <section className="flex flex-col gap-4">
            <h3 className="font-headline-sm">Revisão final</h3>
            {/* prettier-ignore */}
            <p className="max-w-[75ch] font-body-md">Este é o resultado combinado em relação à versão publicada. Nenhuma combinação automática é enviada sem esta revisão.</p>
            <ContentComparison changes={diff.value} title="Resultado a publicar" />
            {/* prettier-ignore */}
            {session?.reviewed ? (
              <Button disabled={isBusy || authAccount === null} onClick={() => void runConfirm()}>
                Confirmar publicação
              </Button>
            ) : (
              <Button disabled={isBusy || !diff.ok || diff.value.length === 0} onClick={() => review()}>
                Confirmar revisão do resultado
              </Button>
            )}
          </section>
        )}
      </section>
      {/* prettier-ignore */}
      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h3 className="font-headline-sm">Cópia de segurança do rascunho</h3>
        <div className="flex flex-wrap gap-3">
          {onDownloadBackup && <Button variant="secondary" onClick={onDownloadBackup}>Baixar cópia de segurança (.json)</Button>}
          {onRestoreBackup && <Button variant="secondary" disabled={isBusy} onClick={onRestoreBackup}>Restaurar rascunho de arquivo (.json)</Button>}
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 p-5">
        <h3 className="font-headline-sm">Arquivar rascunho local</h3>
        {/* prettier-ignore */}
        <p className="max-w-[75ch] font-body-md">Preserva uma cópia para retomar depois e volta ao conteúdo publicado. Não altera a publicação.</p>
        <ConfirmButton
          prompt="Arquivar rascunho"
          confirmLabel="Confirmar arquivamento"
          disabled={isBusy || (localDiff.ok && localDiff.value.length === 0)}
          onConfirm={onResetDrafts}
        />
      </section>
    </div>
  );
  async function runPrepare() {
    if (isBusy) return;
    setBusy(true);
    setSuccess(false);
    setMessage(null);
    try {
      // Mirrors the pre-V2 controller: prefer an explicit refresh, then the
      // provider's latest snapshot, then the currently loaded snapshot.
      // prettier-ignore
      const remote = refreshLatest ? await refreshLatest() : ((await contextRefreshLatest?.()) ?? contextSnapshot);
      // prettier-ignore
      const next = { base: candidate && session ? session.remote.payload : (session?.base ?? base), local: candidate ?? session?.local ?? draft,
        remote: { revision: remote?.revision ?? null, payload: remote?.payload ?? base }, decisions: candidate ? {} : (session?.decisions ?? {}), reviewed: false };
      const result = reconcileContent(next.base, next.local, next.remote.payload, next.decisions);
      if (!result.ok) throw new Error('diff');
      setSession(next);
    } catch {
      // prettier-ignore
      setMessage('Não foi possível comparar as alterações. Seu rascunho não foi descartado. Tente comparar novamente ou baixe uma cópia.');
    } finally {
      setBusy(false);
    }
  }
  async function runConfirm() {
    if (isBusy || !session || !candidate) return;
    const account = authAccount;
    if (!account) return setMessage('Confirme o login administrativo antes de publicar.');
    setBusy(true);
    setMessage(null);
    try {
      const snapshot = await legacyPublish(candidate, account.id, session.remote.revision);
      setSession(null);
      setSuccess(true);
      // Pre-V2 semantics: archive the local generation after a confirmed
      // publication (the workspace copy is preserved for retomar).
      if (store && !(await store.archive())) {
        // prettier-ignore
        setMessage('O conteúdo foi publicado, mas não foi possível arquivar esta geração. A cópia local foi preservada.');
      }
      onPublished(snapshot);
    } catch (error) {
      // Pre-V2 semantics: a revision conflict re-opens the review against the
      // new publication instead of silently retrying.
      if (error instanceof PublishedContentRepositoryError && error.code === 'conflict') {
        // prettier-ignore
        const remote = refreshLatest ? await refreshLatest().catch(() => null) : ((await contextRefreshLatest?.().catch(() => null)) ?? null);
        if (remote) {
          // prettier-ignore
          setSession({ base: session.remote.payload, local: candidate, remote: { revision: remote.revision, payload: remote.payload }, decisions: {}, reviewed: false });
          // prettier-ignore
          setMessage('Há uma nova publicação. As escolhas anteriores foram preservadas no resultado local. Revise este novo conjunto antes de publicar.');
        } else {
          setMessage('Não foi possível carregar a nova publicação. A tentativa e o rascunho foram preservados.');
        }
      } else {
        // prettier-ignore
        setMessage('Não foi possível confirmar o resultado do envio. Consulte a publicação antes de tentar novamente. O rascunho e a tentativa foram preservados.');
      }
    } finally {
      setBusy(false);
    }
  }
}

// prettier-ignore
function ConflictEditor({ conflict, decision, disabled, onDecide }: { conflict: SemanticConflict; decision?: ValueSlot; disabled: boolean; onDecide(choice?: ValueSlot): void }) {
  const [text, setText] = useState('');
  // prettier-ignore
  return <section data-conflict-pending={!decision} className="flex min-w-0 flex-col gap-3 border-b border-outline-variant py-4">
      <h4 className="break-words font-label-md [overflow-wrap:anywhere]">
        {describePath(conflict.path)} · {decision ? 'Resolvido' : 'Pendente'}
      </h4>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SlotCard label="Sua versão" slot={conflict.local} />
        <SlotCard label="Versão publicada" slot={conflict.remote} />
        <SlotCard label="Resultado" slot={decision ?? conflict.local} />
      </div>
      {/* prettier-ignore */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={disabled} onClick={() => onDecide(conflict.local)}>Usar minha alteração</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onDecide(conflict.remote)}>Usar alteração publicada</Button>
        {decision && <Button variant="secondary" disabled={disabled} onClick={() => onDecide()}>Desfazer escolha</Button>}
      </div>
      {/* prettier-ignore */}
      <details>
        <summary className="cursor-pointer font-label-md">Editar resultado manualmente</summary>
        <textarea className="mt-2 block min-h-40 w-full rounded-md border border-outline-variant bg-surface p-3 font-body-md" value={text} onChange={(e) => setText(e.target.value)} />
        {/* prettier-ignore */}
        <Button className="mt-2" disabled={disabled}
          onClick={() => { try { onDecide({ present: true, value: JSON.parse(text) }); } catch { /* Invalid JSON keeps the pending decision untouched. */ } }}>
          Aplicar resultado manual
        </Button>
      </details>
    </section>;
}

// prettier-ignore
function SlotCard({ label, slot }: { label: string; slot: ValueSlot }) {
  return (
    <div className="min-w-0">
      <h4 className="font-label-md">{label}</h4>
      <pre className="mt-1 whitespace-pre-wrap break-words font-body-sm [overflow-wrap:anywhere]">{slot.present ? JSON.stringify(slot.value, null, 2) : 'Ausente (removido)'}</pre>
    </div>
  );
}

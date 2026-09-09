import { useMemo, useState } from 'react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import { getPublishedPayloadSize, MAX_PUBLISHED_PAYLOAD_BYTES } from '../../app/content/publishedContent';
import type { DashboardValidationArea, DashboardValidationResult } from '../validation/validationTypes';
import type { DashboardTab } from '../components/DashboardShell';
import { ConfirmButton } from '../components/ConfirmButton';
import { BlockingValidationNotice } from '../components/BlockingValidationNotice';
import { ContentComparison, SlotPreview } from './ContentComparison';
import { compareContent, describePath, reconcileContent, type SemanticConflict, type ValueSlot } from './semanticDiff';
import { usePublicationController, type WorkspaceStore } from './usePublicationController';

interface PublishDashboardProps {
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  expectedRevision?: number | null;
  basePayload?: PublishedContentPayload;
  workspaceStore?: WorkspaceStore;
  onMergeConflict?(snapshot: PublishedContentSnapshot): void;
  onPublished(snapshot: PublishedContentSnapshot): void;
  onResetDrafts(): void;
  onDownloadBackup?(): void;
  onRestoreBackup?(): void;
  onOpenValidationArea?(area: DashboardValidationArea): void;
  onNavigate?(tab: DashboardTab, id?: string, path?: string): void;
}

export function PublishDashboard({
  baseline,
  draft,
  validation,
  expectedRevision,
  basePayload,
  workspaceStore,
  onPublished,
  onResetDrafts,
  onDownloadBackup,
  onRestoreBackup,
  onOpenValidationArea,
  onNavigate,
}: PublishDashboardProps) {
  const base = basePayload ?? baseline;
  const localDiff = useMemo(() => compareContent(base, draft), [base, draft]);
  const controller = usePublicationController({
    base,
    local: draft,
    expectedRevision: expectedRevision ?? null,
    store: workspaceStore,
    onPublished,
  });
  const { session, merge, candidate, diff } = controller;
  const allConflicts = session ? reconcileContent(session.base, session.local, session.remote.payload) : null;
  const remoteDiff = session ? compareContent(session.base, session.remote.payload) : null;
  const [limit, setLimit] = useState(50);
  const [pendingOnly, setPendingOnly] = useState(false);
  const conflicts = allConflicts?.ok
    ? allConflicts.value.conflicts.filter((entry) => !pendingOnly || !session?.decisions[entry.id])
    : [];
  const isBusy = controller.phase === 'comparing' || controller.phase === 'publishing';
  const comparisonFailed = !localDiff.ok || (merge !== null && !merge.ok) || (remoteDiff !== null && !remoteDiff.ok);
  let payloadExceeded = true;
  try {
    payloadExceeded = getPublishedPayloadSize(draft) > MAX_PUBLISHED_PAYLOAD_BYTES;
  } catch {
    /* Serialization errors block publication. */
  }
  return (
    <div className="flex flex-col gap-stack-md text-on-surface">
      <section className="flex flex-col gap-5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h2 className="font-headline-sm">Publicar conteúdo</h2>
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">
          Revise suas alterações, resolva diferenças com a versão publicada e confirme o resultado. Atualizar a
          publicação não substitui seu rascunho.
        </p>
        <p className="font-body-md">
          Base do rascunho: {expectedRevision ?? 'sem publicação'}
          {session ? ` · Revisão publicada em comparação: ${session.remote.revision ?? 'inicial'}` : ''}
        </p>
        <BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={onOpenValidationArea} />
        {payloadExceeded && (
          <p role="alert">
            Limite de tamanho do conteúdo excedido ou conteúdo não serializável. Reduza o conteúdo para até 5 MiB.
          </p>
        )}
        {comparisonFailed && (
          <p role="alert">
            Não foi possível comparar as alterações. Seu rascunho não foi descartado. Corrija IDs duplicados ou dados
            inválidos no editor e tente novamente.
          </p>
        )}
        {controller.message && (
          <p
            role={controller.phase === 'error' || controller.phase === 'uncertain' ? 'alert' : 'status'}
            className="max-w-[75ch] font-body-md"
          >
            {controller.message}
          </p>
        )}
        {localDiff.ok && (
          <ContentComparison
            changes={localDiff.value}
            title="Alterações do seu rascunho"
            onOpen={
              onNavigate
                ? (change) => {
                    const area = change.path[0];
                    const record = change.path.find((part) => part.kind === 'record');
                    onNavigate(
                      area?.kind === 'field' && area.key === 'flows'
                        ? 'flows'
                        : area?.kind === 'field' && (area.key === 'contacts' || area.key === 'locations')
                          ? 'contacts'
                          : 'education',
                      record?.kind === 'record' ? record.id : undefined,
                    );
                  }
                : undefined
            }
          />
        )}
        {!session && localDiff.ok && localDiff.value.length === 0 && (
          <p>Nada para publicar: todas as alterações coincidem com a base do rascunho.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              isBusy ||
              controller.uncertain ||
              payloadExceeded ||
              validation.errors.length > 0 ||
              comparisonFailed ||
              !localDiff.ok ||
              localDiff.value.length === 0 ||
              workspaceStore?.status === 'loading'
            }
            onClick={() => void controller.prepare()}
          >
            {isBusy ? 'Aguarde…' : session ? 'Atualizar versão publicada e comparar' : 'Publicar alterações'}
          </Button>
        </div>
        {session && remoteDiff?.ok && <ContentComparison changes={remoteDiff.value} title="Alterações já publicadas" />}
        {session && allConflicts?.ok && allConflicts.value.conflicts.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="font-headline-sm">Resolver alterações simultâneas</h3>
            <p role="status">
              {merge?.ok ? merge.value.conflicts.length : 'Comparação indisponível'} conflitos pendentes
            </p>
            <label className="font-body-md">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => {
                  setPendingOnly(e.target.checked);
                  setLimit(50);
                }}
              />{' '}
              Mostrar apenas pendentes
            </label>
            {conflicts.slice(0, limit).map((conflict) => (
              <ConflictEditor
                key={conflict.id}
                conflict={conflict}
                decision={session.decisions[conflict.id]}
                disabled={isBusy || controller.uncertain}
                onDecide={(choice) => {
                  void controller.decide(conflict.id, choice).then(() => {
                    if (choice)
                      window.requestAnimationFrame(() =>
                        document.querySelector<HTMLButtonElement>('[data-conflict-pending="true"] button')?.focus(),
                      );
                  });
                }}
              />
            ))}
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
            <p className="max-w-[75ch] font-body-md">
              Este é o resultado combinado em relação à versão publicada. Nenhuma combinação automática é enviada sem
              esta revisão.
            </p>
            {!controller.candidateValid && (
              <p role="alert">
                O resultado combinado contém dados inválidos, referências quebradas ou excede 5 MiB. Corrija o resultado
                antes de confirmar.
              </p>
            )}
            <CandidateEditor
              candidate={candidate}
              disabled={isBusy || controller.uncertain}
              onApply={(payload) => void controller.editCandidate(payload)}
            />
            <ContentComparison changes={diff.value} title="Resultado a publicar" />
            {session?.reviewed ? (
              <Button disabled={!controller.canConfirm} onClick={() => void controller.confirm()}>
                Confirmar publicação
              </Button>
            ) : (
              <Button
                disabled={!controller.candidateValid || isBusy || controller.uncertain}
                onClick={() => void controller.review()}
              >
                Confirmar revisão do resultado
              </Button>
            )}
          </section>
        )}
        {controller.uncertain && (
          <Button variant="secondary" disabled={isBusy} onClick={() => void controller.checkOutcome()}>
            Consultar resultado da tentativa
          </Button>
        )}
        {controller.phase === 'success' && <p role="status">O conteúdo está publicado.</p>}
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h3 className="font-headline-sm">Cópia de segurança do rascunho</h3>
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">
          O arquivo inclui base, edição local e decisões de reconciliação. Limpeza dos dados do navegador ou falha do
          dispositivo pode apagar a cópia local.
        </p>
        <div className="flex flex-wrap gap-3">
          {onDownloadBackup && (
            <Button variant="secondary" onClick={onDownloadBackup}>
              Baixar cópia de segurança (.json)
            </Button>
          )}
          {onRestoreBackup && (
            <Button variant="secondary" disabled={isBusy} onClick={onRestoreBackup}>
              Restaurar rascunho de arquivo (.json)
            </Button>
          )}
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 p-5">
        <h3 className="font-headline-sm">Arquivar rascunho local</h3>
        <p className="max-w-[75ch] font-body-md">
          Preserva uma cópia para retomar depois e volta ao conteúdo publicado. Não altera a publicação.
        </p>
        <ConfirmButton
          prompt="Arquivar rascunho"
          confirmLabel="Confirmar arquivamento"
          disabled={isBusy || controller.uncertain || (localDiff.ok && localDiff.value.length === 0)}
          onConfirm={onResetDrafts}
        />
      </section>
    </div>
  );
}

function ConflictEditor({
  conflict,
  decision,
  disabled,
  onDecide,
}: {
  conflict: SemanticConflict;
  decision?: ValueSlot;
  disabled: boolean;
  onDecide(choice?: ValueSlot): void;
}) {
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const isText = conflict.local.present && typeof conflict.local.value === 'string';
  function apply() {
    try {
      onDecide({ present: true, value: isText ? text : JSON.parse(text) });
      setManual(false);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <section
      data-conflict-pending={!decision}
      className="flex min-w-0 flex-col gap-3 border-b border-outline-variant py-4"
    >
      <h4 className="break-words font-label-md [overflow-wrap:anywhere]">
        {describePath(conflict.path)} · {decision ? 'Resolvido' : 'Pendente'}
      </h4>
      <details>
        <summary className="min-h-11 cursor-pointer font-label-md">Consultar base</summary>
        <SlotPreview label="Base" slot={conflict.base} />
      </details>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SlotPreview label="Sua versão" slot={conflict.local} />
        <SlotPreview label="Versão publicada" slot={conflict.remote} />
        <SlotPreview label="Resultado" slot={decision ?? conflict.local} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={disabled} onClick={() => onDecide(conflict.local)}>
          Usar minha alteração
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onDecide(conflict.remote)}>
          Usar alteração publicada
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setManual(true);
            setText(
              conflict.local.present
                ? typeof conflict.local.value === 'string'
                  ? conflict.local.value
                  : JSON.stringify(conflict.local.value, null, 2)
                : 'null',
            );
          }}
        >
          Editar resultado
        </Button>
        {decision && (
          <Button variant="secondary" disabled={disabled} onClick={() => onDecide()}>
            Desfazer escolha
          </Button>
        )}
      </div>
      {manual && (
        <div className="flex flex-col gap-3">
          <label className="font-body-md">
            Resultado manual{!isText ? ' (JSON)' : ''}
            <textarea
              className="mt-2 block min-h-40 w-full rounded-md border border-outline-variant bg-surface p-3 font-body-md"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {error && <p role="alert">Informe um valor JSON válido.</p>}
          <Button disabled={disabled} onClick={apply}>
            Aplicar resultado
          </Button>
          <Button variant="secondary" onClick={() => setManual(false)}>
            Cancelar edição
          </Button>
        </div>
      )}
    </section>
  );
}

function CandidateEditor({
  candidate,
  disabled,
  onApply,
}: {
  candidate: PublishedContentPayload;
  disabled: boolean;
  onApply(value: PublishedContentPayload): void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          setText(JSON.stringify(candidate, null, 2));
          setEditing(true);
        }}
      >
        Corrigir resultado completo
      </Button>
      {editing && (
        <>
          <label className="font-body-md">
            Conteúdo do resultado (JSON)
            <textarea
              className="mt-2 block min-h-64 w-full rounded-md border border-outline-variant bg-surface p-3 font-body-md"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {error && <p role="alert">O resultado deve manter a estrutura do conteúdo.</p>}
          <Button
            disabled={disabled}
            onClick={() => {
              try {
                const next = JSON.parse(text) as PublishedContentPayload;
                if (!compareContent(candidate, next).ok) throw new Error();
                onApply(next);
                setEditing(false);
                setError(false);
              } catch {
                setError(true);
              }
            }}
          >
            Aplicar correções
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar edição
          </Button>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Download, Eye, Upload } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import {
  getPublishedPayloadSize,
  MAX_PUBLISHED_PAYLOAD_BYTES,
  type PublishedContentPayload,
  type PublishedContentSnapshot,
} from '../../app/content/publishedContent';
import { PublishedContentRepositoryError } from '../../app/content/publishedContentRepository';
import type { DashboardValidationArea, DashboardValidationResult } from '../validation/validationTypes';
import type { DashboardTab } from '../components/DashboardShell';
import {
  computeChangeSummary,
  computeDetailedChangeSummary,
  type DetailedRecordChanges,
  type RecordChangeCount,
  type RecordChangeDetail,
} from './changeSummary';
import { mergePublishedContent, type PublishedContentMergeConflict } from './mergePublishedContent';

import { ConfirmButton } from '../components/ConfirmButton';
import { BlockingValidationNotice } from '../components/BlockingValidationNotice';

interface PublishDashboardProps {
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  expectedRevision?: number | null;
  basePayload?: PublishedContentPayload;
  onMergeConflict?(snapshot: PublishedContentSnapshot): void;
  onPublished(snapshot: PublishedContentSnapshot): void;
  onResetDrafts(): void;
  onDownloadBackup?(): void;
  onRestoreBackup?(): void;
  onOpenValidationArea?(area: DashboardValidationArea): void;
  onNavigate?(tab: DashboardTab, id?: string, path?: string): void;
}

type PublishState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'pending' }
  | { kind: 'success'; publishedAt: string; revision: number }
  | { kind: 'error'; message: string; conflicts?: PublishedContentMergeConflict[] };

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

function isRevisionConflict(error: unknown): error is PublishedContentRepositoryError {
  return error instanceof PublishedContentRepositoryError && error.code === 'conflict';
}

function messageForMergeConflicts(conflicts: PublishedContentMergeConflict[]) {
  const count = Math.max(conflicts.length, 1);
  return `${count === 1 ? 'Uma alteração' : 'Algumas alterações'} também foi${count === 1 ? '' : 'ram'} modificada${count === 1 ? '' : 's'} por outra pessoa. Revise os campos conflitantes antes de publicar.`;
}

async function refreshForMerge(
  refresh: () => Promise<void>,
  refreshLatest?: () => Promise<PublishedContentSnapshot | null>,
) {
  if (refreshLatest) return refreshLatest();
  await refresh();
  return null;
}

export function PublishDashboard({
  baseline,
  draft,
  validation,
  draftUpdatedAt,
  expectedRevision,
  basePayload,
  onMergeConflict,
  onPublished,
  onResetDrafts,
  onDownloadBackup,
  onRestoreBackup,
  onOpenValidationArea,
  onNavigate,
}: PublishDashboardProps) {
  const { snapshot, publish, refresh, refreshLatest } = usePublishedContent();
  const { account } = useAdminAuth();
  const [state, setState] = useState<PublishState>({ kind: 'idle' });

  const summary = useMemo(() => computeChangeSummary(baseline, draft), [baseline, draft]);
  const detailed = useMemo(() => computeDetailedChangeSummary(baseline, draft), [baseline, draft]);
  const currentRevision = snapshot?.revision ?? 0;
  const payloadBytes = useMemo(() => {
    try {
      return getPublishedPayloadSize(draft);
    } catch {
      return 0;
    }
  }, [draft]);
  const isPayloadExceeded = payloadBytes > MAX_PUBLISHED_PAYLOAD_BYTES;
  const isPayloadNearLimit = payloadBytes > MAX_PUBLISHED_PAYLOAD_BYTES * 0.8 && !isPayloadExceeded;
  const payloadMegabytes = (payloadBytes / (1024 * 1024)).toFixed(2);

  const hasErrors = validation.errors.length > 0;
  const hasChanges = summary.total > 0;
  const publishDisabled = hasErrors || !hasChanges || isPayloadExceeded;
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
      let next: PublishedContentSnapshot;

      try {
        next = await publish(draft, account.id, publicationRevision);
      } catch (error) {
        if (!isRevisionConflict(error)) throw error;

        const mergeBase =
          basePayload ??
          (expectedRevision !== undefined && (expectedRevision === null || snapshot?.revision === expectedRevision)
            ? baseline
            : undefined);
        const latest = mergeBase ? await refreshForMerge(refresh, refreshLatest) : null;
        if (!mergeBase || !latest) throw error;

        const merged = mergePublishedContent(mergeBase, draft, latest.payload);
        if (merged.conflicts.length > 0 || merged.payload === null) {
          onMergeConflict?.(latest);
          setState({
            kind: 'error',
            message: messageForMergeConflicts(merged.conflicts),
            conflicts: merged.conflicts,
          });
          return;
        }

        try {
          next = await publish(merged.payload, account.id, latest.revision);
        } catch (retryError) {
          if (isRevisionConflict(retryError)) {
            const newest = await refreshForMerge(refresh, refreshLatest);
            if (newest) onMergeConflict?.(newest);
          }
          throw retryError;
        }
      }

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

        <BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={onOpenValidationArea} />

        {isPayloadExceeded && (
          <aside
            role="alert"
            className="rounded-lg border border-error/35 bg-error-container/55 p-4 text-on-error-container"
          >
            <p className="flex items-center gap-2 font-label-md font-semibold text-error">
              <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
              Limite de tamanho do conteúdo excedido ({payloadMegabytes} MiB / 5.00 MiB)
            </p>
            <p className="mt-1 font-body-md">
              O conteúdo total excede o limite máximo permitido de 5 MiB para publicação. Para conseguir publicar,
              reduza o tamanho ou a quantidade de imagens enviadas nos materiais.
            </p>
          </aside>
        )}

        {isPayloadNearLimit && (
          <aside
            role="status"
            className="rounded-lg border border-primary/35 bg-primary-container/20 p-4 text-on-surface"
          >
            <p className="font-label-md font-semibold text-primary">
              Tamanho do conteúdo próximo do limite ({payloadMegabytes} MiB / 5.00 MiB)
            </p>
            <p className="mt-1 font-body-md text-on-surface-variant">
              O total publicado está próximo de 5 MiB. Recomendamos otimizar ou comprimir imagens antes de cadastrar
              novos materiais.
            </p>
          </aside>
        )}

        {!hasChanges ? (
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="font-body-md text-on-surface-variant">
              Nada para publicar — todas as alterações coincidem com o conteúdo publicado.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg bg-surface-container-low p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <ChangeStat label="Fluxos" counts={summary.flows} />
              <ChangeStat label="Materiais" counts={summary.materials} />
              <ChangeStat label="Grupos" counts={summary.groups} />
              <ChangeStat label="Contatos" counts={summary.contacts} />
              <ChangeStat label="Locais" counts={summary.locations} />
            </div>
            {summary.defaultGroupOrderChanged ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
                <p className="font-label-sm text-on-surface-variant">A ordem padrão dos grupos foi alterada.</p>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('education')}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 py-1 font-label-sm text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                    Ver em Materiais
                  </button>
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-label-md font-semibold text-on-surface">Detalhes por item</h3>
                <span className="font-body-sm text-on-surface-variant">
                  — clique em “Abrir” para revisar onde foi alterado
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <ChangeDetailSection
                  title="Fluxos"
                  tab="flows"
                  areaLabel="Fluxos"
                  details={detailed.details.flows}
                  onNavigate={onNavigate}
                />
                <ChangeDetailSection
                  title="Materiais"
                  tab="education"
                  areaLabel="Materiais"
                  details={detailed.details.materials}
                  onNavigate={onNavigate}
                />
                <ChangeDetailSection
                  title="Grupos"
                  tab="education"
                  areaLabel="Materiais"
                  details={detailed.details.groups}
                  onNavigate={onNavigate}
                />
                <ChangeDetailSection
                  title="Contatos"
                  tab="contacts"
                  areaLabel="Contatos"
                  details={detailed.details.contacts}
                  onNavigate={onNavigate}
                />
                <ChangeDetailSection
                  title="Locais"
                  tab="contacts"
                  areaLabel="Contatos"
                  details={detailed.details.locations}
                  onNavigate={onNavigate}
                />
              </div>
            </div>
          </div>
        )}

        {state.kind === 'error' ? (
          <div
            role="alert"
            className="rounded-lg border border-error/35 bg-error-container/55 p-4 text-on-error-container"
          >
            <p className="flex items-center gap-2 font-label-md">
              <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />A publicação não foi concluída
            </p>
            <p className="mt-1 font-body-md">{state.message} Seu rascunho foi mantido.</p>
            {state.conflicts && state.conflicts.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 font-label-sm">
                {state.conflicts.slice(0, 8).map((conflict) => (
                  <li key={conflict.path} className="flex flex-wrap items-center gap-2">
                    <span>{formatConflictLocation(conflict.path)}</span>
                    <button
                      type="button"
                      onClick={() => onOpenValidationArea?.(areaForConflict(conflict.path))}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-current/35 px-3 py-1 font-label-sm transition-colors hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Abrir área
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Button className="mt-3" variant="secondary" size="sm" onClick={confirmPublication}>
                Tentar publicar novamente
              </Button>
            )}
          </div>
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

      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <div>
          <h3 className="font-headline-sm text-on-surface">Cópia de segurança do rascunho</h3>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Salve um arquivo com suas alterações locais em formato JSON para restaurar depois ou transferir para outro
            navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDownloadBackup && (
            <Button variant="secondary" size="sm" onClick={onDownloadBackup}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar cópia de segurança (.json)
            </Button>
          )}
          {onRestoreBackup && (
            <Button variant="secondary" size="sm" onClick={onRestoreBackup}>
              <Upload className="mr-1.5 h-4 w-4" /> Restaurar rascunho de arquivo (.json)
            </Button>
          )}
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

const conflictFieldLabels: Record<string, string> = {
  title: 'título',
  text: 'texto',
  description: 'descrição',
  source: 'fonte',
  name: 'nome',
  type: 'categoria',
  address: 'endereço',
  phoneDisplay: 'telefone',
  city: 'cidade',
  state: 'estado',
  __order: 'ordem dos itens',
  defaultGroupOrder: 'ordem padrão dos grupos',
};

function formatConflictLocation(path: string) {
  const recordMatch = /^(flows|educationMaterials|educationGroups|contacts|locations)\[([^\]]+)](?:\.(.*))?$/.exec(
    path,
  );
  if (!recordMatch) {
    return `Configuração geral: ${conflictFieldLabels[path] ?? 'alteração simultânea'}`;
  }

  const [, collection, recordId, remainder = ''] = recordMatch;
  const collectionLabel: Record<string, string> = {
    flows: 'Fluxo',
    educationMaterials: 'Material',
    educationGroups: 'Grupo',
    contacts: 'Contato',
    locations: 'Local',
  };
  const nodeMatch = /^nodes\[([^\]]+)](?:\.(.*))?$/.exec(remainder);
  if (nodeMatch) {
    const field = nodeMatch[2]?.split('.').at(-1) ?? '';
    return `${collectionLabel[collection]} “${recordId}”, etapa “${nodeMatch[1]}”, ${conflictFieldLabels[field] ?? 'conteúdo da etapa'}`;
  }

  const field = remainder.split('.').at(-1) ?? '';
  return `${collectionLabel[collection]} “${recordId}”, ${conflictFieldLabels[field] ?? 'conteúdo do registro'}`;
}

function areaForConflict(path: string): DashboardValidationArea {
  if (path.startsWith('flows')) return 'flows';
  if (path.startsWith('contacts') || path.startsWith('locations')) return 'contacts';
  return 'education';
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

const detailFieldLabels: Record<string, string> = {
  title: 'título',
  text: 'texto',
  description: 'descrição',
  source: 'fonte',
  tags: 'marcadores',
  audience: 'público',
  group: 'grupo',
  body: 'conteúdo',
  imageUrl: 'imagem',
  imageFileName: 'arquivo de imagem',
  featuredImage: 'imagem principal',
  order: 'ordem',
  name: 'nome',
  type: 'categoria',
  badgeTone: 'selo',
  city: 'cidade',
  state: 'estado',
  address: 'endereço',
  phoneDisplay: 'telefone',
  phoneHref: 'link do telefone',
  hours: 'horário',
  notes: 'observações',
  locationId: 'local',
  lat: 'latitude',
  lng: 'longitude',
  status: 'estado',
  version: 'versão',
  locale: 'idioma',
  entry: 'entrada',
  nodes: 'etapas',
  nodeOrder: 'ordem das etapas',
  purpose: 'finalidade',
  review: 'revisão',
};

function humanizeField(key: string): string {
  return detailFieldLabels[key] ?? key;
}

function ChangeDetailSection({
  title,
  tab,
  areaLabel,
  details,
  onNavigate,
}: {
  title: string;
  tab: DashboardTab;
  areaLabel: string;
  details: DetailedRecordChanges;
  onNavigate?: (tab: DashboardTab, id?: string, path?: string) => void;
}) {
  const total = details.counts.added + details.counts.edited + details.counts.removed;
  if (total === 0) return null;
  const hasNavigate = typeof onNavigate === 'function';

  return (
    <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-label-md font-semibold text-on-surface">
          {title}{' '}
          <span className="font-body-sm font-normal text-on-surface-variant">
            ({total} {total === 1 ? 'alteração' : 'alterações'})
          </span>
        </h4>
        {hasNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(tab)}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-label-sm text-on-surface transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Abrir {areaLabel}
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {details.added.length > 0 && (
          <DetailList label="Adicionados" tone="added" items={details.added} tab={tab} onNavigate={onNavigate} />
        )}
        {details.edited.length > 0 && (
          <DetailList label="Editados" tone="edited" items={details.edited} tab={tab} onNavigate={onNavigate} />
        )}
        {details.removed.length > 0 && (
          <DetailList label="Removidos" tone="removed" items={details.removed} tab={tab} onNavigate={undefined} />
        )}
      </div>
    </section>
  );
}

function DetailList({
  label,
  tone,
  items,
  tab,
  onNavigate,
}: {
  label: string;
  tone: 'added' | 'edited' | 'removed';
  items: RecordChangeDetail[];
  tab: DashboardTab;
  onNavigate?: (tab: DashboardTab, id?: string, path?: string) => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    added: 'bg-primary-container text-on-primary-container',
    edited: 'bg-secondary-container text-on-secondary-container',
    removed: 'bg-error-container text-on-error-container',
  };
  const toneLabel: Record<typeof tone, string> = {
    added: 'novo',
    edited: 'alterado',
    removed: 'removido',
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="font-label-sm font-semibold text-on-surface-variant">
        {label} ({items.length})
      </p>
      <ul className="flex flex-col gap-2">
        {items.slice(0, 12).map((item, index) => {
          const fieldSummary =
            item.changedFields && item.changedFields.length > 0
              ? ` — campos: ${item.changedFields.map(humanizeField).join(', ')}`
              : '';
          const canNavigate = tone !== 'removed' && typeof onNavigate === 'function';
          // Build a focus path for precise scrolling: for education use id.field, for contacts use contacts.index.field
          const focusPath =
            item.changedFields && item.changedFields[0]
              ? tab === 'contacts' && typeof item.draftIndex === 'number'
                ? `contacts.${item.draftIndex}.${item.changedFields[0]}`
                : `${item.id}.${item.changedFields[0]}`
              : undefined;

          return (
            <li
              key={`${tone}-${item.id}-${item.draftIndex ?? item.baselineIndex ?? index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2"
            >
              <span className="min-w-0 flex-1 font-body-sm text-on-surface">
                <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${toneClasses[tone]}`}>
                  {toneLabel[tone]}
                </span>
                <span className="font-label-sm font-semibold">{item.label}</span>
                <span className="ml-1 font-body-sm text-on-surface-variant">({item.id})</span>
                {fieldSummary && <span className="font-body-sm text-on-surface-variant">{fieldSummary}</span>}
              </span>
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(tab, item.id, focusPath)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 font-label-sm text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`Abrir ${item.label} em ${tab === 'flows' ? 'Fluxos' : tab === 'education' ? 'Materiais' : 'Contatos'}`}
                >
                  <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                  Abrir
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ) : tone === 'removed' ? (
                <span className="font-label-sm text-on-surface-variant">removido do rascunho</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {items.length > 12 && <p className="font-body-sm text-on-surface-variant">+ {items.length - 12} outros</p>}
    </div>
  );
}

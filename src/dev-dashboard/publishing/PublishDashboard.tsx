import { useMemo } from 'react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { getPublishedPayloadSize, MAX_PUBLISHED_PAYLOAD_BYTES } from '../../app/content/publishedContent';
import type { DashboardValidationArea, DashboardValidationResult } from '../validation/validationTypes';
import { BlockingValidationNotice } from '../components/BlockingValidationNotice';
import { ContentComparison } from './ContentComparison';
import { compareContent } from './semanticDiff';
import type { PublicationPreview, PublicationPhase } from './usePublicationController';

/** V2 publication review surface backed by the guarded prepare/publish protocol. */
export interface PublishDashboardProps {
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  phase: PublicationPhase;
  message: string | null;
  preview: PublicationPreview | null;
  busy: boolean;
  disabled: boolean;
  readOnly: boolean;
  onOpenValidationArea?: (area: DashboardValidationArea) => void;
  onOpenReview(): void;
  onPublish(): void;
  onCloseReview(): void;
}

export function PublishDashboard({
  baseline,
  draft,
  validation,
  phase,
  message,
  preview,
  busy,
  disabled,
  readOnly,
  onOpenValidationArea,
  onOpenReview,
  onPublish,
  onCloseReview,
}: PublishDashboardProps) {
  const liveDiff = useMemo(() => compareContent(baseline, draft), [baseline, draft]);
  const exceeded = payloadExceeded(draft);

  return (
    <div className="flex flex-col gap-stack-md text-on-surface">
      <section className="flex flex-col gap-5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h2 className="font-headline-sm">Publicar conteúdo</h2>
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">
          Revise as alterações salvas no BemTeVi e confirme a publicação. A confirmação compara o rascunho exato com a
          versão publicada; qualquer mudança recente encerra a revisão e exige uma nova conferência.
        </p>
        {readOnly && (
          <p role="status" className="max-w-[75ch] font-body-md text-on-surface-variant">
            A edição e a publicação estão temporariamente desativadas neste painel. As leituras, a comparação e o
            download de recuperação continuam disponíveis.
          </p>
        )}
        <BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={onOpenValidationArea} />
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
          <Button disabled={busy || disabled || readOnly || validation.errors.length > 0} onClick={onOpenReview}>
            {busy ? 'Aguarde…' : 'Publicar alterações'}
          </Button>
        </div>
        {preview && (
          <section className="flex flex-col gap-4">
            <h3 className="font-headline-sm">Revisão final antes de publicar</h3>
            <p className="max-w-[75ch] font-body-md text-on-surface-variant">
              Geração do rascunho: {preview.draft.generation} · Revisão publicada em comparação: {preview.liveRevision}.
              Nenhuma publicação acontece sem a sua confirmação.
            </p>
            <Button variant="secondary" disabled={busy} onClick={onCloseReview}>
              Encerrar revisão
            </Button>
            <Button disabled={busy || readOnly || validation.errors.length > 0} onClick={onPublish}>
              {phase === 'publishing' ? 'Publicando…' : 'Publicar'}
            </Button>
          </section>
        )}
        {phase === 'success' && <p role="status">O conteúdo está publicado.</p>}
      </section>
    </div>
  );
}

function payloadExceeded(draft: PublishedContentPayload): boolean {
  try {
    return getPublishedPayloadSize(draft) > MAX_PUBLISHED_PAYLOAD_BYTES;
  } catch {
    return true;
  }
}

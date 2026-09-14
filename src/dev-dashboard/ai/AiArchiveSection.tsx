import type { ContentDraft, PublishedContentPayload } from '@bemtevi/content-core';
import { AiFileArchiveSection } from './AiFileArchiveSection';
import { ConnectedAssistantsSection } from './connections/ConnectedAssistantsSection';
import type { ConnectionRepository } from './connections/connectionRepository';
import type { ExportRepository } from './files/exportRepository';

/**
 * AI surfaces composition (task AI-FILE-02). Presentation composition ONLY:
 * the zero-setup ChatGPT/file path is rendered FIRST and the connected
 * assistants (advanced MCP) path SECOND (doc 06). This module owns no route
 * state, no authenticated Neon composition and no V2/legacy feature flag —
 * the route decides which props to supply (INTEGRATION-01/02 composition).
 *
 * Temporary coexistence (removed by INTEGRATION-02/LEGACY-01): the
 * still-flagged legacy branch calls this component with the legacy props
 * (`draft` payload, `baseRevision`, `onApply`) it passes today, so those
 * remain accepted for compilation. They carry no V2 capability: the V2
 * surfaces render only when their repositories/callbacks are supplied. The
 * legacy AI experience itself keeps living in the legacy modules until
 * LEGACY-01 deletes them.
 */

export interface AiArchiveSectionProps {
  /**
   * Draft snapshot. The legacy branch passes the published payload; the V2
   * route passes the canonical `ContentDraft` (verified server snapshot).
   */
  draft?: PublishedContentPayload | ContentDraft;
  /** Legacy Neon revision (legacy branch only; unused by the V2 surfaces). */
  baseRevision?: number;
  /** Legacy apply callback (legacy branch only; unused by the V2 surfaces). */
  onApply?: (nextPayload: PublishedContentPayload, envelope: unknown) => void;
  /** Clean-flush gate from the workspace save coordinator (doc 16, V2). */
  flush?: () => Promise<boolean>;
  /** Explicit apply of a reviewed candidate against its exported base (V2). */
  applyCandidate?: (base: PublishedContentPayload, candidate: PublishedContentPayload) => Promise<boolean>;
  /** Durable file-export repository (AI-FILE-01, V2). */
  exportRepository?: ExportRepository;
  /** Agent connection repository (AI-FILE-02, V2). */
  connectionRepository?: ConnectionRepository;
  /** Runtime HTTPS Neon Auth endpoint for the portable MCP config (doc 04, V2). */
  authUrl?: string;
  /** Runtime HTTPS Neon Data API endpoint for the portable MCP config (doc 04, V2). */
  dataApiUrl?: string;
}

function isContentDraft(value: PublishedContentPayload | ContentDraft): value is ContentDraft {
  return typeof value === 'object' && value !== null && 'canonicalPayload' in value && 'payload' in value;
}

export function AiArchiveSection(props: AiArchiveSectionProps) {
  const draft: ContentDraft | undefined = isContentDraft(props.draft) ? props.draft : undefined;
  const v2Ready =
    draft !== undefined &&
    props.flush !== undefined &&
    props.applyCandidate !== undefined &&
    props.exportRepository !== undefined &&
    props.connectionRepository !== undefined &&
    props.authUrl !== undefined &&
    props.dataApiUrl !== undefined;

  if (draft === undefined || !v2Ready) {
    // Legacy-props-only call (still-flagged branch until INTEGRATION-02).
    // The V2 surfaces need their repositories; without them nothing here
    // can render safely, so the panel shows a PT-BR standby notice.
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <h2 className="font-headline-sm text-on-surface">Ajuda rápida com ChatGPT</h2>
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">
          O fluxo de edição com IA via arquivo está sendo atualizado e voltará com a próxima versão do painel, ainda
          mais simples de usar. Nenhuma alteração sua foi perdida.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <AiFileArchiveSection
        draft={draft}
        flush={props.flush}
        applyCandidate={props.applyCandidate}
        exportRepository={props.exportRepository}
      />
      <ConnectedAssistantsSection
        repository={props.connectionRepository}
        authUrl={props.authUrl}
        dataApiUrl={props.dataApiUrl}
      />
    </div>
  );
}

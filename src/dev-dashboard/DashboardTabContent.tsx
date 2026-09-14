import type { PublishedContentPayload, PublishedContentSnapshot } from '../app/content/publishedContent';
import { Button } from '../design-system/components/Button';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { AiArchiveSection } from './ai/AiArchiveSection';
import type { AiOperationEnvelope } from './ai/aiOperations';
import { McpDraftSection } from './ai/McpDraftSection';
import type { ContentDraft } from './draft-sync/contentDraft';
import type { DashboardDraftState } from './draft-storage/dashboardStorage';
import type { DraftWorkspace } from './draft-storage/workspace';
import { ContactsDashboard } from './contacts/ContactsDashboard';
import { EducationDashboard } from './education/EducationDashboard';
import { FlowDashboard } from './flows/FlowDashboard';
import type { DashboardContactMutationController } from './dashboardContactMutations';
import type { DashboardEducationMutationController } from './dashboardEducationMutations';
import type { DashboardFlowMutationController } from './dashboardFlowMutations';
import type { DashboardTab } from './components/DashboardShell';
import type { DashboardValidationResult } from './validation/validationTypes';
import { PublishDashboard } from './publishing/PublishDashboard';
import type { LegacyPublishFn } from './publishing/legacyPublication';
import type { PublicationPhase, PublicationPreview } from './publishing/usePublicationController';
import type { CanonicalDraftWorkspace } from './draft-storage/useDraftWorkspace';
import type { ConflictDecisions, ValueSlot } from '@bemtevi/content-core';
import type { DraftRepository } from './drafts/draftRepository';
import type { ExportRepository } from './ai/files/exportRepository';
import type { ConnectionRepository } from './ai/connections/connectionRepository';
import { DraftWorkspaceSection } from './drafts/DraftWorkspaceSection';

/**
 * Tab-composition seam (INTEGRATION-02). Exactly ONE branch renders per
 * dashboard: `legacy` keeps the pre-V2 tab set, `v2` renders the canonical
 * editor surfaces. The route owns the editor flag; this module never reads it.
 */

interface LegacyTabProps {
  mode: 'legacy';
  readOnly: boolean;
  activeTab: DashboardTab;
  content: PublishedContentPayload;
  publishedContent: PublishedContentPayload;
  remoteContent: PublishedContentPayload;
  workspace: DraftWorkspace | null;
  draftState: DashboardDraftState;
  validation: DashboardValidationResult;
  contactValidation: DashboardValidationResult;
  flowFocusRequest: { id: string; requestId: number } | null;
  educationFocusRequest: { id: string; requestId: number; path?: string } | null;
  contactsFocusRequest: { id: string; requestId: number; path?: string } | null;
  flowMutations: DashboardFlowMutationController;
  educationMutations: DashboardEducationMutationController;
  contactMutations: DashboardContactMutationController;
  workspaceStore: ReturnType<(typeof import('./draft-storage/useDraftWorkspace'))['useLegacyDraftWorkspace']>;
  mcpDraft: ContentDraft | null;
  snapshot: PublishedContentSnapshot | null;
  hasPendingDraft: boolean;
  onMcpDraftOpen: (draft: ContentDraft) => void;
  onMcpDraftAttach: (draft: ContentDraft) => void;
  onMcpDraftSynced: (draft: ContentDraft) => void;
  onAiApply: (nextPayload: PublishedContentPayload, envelope: AiOperationEnvelope) => void;
  onPublished: (snapshot: PublishedContentSnapshot) => void;
  onResetDrafts: () => void;
  onDownloadBackup: () => void;
  onRestoreBackup: () => void;
  onOpenValidationArea: (area: 'flows' | 'education' | 'contacts' | 'export') => void;
  onNavigate: (tab: DashboardTab, id?: string, path?: string) => void;
  /** Legacy direct-table publication via the temporary adapter (flag-false branch only). */
  legacyPublish: LegacyPublishFn;
  legacyRefreshLatest?(): Promise<PublishedContentSnapshot | null>;
}

interface V2TabProps {
  mode: 'v2';
  readOnly: boolean;
  activeTab: DashboardTab;
  /** Live published payload powering reads/diff. */
  liveContent: PublishedContentPayload;
  workspace: CanonicalDraftWorkspace;
  draftRepository: DraftRepository;
  exportRepository: ExportRepository;
  connectionRepository: ConnectionRepository;
  authUrl: string;
  dataApiUrl: string;
  validation: DashboardValidationResult;
  contactValidation: DashboardValidationResult;
  flowFocusRequest: { id: string; requestId: number } | null;
  educationFocusRequest: { id: string; requestId: number; path?: string } | null;
  contactsFocusRequest: { id: string; requestId: number; path?: string } | null;
  flowMutations: DashboardFlowMutationController;
  educationMutations: DashboardEducationMutationController;
  contactMutations: DashboardContactMutationController;
  onEditCandidate: (candidate: PublishedContentPayload) => void;
  /** Fingerprinted conflict decisions currently retained by the route. */
  decisions: ConflictDecisions;
  onDecide(conflictId: string, choice: ValueSlot): void;
  onClearDecision(conflictId: string): void;
  // prettier-ignore
  onApplyCandidate: (base: PublishedContentPayload, candidate: PublishedContentPayload) => Promise<boolean>;
  onDownloadRecovery: () => void;
  publicationPhase: PublicationPhase;
  publicationMessage: string | null;
  publicationPreview: PublicationPreview | null;
  publicationBusy: boolean;
  publicationDisabled: boolean;
  onOpenPublicationReview: () => void;
  onPublish: () => void;
  onClosePublicationReview: () => void;
  onOpenValidationArea: (area: 'flows' | 'education' | 'contacts' | 'export') => void;
  onNavigate: (tab: DashboardTab, id?: string, path?: string) => void;
}

export type DashboardTabContentProps = LegacyTabProps | V2TabProps;

export function DashboardTabContent(props: DashboardTabContentProps) {
  if (props.mode === 'v2') return <V2Tabs {...props} />;
  return <LegacyTabs {...props} />;
}

function LegacyTabs({
  activeTab,
  readOnly,
  content,
  publishedContent,
  remoteContent,
  workspace,
  draftState,
  validation,
  contactValidation,
  flowFocusRequest,
  educationFocusRequest,
  contactsFocusRequest,
  flowMutations,
  educationMutations,
  contactMutations,
  workspaceStore,
  mcpDraft,
  snapshot,
  hasPendingDraft,
  onMcpDraftOpen,
  onMcpDraftAttach,
  onMcpDraftSynced,
  onAiApply,
  onPublished,
  onResetDrafts,
  onDownloadBackup,
  onRestoreBackup,
  onOpenValidationArea,
  onNavigate,
  legacyPublish,
  legacyRefreshLatest,
}: LegacyTabProps) {
  if (activeTab === 'flows')
    // prettier-ignore
    return <FlowDashboard flows={content.flows} resources={content.educationMaterials} externalFocus={flowFocusRequest} {...flowMutations} />;

  if (activeTab === 'education')
    // prettier-ignore
    return <EducationDashboard resources={content.educationMaterials} groups={content.educationGroups} defaultGroupOrder={content.defaultGroupOrder} externalFocus={educationFocusRequest} {...educationMutations} />;

  if (activeTab === 'contacts')
    // prettier-ignore
    return <ContactsDashboard services={content.contacts} locations={content.locations} validation={contactValidation} externalFocus={contactsFocusRequest} {...contactMutations} />;

  if (activeTab === 'ai') {
    return (
      <>
        <McpDraftSection
          candidate={publishedContent}
          activeDraft={mcpDraft}
          activeDraftId={workspace?.mcpDraft?.draftId}
          activeDraftGeneration={workspace?.mcpDraft?.generation}
          onOpen={onMcpDraftOpen}
          onAttach={onMcpDraftAttach}
          onSynced={onMcpDraftSynced}
        />
        {readOnly ? (
          <section className="flex flex-col gap-3 rounded-lg border border-primary/35 bg-primary-container/15 p-5">
            <h2 className="font-headline-sm">A edição está desativada</h2>
            <p className="max-w-[75ch] font-body-md text-on-surface-variant">
              As ações de edição e publicação estão temporariamente bloqueadas. As consultas e o download de cópias
              continuam disponíveis.
            </p>
          </section>
        ) : snapshot === null ? (
          <section className="rounded-lg border border-primary/35 bg-primary-container/15 p-5">
            <h2 className="font-headline-sm">Aguarde o conteúdo publicado do Neon</h2>
            <p className="mt-2 max-w-[75ch] font-body-md text-on-surface-variant">
              O assistente só trabalha sobre uma revisão confirmada do Neon. Verifique a conexão e recarregue o
              Dashboard antes de solicitar uma alteração.
            </p>
          </section>
        ) : hasPendingDraft ? (
          <section className="flex flex-col gap-4 rounded-lg border border-primary/35 bg-primary-container/15 p-5">
            <div>
              <h2 className="font-headline-sm">Finalize o rascunho antes de usar a IA</h2>
              <p className="mt-2 max-w-[75ch] font-body-md text-on-surface-variant">
                Há alterações locais ainda não publicadas. Para evitar que uma proposta da IA sobrescreva ou misture
                mudanças pendentes, publique este rascunho ou baixe uma cópia de segurança e descarte-o antes de
                solicitar novas edições.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => onNavigate('export')}>Revisar e publicar</Button>
              <Button variant="secondary" onClick={onDownloadBackup}>
                Baixar cópia do rascunho
              </Button>
            </div>
          </section>
        ) : (
          <AiArchiveSection draft={publishedContent} baseRevision={snapshot.revision} onApply={onAiApply} />
        )}
      </>
    );
  }

  if (activeTab === 'analytics') return <AnalyticsDashboard />;

  // prettier-ignore
  return <PublishDashboard mode="legacy" baseline={workspace?.base.payload ?? remoteContent} draft={publishedContent}
      validation={validation} draftUpdatedAt={draftState.updatedAt} expectedRevision={draftState.baseRevision ?? null}
      basePayload={draftState.basePayload} workspaceStore={workspaceStore} refreshLatest={legacyRefreshLatest}
      legacyPublish={readOnly ? disabledLegacyPublish : legacyPublish} onPublished={onPublished}
      onResetDrafts={onResetDrafts} onDownloadBackup={onDownloadBackup} onRestoreBackup={onRestoreBackup}
      onOpenValidationArea={onOpenValidationArea} />;
}

/** Read-only kill: legacy direct publication refuses before any table write. */
function disabledLegacyPublish(): Promise<never> {
  return Promise.reject(new Error('A publicação está temporariamente desativada neste painel.'));
}

function V2Tabs({
  activeTab,
  readOnly,
  liveContent,
  workspace,
  draftRepository: _draftRepository,
  exportRepository,
  connectionRepository,
  authUrl,
  dataApiUrl,
  validation,
  contactValidation,
  flowFocusRequest,
  educationFocusRequest,
  contactsFocusRequest,
  flowMutations,
  educationMutations,
  contactMutations,
  onEditCandidate: _onEditCandidate,
  decisions,
  onDecide,
  onClearDecision,
  onApplyCandidate,
  onDownloadRecovery,
  publicationPhase,
  publicationMessage,
  publicationPreview,
  publicationBusy,
  publicationDisabled,
  onOpenPublicationReview,
  onPublish,
  onClosePublicationReview,
  onOpenValidationArea: _onOpenValidationArea,
  onNavigate: _onNavigate,
}: V2TabProps) {
  // prettier-ignore
  const draftSection = <DraftWorkspaceSection workspace={workspace} readOnly={readOnly} onDownloadRecovery={onDownloadRecovery} decisions={decisions} onDecide={onDecide} onClearDecision={onClearDecision} />;
  if (activeTab === 'flows')
    return (
      <>
        {draftSection}
        {/* prettier-ignore */}
        <FlowDashboard flows={liveContent.flows} resources={liveContent.educationMaterials} externalFocus={flowFocusRequest} {...flowMutations} />
      </>
    );
  if (activeTab === 'education')
    return (
      <>
        {draftSection}
        {/* prettier-ignore */}
        <EducationDashboard resources={liveContent.educationMaterials} groups={liveContent.educationGroups} defaultGroupOrder={liveContent.defaultGroupOrder} externalFocus={educationFocusRequest} {...educationMutations} />
      </>
    );
  if (activeTab === 'contacts')
    return (
      <>
        {draftSection}
        {/* prettier-ignore */}
        <ContactsDashboard services={liveContent.contacts} locations={liveContent.locations} validation={contactValidation} externalFocus={contactsFocusRequest} {...contactMutations} />
      </>
    );
  if (activeTab === 'ai') {
    const draft = workspace.state.base;
    // prettier-ignore
    if (readOnly)
      return <section className="flex flex-col gap-3 rounded-lg border border-primary/35 bg-primary-container/15 p-5">
        <h2 className="font-headline-sm">A edição está desativada</h2>
        <p className="max-w-[75ch] font-body-md text-on-surface-variant">As ações de edição e de conexões com assistentes estão temporariamente bloqueadas. As consultas, a comparação e o download de recuperação continuam nas demais abas.</p>
      </section>;
    // prettier-ignore
    return <AiArchiveSection
        draft={draft === null ? liveContent : {
          ...draft, status: 'active', payload: workspace.state.local ?? draft.payload, canonicalPayload: '',
          createdAt: draft.updatedAt, createdBy: draft.lastActor.principalUserId,
        }}
        flush={workspace.flush} applyCandidate={onApplyCandidate} exportRepository={exportRepository}
        connectionRepository={connectionRepository} authUrl={authUrl} dataApiUrl={dataApiUrl} />;
  }
  if (activeTab === 'analytics') return <AnalyticsDashboard />;
  return (
    <>
      {draftSection}
      {/* prettier-ignore */}
      <PublishDashboard mode="v2" baseline={liveContent} draft={workspace.state.local ?? workspace.state.base?.payload ?? liveContent}
        validation={validation} phase={publicationPhase} message={publicationMessage} preview={publicationPreview}
        busy={publicationBusy} disabled={publicationDisabled} readOnly={readOnly}
        onOpenReview={onOpenPublicationReview} onPublish={onPublish} onCloseReview={onClosePublicationReview} />
    </>
  );
}

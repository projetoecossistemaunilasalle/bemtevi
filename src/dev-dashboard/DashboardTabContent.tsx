import type { PublishedContentPayload } from '../app/content/publishedContent';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { AiArchiveSection } from './ai/AiArchiveSection';
import { ContactsDashboard } from './contacts/ContactsDashboard';
import { EducationDashboard } from './education/EducationDashboard';
import { FlowDashboard } from './flows/FlowDashboard';
import type { DashboardContactMutationController } from './dashboardContactMutations';
import type { DashboardEducationMutationController } from './dashboardEducationMutations';
import type { DashboardFlowMutationController } from './dashboardFlowMutations';
import type { DashboardTab } from './components/DashboardShell';
import type { DashboardValidationResult } from './validation/validationTypes';
import { PublishDashboard } from './publishing/PublishDashboard';
import type { PublicationPhase, PublicationPreview } from './publishing/usePublicationController';
import type { CanonicalDraftWorkspace } from './draft-storage/useDraftWorkspace';
import type { ConflictDecisions, ValueSlot } from '@bemtevi/content-core';
import type { DraftRepository } from './drafts/draftRepository';
import type { ExportRepository } from './ai/files/exportRepository';
import type { ConnectionRepository } from './ai/connections/connectionRepository';
import { DraftWorkspaceSection } from './drafts/DraftWorkspaceSection';

/**
 * Tab-composition seam (LEGACY-01): V2-only. The legacy mode arm, local
 * workspace store and temporary direct-publication props are removed.
 */

export interface DashboardTabContentProps {
  readOnly: boolean;
  activeTab: DashboardTab;
  /** Live published payload used as the publication comparison baseline. */
  liveContent: PublishedContentPayload;
  /** Canonical draft candidate powering the editor tabs. */
  draftContent: PublishedContentPayload;
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

export function DashboardTabContent({
  activeTab,
  readOnly,
  liveContent,
  draftContent,
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
  onOpenValidationArea,
  onNavigate: _onNavigate,
}: DashboardTabContentProps) {
  const draftSection = (
    <DraftWorkspaceSection
      workspace={workspace}
      readOnly={readOnly}
      onDownloadRecovery={onDownloadRecovery}
      decisions={decisions}
      onDecide={onDecide}
      onClearDecision={onClearDecision}
    />
  );
  if (activeTab === 'flows')
    return (
      <>
        {draftSection}
        <FlowDashboard
          flows={draftContent.flows}
          resources={draftContent.educationMaterials}
          externalFocus={flowFocusRequest}
          {...flowMutations}
        />
      </>
    );
  if (activeTab === 'education')
    return (
      <>
        {draftSection}
        <EducationDashboard
          resources={draftContent.educationMaterials}
          groups={draftContent.educationGroups}
          defaultGroupOrder={draftContent.defaultGroupOrder}
          externalFocus={educationFocusRequest}
          {...educationMutations}
        />
      </>
    );
  if (activeTab === 'contacts')
    return (
      <>
        {draftSection}
        <ContactsDashboard
          services={draftContent.contacts}
          locations={draftContent.locations}
          validation={contactValidation}
          externalFocus={contactsFocusRequest}
          {...contactMutations}
        />
      </>
    );
  if (activeTab === 'ai') {
    const draft = workspace.state.base;
    if (readOnly)
      return (
        <section className="flex flex-col gap-3 rounded-lg border border-primary/35 bg-primary-container/15 p-5">
          <h2 className="font-headline-sm">A edição está desativada</h2>
          <p className="max-w-[75ch] font-body-md text-on-surface-variant">
            As ações de edição e de conexões com assistentes estão temporariamente bloqueadas. As consultas, a
            comparação e o download de recuperação continuam nas demais abas.
          </p>
        </section>
      );
    return (
      <AiArchiveSection
        draft={
          draft === null
            ? draftContent
            : {
                ...draft,
                status: 'active',
                payload: workspace.state.local ?? draft.payload,
                canonicalPayload: '',
                createdAt: draft.updatedAt,
                createdBy: draft.lastActor.principalUserId,
              }
        }
        flush={workspace.flush}
        applyCandidate={onApplyCandidate}
        exportRepository={exportRepository}
        connectionRepository={connectionRepository}
        authUrl={authUrl}
        dataApiUrl={dataApiUrl}
      />
    );
  }
  if (activeTab === 'analytics') return <AnalyticsDashboard />;
  return (
    <>
      {draftSection}
      <PublishDashboard
        baseline={liveContent}
        draft={draftContent}
        validation={validation}
        phase={publicationPhase}
        message={publicationMessage}
        preview={publicationPreview}
        busy={publicationBusy}
        disabled={publicationDisabled}
        readOnly={readOnly}
        onOpenValidationArea={onOpenValidationArea}
        onOpenReview={onOpenPublicationReview}
        onPublish={onPublish}
        onCloseReview={onClosePublicationReview}
      />
    </>
  );
}

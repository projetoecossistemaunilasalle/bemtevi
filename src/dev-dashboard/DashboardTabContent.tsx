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
import type { WorkspaceStore } from './publishing/usePublicationController';

export function DashboardTabContent({
  activeTab,
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
}: {
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
  workspaceStore: WorkspaceStore;
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
}) {
  if (activeTab === 'flows') {
    return (
      <FlowDashboard
        flows={content.flows}
        resources={content.educationMaterials}
        externalFocus={flowFocusRequest}
        {...flowMutations}
      />
    );
  }

  if (activeTab === 'education') {
    return (
      <EducationDashboard
        resources={content.educationMaterials}
        groups={content.educationGroups}
        defaultGroupOrder={content.defaultGroupOrder}
        externalFocus={educationFocusRequest}
        {...educationMutations}
      />
    );
  }

  if (activeTab === 'contacts') {
    return (
      <ContactsDashboard
        services={content.contacts}
        locations={content.locations}
        validation={contactValidation}
        externalFocus={contactsFocusRequest}
        {...contactMutations}
      />
    );
  }

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
        {snapshot === null ? (
          <section className="rounded-lg border border-primary/35 bg-primary-container/15 p-5 text-on-surface">
            <h2 className="font-headline-sm">Aguarde o conteúdo publicado do Neon</h2>
            <p className="mt-2 max-w-[75ch] font-body-md text-on-surface-variant">
              O assistente só trabalha sobre uma revisão confirmada do Neon. Verifique a conexão e recarregue o
              Dashboard antes de solicitar uma alteração.
            </p>
          </section>
        ) : hasPendingDraft ? (
          <section className="flex flex-col gap-4 rounded-lg border border-primary/35 bg-primary-container/15 p-5 text-on-surface">
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

  return (
    <PublishDashboard
      baseline={workspace?.base.payload ?? remoteContent}
      draft={publishedContent}
      validation={validation}
      draftUpdatedAt={draftState.updatedAt}
      expectedRevision={draftState.baseRevision ?? null}
      basePayload={draftState.basePayload}
      workspaceStore={workspaceStore}
      onPublished={onPublished}
      onResetDrafts={onResetDrafts}
      onDownloadBackup={onDownloadBackup}
      onRestoreBackup={onRestoreBackup}
      onOpenValidationArea={onOpenValidationArea}
      onNavigate={onNavigate}
    />
  );
}

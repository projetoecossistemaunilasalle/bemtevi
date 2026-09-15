import { useCallback, useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import { createEmptyDashboardDraftState, type DashboardDraftState } from './dashboardDraftState';
import { mergeDashboardDrafts } from './dashboardDraftMerge';
import { usePublishedContent } from '../app/content/PublishedContentContext';
import type { PublishedContentPayload } from '../app/content/publishedContent';
import { loadActiveTab, saveActiveTab } from './draft-storage/dashboardTabStorage';
import { scheduleValidationSummaryScroll } from './validation/validationNavigation';
import { DashboardTabContent } from './DashboardTabContent';
import { createDashboardFlowMutationController } from './dashboardFlowMutations';
import { createDashboardEducationMutationController } from './dashboardEducationMutations';
import { createDashboardContactMutationController } from './dashboardContactMutations';
import { getEditorFlags } from './editorFlags';
import type { ConflictDecisions, ValueSlot } from '@bemtevi/content-core';
import { useDraftWorkspace } from './draft-storage/useDraftWorkspace';
import { editorialNeonServices } from './editorialNeonServices';
import { getNeonConfig } from '../app/neon/client';
import { useAdminAuth } from '../app/auth/AdminAuthContext';
import { usePublicationController } from './publishing/usePublicationController';
import { validateDashboardContacts } from './contacts/contactsValidation';
import { validateDashboardEducation } from './education/educationValidation';
import { validateDashboardFlows } from './flows/flowValidation';

/**
 * V2-only dashboard (LEGACY-01): the legacy local-persistence branch, the
 * `v2Enabled` coexistence flag and the temporary direct-publication adapter
 * are gone. Neon published content is the only public read source; the
 * canonical draft lives in Neon through `useDraftWorkspace`.
 * `VITE_EDITOR_READ_ONLY` remains the emergency UI kill flag.
 */
export function DashboardRoute() {
  const { readOnly } = getEditorFlags();
  return <V2DashboardRoute readOnly={readOnly} />;
}

function V2DashboardRoute({ readOnly }: { readOnly: boolean }) {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const { account } = useAdminAuth();
  const { content: liveContent } = usePublishedContent();
  const workspace = useDraftWorkspace(account?.id ?? 'unauthenticated');
  const publication = usePublicationController({
    repository: editorialNeonServices.draftRepository,
    flush: workspace.flush,
    refreshDraft: workspace.refresh,
    readOnly,
  });
  const [conflictDecisions, setConflictDecisions] = useState<ConflictDecisions>({});
  const decide = useCallback(
    (decisions: ConflictDecisions) => {
      if (!readOnly) {
        setConflictDecisions(decisions);
        void workspace.resolve(decisions);
      }
    },
    [readOnly, workspace],
  );
  const handleDecide = useCallback(
    (conflictId: string, choice: ValueSlot) => decide({ ...conflictDecisions, [conflictId]: choice }),
    [conflictDecisions, decide],
  );
  const handleClearDecision = useCallback(
    (conflictId: string) => {
      const decisions = { ...conflictDecisions };
      delete decisions[conflictId];
      decide(decisions);
    },
    [conflictDecisions, decide],
  );
  const local = workspace.state.local ?? workspace.state.base?.payload ?? liveContent;
  const updateCandidate = useCallback(
    (next: PublishedContentPayload) => {
      if (!readOnly) workspace.edit(next);
    },
    [readOnly, workspace],
  );
  const applyCandidate = useCallback(
    async (_basePayload: PublishedContentPayload, candidate: PublishedContentPayload) => {
      if (readOnly) return false;
      workspace.edit(candidate);
      return workspace.flush();
    },
    [readOnly, workspace],
  );
  const downloadRecovery = useCallback(() => {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bemtevi-rascunho.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [local]);
  const candidateUpdater = (updater: (current: DashboardDraftState) => DashboardDraftState) => {
    updateCandidate(mergeDashboardDrafts(local, updater(createEmptyDashboardDraftState())));
  };
  const flowMutations = createDashboardFlowMutationController({ shipped: local, updateDraftState: candidateUpdater });
  const educationMutations = createDashboardEducationMutationController({
    shipped: local,
    draftState: createEmptyDashboardDraftState(),
    updateDraftState: candidateUpdater,
  });
  const contactMutations = createDashboardContactMutationController({
    shipped: local,
    draftState: createEmptyDashboardDraftState(),
    updateDraftState: candidateUpdater,
  });
  const neonConfig = getNeonConfig();
  const setActiveTab = (tab: DashboardTab) => {
    setActiveTabState(tab);
    saveActiveTab(tab);
  };
  const handleNavigate = (tab: DashboardTab) => {
    setActiveTab(tab);
    scheduleValidationSummaryScroll();
  };
  const handleOpenValidationArea = (area: 'flows' | 'education' | 'contacts' | 'export') => {
    setActiveTab(area);
    scheduleValidationSummaryScroll();
  };
  const flowValidation = useMemo(
    () =>
      validateDashboardFlows(
        local.flows,
        local.educationMaterials.map((resource) => resource.id),
      ),
    [local.flows, local.educationMaterials],
  );
  const educationValidation = useMemo(
    () => validateDashboardEducation(local.educationMaterials, local.educationGroups),
    [local.educationMaterials, local.educationGroups],
  );
  const contactValidation = useMemo(
    () => validateDashboardContacts(local.contacts, local.locations),
    [local.contacts, local.locations],
  );
  const validation = useMemo(
    () => ({
      errors: [...flowValidation.errors, ...educationValidation.errors, ...contactValidation.errors],
      warnings: [...flowValidation.warnings, ...educationValidation.warnings, ...contactValidation.warnings],
    }),
    [flowValidation, educationValidation, contactValidation],
  );
  const tabErrorCounts = {
    flows: flowValidation.errors.length,
    education: educationValidation.errors.length,
    contacts: contactValidation.errors.length,
  };
  const publicationDisabled =
    workspace.state.phase !== 'clean' || validation.errors.length > 0 || publication.readOnly || account === null;
  return (
    <Page>
      <PageHeader
        title="Painel administrativo"
        description="Gerencie o conteúdo publicado e consulte estatísticas agregadas de acesso."
      />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab} tabErrorCounts={tabErrorCounts}>
        <DashboardTabContent
          readOnly={readOnly}
          activeTab={activeTab}
          liveContent={liveContent}
          draftContent={local}
          workspace={workspace}
          draftRepository={editorialNeonServices.draftRepository}
          exportRepository={editorialNeonServices.exportRepository}
          connectionRepository={editorialNeonServices.connectionRepository}
          authUrl={neonConfig.authUrl}
          dataApiUrl={neonConfig.dataApiUrl}
          validation={validation}
          contactValidation={contactValidation}
          flowFocusRequest={null}
          educationFocusRequest={null}
          contactsFocusRequest={null}
          flowMutations={readOnly ? disabledFlowMutations : flowMutations}
          educationMutations={readOnly ? disabledEducationMutations : educationMutations}
          contactMutations={readOnly ? disabledContactMutations : contactMutations}
          onEditCandidate={updateCandidate}
          decisions={conflictDecisions}
          onDecide={handleDecide}
          onClearDecision={handleClearDecision}
          onApplyCandidate={applyCandidate}
          onDownloadRecovery={downloadRecovery}
          publicationPhase={publication.phase}
          publicationMessage={publication.message}
          publicationPreview={publication.preview}
          publicationBusy={publication.phase === 'preparing' || publication.phase === 'publishing'}
          publicationDisabled={publicationDisabled}
          onOpenPublicationReview={() => void publication.openReview()}
          onPublish={() => void publication.publish()}
          onClosePublicationReview={() => publication.closeReview()}
          onOpenValidationArea={handleOpenValidationArea}
          onNavigate={handleNavigate}
        />
      </DashboardShell>
    </Page>
  );
}

/** Read-only kill: local candidate edits never mutate under the flag. */
const disabledFlowMutations = {
  onFlowChange: () => undefined,
  onFlowAdd: () => undefined,
  onFlowImport: () => undefined,
  onFlowRemove: () => undefined,
} as const;
const disabledEducationMutations = {
  onResourceChange: () => undefined,
  onResourceAdd: () => '',
  onResourceRemove: () => undefined,
  onGroupChange: () => undefined,
  onGroupAdd: () => undefined,
  onGroupRemove: () => undefined,
  onGroupMove: () => undefined,
} as const;
const disabledContactMutations = {
  onServiceChange: () => undefined,
  onServiceAdd: () => '',
  onServiceRemove: () => undefined,
  onLocationChange: () => undefined,
  onLocationAdd: () => '',
  onLocationRemove: () => undefined,
} as const;

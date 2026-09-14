import { useCallback, useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import { createEmptyDashboardDraftState, type DashboardDraftState } from './dashboardDraftState';
import { mergeDashboardDrafts } from './dashboardDraftMerge';
import { Button } from '../design-system/components/Button';
import { AlertCircle, Download, Info, Upload } from 'lucide-react';
import { WorkspaceHistory } from './draft-storage/WorkspaceHistory';
import { usePublishedContent } from '../app/content/PublishedContentContext';
import type { PublishedContentPayload } from '../app/content/publishedContent';
import { loadActiveTab, saveActiveTab } from './draft-storage/dashboardTabStorage';
import { parsePayload, validatePublicationPayload } from '../app/content/publishedContent';
import { scheduleValidationFocus, scheduleValidationSummaryScroll } from './validation/validationNavigation';
import { createDraftFromAiPayload } from './ai/aiDraft';
import type { AiOperationEnvelope } from './ai/aiOperations';
import type { ContentDraft } from './draft-sync/contentDraft';
import { DashboardTabContent } from './DashboardTabContent';
import { createDashboardFlowMutationController } from './dashboardFlowMutations';
import { createDashboardEducationMutationController } from './dashboardEducationMutations';
import { createDashboardContactMutationController } from './dashboardContactMutations';
import { useDashboardImportRestore } from './dashboardImportRestore';
import { normalizeDashboardRemoteContent, useDashboardDerivedContent } from './dashboardDerivedContent';
import { createDashboardPublicationSuccessHandler } from './dashboardPublication';
import { getEditorFlags } from './editorFlags';
import type { ConflictDecisions, ValueSlot } from '@bemtevi/content-core';
import { useDraftWorkspace, useLegacyDraftWorkspace } from './draft-storage/useDraftWorkspace';
import { editorialNeonServices } from './editorialNeonServices';
import { getNeonConfig, defaultNeonClient } from '../app/neon/client';
import { useAdminAuth } from '../app/auth/AdminAuthContext';
import { usePublicationController } from './publishing/usePublicationController';
import {
  legacyPublishContent,
  createNeonPublishedContentGateway,
  type LegacyPublishFn as LegacyPublishRouteFn,
} from './publishing/legacyPublication';

/**
 * Coexistence selection (doc 16, INTEGRATION-02): `VITE_EDITOR_V2_ENABLED`
 * selects exactly ONE dashboard experience per render (build-time flags; no
 * runtime override — both persistence systems are never instantiated
 * together). `VITE_EDITOR_READ_ONLY` disables every browser-side mutation,
 * publication and connection-create action in the selected branch.
 */
export function DashboardRoute() {
  const flags = getEditorFlags();
  if (flags.v2Enabled) return <V2DashboardRoute readOnly={flags.readOnly} />;
  return <LegacyDashboardRoute readOnly={flags.readOnly} />;
}

function LegacyDashboardRoute({ readOnly }: { readOnly: boolean }) {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const [flowFocusRequest, setFlowFocusRequest] = useState<{ id: string; requestId: number } | null>(null);
  // prettier-ignore
  const [educationFocusRequest, setEducationFocusRequest] = useState<{ id: string; requestId: number; path?: string } | null>(null);
  // prettier-ignore
  const [contactsFocusRequest, setContactsFocusRequest] = useState<{ id: string; requestId: number; path?: string } | null>(null);
  const [mcpDraft, setMcpDraft] = useState<ContentDraft | null>(null);
  const { content: baseline, snapshot, refreshLatest } = usePublishedContent();
  const remoteContent = useMemo(() => normalizeDashboardRemoteContent(baseline), [baseline]);
  const store = useLegacyDraftWorkspace(remoteContent, snapshot?.revision ?? null);
  const { workspace, status: saveStatus, error: storageError, setError: setStorageError } = store;
  const derived = useDashboardDerivedContent(remoteContent, snapshot, workspace);
  // prettier-ignore
  const { mergedDrafts, draftState, hasBackgroundRevision, hasPendingDraft, publishedDraft, changeSummary, contactValidation, validation, tabErrorCounts } = derived;
  const handlePublished = createDashboardPublicationSuccessHandler(() => setMcpDraft(null));

  // prettier-ignore
  function setActiveTab(tab: DashboardTab) { setActiveTabState(tab); saveActiveTab(tab); }

  // prettier-ignore
  function handleNavigate(tab: DashboardTab, id?: string, path?: string) {
    setActiveTab(tab);
    if (!id) return void scheduleValidationSummaryScroll();
    const requestId = Date.now();
    if (tab === 'flows') setFlowFocusRequest({ id, requestId });
    else if (tab === 'education') setEducationFocusRequest({ id, requestId, path });
    else if (tab === 'contacts') setContactsFocusRequest({ id, requestId, path });
    // foco direto para campos com data-validation-path
    if (path) window.setTimeout(() => scheduleValidationFocus(path), 180);
  }

  // prettier-ignore
  function updateDraftState(updater: (current: DashboardDraftState) => DashboardDraftState) {
    store.update((current) => ({ ...current, local: mergeDashboardDrafts(current.local, updater(createEmptyDashboardDraftState())), reconciliation: undefined }));
  }
  const flowMutations = createDashboardFlowMutationController({ shipped: mergedDrafts, updateDraftState });
  // prettier-ignore
  const educationMutations = createDashboardEducationMutationController({ shipped: mergedDrafts, draftState, updateDraftState });
  // prettier-ignore
  const contactMutations = createDashboardContactMutationController({ shipped: mergedDrafts, draftState, updateDraftState, updateWorkspace: store.update });
  // The direct-table adapter stays reachable only from this legacy branch (INTEGRATION-02).
  // prettier-ignore
  const legacyPublish = useMemo<LegacyPublishRouteFn>(() => async (payload, publisherId, expectedRevision) => {
    if (defaultNeonClient === null) throw new Error('O cliente Neon não está configurado.');
    return legacyPublishContent(createNeonPublishedContentGateway(defaultNeonClient), { payload, publisherId, expectedRevision });
  }, []);
  // prettier-ignore
  const { fileInputRef, handleDownloadBackup, handleRestoreBackupFile, downloadBackup } = useDashboardImportRestore({ store, publishedDraft, revision: snapshot?.revision ?? null });

  // prettier-ignore
  function retryDraftSave() { void store.checkpoint(); }
  // prettier-ignore
  function resetLocalDrafts() { setMcpDraft(null); void store.archive(); }

  // prettier-ignore
  function handleAiApply(nextPayload: PublishedContentPayload, envelope: AiOperationEnvelope) {
    if (!mergedDrafts) return setStorageError('Aguarde o carregamento do conteúdo publicado antes de aplicar a resposta da IA.');
    if (snapshot === null || snapshot.revision !== envelope.baseRevision)
      return setStorageError('A resposta da IA foi criada para uma revisão diferente do Neon. Recarregue o Dashboard e solicite uma nova proposta para evitar sobrescrever alterações de outra pessoa.');
    if (hasPendingDraft)
      return setStorageError('A resposta da IA não foi aplicada porque há um rascunho local pendente. Publique-o ou faça uma cópia de segurança e descarte-o antes de usar a IA.');
    try {
      const validated = validatePublicationPayload(nextPayload); // valida estrutura completa e 5 MiB
      const aiDraft = createDraftFromAiPayload(mergedDrafts, publishedDraft, validated); // converte em rascunho local
      parsePayload(validated); // garante estrutura profunda
      updateDraftState(() => aiDraft);
      setActiveTab('export'); // revisão antes de publicar
      scheduleValidationSummaryScroll();
    } catch (e) {
      setStorageError(`A resposta da IA não pôde ser aplicada: ${e instanceof Error ? e.message : 'Conteúdo da IA inválido.'}`);
    }
  }

  // prettier-ignore
  async function handleMcpDraftOpen(nextDraft: ContentDraft) {
    if (workspace && workspace.mcpDraft?.draftId !== nextDraft.draftId)
      return setStorageError('O painel já possui um rascunho aberto. Arquive ou exporte essa cópia antes de abrir outro rascunho do assistente.');
    if (!(await store.restoreContentDraft(nextDraft))) return;
    setMcpDraft(nextDraft);
    setActiveTab('export');
  }

  // prettier-ignore
  function handleMcpDraftSynced(nextDraft: ContentDraft) { setMcpDraft(nextDraft); void store.markMcpDraftSynced(nextDraft); }

  return (
    <Page>
      {/* prettier-ignore */}
      <PageHeader title="Painel administrativo" description="Gerencie o conteúdo publicado e consulte estatísticas agregadas de acesso." />
      {/* prettier-ignore */}
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab} pendingChanges={changeSummary.ok ? changeSummary.value.length : undefined} draftUpdatedAt={saveStatus === 'saved' ? draftState.updatedAt : null} tabErrorCounts={tabErrorCounts}>
        <div inert={(store.locked || saveStatus === 'loading') && activeTab !== 'export'}>
          {/* prettier-ignore */}
          <WorkspaceHistory workspaces={store.available} disabled={store.locked || saveStatus === 'loading'} onRestore={store.restore} />
          <p role="status" className="font-body-md text-on-surface-variant">
            {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'saved' ? 'Salvo neste navegador' : saveStatus === 'loading' ? 'Carregando rascunhos…' : saveStatus === 'error' ? 'Não foi possível salvar' : 'Nenhum rascunho aberto'}
          </p>
          {!changeSummary.ok && <p role="alert">Não foi possível comparar as alterações. Seu rascunho não foi descartado.</p>}
          {/* prettier-ignore */}
          {store.recovery && (
            <section className="p-4">
              <h2 className="font-headline-sm">Recuperação assistida</h2>
              <p>Não foi encontrada uma base confiável. Baixe o original antes de reconstruir. A reconstrução aplica o material recuperável sobre a publicação atual e exige sua revisão; não recupera a ancestralidade perdida.</p>
              <Button variant="secondary" onClick={() => downloadBackup(store.recovery!)}>Baixar original</Button>
              <Button onClick={() => void store.recoverAgainstRemote()}>Reconstruir contra a publicação atual</Button>
            </section>
          )}
          {/* prettier-ignore */}
          {!workspace && store.available.length > 0 && (
            <section className="p-4">
              <h2 className="font-headline-sm">Rascunhos preservados</h2>
              <p>Retomar cria uma cópia independente. Nenhuma outra aba será substituída.</p>
              {store.available.map((item) => (
                <Button key={item.workspaceId} variant="secondary" onClick={() => void store.restore(JSON.stringify(item))}>
                  Retomar {item.archived ? 'arquivo' : 'rascunho'} {item.workspaceId.slice(0, 8)} (geração {item.generation})
                </Button>
              ))}
            </section>
          )}
          {/* prettier-ignore */}
          {hasBackgroundRevision && (
            <aside role="status" className="rounded-lg border border-primary/35 bg-primary-container/20 p-4 text-on-surface">
              <p className="flex items-center gap-2 font-label-md font-semibold text-primary">
                <Info aria-hidden="true" className="h-5 w-5 shrink-0" />
                Nova publicação detectada no banco (Revisão {snapshot?.revision})
              </p>
              <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">
                Outro administrador publicou alterações no banco de dados. Suas alterações locais continuam ativas e preservadas. Revise o resultado combinado na aba “Publicar” antes de confirmar uma nova publicação.
              </p>
            </aside>
          )}
          {/* prettier-ignore */}
          {storageError ? (
            <aside role="alert" className="rounded-lg border border-error/35 bg-error-container/55 p-4 text-on-error-container">
              <p className="flex items-center gap-2 font-label-md">
                <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
                Aviso sobre o salvamento local do rascunho
              </p>
              <p className="mt-1 max-w-[70ch] font-body-md">{storageError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={retryDraftSave}>Tentar salvar novamente</Button>
                <Button variant="secondary" size="sm" onClick={handleDownloadBackup}>
                  <Download className="mr-1 h-4 w-4" /> Baixar cópia de segurança (.json)
                </Button>
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> Restaurar de arquivo (.json)
                </Button>
              </div>
            </aside>
          ) : null}
          <DashboardTabContent mode="legacy" readOnly={readOnly} activeTab={activeTab} content={mergedDrafts}
            publishedContent={publishedDraft} remoteContent={remoteContent} workspace={workspace} draftState={draftState}
            validation={validation} contactValidation={contactValidation} flowFocusRequest={flowFocusRequest}
            educationFocusRequest={educationFocusRequest} contactsFocusRequest={contactsFocusRequest}
            flowMutations={readOnly ? disabledFlowMutations : flowMutations}
            educationMutations={readOnly ? disabledEducationMutations : educationMutations}
            contactMutations={readOnly ? disabledContactMutations : contactMutations} workspaceStore={store}
            mcpDraft={mcpDraft} snapshot={snapshot} hasPendingDraft={hasPendingDraft}
            onMcpDraftOpen={(nextDraft) => void handleMcpDraftOpen(nextDraft)} onMcpDraftAttach={setMcpDraft}
            onMcpDraftSynced={handleMcpDraftSynced} onAiApply={handleAiApply} onPublished={handlePublished}
            onResetDrafts={resetLocalDrafts} onDownloadBackup={handleDownloadBackup}
            onRestoreBackup={() => fileInputRef.current?.click()}
            onOpenValidationArea={(area) => { setActiveTab(area === 'export' ? 'export' : area); scheduleValidationSummaryScroll(); }}
            onNavigate={handleNavigate} legacyPublish={legacyPublish} legacyRefreshLatest={refreshLatest} />
        </div>
      </DashboardShell>
      {/* prettier-ignore */}
      <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" aria-hidden="true" onChange={handleRestoreBackupFile} />
    </Page>
  );
}

/** Read-only kill: legacy local persistence never mutates under the flag. */
// prettier-ignore
const disabledFlowMutations = { onFlowChange: () => undefined, onFlowAdd: () => undefined, onFlowImport: () => undefined, onFlowRemove: () => undefined } as const;
// prettier-ignore
const disabledEducationMutations = { onResourceChange: () => undefined, onResourceAdd: () => '', onResourceRemove: () => undefined, onGroupChange: () => undefined, onGroupAdd: () => undefined, onGroupRemove: () => undefined, onGroupMove: () => undefined } as const;
// prettier-ignore
const disabledContactMutations = { onServiceChange: () => undefined, onServiceAdd: () => '', onServiceRemove: () => undefined, onLocationChange: () => undefined, onLocationAdd: () => '', onLocationRemove: () => undefined } as const;

/**
 * V2 dashboard branch (INTEGRATION-02): canonical Neon draft through the
 * promoted `useDraftWorkspace` hook (repository registered by
 * `editorialNeonServices`), guarded publication via `usePublicationController`,
 * durable file export/import and connections through `AiArchiveSection` with
 * the canonical prop set. Never instantiates the legacy local persistence and
 * never imports the legacy direct-publication adapter.
 */
function V2DashboardRoute({ readOnly }: { readOnly: boolean }) {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const { account } = useAdminAuth();
  const { content: liveContent } = usePublishedContent();
  const workspace = useDraftWorkspace(account?.id ?? 'unauthenticated');
  // prettier-ignore
  const publication = usePublicationController({ repository: editorialNeonServices.draftRepository, flush: workspace.flush, refreshDraft: workspace.refresh, readOnly });
  const [conflictDecisions, setConflictDecisions] = useState<ConflictDecisions>({});
  // prettier-ignore
  const decide = useCallback((decisions: ConflictDecisions) => { if (!readOnly) { setConflictDecisions(decisions); void workspace.resolve(decisions); } }, [readOnly, workspace]);
  const handleDecide = useCallback(
    (conflictId: string, choice: ValueSlot) => decide({ ...conflictDecisions, [conflictId]: choice }),
    [conflictDecisions, decide],
  );
  // prettier-ignore
  const handleClearDecision = useCallback((conflictId: string) => { const decisions = { ...conflictDecisions }; delete decisions[conflictId]; decide(decisions); }, [conflictDecisions, decide]);
  const local = workspace.state.local ?? workspace.state.base?.payload ?? liveContent;
  const base = workspace.state.base?.payload ?? liveContent;
  // prettier-ignore
  const updateCandidate = useCallback((next: PublishedContentPayload) => { if (!readOnly) workspace.edit(next); }, [readOnly, workspace]);
  // prettier-ignore
  const applyCandidate = useCallback(async (_basePayload: PublishedContentPayload, candidate: PublishedContentPayload) => { if (readOnly) return false; workspace.edit(candidate); return workspace.flush(); }, [readOnly, workspace]);
  // prettier-ignore
  const downloadRecovery = useCallback(() => {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'bemtevi-rascunho.json'; anchor.click(); URL.revokeObjectURL(url);
  }, [local]);
  // prettier-ignore
  const candidateUpdater = (updater: (current: DashboardDraftState) => DashboardDraftState) => { updateCandidate(mergeDashboardDrafts(local, updater(createEmptyDashboardDraftState()))); };
  // prettier-ignore
  const flowMutations = createDashboardFlowMutationController({ shipped: base, updateDraftState: candidateUpdater });
  // prettier-ignore
  const educationMutations = createDashboardEducationMutationController({ shipped: base, draftState: createEmptyDashboardDraftState(), updateDraftState: candidateUpdater });
  // prettier-ignore
  const contactMutations = createDashboardContactMutationController({ shipped: base, draftState: createEmptyDashboardDraftState(), updateDraftState: candidateUpdater, updateWorkspace: () => undefined });
  const neonConfig = getNeonConfig();
  // prettier-ignore
  const publicationDisabled = workspace.state.phase !== 'clean' || publication.readOnly || account === null;
  // prettier-ignore
  function setActiveTab(tab: DashboardTab) { setActiveTabState(tab); saveActiveTab(tab); }
  function handleNavigate(tab: DashboardTab) {
    setActiveTab(tab);
    scheduleValidationSummaryScroll();
  }
  const validation = useMemo(() => ({ errors: [], warnings: [] }), []);
  const contactValidation = useMemo(() => ({ errors: [], warnings: [] }), []);
  return (
    <Page>
      {/* prettier-ignore */}
      <PageHeader title="Painel administrativo" description="Gerencie o conteúdo publicado e consulte estatísticas agregadas de acesso." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab} tabErrorCounts={{}}>
        {/* prettier-ignore */}
        <DashboardTabContent mode="v2" readOnly={readOnly} activeTab={activeTab} liveContent={liveContent} workspace={workspace}
          draftRepository={editorialNeonServices.draftRepository} exportRepository={editorialNeonServices.exportRepository}
          connectionRepository={editorialNeonServices.connectionRepository} authUrl={neonConfig.authUrl} dataApiUrl={neonConfig.dataApiUrl}
          validation={validation} contactValidation={contactValidation} flowFocusRequest={null} educationFocusRequest={null}
          contactsFocusRequest={null} flowMutations={readOnly ? disabledFlowMutations : flowMutations}
          educationMutations={readOnly ? disabledEducationMutations : educationMutations}
          contactMutations={readOnly ? disabledContactMutations : contactMutations} onEditCandidate={updateCandidate}
          decisions={conflictDecisions} onDecide={handleDecide} onClearDecision={handleClearDecision}
          onApplyCandidate={applyCandidate} onDownloadRecovery={downloadRecovery} publicationPhase={publication.phase}
          publicationMessage={publication.message} publicationPreview={publication.preview}
          publicationBusy={publication.phase === 'preparing' || publication.phase === 'publishing'}
          publicationDisabled={publicationDisabled} onOpenPublicationReview={() => void publication.openReview()}
          onPublish={() => void publication.publish()} onClosePublicationReview={() => publication.closeReview()}
          onOpenValidationArea={() => undefined} onNavigate={handleNavigate} />
      </DashboardShell>
    </Page>
  );
}

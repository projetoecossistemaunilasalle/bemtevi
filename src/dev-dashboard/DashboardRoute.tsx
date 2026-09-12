import { useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import {
  createEmptyDashboardDraftState,
  mergeDashboardDrafts,
  type DashboardDraftState,
} from './draft-storage/dashboardStorage';
import { Button } from '../design-system/components/Button';
import { AlertCircle, Download, Info, Upload } from 'lucide-react';
import { useDraftWorkspace } from './draft-storage/useDraftWorkspace';
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

export function DashboardRoute() {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const [flowFocusRequest, setFlowFocusRequest] = useState<{ id: string; requestId: number } | null>(null);
  const [educationFocusRequest, setEducationFocusRequest] = useState<{
    id: string;
    requestId: number;
    path?: string;
  } | null>(null);
  const [contactsFocusRequest, setContactsFocusRequest] = useState<{
    id: string;
    requestId: number;
    path?: string;
  } | null>(null);
  const [mcpDraft, setMcpDraft] = useState<ContentDraft | null>(null);
  const { content: baseline, snapshot } = usePublishedContent();
  const remoteContent = useMemo(() => normalizeDashboardRemoteContent(baseline), [baseline]);
  const store = useDraftWorkspace(remoteContent, snapshot?.revision ?? null);
  const { workspace, status: saveStatus, error: storageError, setError: setStorageError } = store;
  const derived = useDashboardDerivedContent(remoteContent, snapshot, workspace);
  const {
    mergedDrafts,
    draftState,
    hasBackgroundRevision,
    hasPendingDraft,
    publishedDraft,
    changeSummary,
    contactValidation,
    validation,
    tabErrorCounts,
  } = derived;
  const shipped = mergedDrafts;
  const handlePublished = createDashboardPublicationSuccessHandler(() => setMcpDraft(null));

  function setActiveTab(tab: DashboardTab) {
    setActiveTabState(tab);
    saveActiveTab(tab);
  }

  function handleNavigate(tab: DashboardTab, id?: string, path?: string) {
    setActiveTab(tab);
    if (!id) {
      scheduleValidationSummaryScroll();
      return;
    }
    const requestId = Date.now();
    if (tab === 'flows') {
      setFlowFocusRequest({ id, requestId });
    } else if (tab === 'education') {
      setEducationFocusRequest({ id, requestId, path });
    } else if (tab === 'contacts') {
      setContactsFocusRequest({ id, requestId, path });
    }
    if (path) {
      // Também tenta foco direto para campos que usam data-validation-path
      window.setTimeout(() => scheduleValidationFocus(path), 180);
    }
  }

  function updateDraftState(updater: (current: DashboardDraftState) => DashboardDraftState) {
    store.update((current) => {
      const operation = updater(createEmptyDashboardDraftState());
      return { ...current, local: mergeDashboardDrafts(current.local, operation), reconciliation: undefined };
    });
  }

  const flowMutations = createDashboardFlowMutationController({ shipped: mergedDrafts, updateDraftState });
  const educationMutations = createDashboardEducationMutationController({
    shipped: mergedDrafts,
    draftState,
    updateDraftState,
  });
  const contactMutations = createDashboardContactMutationController({
    shipped: mergedDrafts,
    draftState,
    updateDraftState,
    updateWorkspace: store.update,
  });
  const { fileInputRef, handleDownloadBackup, handleRestoreBackupFile, downloadBackup } = useDashboardImportRestore({
    store,
    publishedDraft,
    revision: snapshot?.revision ?? null,
  });

  function retryDraftSave() {
    void store.checkpoint();
  }
  function resetLocalDrafts() {
    setMcpDraft(null);
    void store.archive();
  }

  function handleAiApply(nextPayload: PublishedContentPayload, envelope: AiOperationEnvelope) {
    if (!shipped) {
      setStorageError('Aguarde o carregamento do conteúdo publicado antes de aplicar a resposta da IA.');
      return;
    }
    if (snapshot === null || snapshot.revision !== envelope.baseRevision) {
      setStorageError(
        'A resposta da IA foi criada para uma revisão diferente do Neon. Recarregue o Dashboard e solicite uma nova proposta para evitar sobrescrever alterações de outra pessoa.',
      );
      return;
    }
    if (hasPendingDraft) {
      setStorageError(
        'A resposta da IA não foi aplicada porque há um rascunho local pendente. Publique-o ou faça uma cópia de segurança e descarte-o antes de usar a IA.',
      );
      return;
    }
    try {
      // Valida estrutura completa e tamanho (5 MiB) usando validador existente
      const validated = validatePublicationPayload(nextPayload);
      // Converte payload da IA em rascunho local (patches/adicionados/removidos) comparando com o publicado
      const aiDraft = createDraftFromAiPayload(shipped, publishedDraft, validated);
      // Verifica se parsePayload não lança (estrutura profunda)
      parsePayload(validated);
      updateDraftState(() => aiDraft);
      // Leva o admin para a aba Publicar/Exportar para revisar antes de publicar
      setActiveTab('export');
      scheduleValidationSummaryScroll();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Conteúdo da IA inválido.';
      setStorageError(`A resposta da IA não pôde ser aplicada: ${message}`);
      // Mantém rascunho atual intacto
    }
  }

  async function handleMcpDraftOpen(nextDraft: ContentDraft) {
    if (workspace && workspace.mcpDraft?.draftId !== nextDraft.draftId) {
      setStorageError(
        'O painel já possui um rascunho aberto. Arquive ou exporte essa cópia antes de abrir outro rascunho do assistente.',
      );
      return;
    }
    const opened = await store.restoreContentDraft(nextDraft);
    if (!opened) return;
    setMcpDraft(nextDraft);
    setActiveTab('export');
  }

  function handleMcpDraftSynced(nextDraft: ContentDraft) {
    setMcpDraft(nextDraft);
    void store.markMcpDraftSynced(nextDraft);
  }

  return (
    <Page>
      <PageHeader
        title="Painel administrativo"
        description="Gerencie o conteúdo publicado e consulte estatísticas agregadas de acesso."
      />
      <DashboardShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingChanges={changeSummary.ok ? changeSummary.value.length : undefined}
        draftUpdatedAt={saveStatus === 'saved' ? draftState.updatedAt : null}
        tabErrorCounts={tabErrorCounts}
      >
        <div inert={(store.locked || saveStatus === 'loading') && activeTab !== 'export'}>
          <WorkspaceHistory
            workspaces={store.available}
            disabled={store.locked || saveStatus === 'loading'}
            onRestore={store.restore}
          />
          <p role="status" className="font-body-md text-on-surface-variant">
            {saveStatus === 'saving'
              ? 'Salvando…'
              : saveStatus === 'saved'
                ? 'Salvo neste navegador'
                : saveStatus === 'loading'
                  ? 'Carregando rascunhos…'
                  : saveStatus === 'error'
                    ? 'Não foi possível salvar'
                    : 'Nenhum rascunho aberto'}
          </p>
          {!changeSummary.ok && (
            <p role="alert">Não foi possível comparar as alterações. Seu rascunho não foi descartado.</p>
          )}
          {store.recovery && (
            <section className="p-4">
              <h2 className="font-headline-sm">Recuperação assistida</h2>
              <p>
                Não foi encontrada uma base confiável. Baixe o original antes de reconstruir. A reconstrução aplica o
                material recuperável sobre a publicação atual e exige sua revisão; não recupera a ancestralidade
                perdida.
              </p>
              <Button variant="secondary" onClick={() => downloadBackup(store.recovery!)}>
                Baixar original
              </Button>
              <Button onClick={() => void store.recoverAgainstRemote()}>Reconstruir contra a publicação atual</Button>
            </section>
          )}
          {!workspace && store.available.length > 0 && (
            <section className="p-4">
              <h2 className="font-headline-sm">Rascunhos preservados</h2>
              <p>Retomar cria uma cópia independente. Nenhuma outra aba será substituída.</p>
              {store.available.map((item) => (
                <Button
                  key={item.workspaceId}
                  variant="secondary"
                  onClick={() => void store.restore(JSON.stringify(item))}
                >
                  Retomar {item.archived ? 'arquivo' : 'rascunho'} {item.workspaceId.slice(0, 8)} (geração{' '}
                  {item.generation})
                </Button>
              ))}
            </section>
          )}
          {hasBackgroundRevision && (
            <aside
              role="status"
              className="rounded-lg border border-primary/35 bg-primary-container/20 p-4 text-on-surface"
            >
              <p className="flex items-center gap-2 font-label-md font-semibold text-primary">
                <Info aria-hidden="true" className="h-5 w-5 shrink-0" />
                Nova publicação detectada no banco (Revisão {snapshot?.revision})
              </p>
              <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">
                Outro administrador publicou alterações no banco de dados. Suas alterações locais continuam ativas e
                preservadas. Revise o resultado combinado na aba “Publicar” antes de confirmar uma nova publicação.
              </p>
            </aside>
          )}
          {storageError ? (
            <aside
              role="alert"
              className="rounded-lg border border-error/35 bg-error-container/55 p-4 text-on-error-container"
            >
              <p className="flex items-center gap-2 font-label-md">
                <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
                Aviso sobre o salvamento local do rascunho
              </p>
              <p className="mt-1 max-w-[70ch] font-body-md">{storageError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={retryDraftSave}>
                  Tentar salvar novamente
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownloadBackup}>
                  <Download className="mr-1 h-4 w-4" /> Baixar cópia de segurança (.json)
                </Button>
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1 h-4 w-4" /> Restaurar de arquivo (.json)
                </Button>
              </div>
            </aside>
          ) : null}
          <DashboardTabContent
            activeTab={activeTab}
            content={mergedDrafts}
            publishedContent={publishedDraft}
            remoteContent={remoteContent}
            workspace={workspace}
            draftState={draftState}
            validation={validation}
            contactValidation={contactValidation}
            flowFocusRequest={flowFocusRequest}
            educationFocusRequest={educationFocusRequest}
            contactsFocusRequest={contactsFocusRequest}
            flowMutations={flowMutations}
            educationMutations={educationMutations}
            contactMutations={contactMutations}
            workspaceStore={store}
            mcpDraft={mcpDraft}
            snapshot={snapshot}
            hasPendingDraft={hasPendingDraft}
            onMcpDraftOpen={(nextDraft) => void handleMcpDraftOpen(nextDraft)}
            onMcpDraftAttach={setMcpDraft}
            onMcpDraftSynced={handleMcpDraftSynced}
            onAiApply={handleAiApply}
            onPublished={handlePublished}
            onResetDrafts={resetLocalDrafts}
            onDownloadBackup={handleDownloadBackup}
            onRestoreBackup={() => fileInputRef.current?.click()}
            onOpenValidationArea={(area) => {
              setActiveTab(area === 'export' ? 'export' : area);
              scheduleValidationSummaryScroll();
            }}
            onNavigate={handleNavigate}
          />
        </div>
      </DashboardShell>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        onChange={handleRestoreBackupFile}
      />
    </Page>
  );
}

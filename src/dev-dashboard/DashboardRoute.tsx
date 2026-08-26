import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import {
  createEmptyDashboardDraftState,
  type DashboardRecordPatch,
  type DashboardDraftState,
  DASHBOARD_STORAGE_KEY,
  exportDraftAsJson,
  hasDashboardChanges,
  importDraftFromJson,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  resetDashboardDrafts,
  restoreDraftFromIndexedDbFallback,
  saveDashboardDrafts,
} from './draft-storage/dashboardStorage';
import { Button } from '../design-system/components/Button';
import { AlertCircle, Download, Info, Upload } from 'lucide-react';
import { EducationDashboard } from './education/EducationDashboard';
import { validateDashboardEducation } from './education/educationValidation';
import { ExportDashboard } from './export/ExportDashboard';
import { PublishDashboard } from './publishing/PublishDashboard';
import { computeChangeSummary } from './publishing/changeSummary';
import { getDashboardPublishMode } from './publishing/publishMode';
import { usePublishedContent } from '../app/content/PublishedContentContext';
import type { PublishedContentPayload } from '../app/content/publishedContent';
import { FlowDashboard } from './flows/FlowDashboard';
import { validateDashboardFlows } from './flows/flowValidation';
import { defaultFeaturedImageId } from '../content/resources/featuredImages';
import { DEFAULT_EDUCATION_GROUP_ID } from '../content/resources/groups';
import type { EducationResourceGroup } from '../content/resources/groups';
import { loadActiveTab, saveActiveTab } from './draft-storage/dashboardTabStorage';
import { ContactsDashboard } from './contacts/ContactsDashboard';
import { createLocalLocation, createLocalService } from './contacts/contactDrafts';
import { validateDashboardContacts } from './contacts/contactsValidation';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { normalizeContactLocations } from '../domain/services/locations';
import type { PublishedContentSnapshot } from '../app/content/publishedContent';
import type { DashboardShippedContent } from './content/shippedContent';
import { scheduleValidationSummaryScroll } from './validation/validationNavigation';

function upsertPatchById<T extends { id: string }>(
  records: Array<DashboardRecordPatch<T>>,
  id: string,
  sourceIndex: number,
  patch: Partial<T>,
  sourceIdUnique?: boolean,
) {
  const existingIndex = records.findIndex((record) => record.id === id && record.sourceIndex === sourceIndex);
  const sameIdIndexes = records.flatMap((record, index) => (record.id === id ? [index] : []));
  const rebaseIndex =
    existingIndex === -1 &&
    sameIdIndexes.length === 1 &&
    (sourceIdUnique === true || (sourceIdUnique === undefined && records[sameIdIndexes[0]]?.sourceIdUnique !== false))
      ? sameIdIndexes[0]
      : -1;
  const targetIndex = existingIndex === -1 ? rebaseIndex : existingIndex;
  const uniquenessMetadata = sourceIdUnique === undefined ? {} : { sourceIdUnique };
  if (targetIndex === -1) return [...records, { id, sourceIndex, ...uniquenessMetadata, patch }];

  return records.map((record, index) =>
    index === targetIndex
      ? { ...record, id, sourceIndex, ...uniquenessMetadata, patch: { ...record.patch, ...patch } }
      : record,
  );
}

function createLocalEducationMaterial(existingCount: number) {
  const suffix = existingCount + 1;

  return {
    id: `material-local-${suffix}`,
    title: 'Novo material',
    source: 'Equipe BemTeVi',
    description: 'Material editável apenas neste navegador.',
    imageUrl: '',
    tags: ['novo'],
    audience: 'teachers' as const,
    featuredImage: { kind: 'catalog' as const, imageId: defaultFeaturedImageId },
    body: [
      {
        id: `material-local-${suffix}-overview`,
        kind: 'paragraph' as const,
        title: 'Sobre este material',
        text: 'Descreva aqui o conteúdo principal do material.',
      },
    ],
    review: { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' },
  };
}

function createLocalGroup(existingAddedGroups: EducationResourceGroup[], shippedGroups: EducationResourceGroup[]) {
  let suffix = 1;
  const allGroupIds = new Set([...shippedGroups, ...existingAddedGroups].map((g) => g.id));
  while (allGroupIds.has(`group-local-${suffix}`)) {
    suffix++;
  }

  return {
    id: `group-local-${suffix}`,
    title: 'Novo grupo',
    description: '',
    order: shippedGroups.length + existingAddedGroups.length + 1,
  };
}

function createLocalFlow(existingCount: number) {
  const suffix = existingCount + 1;
  const id = `flow-local-${suffix}`;

  return {
    id,
    version: '1.0.0' as const,
    locale: 'pt-BR' as const,
    title: 'Novo fluxo',
    type: 'guided_conversation' as const,
    status: 'draft' as const,
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Começar'],
      transitionMessage: 'Olá.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice' as const,
        text: 'Como você quer continuar?',
        options: [{ id: 'done', label: 'Continuar', next: 'done' }],
      },
      done: {
        id: 'done',
        kind: 'result' as const,
        text: 'Finalizado.',
      },
    },
  };
}

function updateRecordAtIndex<T>(records: T[], index: number, patch: Partial<T>) {
  return records.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record));
}

function findGroupIndex(groups: EducationResourceGroup[], groupId: string) {
  return groups.findIndex((group) => group.id === groupId);
}

function toPublishedContentPayload(content: DashboardShippedContent): PublishedContentPayload {
  return {
    flows: content.flows,
    educationMaterials: content.educationMaterials,
    educationGroups: content.educationGroups,
    contacts: content.contacts,
    locations: content.locations ?? [],
    defaultGroupOrder: content.defaultGroupOrder ?? 0,
  };
}

type ContactOrigin =
  | { kind: 'shipped'; sourceIndex: number; id: string }
  | { kind: 'added'; addedIndex: number; id: string };

type LocationOrigin =
  | { kind: 'shipped'; sourceIndex: number; id: string }
  | { kind: 'added'; addedIndex: number; id: string };

type EducationResourceOrigin =
  | { kind: 'shipped'; sourceIndex: number; id: string }
  | { kind: 'added'; addedIndex: number; id: string };

function resolveEducationResourceOrigin(
  shippedResources: Array<{ id: string }>,
  addedResources: Array<{ id: string }>,
  removedResourceIds: readonly string[],
  mergedIndex: number,
  id?: string,
): EducationResourceOrigin | undefined {
  const removedIds = new Set(removedResourceIds);
  const origins: EducationResourceOrigin[] = [];

  shippedResources.forEach((resource, sourceIndex) => {
    if (!removedIds.has(resource.id)) origins.push({ kind: 'shipped', sourceIndex, id: resource.id });
  });
  addedResources.forEach((resource, addedIndex) => {
    if (!removedIds.has(resource.id)) origins.push({ kind: 'added', addedIndex, id: resource.id });
  });

  if (origins[mergedIndex] && (!id || origins[mergedIndex]?.id === id)) {
    return origins[mergedIndex];
  }
  if (id) {
    const addedIndex = addedResources.findIndex((r) => r.id === id);
    if (addedIndex >= 0) return { kind: 'added', addedIndex, id };
    const sourceIndex = shippedResources.findIndex((r) => r.id === id);
    if (sourceIndex >= 0) return { kind: 'shipped', sourceIndex, id };
  }
  return origins[mergedIndex];
}

function resolveContactOrigin(
  shippedContacts: Array<{ id: string }>,
  addedContacts: Array<{ id: string }>,
  removedContactIds: readonly string[],
  mergedIndex: number,
  id?: string,
): ContactOrigin | undefined {
  const removedIds = new Set(removedContactIds);
  const origins: ContactOrigin[] = [];

  shippedContacts.forEach((contact, sourceIndex) => {
    if (!removedIds.has(contact.id)) origins.push({ kind: 'shipped', sourceIndex, id: contact.id });
  });
  addedContacts.forEach((contact, addedIndex) => {
    if (!removedIds.has(contact.id)) origins.push({ kind: 'added', addedIndex, id: contact.id });
  });

  if (origins[mergedIndex] && (!id || origins[mergedIndex]?.id === id)) {
    return origins[mergedIndex];
  }
  if (id) {
    const addedIndex = addedContacts.findIndex((c) => c.id === id);
    if (addedIndex >= 0) return { kind: 'added', addedIndex, id };
    const sourceIndex = shippedContacts.findIndex((c) => c.id === id);
    if (sourceIndex >= 0) return { kind: 'shipped', sourceIndex, id };
  }
  return origins[mergedIndex];
}

function resolveLocationOrigin(
  shippedLocations: Array<{ id: string }>,
  addedLocations: Array<{ id: string }>,
  removedLocationIds: readonly string[],
  mergedIndex: number,
  id?: string,
): LocationOrigin | undefined {
  const removedIds = new Set(removedLocationIds);
  const origins: LocationOrigin[] = [];

  shippedLocations.forEach((location, sourceIndex) => {
    if (!removedIds.has(location.id)) origins.push({ kind: 'shipped', sourceIndex, id: location.id });
  });
  addedLocations.forEach((location, addedIndex) => {
    if (!removedIds.has(location.id)) origins.push({ kind: 'added', addedIndex, id: location.id });
  });

  if (origins[mergedIndex] && (!id || origins[mergedIndex]?.id === id)) {
    return origins[mergedIndex];
  }
  if (id) {
    const addedIndex = addedLocations.findIndex((l) => l.id === id);
    if (addedIndex >= 0) return { kind: 'added', addedIndex, id };
    const sourceIndex = shippedLocations.findIndex((l) => l.id === id);
    if (sourceIndex >= 0) return { kind: 'shipped', sourceIndex, id };
  }
  return origins[mergedIndex];
}

export function DashboardRoute() {
  const [activeTab, setActiveTabState] = useState<DashboardTab>(() => loadActiveTab());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { content: baseline, snapshot } = usePublishedContent();
  const publishMode = getDashboardPublishMode();
  const shipped = useMemo(() => {
    if (!baseline) return baseline;

    const normalized = normalizeContactLocations(baseline.contacts, baseline.locations ?? [], {
      allowDerivation: baseline.locations === undefined,
    });
    return {
      ...baseline,
      contacts: normalized.contacts,
      locations: normalized.locations,
    };
  }, [baseline]);
  const [draftState, setDraftState] = useState(() => loadDashboardDrafts());
  const [storageError, setStorageError] = useState<string | null>(null);
  const mergedDrafts = useMemo(() => mergeDashboardDrafts(shipped, draftState), [draftState, shipped]);

  useEffect(() => {
    let active = true;
    void restoreDraftFromIndexedDbFallback().then((restored) => {
      if (!active || !restored) return;
      setDraftState((current) => {
        if (hasDashboardChanges(current)) return current;
        return restored;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key !== DASHBOARD_STORAGE_KEY) return;
      if (event.newValue === null) {
        setDraftState(createEmptyDashboardDraftState());
        return;
      }
      try {
        const nextDraft = loadDashboardDrafts({
          getItem: () => event.newValue,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 1,
        });
        setDraftState((current) => {
          if (nextDraft.updatedAt && current.updatedAt) {
            const nextTime = new Date(nextDraft.updatedAt).getTime();
            const currentTime = new Date(current.updatedAt).getTime();
            if (nextTime <= currentTime) return current;
          }
          return nextDraft;
        });
      } catch {
        // Ignore malformed storage payload from external tab
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const hasBackgroundRevision =
    snapshot !== null &&
    typeof draftState.baseRevision === 'number' &&
    snapshot.revision > draftState.baseRevision &&
    hasDashboardChanges(draftState);

  function setActiveTab(tab: DashboardTab) {
    setActiveTabState(tab);
    saveActiveTab(tab);
  }

  function updateDraftState(updater: (current: DashboardDraftState) => DashboardDraftState) {
    setDraftState((current) => {
      const updatedDraft = updater(current);
      const startsDraft = !hasDashboardChanges(current) && hasDashboardChanges(updatedDraft);
      const baseRevision = current.baseRevision === undefined ? (snapshot?.revision ?? null) : current.baseRevision;
      const basePayload = current.basePayload ?? (startsDraft ? toPublishedContentPayload(shipped) : undefined);
      const next = {
        ...updatedDraft,
        baseRevision,
        ...(basePayload ? { basePayload } : {}),
        updatedAt: new Date().toISOString(),
      };

      try {
        saveDashboardDrafts(next);
        queueMicrotask(() => setStorageError(null));
      } catch {
        queueMicrotask(() =>
          setStorageError(
            'Não foi possível salvar o rascunho no localStorage deste navegador. Uma cópia de segurança está no banco de dados local (IndexedDB) e na memória desta página.',
          ),
        );
      }
      return next;
    });
  }

  const contactValidation = useMemo(
    () => validateDashboardContacts(mergedDrafts.contacts, mergedDrafts.locations),
    [mergedDrafts.contacts, mergedDrafts.locations],
  );
  const flowValidation = useMemo(
    () =>
      validateDashboardFlows(
        mergedDrafts.flows,
        mergedDrafts.educationMaterials.map((resource) => resource.id),
      ),
    [mergedDrafts],
  );
  const educationValidation = useMemo(
    () => validateDashboardEducation(mergedDrafts.educationMaterials, mergedDrafts.educationGroups),
    [mergedDrafts],
  );
  const validation = useMemo(
    () => ({
      errors: [...flowValidation.errors, ...educationValidation.errors, ...contactValidation.errors],
      warnings: [...flowValidation.warnings, ...educationValidation.warnings, ...contactValidation.warnings],
    }),
    [flowValidation, educationValidation, contactValidation],
  );
  const drafts = {
    flows: mergedDrafts.flows,
    educationMaterials: mergedDrafts.educationMaterials,
    educationGroups: mergedDrafts.educationGroups,
    contacts: mergedDrafts.contacts,
    locations: mergedDrafts.locations,
    defaultGroupOrder: mergedDrafts.defaultGroupOrder,
    removedEducationGroupIds: draftState.removedGroupIds ?? [],
    removedEducationMaterialIds: draftState.removedEducationMaterialIds ?? [],
    removedContactIds: draftState.removedContactIds ?? [],
    removedLocationIds: draftState.removedLocationIds ?? [],
  };
  const publishedDraft = useMemo<PublishedContentPayload>(
    () => ({
      flows: mergedDrafts.flows,
      educationMaterials: mergedDrafts.educationMaterials,
      educationGroups: mergedDrafts.educationGroups,
      contacts: mergedDrafts.contacts,
      locations: mergedDrafts.locations,
      defaultGroupOrder: mergedDrafts.defaultGroupOrder,
    }),
    [mergedDrafts],
  );

  function rebaseDraftAfterMergeConflict(nextSnapshot: PublishedContentSnapshot) {
    setDraftState((current) => {
      if (!hasDashboardChanges(current)) return current;

      const next = {
        ...current,
        baseRevision: nextSnapshot.revision,
        basePayload: nextSnapshot.payload,
        updatedAt: new Date().toISOString(),
      };
      try {
        saveDashboardDrafts(next);
        queueMicrotask(() => setStorageError(null));
      } catch {
        queueMicrotask(() =>
          setStorageError(
            'O conteúdo publicado foi atualizado, mas não foi possível salvar a nova base do rascunho no localStorage.',
          ),
        );
      }
      return next;
    });
  }
  const changeSummary = useMemo(() => computeChangeSummary(shipped, publishedDraft), [shipped, publishedDraft]);
  const tabErrorCounts: Partial<Record<DashboardTab, number>> = {
    flows: flowValidation.errors.length,
    education: educationValidation.errors.length,
    contacts: contactValidation.errors.length,
  };

  function retryDraftSave() {
    try {
      saveDashboardDrafts(draftState);
      setStorageError(null);
    } catch {
      setStorageError(
        'O navegador ainda não permite salvar o rascunho no localStorage. Verifique o espaço disponível ou baixe uma cópia de segurança em arquivo.',
      );
    }
  }

  function handleDownloadBackup() {
    const json = exportDraftAsJson(draftState);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bemtevi-rascunho-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleRestoreBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const imported = importDraftFromJson(text);
        setDraftState(imported);
        saveDashboardDrafts(imported);
        setStorageError(null);
      } catch (err) {
        setStorageError(err instanceof Error ? err.message : 'Falha ao restaurar rascunho do arquivo.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetLocalDrafts() {
    try {
      setDraftState(resetDashboardDrafts());
      setStorageError(null);
    } catch {
      setStorageError(
        'Não foi possível apagar o rascunho deste navegador. Nada foi descartado; verifique a permissão de armazenamento e tente novamente.',
      );
    }
  }

  function clearDraftsAfterPublication() {
    try {
      setDraftState(resetDashboardDrafts());
      setStorageError(null);
    } catch {
      setDraftState(createEmptyDashboardDraftState());
      setStorageError(
        'A publicação foi concluída, mas o navegador não conseguiu apagar a cópia local antiga. Evite recarregar a página até liberar o armazenamento.',
      );
    }
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
        publishMode={publishMode}
        pendingChanges={changeSummary.total}
        draftUpdatedAt={draftState.updatedAt}
        tabErrorCounts={tabErrorCounts}
      >
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
              seguras. Ao publicar suas alterações na aba “Publicar”, as modificações serão mescladas automaticamente.
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
        {activeTab === 'flows' && (
          <FlowDashboard
            flows={mergedDrafts.flows}
            resources={mergedDrafts.educationMaterials}
            onFlowChange={(flowIndex, flowId, patch) =>
              updateDraftState((current) => ({
                ...current,
                flowPatches: upsertPatchById(current.flowPatches, flowId, flowIndex, patch),
              }))
            }
            onFlowAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedFlows: [...current.addedFlows, createLocalFlow(current.addedFlows.length)],
              }))
            }
            onFlowRemove={(flowId) =>
              updateDraftState((current) => {
                const shippedIndex = shipped.flows.findIndex((f) => f.id === flowId);
                return {
                  ...current,
                  addedFlows: current.addedFlows.filter((f) => f.id !== flowId),
                  removedFlowIds:
                    shippedIndex >= 0
                      ? [...new Set([...(current.removedFlowIds ?? []), flowId])]
                      : current.removedFlowIds,
                };
              })
            }
          />
        )}
        {activeTab === 'education' && (
          <EducationDashboard
            resources={mergedDrafts.educationMaterials}
            groups={mergedDrafts.educationGroups}
            defaultGroupOrder={mergedDrafts.defaultGroupOrder}
            onResourceChange={(resourceIndex, resourceId, patch) =>
              updateDraftState((current) => {
                const origin = resolveEducationResourceOrigin(
                  shipped.educationMaterials,
                  current.addedEducationMaterials,
                  current.removedEducationMaterialIds ?? [],
                  resourceIndex,
                  resourceId,
                );
                if (!origin || origin.id !== resourceId) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedEducationMaterials: updateRecordAtIndex(
                      current.addedEducationMaterials,
                      origin.addedIndex,
                      patch,
                    ),
                  };
                }

                return {
                  ...current,
                  educationMaterialPatches: upsertPatchById(
                    current.educationMaterialPatches,
                    resourceId,
                    origin.sourceIndex,
                    patch,
                  ),
                };
              })
            }
            onResourceAdd={() => {
              const newMaterial = createLocalEducationMaterial(
                shipped.educationMaterials.length + draftState.addedEducationMaterials.length,
              );
              updateDraftState((current) => ({
                ...current,
                addedEducationMaterials: [...current.addedEducationMaterials, newMaterial],
              }));
              return newMaterial.id;
            }}
            onResourceRemove={(resourceIndex, resourceId) =>
              updateDraftState((current) => {
                const origin = resolveEducationResourceOrigin(
                  shipped.educationMaterials,
                  current.addedEducationMaterials,
                  current.removedEducationMaterialIds ?? [],
                  resourceIndex,
                  resourceId,
                );
                if (!origin || origin.id !== resourceId) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedEducationMaterials: current.addedEducationMaterials.filter(
                      (_, index) => index !== origin.addedIndex,
                    ),
                  };
                }

                return {
                  ...current,
                  educationMaterialPatches: current.educationMaterialPatches.filter((patch) => patch.id !== origin.id),
                  removedEducationMaterialIds: [
                    ...new Set([...(current.removedEducationMaterialIds ?? []), origin.id]),
                  ],
                };
              })
            }
            onGroupChange={(groupIndex, groupId, patch) =>
              updateDraftState((current) => {
                const addedIndex = findGroupIndex(current.addedGroups, groupId);

                if (addedIndex >= 0) {
                  return {
                    ...current,
                    addedGroups: updateRecordAtIndex(current.addedGroups, addedIndex, patch),
                  };
                }

                const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                if (shippedIndex < 0) return current;

                return {
                  ...current,
                  groupPatches: upsertPatchById(current.groupPatches, groupId, shippedIndex, patch),
                };
              })
            }
            onGroupAdd={() =>
              updateDraftState((current) => ({
                ...current,
                addedGroups: [...current.addedGroups, createLocalGroup(current.addedGroups, shipped.educationGroups)],
              }))
            }
            onGroupRemove={(_groupIndex, groupId) =>
              updateDraftState((current) => {
                const addedIndex = findGroupIndex(current.addedGroups, groupId);
                const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                if (addedIndex < 0 && shippedIndex < 0) return current;

                const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                const assignedResources = currentMergedDrafts.educationMaterials.flatMap((resource, resourceIndex) =>
                  resource.group === groupId ? [{ resource, resourceIndex }] : [],
                );
                let next: typeof current = {
                  ...current,
                  addedGroups: current.addedGroups.filter((_, index) => index !== addedIndex),
                  groupPatches: current.groupPatches.filter((patch) => patch.id !== groupId),
                  removedGroupIds:
                    shippedIndex >= 0
                      ? [...new Set([...(current.removedGroupIds ?? []), groupId])]
                      : current.removedGroupIds,
                };

                assignedResources.forEach(({ resource, resourceIndex }) => {
                  const addedMaterialIndex = resourceIndex - shipped.educationMaterials.length;

                  if (addedMaterialIndex >= 0) {
                    next = {
                      ...next,
                      addedEducationMaterials: updateRecordAtIndex(next.addedEducationMaterials, addedMaterialIndex, {
                        group: DEFAULT_EDUCATION_GROUP_ID,
                      }),
                    };
                    return;
                  }

                  next = {
                    ...next,
                    educationMaterialPatches: upsertPatchById(
                      next.educationMaterialPatches,
                      resource.id,
                      resourceIndex,
                      { group: DEFAULT_EDUCATION_GROUP_ID },
                    ),
                  };
                });

                return next;
              })
            }
            onGroupMove={(groupIndex, direction) =>
              updateDraftState((current) => {
                if (groupIndex === 0 && direction === -1) {
                  const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                  const groups = currentMergedDrafts.educationGroups;
                  if (groups.length === 0) return current;

                  const firstGroup = groups[0];
                  const defaultGroupOrder = currentMergedDrafts.defaultGroupOrder;
                  if (!firstGroup || firstGroup.order <= defaultGroupOrder) return current;

                  const firstAddedIndex = findGroupIndex(current.addedGroups, firstGroup.id);
                  if (firstAddedIndex >= 0) {
                    return {
                      ...current,
                      defaultGroupOrder: firstGroup.order,
                      addedGroups: updateRecordAtIndex(current.addedGroups, firstAddedIndex, {
                        order: defaultGroupOrder,
                      }),
                    };
                  }

                  const firstShippedIndex = findGroupIndex(shipped.educationGroups, firstGroup.id);
                  if (firstShippedIndex < 0) return current;

                  return {
                    ...current,
                    defaultGroupOrder: firstGroup.order,
                    groupPatches: upsertPatchById(current.groupPatches, firstGroup.id, firstShippedIndex, {
                      order: defaultGroupOrder,
                    }),
                  };
                }

                if (groupIndex === -1) {
                  const currentMergedDrafts = mergeDashboardDrafts(shipped, current);
                  const groups = currentMergedDrafts.educationGroups;
                  if (groups.length === 0) return current;

                  const defaultGroupOrder = currentMergedDrafts.defaultGroupOrder;
                  const adjacentGroup = direction === -1 ? groups[groups.length - 1] : groups[0];
                  if (!adjacentGroup) return current;
                  if (direction === -1 && defaultGroupOrder <= adjacentGroup.order) return current;
                  if (direction === 1 && defaultGroupOrder >= adjacentGroup.order) return current;

                  const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
                  if (adjacentAddedIndex >= 0) {
                    return {
                      ...current,
                      defaultGroupOrder: adjacentGroup.order,
                      addedGroups: updateRecordAtIndex(current.addedGroups, adjacentAddedIndex, {
                        order: defaultGroupOrder,
                      }),
                    };
                  }

                  const adjacentShippedIndex = findGroupIndex(shipped.educationGroups, adjacentGroup.id);
                  if (adjacentShippedIndex < 0) return current;

                  return {
                    ...current,
                    defaultGroupOrder: adjacentGroup.order,
                    groupPatches: upsertPatchById(current.groupPatches, adjacentGroup.id, adjacentShippedIndex, {
                      order: defaultGroupOrder,
                    }),
                  };
                }

                const nextIndex = groupIndex + direction;
                if (
                  nextIndex < 0 ||
                  nextIndex >= mergedDrafts.educationGroups.length ||
                  mergedDrafts.educationGroups[groupIndex] === undefined ||
                  mergedDrafts.educationGroups[nextIndex] === undefined
                ) {
                  return current;
                }

                const currentGroup = mergedDrafts.educationGroups[groupIndex];
                const adjacentGroup = mergedDrafts.educationGroups[nextIndex];
                const currentAddedIndex = findGroupIndex(current.addedGroups, currentGroup.id);
                const adjacentAddedIndex = findGroupIndex(current.addedGroups, adjacentGroup.id);
                let next = current;

                function applyShippedPatch(groupId: string, patch: Partial<EducationResourceGroup>) {
                  const shippedIndex = findGroupIndex(shipped.educationGroups, groupId);
                  if (shippedIndex < 0) return;

                  next = {
                    ...next,
                    groupPatches: upsertPatchById(next.groupPatches, groupId, shippedIndex, patch),
                  };
                }

                function applyLocalGroup(index: number, patch: Partial<EducationResourceGroup>) {
                  if (index < 0) return;

                  next = {
                    ...next,
                    addedGroups: updateRecordAtIndex(next.addedGroups, index, patch),
                  };
                }

                if (currentAddedIndex >= 0) {
                  applyLocalGroup(currentAddedIndex, { order: adjacentGroup.order });
                } else {
                  applyShippedPatch(currentGroup.id, { order: adjacentGroup.order });
                }

                if (adjacentAddedIndex >= 0) {
                  applyLocalGroup(adjacentAddedIndex, { order: currentGroup.order });
                } else {
                  applyShippedPatch(adjacentGroup.id, { order: currentGroup.order });
                }

                return next;
              })
            }
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsDashboard
            services={mergedDrafts.contacts}
            locations={mergedDrafts.locations}
            validation={contactValidation}
            onServiceChange={(serviceIndex, serviceId, patch) =>
              updateDraftState((current) => {
                const origin = resolveContactOrigin(
                  shipped.contacts,
                  current.addedContacts,
                  current.removedContactIds ?? [],
                  serviceIndex,
                  serviceId,
                );
                if (!origin || origin.id !== serviceId) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedContacts: updateRecordAtIndex(current.addedContacts, origin.addedIndex, patch),
                  };
                }

                return {
                  ...current,
                  contactPatches: upsertPatchById(
                    current.contactPatches,
                    origin.id,
                    origin.sourceIndex,
                    patch,
                    shipped.contacts.filter((contact) => contact.id === origin.id).length === 1,
                  ),
                };
              })
            }
            onServiceAdd={() => {
              const newService = createLocalService(
                mergedDrafts.contacts.map((service) => service.id),
                mergedDrafts.locations,
              );
              updateDraftState((current) => ({
                ...current,
                addedContacts: [...current.addedContacts, newService],
              }));
              return newService.id;
            }}
            onServiceRemove={(serviceIndex, serviceId) =>
              updateDraftState((current) => {
                const origin = resolveContactOrigin(
                  shipped.contacts,
                  current.addedContacts,
                  current.removedContactIds ?? [],
                  serviceIndex,
                  serviceId,
                );
                if (!origin || origin.id !== serviceId) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedContacts: current.addedContacts.filter((_, index) => index !== origin.addedIndex),
                  };
                }

                return {
                  ...current,
                  contactPatches: current.contactPatches.filter((patch) => patch.id !== origin.id),
                  addedContacts: current.addedContacts.filter((contact) => contact.id !== origin.id),
                  removedContactIds: [...new Set([...(current.removedContactIds ?? []), origin.id])],
                };
              })
            }
            onLocationChange={(locationIndex, locationId, patch) =>
              updateDraftState((current) => {
                const origin = resolveLocationOrigin(
                  shipped.locations ?? [],
                  current.addedLocations,
                  current.removedLocationIds ?? [],
                  locationIndex,
                  locationId,
                );
                if (!origin || origin.id !== locationId) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedLocations: updateRecordAtIndex(current.addedLocations, origin.addedIndex, patch),
                  };
                }

                return {
                  ...current,
                  locationPatches: upsertPatchById(
                    current.locationPatches,
                    origin.id,
                    origin.sourceIndex,
                    patch,
                    (shipped.locations ?? []).filter((location) => location.id === origin.id).length === 1,
                  ),
                };
              })
            }
            onLocationAdd={() => {
              const existingIds = [
                ...(shipped.locations ?? []).map((location) => location.id),
                ...draftState.addedLocations.map((location) => location.id),
                ...(draftState.removedLocationIds ?? []),
              ];
              const newLocation = createLocalLocation(existingIds);
              updateDraftState((current) => ({
                ...current,
                addedLocations: [...current.addedLocations, newLocation],
              }));
              return newLocation.id;
            }}
            onLocationRemove={(locationIndex, locationId) =>
              updateDraftState((current) => {
                const origin = resolveLocationOrigin(
                  shipped.locations ?? [],
                  current.addedLocations,
                  current.removedLocationIds ?? [],
                  locationIndex,
                  locationId,
                );
                if (!origin || origin.id !== locationId) return current;
                if (mergedDrafts.contacts.some((contact) => contact.locationId === origin.id)) return current;

                if (origin.kind === 'added') {
                  return {
                    ...current,
                    addedLocations: current.addedLocations.filter((_, index) => index !== origin.addedIndex),
                    removedLocationIds: [...new Set([...(current.removedLocationIds ?? []), origin.id])],
                  };
                }

                return {
                  ...current,
                  locationPatches: current.locationPatches.filter((patch) => patch.id !== origin.id),
                  removedLocationIds: [...new Set([...(current.removedLocationIds ?? []), origin.id])],
                };
              })
            }
          />
        )}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'export' &&
          (publishMode === 'database' ? (
            <PublishDashboard
              baseline={shipped}
              draft={publishedDraft}
              validation={validation}
              draftUpdatedAt={draftState.updatedAt}
              expectedRevision={draftState.baseRevision ?? null}
              basePayload={draftState.basePayload}
              onMergeConflict={rebaseDraftAfterMergeConflict}
              onPublished={clearDraftsAfterPublication}
              onResetDrafts={resetLocalDrafts}
              onDownloadBackup={handleDownloadBackup}
              onRestoreBackup={() => fileInputRef.current?.click()}
              onOpenValidationArea={(area) => {
                setActiveTab(area === 'export' ? 'export' : area);
                scheduleValidationSummaryScroll();
              }}
            />
          ) : (
            <ExportDashboard
              shipped={shipped}
              drafts={drafts}
              validation={validation}
              draftUpdatedAt={draftState.updatedAt}
              onResetDrafts={resetLocalDrafts}
              onDownloadBackup={handleDownloadBackup}
              onRestoreBackup={() => fileInputRef.current?.click()}
              onOpenValidationArea={(area) => {
                setActiveTab(area === 'export' ? 'export' : area);
                scheduleValidationSummaryScroll();
              }}
            />
          ))}
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

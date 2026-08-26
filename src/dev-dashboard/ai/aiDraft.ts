import type { PublishedContentPayload } from '../../app/content/publishedContent';
import type { DashboardDraftState } from '../draft-storage/dashboardStorage';
import { createEmptyDashboardDraftState } from '../draft-storage/dashboardStorage';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource, EducationResourceBlock } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { normalizeForComparison } from '../content/normalize';
import { extractImagesFromDrafts } from '../export/extractImages';
import type { DashboardDraftContent } from '../export/exportBundle';

/**
 * Converte um payload completo vindo da IA (ex: data.json do ZIP) em um DashboardDraftState
 * comparando com o shipped (conteúdo publicado). Gera patches/adicionados/removidos.
 * Também restaura imagens que foram extraídas para ./images/... no arquivo da IA.
 */
export function createDraftFromAiPayload(
  shipped: PublishedContentPayload,
  currentDraft: PublishedContentPayload,
  aiPayload: PublishedContentPayload,
): DashboardDraftState {
  // 1. Restaura imagens: qualquer campo que ainda tem "./images/..." no aiPayload deve voltar a ter o dataUrl original
  // Isso preserva imagens que a IA foi instruída a NÃO editar.
  const restoredPayload = restoreImages(aiPayload, currentDraft);

  const draft = createEmptyDashboardDraftState();

  // Helper genérico para computar patches/adicionados/removidos entre shipped e next
  function diffCollection<T extends { id: string }>(
    shippedItems: T[],
    nextItems: T[],
  ): {
    patches: Array<{ id: string; sourceIndex: number; patch: Partial<T>; sourceIdUnique: boolean }>;
    added: T[];
    removedIds: string[];
  } {
    const shippedById = new Map<string, { item: T; index: number }[]>();
    shippedItems.forEach((item, index) => {
      const list = shippedById.get(item.id) ?? [];
      list.push({ item, index });
      shippedById.set(item.id, list);
    });

    const nextById = new Map<string, T[]>();
    nextItems.forEach((item) => {
      const list = nextById.get(item.id) ?? [];
      list.push(item);
      nextById.set(item.id, list);
    });

    const patches: Array<{ id: string; sourceIndex: number; patch: Partial<T>; sourceIdUnique: boolean }> = [];
    const added: T[] = [];
    const removedIds: string[] = [];

    // Para cada item no next, verifica se existe no shipped
    const shippedIdCounts = new Map<string, number>();
    shippedItems.forEach((item) => shippedIdCounts.set(item.id, (shippedIdCounts.get(item.id) ?? 0) + 1));

    const nextIdCounts = new Map<string, number>();
    nextItems.forEach((item) => nextIdCounts.set(item.id, (nextIdCounts.get(item.id) ?? 0) + 1));

    const shippedOccurrenceUsed = new Map<string, number>();

    nextItems.forEach((nextItem) => {
      const occurrences = shippedById.get(nextItem.id);
      const used = shippedOccurrenceUsed.get(nextItem.id) ?? 0;
      const shippedEntry = occurrences?.[used];

      if (shippedEntry) {
        shippedOccurrenceUsed.set(nextItem.id, used + 1);
        const shippedItem = shippedEntry.item;
        const idx = shippedEntry.index;
        if (normalizeForComparison(shippedItem) !== normalizeForComparison(nextItem)) {
          // Cria patch com diff completo (todos campos de nextItem menos id)
          const { id: _id, ...patch } = nextItem as Record<string, unknown>;
          const isUnique = (shippedIdCounts.get(nextItem.id) ?? 0) === 1 && (nextIdCounts.get(nextItem.id) ?? 0) === 1;
          patches.push({ id: nextItem.id, sourceIndex: idx, patch: patch as Partial<T>, sourceIdUnique: isUnique });
        }
      } else {
        // Não existe no shipped -> adicionado
        added.push(nextItem);
      }
    });

    // Para cada item no shipped que não está no next, marca como removido (considerando ocorrências)
    const nextOccurrenceCount = new Map<string, number>();
    nextItems.forEach((item) => nextOccurrenceCount.set(item.id, (nextOccurrenceCount.get(item.id) ?? 0) + 1));

    const shippedGroups = new Map<string, number>();
    shippedItems.forEach((item) => {
      const seen = shippedGroups.get(item.id) ?? 0;
      shippedGroups.set(item.id, seen + 1);
      // Se shipped tem mais ocorrências que next, ou se id não existe em next, é remoção
      // Simplificação: se id não existe em next, todos shipped com esse id são removidos
      // Se id existe mas com menos ocorrências, as sobras são removidas
      const nextCount = nextById.get(item.id)?.length ?? 0;
      const shippedCount = shippedById.get(item.id)?.length ?? 0;
      if (shippedCount > nextCount && seen >= nextCount) {
        if (!removedIds.includes(item.id)) removedIds.push(item.id);
      } else if (nextCount === 0) {
        if (!removedIds.includes(item.id)) removedIds.push(item.id);
      }
    });

    // Caso mais simples e robusto: qualquer id em shipped que não aparece em next é removido
    shippedItems.forEach((item) => {
      if (!nextById.has(item.id) && !removedIds.includes(item.id)) {
        removedIds.push(item.id);
      }
    });

    return { patches, added, removedIds };
  }

  // Flows
  const flowDiff = diffCollection(shipped.flows, restoredPayload.flows);
  draft.flowPatches = flowDiff.patches as DashboardDraftState['flowPatches'];
  draft.addedFlows = flowDiff.added as GuidedFlow[];
  draft.removedFlowIds = flowDiff.removedIds;

  // Education Materials
  const matDiff = diffCollection(shipped.educationMaterials, restoredPayload.educationMaterials);
  draft.educationMaterialPatches = matDiff.patches as DashboardDraftState['educationMaterialPatches'];
  draft.addedEducationMaterials = matDiff.added as EducationResource[];
  draft.removedEducationMaterialIds = matDiff.removedIds;

  // Groups
  const groupDiff = diffCollection(shipped.educationGroups, restoredPayload.educationGroups);
  draft.groupPatches = groupDiff.patches as DashboardDraftState['groupPatches'];
  draft.addedGroups = groupDiff.added as EducationResourceGroup[];
  draft.removedGroupIds = groupDiff.removedIds;

  // Contacts
  const contactDiff = diffCollection(shipped.contacts, restoredPayload.contacts);
  draft.contactPatches = contactDiff.patches as DashboardDraftState['contactPatches'];
  draft.addedContacts = contactDiff.added as ServiceDirectoryEntry[];
  draft.removedContactIds = contactDiff.removedIds;

  // Locations
  const shippedLocs = shipped.locations ?? [];
  const nextLocs = restoredPayload.locations ?? [];
  const locDiff = diffCollection(shippedLocs, nextLocs);
  draft.locationPatches = locDiff.patches as DashboardDraftState['locationPatches'];
  draft.addedLocations = locDiff.added as ServiceLocation[];
  draft.removedLocationIds = locDiff.removedIds;

  // defaultGroupOrder
  if ((restoredPayload.defaultGroupOrder ?? 0) !== (shipped.defaultGroupOrder ?? 0)) {
    draft.defaultGroupOrder = restoredPayload.defaultGroupOrder;
  }

  return draft;
}

/**
 * Restaura dataUrls de imagens que foram convertidas para "./images/..." no arquivo da IA.
 * Usa o payload atual (com dataUrls) como fonte da verdade para qualquer caminho ./images/...
 * Se a IA manteve o caminho, restauramos o dataUrl original para não perder a imagem.
 * Se a IA criou um novo material com ./images/... que não existe no original, mantemos como está (será validado e pode falhar, mas é esperado).
 */
function restoreImages(
  aiPayload: PublishedContentPayload,
  currentDraft: PublishedContentPayload,
): PublishedContentPayload {
  // Constrói mapa path -> dataUrl a partir do draft atual (que tem as imagens reais)
  const draftContent: DashboardDraftContent = {
    flows: currentDraft.flows,
    educationMaterials: currentDraft.educationMaterials,
    educationGroups: currentDraft.educationGroups,
    contacts: currentDraft.contacts,
    locations: currentDraft.locations ?? [],
    defaultGroupOrder: currentDraft.defaultGroupOrder ?? 0,
    removedEducationGroupIds: [],
    removedEducationMaterialIds: [],
    removedContactIds: [],
    removedLocationIds: [],
  };
  const { images } = extractImagesFromDrafts(draftContent);
  // Para cada material no aiPayload que tem imageUrl começando com "./images/", procuramos no currentDraft o mesmo material por id e pegamos o dataUrl

  // Abordagem prática: para cada material no aiPayload, se imageUrl começa com "./images/" e existe material com mesmo id no currentDraft com data:image, restaura
  const currentById = new Map(currentDraft.educationMaterials.map((m) => [m.id, m]));

  function restoreResourceImages(resource: EducationResource): EducationResource {
    const original = currentById.get(resource.id);
    let next = resource;

    // Thumbnail
    if (resource.imageUrl?.startsWith('./images/') && original?.imageUrl?.startsWith('data:')) {
      next = { ...next, imageUrl: original.imageUrl };
    }

    // Featured image
    if (
      resource.featuredImage?.kind === 'uploaded' &&
      (resource.featuredImage.dataUrl as string)?.startsWith('./images/')
    ) {
      const origFeatured = original?.featuredImage;
      if (origFeatured?.kind === 'uploaded' && origFeatured.dataUrl?.startsWith('data:')) {
        next = {
          ...next,
          featuredImage: { ...next.featuredImage, dataUrl: origFeatured.dataUrl } as EducationResource['featuredImage'],
        };
      }
    }

    // Blocks
    if (resource.body) {
      const newBody = resource.body.map((block) => {
        if (block.kind === 'image' && block.imageUrl?.startsWith('./images/')) {
          const origBlock = original?.body?.find((b) => b.id === block.id);
          if (origBlock?.imageUrl?.startsWith('data:')) {
            return { ...block, imageUrl: origBlock.imageUrl };
          }
          // Também tenta restaurar de qualquer bloco original com dataUrl se id não bate (IA pode ter recriado)
          // Procura por path igual no mapa de images extraídas
          for (const img of images) {
            if (block.imageUrl === `./${img.name}`) {
              // Converte Uint8Array de volta para dataUrl
              // Mas não temos o dataUrl original aqui, apenas o bytes + mime. Reconstrói:
              const base64 = uint8ToBase64(img.data);
              const dataUrl = `data:${img.mimeType};base64,${base64}`;
              return { ...block, imageUrl: dataUrl };
            }
          }
        }
        return block;
      });
      if (newBody.some((b, i) => b !== resource.body![i])) {
        next = { ...next, body: newBody as EducationResourceBlock[] };
      }
    }

    return next;
  }

  // Também restaura thumbnails/featured via mapa images para casos onde id não bate
  function restoreViaImageMap(url: string | undefined): string | undefined {
    if (!url || !url.startsWith('./images/')) return url;
    for (const img of images) {
      if (url === `./${img.name}`) {
        const base64 = uint8ToBase64(img.data);
        return `data:${img.mimeType};base64,${base64}`;
      }
    }
    return url;
  }

  const restoredMaterials = aiPayload.educationMaterials.map((res) => {
    let r = restoreResourceImages(res);
    // Fallback: tenta restaurar qualquer campo que ainda tenha ./images/ via mapa
    if (r.imageUrl?.startsWith('./images/')) {
      const restored = restoreViaImageMap(r.imageUrl);
      if (restored && restored.startsWith('data:')) r = { ...r, imageUrl: restored };
    }
    if (r.featuredImage?.kind === 'uploaded' && (r.featuredImage.dataUrl as string)?.startsWith('./images/')) {
      const restored = restoreViaImageMap(r.featuredImage.dataUrl as string);
      if (restored)
        r = { ...r, featuredImage: { ...r.featuredImage, dataUrl: restored } as EducationResource['featuredImage'] };
    }
    if (r.body) {
      const newBody = r.body.map((block) => {
        if (block.kind === 'image' && block.imageUrl?.startsWith('./images/')) {
          const restored = restoreViaImageMap(block.imageUrl);
          if (restored) return { ...block, imageUrl: restored };
        }
        return block;
      });
      r = { ...r, body: newBody as EducationResourceBlock[] };
    }
    return r;
  });

  return {
    ...aiPayload,
    educationMaterials: restoredMaterials,
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

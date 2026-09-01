import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { createDraftFromAiPayload } from '../aiDraft';

const pngDataUrl = (value: string) => `data:image/png;base64,${btoa(value)}`;

const uploadedVisualSrc = pngDataUrl('calma');
// Caminho que extractImagesFromDrafts gera para o visual enviado do nó "inicio" do fluxo "fluxo-x"
const extractedVisualPath = './images/flow-fluxo-x-node-inicio-visual-calma.png';

function buildFlow(id: string, src: string): GuidedFlow {
  return {
    id,
    version: '1.0.0',
    locale: 'pt-BR',
    title: `Fluxo ${id}`,
    type: 'guided_conversation',
    status: 'approved',
    entry: { nodeId: 'inicio', enteringPhrases: ['Começar'], transitionMessage: 'Vamos começar.' },
    nodes: {
      inicio: {
        id: 'inicio',
        kind: 'result',
        text: 'Resposta acolhedora do resultado.',
        visuals: [{ id: 'calma', alt: 'Imagem calma', src }],
      },
    },
  };
}

function buildPayload(flows: GuidedFlow[]): PublishedContentPayload {
  return {
    flows,
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 0,
  };
}

describe('createDraftFromAiPayload (imagens de fluxo)', () => {
  it('mantém a imagem enviada do fluxo quando a IA devolve o caminho ./images/...', () => {
    const shipped = buildPayload([buildFlow('fluxo-x', uploadedVisualSrc)]);
    const currentDraft = buildPayload([buildFlow('fluxo-x', uploadedVisualSrc)]);
    const aiPayload = buildPayload([buildFlow('fluxo-x', extractedVisualPath)]);

    const draft = createDraftFromAiPayload(shipped, currentDraft, aiPayload);

    // O visual foi restaurado para o dataUrl original, então o fluxo é igual ao publicado:
    // nenhum patch (e nenhum patch pode conter "./images/...")
    expect(draft.flowPatches).toHaveLength(0);
    expect(draft.addedFlows).toHaveLength(0);
    expect(draft.removedFlowIds).toHaveLength(0);
    expect(JSON.stringify(draft)).not.toContain('./images/');
  });

  it('restaura visual pelo mapa de imagens quando a IA cria um fluxo novo reutilizando um caminho existente', () => {
    const shipped = buildPayload([buildFlow('fluxo-x', uploadedVisualSrc)]);
    const currentDraft = buildPayload([buildFlow('fluxo-x', uploadedVisualSrc)]);
    const aiPayload = buildPayload([
      buildFlow('fluxo-x', uploadedVisualSrc),
      buildFlow('novo-fluxo', extractedVisualPath),
    ]);

    const draft = createDraftFromAiPayload(shipped, currentDraft, aiPayload);

    expect(draft.flowPatches).toHaveLength(0);
    expect(draft.addedFlows).toHaveLength(1);
    expect(draft.addedFlows[0]?.nodes.inicio?.visuals?.[0]?.src).toBe(uploadedVisualSrc);
    expect(JSON.stringify(draft)).not.toContain('./images/');
  });
});

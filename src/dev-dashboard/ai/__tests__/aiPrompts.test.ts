import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { buildFlowPrompt, buildFullPayloadPromptForArchive } from '../aiPrompts';

const flow: GuidedFlow = {
  id: 'fluxo-minimo',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo mínimo',
  type: 'guided_conversation',
  status: 'approved',
  entry: { nodeId: 'inicio', enteringPhrases: ['Começar'], transitionMessage: 'Vamos começar.' },
  nodes: {
    inicio: {
      id: 'inicio',
      kind: 'result',
      text: 'Resultado.',
      visuals: [{ id: 'calma', alt: 'Imagem calma', src: 'https://example.com/imagem.png' }],
    },
  },
};

const payload: PublishedContentPayload = {
  flows: [flow],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

describe('aiPrompts (visuals de fluxo)', () => {
  it('prompt do arquivo ZIP ensina a IA sobre imagens de fluxo', () => {
    const prompt = buildFullPayloadPromptForArchive(payload, 39);

    expect(prompt).toContain('GuidedFlow.nodes[].visuals[].src');
    expect(prompt).toContain('NUNCA edite esse caminho');
    expect(prompt).toContain('Fluxos > mapa visual > painel da etapa > Mídia');
  });

  it('prompt do arquivo orienta a IA a não enviar paths de imagem em operações', () => {
    const prompt = buildFullPayloadPromptForArchive(payload, 39);

    expect(prompt).toContain('NÃO tente gerar a imagem nem inclua campos de imagem em uma operação');
    expect(prompt).toContain('Não altere imagens: não envie campos com "./images/..." nem "data:image/..."');
    expect(prompt).toContain('Fluxos > mapa visual > painel da etapa > Mídia');
  });

  it('prompt de fluxo isolado documenta o campo visuals na estrutura e nas regras', () => {
    const prompt = buildFlowPrompt(flow);

    expect(prompt).toContain('"visuals"?: [{ "id", "alt", "src" }]');
    expect(prompt).toContain('"visuals" são imagens exibidas junto à mensagem do nó');
  });
});

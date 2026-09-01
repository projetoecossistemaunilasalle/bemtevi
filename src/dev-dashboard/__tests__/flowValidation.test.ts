import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { validateFlow } from '../../domain/flow-engine/validateFlow';
import { validateDashboardFlows } from '../flows/flowValidation';

const baseFlow: GuidedFlow = {
  id: 'base-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo base',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Começar fluxo base'],
    transitionMessage: 'Vamos começar.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Escolha uma opção.',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Resultado final.',
      recommendations: ['known-resource'],
    },
  },
};

describe('validateDashboardFlows', () => {
  it('rejects duplicate flow IDs', () => {
    const result = validateDashboardFlows([baseFlow, { ...baseFlow }], ['known-resource']);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-flow-id:base-flow',
        message:
          'Existe mais de um fluxo com o identificador "base-flow". Remova um dos fluxos duplicados e crie-o novamente.',
      }),
    );
  });

  it('rejects missing flow_start targets', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            ...baseFlow.nodes,
            start: {
              id: 'start',
              kind: 'choice',
              text: 'Escolha uma opção.',
              options: [
                {
                  id: 'handoff',
                  label: 'Começar outro fluxo',
                  next: 'end',
                  effects: [{ kind: 'flow_start', flowId: 'missing-flow' }],
                },
              ],
            },
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-flow-start:base-flow:start:handoff',
        message: 'Esta opção tenta começar um fluxo que não existe: missing-flow.',
      }),
    );
  });

  it('rejects missing recommendation resources', () => {
    const result = validateDashboardFlows([baseFlow], []);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-resource:base-flow:end:known-resource',
        message: 'Este resultado recomenda um material que não existe: known-resource.',
      }),
    );
  });

  it('rejects incomplete, duplicate, and non-YouTube orientation videos', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            ...baseFlow.nodes,
            end: {
              ...baseFlow.nodes.end,
              videos: [
                { id: 'pause', title: '', url: 'https://vimeo.com/123' },
                { id: 'pause', title: 'Outro vídeo', url: 'not-a-url' },
              ],
            },
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.errors.map((issue) => issue.message).join(' ')).toContain('precisa de um título');
    expect(result.errors.map((issue) => issue.message).join(' ')).toContain('URL válida do YouTube');
    expect(result.errors.map((issue) => issue.message).join(' ')).toContain('mais de um vídeo');
  });

  describe('visual sources', () => {
    it('accepts https links, site paths, and valid image data URLs', () => {
      const result = validateDashboardFlows(
        [
          {
            ...baseFlow,
            nodes: {
              ...baseFlow.nodes,
              end: {
                ...baseFlow.nodes.end,
                visuals: [
                  { id: 'foto-1', alt: 'Foto de apoio', src: 'https://exemplo.com/foto.png' },
                  { id: 'foto-2', alt: 'Imagem do site', src: '/bemtevi/flow-visuals/foto.png' },
                  { id: 'foto-3', alt: 'Imagem enviada', src: 'data:image/png;base64,AAAA' },
                ],
              },
            },
          },
        ],
        ['known-resource'],
      );

      expect(result.errors).toHaveLength(0);
    });

    it('rejects unsupported mime types and malformed base64 payloads', () => {
      const flow: GuidedFlow = {
        ...baseFlow,
        nodes: {
          ...baseFlow.nodes,
          end: {
            ...baseFlow.nodes.end,
            visuals: [
              { id: 'foto-tiff', alt: 'Foto em TIFF', src: 'data:image/tiff;base64,AAAA' },
              { id: 'foto-base64', alt: 'Imagem quebrada', src: 'data:image/png;base64,@@@' },
            ],
          },
        },
      };

      const errors = validateFlow(flow).errors;

      expect(errors).toContain(
        'O recurso visual foto-tiff do nó end, no fluxo base-flow, usa um formato de imagem enviada inválido.',
      );
      expect(errors).toContain(
        'O recurso visual foto-base64 do nó end, no fluxo base-flow, usa um formato de imagem enviada inválido.',
      );
    });

    it('rejects external sources without http(s) scheme or leading slash', () => {
      const flow: GuidedFlow = {
        ...baseFlow,
        nodes: {
          ...baseFlow.nodes,
          end: {
            ...baseFlow.nodes.end,
            visuals: [
              { id: 'foto-ftp', alt: 'Foto por FTP', src: 'ftp://exemplo.com/foto.png' },
              { id: 'foto-relativa', alt: 'Link relativo', src: 'exemplo.com/foto.png' },
            ],
          },
        },
      };

      const errors = validateFlow(flow).errors;

      expect(errors).toContain(
        'O recurso visual foto-ftp do nó end, no fluxo base-flow, precisa usar um link http(s) ou caminho iniciado por "/".',
      );
      expect(errors).toContain(
        'O recurso visual foto-relativa do nó end, no fluxo base-flow, precisa usar um link http(s) ou caminho iniciado por "/".',
      );
    });

    it('keeps the missing-origin message for empty sources', () => {
      const flow: GuidedFlow = {
        ...baseFlow,
        nodes: {
          ...baseFlow.nodes,
          end: {
            ...baseFlow.nodes.end,
            visuals: [{ id: 'foto-vazia', alt: 'Foto sem origem', src: '' }],
          },
        },
      };

      const errors = validateFlow(flow).errors;

      expect(errors).toContain(
        'O recurso visual foto-vazia do nó end, no fluxo base-flow, precisa informar uma origem.',
      );
      expect(errors.some((error) => error.includes('formato de imagem enviada inválido'))).toBe(false);
      expect(errors.some((error) => error.includes('link http(s) ou caminho iniciado'))).toBe(false);
    });

    it('deep-links a corrupted image visual to the media section path', () => {
      const result = validateDashboardFlows(
        [
          {
            ...baseFlow,
            nodes: {
              ...baseFlow.nodes,
              end: {
                ...baseFlow.nodes.end,
                visuals: [{ id: 'foto-quebrada', alt: 'Imagem corrompida', src: 'data:image/tiff;base64,AAAA' }],
              },
            },
          },
        ],
        ['known-resource'],
      );

      const issue = result.errors.find((candidate) => candidate.path.endsWith('.visuals.0.src'));

      expect(issue?.path).toBe('base-flow.nodes.end.visuals.0.src');
      expect(issue?.message).toContain('Reenvie a imagem');
      expect(issue?.message).toContain('"foto-quebrada"');
    });

    it('deep-links an invalid external image link to the media section path', () => {
      const result = validateDashboardFlows(
        [
          {
            ...baseFlow,
            nodes: {
              ...baseFlow.nodes,
              end: {
                ...baseFlow.nodes.end,
                visuals: [{ id: 'foto-ftp', alt: 'Foto por FTP', src: 'ftp://exemplo.com/foto.png' }],
              },
            },
          },
        ],
        ['known-resource'],
      );

      const issue = result.errors.find((candidate) => candidate.path.endsWith('.visuals.0.src'));

      expect(issue?.path).toBe('base-flow.nodes.end.visuals.0.src');
      expect(issue?.message).toContain('link http(s) ou caminho iniciado');
      expect(issue?.message).toContain('Cole um link completo');
    });
  });

  it('warns when score branch ranges overlap or use a score key with no scoring options', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            start: {
              id: 'start',
              kind: 'choice',
              text: 'Escolha uma opção.',
              options: [{ id: 'continue', label: 'Continuar', next: 'score' }],
            },
            score: {
              id: 'score',
              kind: 'score_branch',
              text: 'Calculando.',
              scoreKey: 'missing-score',
              branches: [
                { id: 'low', min: 0, max: 5, next: 'end' },
                { id: 'high', min: 5, max: 10, next: 'end', navigation: '/apoio' },
              ],
            },
            end: baseFlow.nodes.end,
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'unused-score-key:base-flow:score:missing-score',
        message: 'Esta ramificação usa a pontuação "missing-score", mas nenhuma opção soma pontos nessa chave.',
      }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'overlapping-score-range:base-flow:score:high',
        message: 'A faixa "high" sobrepõe outra faixa de pontuação neste redirecionamento.',
      }),
    );
  });
});

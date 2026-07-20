import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../src/domain/flow-engine/types';
import { validateRegisteredFlows, validateResourceRecommendations, validateSrq20Contract } from '../validate-flows';

const validSrq20Fixture = {
  id: 'srq20',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'SRQ-20',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'consent',
    enteringPhrases: ['Quero responder o SRQ-20'],
    transitionMessage: 'Mensagem de transição.',
  },
  nodes: {
    consent: {
      id: 'consent',
      kind: 'choice',
      text: 'Consentimento?',
      options: [
        { id: 'accept', label: 'Quero responder', next: 'q1' },
        { id: 'decline', label: 'Agora não', next: 'declined-result' },
      ],
    },
    'declined-result': {
      id: 'declined-result',
      kind: 'result',
      text: 'Tudo bem.',
    },
    'srq20-score': {
      id: 'srq20-score',
      kind: 'score_branch',
      text: 'Vou organizar suas respostas.',
      scoreKey: 'srq20',
      branches: [
        { id: 'low', min: 0, max: 6, next: 'low-result' },
        { id: 'possible', min: 7, max: 20, next: 'possible-result' },
      ],
    },
    'low-result': {
      id: 'low-result',
      kind: 'result',
      text: 'Resultado baixo.',
      recommendations: ['known-resource'],
    },
    'possible-result': {
      id: 'possible-result',
      kind: 'result',
      text: 'Possível sofrimento.',
      recommendations: ['known-resource'],
    },
  },
} as GuidedFlow;

for (let questionNumber = 1; questionNumber <= 20; questionNumber += 1) {
  const id = `q${questionNumber}`;
  validSrq20Fixture.nodes[id] = {
    id,
    kind: 'choice',
    text: `Pergunta ${questionNumber}?`,
    options: [
      {
        id: 'yes',
        label: 'Sim',
        next: questionNumber === 20 ? 'srq20-score' : `q${questionNumber + 1}`,
        effects:
          questionNumber === 17
            ? [
                {
                  kind: 'deferred_safety',
                  flagKey: 'self_harm_ideation',
                  message: 'Vamos te direcionar para apoio imediato.',
                  destination: '/apoio',
                },
              ]
            : [{ kind: 'score', scoreKey: 'srq20', value: 1 }],
      },
      {
        id: 'no',
        label: 'Não',
        next: questionNumber === 20 ? 'srq20-score' : `q${questionNumber + 1}`,
      },
    ],
  };
}

describe('validateRegisteredFlows', () => {
  it('reports duplicate flow ids and duplicate entering phrases', () => {
    const duplicate = {
      ...validSrq20Fixture,
      title: 'Duplicated SRQ-20',
    } satisfies GuidedFlow;

    expect(validateRegisteredFlows([validSrq20Fixture, duplicate])).toEqual(
      expect.arrayContaining([
        'Duplicate flow id "srq20".',
        'Duplicate entering phrase "Quero responder o SRQ-20" used by flows srq20 and srq20.',
      ]),
    );
  });
});

describe('validateSrq20Contract', () => {
  it('reports error when SRQ-20 flow is undefined', () => {
    expect(validateSrq20Contract(undefined)).toEqual(['SRQ-20 flow is not registered.']);
  });

  it('accepts a structurally complete SRQ-20 flow', () => {
    expect(validateSrq20Contract(validSrq20Fixture)).toEqual([]);
  });

  it('reports missing SRQ-20 question nodes and missing q17 deferred safety effect', () => {
    const broken = structuredClone(validSrq20Fixture);
    delete broken.nodes.q20;
    const q17 = broken.nodes.q17;
    if (q17.kind === 'choice') {
      q17.options = q17.options.map((option) => ({ id: option.id, label: option.label, next: option.next }));
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining([
        'SRQ-20 must include question node q20.',
        'SRQ-20 q17 yes option must include a deferred_safety effect to /apoio with non-empty flagKey and message.',
      ]),
    );
  });

  it('reports q17 deferred_safety effect with empty flagKey or message', () => {
    const broken = structuredClone(validSrq20Fixture);
    const q17 = broken.nodes.q17;
    if (q17.kind === 'choice') {
      const yesOption = q17.options.find((option) => option.id === 'yes');
      if (yesOption) {
        yesOption.effects = [
          {
            kind: 'deferred_safety',
            flagKey: '',
            message: '',
            destination: '/apoio',
          },
        ];
      }
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining([
        'SRQ-20 q17 yes option must include a deferred_safety effect to /apoio with non-empty flagKey and message.',
      ]),
    );
  });

  it('reports q17 effect when destination is not /apoio', () => {
    const broken = structuredClone(validSrq20Fixture);
    const q17 = broken.nodes.q17;
    if (q17.kind === 'choice') {
      const yesOption = q17.options.find((option) => option.id === 'yes');
      if (yesOption) {
        yesOption.effects = [
          {
            kind: 'deferred_safety',
            flagKey: 'self_harm_ideation',
            message: 'Mensagem.',
            destination: '/contatos',
          },
        ];
      }
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining([
        'SRQ-20 q17 yes option must include a deferred_safety effect to /apoio with non-empty flagKey and message.',
      ]),
    );
  });

  it('reports wrong scoreKey on score_branch', () => {
    const broken = structuredClone(validSrq20Fixture);
    const scoreNode = broken.nodes['srq20-score'];
    if (scoreNode.kind === 'score_branch') {
      scoreNode.scoreKey = 'wrong-key';
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining(['SRQ-20 score_branch must have scoreKey "srq20".']),
    );
  });

  it('reports missing 0-6 and 7-20 branches', () => {
    const broken = structuredClone(validSrq20Fixture);
    const scoreNode = broken.nodes['srq20-score'];
    if (scoreNode.kind === 'score_branch') {
      scoreNode.branches = [{ id: 'only-low', min: 0, max: 6, next: 'low-result' }];
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining(['SRQ-20 score branch must include a 7-20 branch.']),
    );
  });
});

describe('validateResourceRecommendations', () => {
  it('reports recommendations that do not exist in resources content', () => {
    expect(validateResourceRecommendations([validSrq20Fixture], ['different-resource'])).toEqual([
      'Flow srq20 result node low-result recommends missing resource known-resource.',
      'Flow srq20 result node possible-result recommends missing resource known-resource.',
    ]);
  });
});

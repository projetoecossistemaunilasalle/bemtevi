import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../src/domain/flow-engine/types';
import {
  validateRegisteredFlows,
  validateResourceRecommendations,
  validateSrq20Contract,
} from '../validate-flows';

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
                  kind: 'safety_interrupt',
                  message: 'Vamos te direcionar para apoio imediato.',
                  destination: '/apoio',
                  blockResume: true,
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
  it('accepts a structurally complete SRQ-20 flow', () => {
    expect(validateSrq20Contract(validSrq20Fixture)).toEqual([]);
  });

  it('reports missing SRQ-20 question nodes and missing q17 safety interruption', () => {
    const broken = structuredClone(validSrq20Fixture);
    delete broken.nodes.q20;
    const q17 = broken.nodes.q17;
    if (q17.kind === 'choice') {
      q17.options = q17.options.map((option) => ({ id: option.id, label: option.label, next: option.next }));
    }

    expect(validateSrq20Contract(broken)).toEqual(
      expect.arrayContaining([
        'SRQ-20 must include question node q20.',
        'SRQ-20 q17 yes option must include a safety_interrupt effect to /apoio with blockResume enabled.',
      ]),
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

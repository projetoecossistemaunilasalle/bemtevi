import type { ChoiceFlowNode, FlowOption } from '../../../domain/flow-engine/types';

export const close = (nodeId: string): FlowOption[] => [
  {
    id: 'back-home',
    label: 'Por enquanto, isso foi suficiente.',
    next: nodeId,
    effects: [{ kind: 'end_flow', message: 'Tudo bem. Você pode retomar uma orientação quando quiser.' }],
  },
  {
    id: 'another-path',
    label: 'Quero escolher outro caminho.',
    next: nodeId,
    effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
  },
];

export const ending = (id: string, text: string): ChoiceFlowNode => ({ id, kind: 'choice', text, options: close(id) });

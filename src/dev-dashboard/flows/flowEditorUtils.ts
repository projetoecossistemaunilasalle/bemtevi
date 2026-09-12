import type {
  ChoiceFlowNode,
  DeferredSafetyFlowEffect,
  FlowNode,
  GlobalActionTarget,
  FlowOption,
} from '../../domain/flow-engine/types';

export type OptionEffectsUpdate = (
  node: ChoiceFlowNode,
  optionId: string,
  update: (effects: FlowOption['effects']) => FlowOption['effects'],
) => void;

export function getNodeKindLabel(node: FlowNode) {
  if (node.kind === 'choice') return 'Pergunta com opções';
  if (node.kind === 'result') return 'Resultado final';
  return 'Ramificação por pontuação';
}

export function getNodeCountLabel(node: FlowNode) {
  if (node.kind === 'choice') {
    if (node.options.length === 0) return 'Sem opções';
    return node.options.length === 1 ? '1 opção' : `${node.options.length} opções`;
  }

  if (node.kind === 'score_branch') {
    if (node.branches.length === 0) return 'Sem caminhos';
    return node.branches.length === 1 ? '1 caminho' : `${node.branches.length} caminhos`;
  }

  return 'Final';
}

export function getNodePreview(text: string) {
  return text.trim().replace(/\s+/g, ' ') || 'Texto vazio';
}

/** Returns a collision-free id while preserving the editor's existing naming convention. */
export function createUniqueId(baseId: string, records: Record<string, unknown>) {
  if (!records[baseId]) return baseId;

  let index = 2;
  while (records[`${baseId}_${index}`]) index += 1;
  return `${baseId}_${index}`;
}

export function getDeferredSafetyEffect(option: ChoiceFlowNode['options'][number]) {
  return option.effects?.find((effect): effect is DeferredSafetyFlowEffect => effect.kind === 'deferred_safety');
}

export function parseOptionalNavigation(value: string) {
  return value === '' ? undefined : (value as Exclude<GlobalActionTarget, 'end'>);
}

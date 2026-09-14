import type { ChoiceFlowNode, FlowEffect, ScoreBranchFlowNode } from '../model/flowTypes';
import { hasText } from './validateFlow';

export function validateChoiceNode(flowLabel: string, node: ChoiceFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (node.options.length === 0 && node.freeText === undefined) {
    errors.push(`O nó de escolhas ${node.id} do fluxo ${flowLabel} precisa ter pelo menos uma opção.`);
  }

  if (node.freeText !== undefined && !nodeIds.has(node.freeText.next)) {
    errors.push(
      `A opção de texto livre do nó ${node.id}, no fluxo ${flowLabel}, aponta para um nó inexistente: ${node.freeText.next}.`,
    );
  }

  node.options.forEach((option) => {
    if (!hasText(option.id)) {
      errors.push(`O nó ${node.id} do fluxo ${flowLabel} tem uma opção sem ID.`);
    }

    if (!hasText(option.label)) {
      errors.push(`A opção ${option.id} do fluxo ${flowLabel} precisa informar um rótulo.`);
    }

    if (!nodeIds.has(option.next)) {
      errors.push(`A opção ${option.id} do fluxo ${flowLabel} aponta para um nó inexistente: ${option.next}.`);
    }

    option.effects?.forEach((effect) => validateEffect(flowLabel, option.id, effect, errors));
  });
}

export function validateScoreBranchNode(
  flowLabel: string,
  node: ScoreBranchFlowNode,
  nodeIds: Set<string>,
  errors: string[],
) {
  if (!hasText(node.scoreKey)) {
    errors.push(
      `O nó de ramificação de pontuação ${node.id} do fluxo ${flowLabel} precisa informar uma chave de pontuação (scoreKey).`,
    );
  }

  if (!Array.isArray(node.branches) || node.branches.length === 0) {
    errors.push(`O nó de ramificação de pontuação ${node.id} do fluxo ${flowLabel} precisa ter pelo menos uma faixa.`);
    return;
  }

  node.branches.forEach((branch) => {
    if (!hasText(branch.id) || typeof branch.min !== 'number' || typeof branch.max !== 'number') {
      errors.push(`O nó de ramificação de pontuação ${node.id} do fluxo ${flowLabel} tem uma faixa inválida.`);
      return;
    }

    if (!nodeIds.has(branch.next)) {
      errors.push(
        `A faixa ${branch.id} do nó de ramificação ${node.id}, no fluxo ${flowLabel}, aponta para um nó inexistente: ${branch.next}.`,
      );
    }

    if (branch.navigation !== undefined && !['/apoio', '/contatos', '/educacao'].includes(String(branch.navigation))) {
      errors.push(
        `A faixa ${branch.id} do nó de ramificação ${node.id}, no fluxo ${flowLabel}, usa um destino de navegação não permitido.`,
      );
    }
  });
}

function validateEffect(flowLabel: string, optionId: string, effect: FlowEffect, errors: string[]) {
  if (effect.kind === 'score') {
    if (!hasText(effect.scoreKey) || typeof effect.value !== 'number') {
      errors.push(
        `O efeito de pontuação da opção ${optionId} do fluxo ${flowLabel} precisa informar uma chave de pontuação (scoreKey) e um valor numérico.`,
      );
    }
    return;
  }

  if (effect.kind === 'safety_interrupt') {
    if (!hasText(effect.message) || !hasText(effect.destination) || typeof effect.blockResume !== 'boolean') {
      errors.push(
        `O efeito de interrupção de segurança da opção ${optionId} do fluxo ${flowLabel} precisa informar mensagem, destino e se deve bloquear o retorno (blockResume).`,
      );
    }
    return;
  }

  if (effect.kind === 'deferred_safety') {
    if (
      !hasText(effect.flagKey) ||
      !hasText(effect.message) ||
      !['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))
    ) {
      errors.push(
        `O efeito de segurança adiada da opção ${optionId} do fluxo ${flowLabel} precisa informar a chave de sinalização (flagKey), mensagem e destino permitido.`,
      );
    }
    return;
  }

  if (effect.kind === 'flow_start') {
    if (!hasText(effect.flowId)) {
      errors.push(
        `O efeito de início de fluxo da opção ${optionId} do fluxo ${flowLabel} precisa informar o ID do fluxo de destino (flowId).`,
      );
    }
    return;
  }

  if (effect.kind === 'navigate') {
    if (!['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))) {
      errors.push(
        `O efeito de navegação da opção ${optionId} do fluxo ${flowLabel} precisa usar um destino permitido.`,
      );
    }
    return;
  }

  if (effect.kind === 'end_flow') {
    if (!hasText(effect.message)) {
      errors.push(`O efeito de encerramento da opção ${optionId} do fluxo ${flowLabel} precisa informar uma mensagem.`);
    }
    return;
  }

  errors.push(
    `A opção ${optionId} do fluxo ${flowLabel} contém um tipo de efeito não suportado: "${(effect as { kind: string }).kind}".`,
  );
}

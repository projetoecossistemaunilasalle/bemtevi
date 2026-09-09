import { parseYouTubeVideoId } from '../media/youtube';
import type { ChoiceFlowNode, FlowEffect, FlowNode, FlowValidationResult, ScoreBranchFlowNode } from './types';

const allowedFlowPurposes = ['orientation_entry', 'post_flow_routing'];
const allowedFlowExercises = ['breathing'];

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

const imageDataUrlPattern = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

function isValidImageDataUrl(value: string) {
  return imageDataUrlPattern.test(value.trim());
}

function isExternalVisualSrc(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFlow(flow: unknown): FlowValidationResult {
  const errors: string[] = [];
  const flowRecord = isRecord(flow) ? flow : {};
  const flowId = hasText(flowRecord.id) ? String(flowRecord.id) : '';
  const flowLabel = flowId || 'unknown';
  const entry = flowRecord.entry;
  const nodes = flowRecord.nodes;

  if (!hasText(flowRecord.id)) {
    errors.push('O ID do fluxo é obrigatório.');
  }

  if (flowRecord.purpose !== undefined && !allowedFlowPurposes.includes(String(flowRecord.purpose))) {
    errors.push(`O propósito do fluxo ${flowLabel} deve ser um destes: ${allowedFlowPurposes.join(', ')}.`);
  }

  if (!isRecord(entry)) {
    errors.push('A entrada do fluxo é obrigatória.');
  }

  if (!isRecord(nodes)) {
    errors.push('Os nós do fluxo são obrigatórios.');
  }

  if (!isRecord(entry) || !isRecord(nodes)) {
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  const nodeIds = new Set(Object.keys(nodes));
  const entryNodeId = entry.nodeId;
  const enteringPhrases = entry.enteringPhrases;

  if (!hasText(entryNodeId) || !nodeIds.has(String(entryNodeId))) {
    errors.push(`A entrada do fluxo ${flowLabel} aponta para um nó inexistente: ${String(entryNodeId)}.`);
  }

  if (
    !Array.isArray(enteringPhrases) ||
    enteringPhrases.length === 0 ||
    enteringPhrases.some((phrase) => !hasText(phrase))
  ) {
    errors.push(`O fluxo ${flowLabel} precisa definir frases explícitas para iniciá-lo.`);
  }

  Object.entries(nodes).forEach(([nodeKey, nodeValue]) => {
    validateNode(flowLabel, nodeKey, nodeValue, nodeIds, errors);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateNode(flowLabel: string, nodeKey: string, nodeValue: unknown, nodeIds: Set<string>, errors: string[]) {
  if (!isRecord(nodeValue)) {
    errors.push(`O nó ${nodeKey} do fluxo ${flowLabel} precisa ser um objeto.`);
    return;
  }

  const node = nodeValue as unknown as FlowNode;

  if (!hasText(node.id)) {
    errors.push(`O fluxo ${flowLabel} tem um nó sem ID.`);
  } else if (nodeKey !== node.id) {
    errors.push(`A chave do nó ${nodeKey} no fluxo ${flowLabel} deve ser igual ao ID do nó ${node.id}.`);
  }

  if (!hasText(node.text)) {
    errors.push(`O nó ${String(node.id)} do fluxo ${flowLabel} precisa informar um texto.`);
  }

  validateNodeVideos(flowLabel, nodeKey, nodeValue.videos, errors);
  validateNodeVisuals(flowLabel, nodeKey, nodeValue.visuals, errors);
  validateNodeExercise(flowLabel, nodeKey, nodeValue.exercise, errors);

  if (node.kind === 'choice') {
    validateChoiceNode(flowLabel, node, nodeIds, errors);
    return;
  }

  if (node.kind === 'score_branch') {
    validateScoreBranchNode(flowLabel, node, nodeIds, errors);
  }
}

function validateNodeVisuals(flowLabel: string, nodeId: string, visuals: unknown, errors: string[]) {
  if (visuals === undefined) return;
  if (!Array.isArray(visuals)) {
    errors.push(`Os recursos visuais do nó ${nodeId} no fluxo ${flowLabel} precisam estar em uma lista.`);
    return;
  }

  const ids = new Set<string>();
  visuals.forEach((visual, index) => {
    if (!isRecord(visual)) {
      errors.push(`O recurso visual no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa ser um objeto.`);
      return;
    }

    const visualId = hasText(visual.id) ? String(visual.id) : `index-${index}`;
    if (!hasText(visual.id)) {
      errors.push(
        `O recurso visual no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um ID.`,
      );
    } else if (ids.has(visualId)) {
      errors.push(`O nó ${nodeId} do fluxo ${flowLabel} tem o ID de recurso visual repetido: ${visualId}.`);
    } else {
      ids.add(visualId);
    }

    if (!hasText(visual.alt)) {
      errors.push(
        `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um texto alternativo.`,
      );
    }
    if (!hasText(visual.src)) {
      errors.push(`O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar uma origem.`);
    } else {
      const src = String(visual.src);
      if (src.trim().startsWith('data:')) {
        if (!isValidImageDataUrl(src)) {
          errors.push(
            `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, usa um formato de imagem enviada inválido.`,
          );
        }
      } else if (!isExternalVisualSrc(src)) {
        errors.push(
          `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa usar um link http(s) ou caminho iniciado por "/".`,
        );
      }
    }
  });
}

function validateNodeVideos(flowLabel: string, nodeId: string, videos: unknown, errors: string[]) {
  if (videos === undefined) return;
  if (!Array.isArray(videos)) {
    errors.push(`Os vídeos do nó ${nodeId} no fluxo ${flowLabel} precisam estar em uma lista.`);
    return;
  }

  const ids = new Set<string>();
  videos.forEach((video, index) => {
    if (!isRecord(video)) {
      errors.push(`O vídeo no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa ser um objeto.`);
      return;
    }

    const videoId = hasText(video.id) ? String(video.id) : `index-${index}`;
    if (!hasText(video.id)) {
      errors.push(`O vídeo no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um ID.`);
    } else if (ids.has(videoId)) {
      errors.push(`O nó ${nodeId} do fluxo ${flowLabel} tem o ID de vídeo repetido: ${videoId}.`);
    } else {
      ids.add(videoId);
    }

    if (!hasText(video.title)) {
      errors.push(`O vídeo ${videoId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um título.`);
    }
    if (!hasText(video.url) || parseYouTubeVideoId(String(video.url)) === null) {
      errors.push(`O vídeo ${videoId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa usar uma URL válida do YouTube.`);
    }
  });
}

function validateNodeExercise(flowLabel: string, nodeId: string, exercise: unknown, errors: string[]) {
  if (exercise === undefined) return;
  if (typeof exercise !== 'string' || !allowedFlowExercises.includes(exercise)) {
    errors.push(
      `O exercício do nó ${nodeId} no fluxo ${flowLabel} deve ser um destes: ${allowedFlowExercises.join(', ')}.`,
    );
  }
}

function validateChoiceNode(flowLabel: string, node: ChoiceFlowNode, nodeIds: Set<string>, errors: string[]) {
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

function validateScoreBranchNode(flowLabel: string, node: ScoreBranchFlowNode, nodeIds: Set<string>, errors: string[]) {
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

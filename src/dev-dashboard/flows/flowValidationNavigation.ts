import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { DashboardValidationIssue } from '../validation/validationTypes';
import type { FlowValidationTarget } from './flowDashboardTypes';

export function resolveFlowValidationTarget(
  issue: DashboardValidationIssue,
  flows: GuidedFlow[],
): FlowValidationTarget | null {
  const flow = findFlowForIssue(issue, flows);
  if (!flow) return null;

  const pathParts = getFlowPathParts(issue.path, flow);
  const nodePathIndex = pathParts.indexOf('nodes');
  const pathNodeId = nodePathIndex >= 0 ? pathParts[nodePathIndex + 1] : undefined;
  const nodeId = pathNodeId && flow.nodes[pathNodeId] ? pathNodeId : inferNodeId(issue, flow);
  const node = nodeId ? flow.nodes[nodeId] : undefined;
  const stepNumber = node ? getOrderedFlowNodes(flow).findIndex((item) => item.id === node.id) + 1 : 0;
  const nodePrefix = node ? `a etapa ${stepNumber || node.id}` : 'a etapa indicada';
  const nodePath = nodePathIndex >= 0 ? pathParts.slice(nodePathIndex + 2) : [];

  if (node) return resolveNodeValidationTarget(flow.id, node, nodePrefix, nodePath);

  const normalizedMessage = issue.message.toLocaleLowerCase('pt-BR');
  if (pathParts[0] === 'purpose' || normalizedMessage.includes('purpose') || normalizedMessage.includes('finalidade')) {
    return {
      flowId: flow.id,
      section: 'configuracoes',
      description: 'abra as configurações do fluxo e corrija o uso.',
    };
  }

  if (pathParts[0] === 'entry' || hasEntryDiagnostic(normalizedMessage)) {
    const pointsToMissingNode =
      normalizedMessage.includes('missing node') || normalizedMessage.includes('etapa ausente');
    return {
      flowId: flow.id,
      section: 'configuracoes',
      description: pointsToMissingNode
        ? 'abra as configurações do fluxo e escolha uma primeira etapa existente.'
        : 'abra as configurações do fluxo e adicione uma frase de entrada válida.',
    };
  }

  return {
    flowId: flow.id,
    section: 'configuracoes',
    description: 'abra as configurações do fluxo e revise o campo indicado na mensagem.',
  };
}

function resolveNodeValidationTarget(
  flowId: string,
  node: GuidedFlow['nodes'][string],
  nodePrefix: string,
  nodePath: string[],
): FlowValidationTarget {
  const base = { flowId, nodeId: node.id };
  if (nodePath[0] === 'kind') {
    return { ...base, section: 'texto', description: `revise o tipo de ${nodePrefix} no painel da etapa.` };
  }
  if (nodePath[0] === 'scoreKey') {
    return {
      ...base,
      section: 'ramificacao',
      description: `corrija a chave de pontuação de ${nodePrefix} no painel da etapa.`,
    };
  }
  if (nodePath[0] === 'branches' && nodePath[1]) {
    const branchId = nodePath[1];
    const field = nodePath[2] === 'navigation' ? 'Destino de página' : 'Nome da faixa';
    return {
      ...base,
      section: 'ramificacao',
      description: `corrija ${field.toLocaleLowerCase('pt-BR')} da faixa "${branchId}" em ${nodePrefix} no painel da etapa.`,
    };
  }
  if (nodePath[0] === 'options' && nodePath[1] && node.kind === 'choice') {
    const optionIndex = node.options.findIndex((option) => option.id === nodePath[1]);
    if (optionIndex >= 0) {
      return {
        ...base,
        section: 'opcoes',
        description: `corrija o efeito indicado na opção ${optionIndex + 1} de ${nodePrefix} no painel da etapa.`,
      };
    }
  }
  if (nodePath[0] === 'videos' && nodePath[1]) {
    const videoIndex = (node.videos ?? []).findIndex((video) => video.id === nodePath[1]);
    if (videoIndex >= 0) {
      return {
        ...base,
        section: 'midia',
        description: `corrija o link do vídeo em ${nodePrefix} no painel da etapa.`,
      };
    }
  }
  if (nodePath[0] === 'visuals' && nodePath[1]) {
    const visualId = nodePath[1];
    const visuals = node.visuals ?? [];
    const byId = visuals.findIndex((visual) => visual.id === visualId);
    const visualIndex =
      byId >= 0 ? byId : /^\d+$/.test(visualId) && Number(visualId) < visuals.length ? Number(visualId) : -1;
    const visual = visualIndex >= 0 ? visuals[visualIndex] : undefined;
    if (visual) {
      return {
        ...base,
        section: 'midia',
        description: `corrija a imagem "${visual.id}" em ${nodePrefix} no painel da etapa.`,
      };
    }
  }
  return { ...base, section: 'texto', description: `revise ${nodePrefix} no painel da etapa.` };
}

function findFlowForIssue(issue: DashboardValidationIssue, flows: GuidedFlow[]) {
  return flows.find((flow) => {
    if (issue.path && (issue.path === flow.id || issue.path.startsWith(`${flow.id}.`))) return true;
    return (
      issue.id.startsWith(`structural:${flow.id}:`) ||
      issue.id.startsWith(`duplicate-flow-id:${flow.id}`) ||
      issue.id.includes(`:${flow.id}:`) ||
      issue.id.endsWith(`:${flow.id}`)
    );
  });
}

function getFlowPathParts(path: string | undefined, flow: GuidedFlow) {
  if (!path || path === flow.id) return [];
  const prefix = `${flow.id}.`;
  return path.startsWith(prefix) ? path.slice(prefix.length).split('.') : [];
}

function inferNodeId(issue: DashboardValidationIssue, flow: GuidedFlow) {
  const message = issue.message.toLocaleLowerCase('pt-BR');
  const nodes = getOrderedFlowNodes(flow);
  const explicitNode = nodes.find((node) => {
    const id = node.id.toLocaleLowerCase('pt-BR');
    return message.includes(`node ${id}`) || message.includes(`nó ${id}`) || message.includes(`etapa ${id}`);
  });
  if (explicitNode) return explicitNode.id;
  const choiceNode = nodes.find(
    (node) =>
      node.kind === 'choice' &&
      node.options.some((option) => {
        const optionId = option.id.toLocaleLowerCase('pt-BR');
        return message.includes(`option ${optionId}`) || message.includes(`opção ${optionId}`);
      }),
  );
  if (choiceNode) return choiceNode.id;
  return nodes.find((node) =>
    (node.videos ?? []).some((video) => message.includes(`video ${video.id.toLocaleLowerCase('pt-BR')}`)),
  )?.id;
}

function getOrderedFlowNodes(flow: GuidedFlow) {
  if (!flow.nodeOrder) return Object.values(flow.nodes);
  const ordered = flow.nodeOrder.filter((id) => flow.nodes[id]).map((id) => flow.nodes[id]);
  Object.values(flow.nodes).forEach((node) => {
    if (!flow.nodeOrder?.includes(node.id)) ordered.push(node);
  });
  return ordered;
}

function hasEntryDiagnostic(message: string) {
  return (
    message.includes('entry') ||
    message.includes('entrada') ||
    message.includes('entering phrase') ||
    message.includes('frase de entrada')
  );
}

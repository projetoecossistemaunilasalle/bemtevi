import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { FlowEffect, GuidedFlow, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';

const allowedNavigateDestinations = new Set(['/apoio', '/contatos', '/educacao']);
const allowedNodeKinds = new Set(['choice', 'result', 'score_branch']);

export function validateDashboardFlows(flows: GuidedFlow[], resourceIds: string[]) {
  const issues: DashboardValidationIssue[] = [];
  const flowIds = new Set(flows.map((flow) => flow.id));
  const resourceSet = new Set(resourceIds);

  flows.forEach((flow) => {
    const validation = validateFlow(flow);
    validation.errors.forEach((message, index) => {
      const structuralIssue = toStructuralIssue(flow, message, index, validation.errors);
      issues.push({
        level: 'error',
        area: 'flows',
        id: `structural:${flow.id}:${index}`,
        ...structuralIssue,
      });
    });
  });

  findDuplicateIds(flows.map((flow) => flow.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'flows',
      id: `duplicate-flow-id:${id}`,
      message: `Existe mais de um fluxo com o ID "${id}".`,
    });
  });

  flows.forEach((flow) => {
    const scoringKeys = collectScoringKeys(flow);

    Object.values(flow.nodes).forEach((node) => {
      if (!allowedNodeKinds.has(node.kind)) {
        issues.push({
          level: 'error',
          area: 'flows',
          id: `unsupported-node-kind:${flow.id}:${node.id}`,
          message: `Esta etapa usa um tipo que o dashboard não entende: ${node.kind}.`,
          path: `${flow.id}.nodes.${node.id}.kind`,
        });
      }

      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          (option.effects ?? []).forEach((effect) => {
            issues.push(...validateEffect(flow.id, node.id, option.id, effect, flowIds));
          });
        });
      }

      if (node.kind === 'score_branch') {
        issues.push(...validateScoreBranch(flow.id, node, scoringKeys));
      }

      if (node.kind === 'result') {
        (node.recommendations ?? []).forEach((recommendation) => {
          if (!resourceSet.has(recommendation)) {
            issues.push({
              level: 'error',
              area: 'flows',
              id: `missing-resource:${flow.id}:${node.id}:${recommendation}`,
              message: `Este resultado recomenda um material que não existe: ${recommendation}.`,
              path: `${flow.id}.nodes.${node.id}.recommendations`,
            });
          }
        });
      }
    });
  });

  return createValidationResult(issues);
}

type UnknownRecord = Record<string, unknown>;

interface FlowValidationContext {
  flow: UnknownRecord;
  flowId: string;
  pathRoot: string;
  nodes: Array<{ key: string; value: UnknownRecord }>;
}

interface StructuralIssueDetails {
  message: string;
  path: string;
}

/**
 * `validateFlow` intentionally returns a small, domain-level string result.
 * The dashboard adds the editor location here while the original value is
 * still available for matching.  This keeps the domain validator independent
 * from dashboard concerns and prevents structural errors from becoming
 * unclickable, English-only summary entries.
 */
function toStructuralIssue(
  flow: GuidedFlow,
  rawMessage: string,
  errorIndex: number,
  allErrors: string[],
): StructuralIssueDetails {
  const context = createFlowValidationContext(flow);
  const occurrence = countPreviousOccurrences(allErrors, rawMessage, errorIndex);
  const flowLabel = context.flowId || 'este fluxo';

  if (rawMessage === 'O ID do fluxo é obrigatório.') {
    return {
      message: 'O ID do fluxo é obrigatório. Informe um identificador para este fluxo.',
      path: `${context.pathRoot}.id`,
    };
  }

  if (rawMessage === 'A entrada do fluxo é obrigatória.') {
    return {
      message: `A configuração de entrada do fluxo "${flowLabel}" é obrigatória. Configure a primeira etapa e as frases de entrada.`,
      path: `${context.pathRoot}.entry`,
    };
  }

  if (rawMessage === 'Os nós do fluxo são obrigatórios.') {
    return {
      message: `O fluxo "${flowLabel}" precisa ter uma lista de etapas. Adicione pelo menos uma etapa antes de publicar.`,
      path: `${context.pathRoot}.nodes`,
    };
  }

  const purposeMatch = /^O propósito do fluxo (.+?) deve ser um destes: (.+)\.$/.exec(rawMessage);
  if (purposeMatch) {
    return {
      message: `O propósito do fluxo "${flowLabel}" não é válido. Use uma destas opções: ${purposeMatch[2]}.`,
      path: `${context.pathRoot}.purpose`,
    };
  }

  const entryTargetMatch = /^A entrada do fluxo (.+?) aponta para um nó inexistente: (.+)\.$/.exec(rawMessage);
  if (entryTargetMatch) {
    const targetNodeId = entryTargetMatch[2];
    return {
      message: `A entrada do fluxo "${flowLabel}" aponta para a etapa "${targetNodeId}", mas ela não existe. Selecione uma etapa existente como primeira etapa.`,
      path: `${context.pathRoot}.entry.nodeId`,
    };
  }

  if (/^O fluxo (.+) precisa definir frases explícitas para iniciá-lo\.$/.test(rawMessage)) {
    return {
      message: `O fluxo "${flowLabel}" precisa de pelo menos uma frase de entrada preenchida. Adicione uma frase que possa iniciar a conversa.`,
      path: `${context.pathRoot}.entry.enteringPhrases`,
    };
  }

  const nodeObjectMatch = /^O nó (.+?) do fluxo (.+) precisa ser um objeto\.$/.exec(rawMessage);
  if (nodeObjectMatch) {
    const nodeKey = nodeObjectMatch[1];
    return {
      message: `A etapa "${nodeKey}" do fluxo "${flowLabel}" precisa ser um objeto configurável. Revise ou recrie essa etapa.`,
      path: `${context.pathRoot}.nodes.${nodeKey}`,
    };
  }

  if (/^O fluxo (.+) tem um nó sem ID\.$/.test(rawMessage)) {
    const node = findNodeWithMissingId(context, occurrence);
    const missingIdPath = node ? `${context.pathRoot}.nodes.${node.key}.id` : `${context.pathRoot}.nodes`;
    const nodeLabel = node?.key ?? 'sem identificação';
    return {
      message: `A etapa "${nodeLabel}" do fluxo "${flowLabel}" não tem ID. Informe um ID único para que os destinos possam encontrá-la.`,
      path: missingIdPath,
    };
  }

  const nodeKeyMatch = /^A chave do nó (.+?) no fluxo (.+) deve ser igual ao ID do nó (.+)\.$/.exec(rawMessage);
  if (nodeKeyMatch) {
    const nodeKey = nodeKeyMatch[1];
    const nodeId = nodeKeyMatch[3];
    return {
      message: `A chave da etapa "${nodeKey}" precisa ser igual ao ID "${nodeId}". Renomeie a chave ou o ID para que os destinos funcionem.`,
      path: `${context.pathRoot}.nodes.${nodeKey}.id`,
    };
  }

  const nodeTextMatch = /^O nó (.+?) do fluxo (.+) precisa informar um texto\.$/.exec(rawMessage);
  if (nodeTextMatch) {
    const node = findNode(context, nodeTextMatch[1], occurrence);
    const nodeLabel = node ? nodeId(node) : nodeTextMatch[1];
    return {
      message: `A etapa "${nodeLabel}" do fluxo "${flowLabel}" precisa de um texto. Escreva a mensagem que será mostrada antes das opções.`,
      path: `${nodePath(context, node, nodeTextMatch[1])}.text`,
    };
  }

  const videosListMatch = /^Os vídeos do nó (.+?) no fluxo (.+) precisam estar em uma lista\.$/.exec(rawMessage);
  if (videosListMatch) {
    const node = findNode(context, videosListMatch[1], occurrence);
    return {
      message: `Os vídeos da etapa "${node ? nodeId(node) : videosListMatch[1]}" precisam ser informados como uma lista. Remova o valor inválido ou adicione vídeos válidos.`,
      path: `${nodePath(context, node, videosListMatch[1])}.videos`,
    };
  }

  const videoObjectMatch = /^O vídeo no índice (\d+) do nó (.+?), no fluxo (.+), precisa ser um objeto\.$/.exec(
    rawMessage,
  );
  if (videoObjectMatch) {
    const node = findNode(context, videoObjectMatch[2], occurrence);
    const videoIndex = videoObjectMatch[1];
    return {
      message: `O vídeo na posição ${Number(videoIndex) + 1} da etapa "${node ? nodeId(node) : videoObjectMatch[2]}" precisa ser um objeto válido.`,
      path: `${nodePath(context, node, videoObjectMatch[2])}.videos.${videoIndex}`,
    };
  }

  const videoIdRequiredMatch = /^O vídeo no índice (\d+) do nó (.+?), no fluxo (.+), precisa informar um ID\.$/.exec(
    rawMessage,
  );
  if (videoIdRequiredMatch) {
    const node = findNode(context, videoIdRequiredMatch[2], occurrence);
    const videoIndex = videoIdRequiredMatch[1];
    return {
      message: `O vídeo na posição ${Number(videoIndex) + 1} da etapa "${node ? nodeId(node) : videoIdRequiredMatch[2]}" precisa de um ID. Informe um identificador único para esse vídeo.`,
      path: `${nodePath(context, node, videoIdRequiredMatch[2])}.videos.${videoIndex}.id`,
    };
  }

  const duplicateVideoMatch = /^O nó (.+?) do fluxo (.+) tem o ID de vídeo repetido: (.+)\.$/.exec(rawMessage);
  if (duplicateVideoMatch) {
    const node = findNode(context, duplicateVideoMatch[1], occurrence);
    const video = findVideo(context, node, duplicateVideoMatch[3], occurrence);
    return {
      message: `A etapa "${node ? nodeId(node) : duplicateVideoMatch[1]}" tem mais de um vídeo com o ID "${duplicateVideoMatch[3]}". Use um ID diferente em cada vídeo.`,
      path: `${nodePath(context, node, duplicateVideoMatch[1])}.videos.${video?.index ?? duplicateVideoMatch[3]}.id`,
    };
  }

  const videoTitleMatch = /^O vídeo (.+?) do nó (.+?), no fluxo (.+), precisa informar um título\.$/.exec(rawMessage);
  if (videoTitleMatch) {
    const node = findNode(context, videoTitleMatch[2], occurrence);
    const video = findVideo(context, node, videoTitleMatch[1], occurrence);
    return {
      message: `O vídeo "${videoTitleMatch[1]}" da etapa "${node ? nodeId(node) : videoTitleMatch[2]}" precisa de um título. Informe um nome curto e descritivo.`,
      path: `${nodePath(context, node, videoTitleMatch[2])}.videos.${video?.index ?? videoTitleMatch[1]}.title`,
    };
  }

  const videoUrlMatch = /^O vídeo (.+?) do nó (.+?), no fluxo (.+), precisa usar uma URL válida do YouTube\.$/.exec(
    rawMessage,
  );
  if (videoUrlMatch) {
    const node = findNode(context, videoUrlMatch[2], occurrence);
    const video = findVideo(context, node, videoUrlMatch[1], occurrence);
    return {
      message: `O vídeo "${videoUrlMatch[1]}" da etapa "${node ? nodeId(node) : videoUrlMatch[2]}" precisa usar uma URL válida do YouTube. Cole o link completo do vídeo.`,
      path: `${nodePath(context, node, videoUrlMatch[2])}.videos.${video?.index ?? videoUrlMatch[1]}.url`,
    };
  }

  const emptyOptionsMatch = /^O nó de escolhas (.+?) do fluxo (.+) precisa ter pelo menos uma opção\.$/.exec(rawMessage);
  if (emptyOptionsMatch) {
    const node = findNode(context, emptyOptionsMatch[1], occurrence);
    return {
      message: `A etapa de escolha "${node ? nodeId(node) : emptyOptionsMatch[1]}" do fluxo "${flowLabel}" precisa ter pelo menos uma opção ou um campo de texto livre. Adicione uma opção para a pessoa continuar.`,
      path: `${nodePath(context, node, emptyOptionsMatch[1])}.options`,
    };
  }

  const freeTextTargetMatch = /^A opção de texto livre do nó (.+?), no fluxo (.+), aponta para um nó inexistente: (.+)\.$/.exec(
    rawMessage,
  );
  if (freeTextTargetMatch) {
    const node = findNode(context, freeTextTargetMatch[1], occurrence);
    return {
      message: `O texto livre da etapa "${node ? nodeId(node) : freeTextTargetMatch[1]}" aponta para a etapa "${freeTextTargetMatch[3]}", mas ela não existe. Escolha um destino existente.`,
      path: `${nodePath(context, node, freeTextTargetMatch[1])}.freeText.next`,
    };
  }

  const optionIdMatch = /^O nó (.+?) do fluxo (.+) tem uma opção sem ID\.$/.exec(rawMessage);
  if (optionIdMatch) {
    const node = findNode(context, optionIdMatch[1], occurrence);
    const option = findOptionByIndex(node, occurrence);
    return {
      message: `A opção na posição ${(option?.index ?? occurrence) + 1} da etapa "${node ? nodeId(node) : optionIdMatch[1]}" não tem ID. Informe um identificador único para essa opção.`,
      path: `${nodePath(context, node, optionIdMatch[1])}.options.${option?.index ?? occurrence}.id`,
    };
  }

  const optionLabelMatch = /^A opção (.+?) do fluxo (.+) precisa informar um rótulo\.$/.exec(rawMessage);
  if (optionLabelMatch) {
    const option = findOption(context, optionLabelMatch[1], occurrence);
    return {
      message: `A opção "${optionLabelMatch[1]}" da etapa "${option?.nodeId ?? 'desconhecida'}" precisa de um rótulo. Escreva o texto que a pessoa verá para escolher essa opção.`,
      path: `${optionPath(context, option, optionLabelMatch[1])}.label`,
    };
  }

  const optionTargetMatch = /^A opção (.+?) do fluxo (.+) aponta para um nó inexistente: (.+)\.$/.exec(rawMessage);
  if (optionTargetMatch) {
    const optionId = optionTargetMatch[1];
    const targetNodeId = optionTargetMatch[3];
    const option = findOption(context, optionId, occurrence);
    const sourceNodeId = option?.nodeId ?? 'desconhecida';
    return {
      message: `A opção "${optionId}" da etapa "${sourceNodeId}" do fluxo "${flowLabel}" aponta para a etapa "${targetNodeId}", mas ela não existe. Escolha uma etapa existente no destino desta opção.`,
      path: `${optionPath(context, option, optionId)}.next`,
    };
  }

  const scoreBranchScoreKeyMatch = /^O nó de ramificação de pontuação (.+?) do fluxo (.+) precisa informar uma chave de pontuação \(scoreKey\)\.$/.exec(
    rawMessage,
  );
  if (scoreBranchScoreKeyMatch) {
    const node = findNode(context, scoreBranchScoreKeyMatch[1], occurrence);
    return {
      message: `A ramificação de pontuação "${node ? nodeId(node) : scoreBranchScoreKeyMatch[1]}" precisa informar uma chave de pontuação. Escolha a mesma chave usada pelas opções que somam pontos.`,
      path: `${nodePath(context, node, scoreBranchScoreKeyMatch[1])}.scoreKey`,
    };
  }

  const scoreBranchListMatch = /^O nó de ramificação de pontuação (.+?) do fluxo (.+) precisa ter pelo menos uma faixa\.$/.exec(
    rawMessage,
  );
  if (scoreBranchListMatch) {
    const node = findNode(context, scoreBranchListMatch[1], occurrence);
    return {
      message: `A ramificação de pontuação "${node ? nodeId(node) : scoreBranchListMatch[1]}" precisa ter pelo menos uma faixa. Adicione uma faixa com limites e destino válidos.`,
      path: `${nodePath(context, node, scoreBranchListMatch[1])}.branches`,
    };
  }

  const invalidBranchMatch = /^O nó de ramificação de pontuação (.+?) do fluxo (.+) tem uma faixa inválida\.$/.exec(rawMessage);
  if (invalidBranchMatch) {
    const node = findNode(context, invalidBranchMatch[1], occurrence);
    const branch = findBranchByIndex(node, occurrence);
    return {
      message: `Uma faixa da ramificação "${node ? nodeId(node) : invalidBranchMatch[1]}" está incompleta ou inválida. Informe ID, limite mínimo e limite máximo numéricos.`,
      path: `${nodePath(context, node, invalidBranchMatch[1])}.branches.${branch?.id ?? branch?.index ?? occurrence}`,
    };
  }

  const branchTargetMatch = /^A faixa (.+?) do nó de ramificação (.+?), no fluxo (.+), aponta para um nó inexistente: (.+)\.$/.exec(
    rawMessage,
  );
  if (branchTargetMatch) {
    const node = findNode(context, branchTargetMatch[2], occurrence);
    const branch = findBranch(node, branchTargetMatch[1], occurrence);
    return {
      message: `A faixa "${branchTargetMatch[1]}" da ramificação "${node ? nodeId(node) : branchTargetMatch[2]}" aponta para a etapa "${branchTargetMatch[4]}", mas ela não existe. Escolha uma etapa existente para essa faixa.`,
      path: `${nodePath(context, node, branchTargetMatch[2])}.branches.${branch?.id ?? branchTargetMatch[1]}.next`,
    };
  }

  const branchNavigationMatch = /^A faixa (.+?) do nó de ramificação (.+?), no fluxo (.+), usa um destino de navegação não permitido\.$/.exec(
    rawMessage,
  );
  if (branchNavigationMatch) {
    const node = findNode(context, branchNavigationMatch[2], occurrence);
    const branch = findBranch(node, branchNavigationMatch[1], occurrence);
    return {
      message: `A faixa "${branchNavigationMatch[1]}" da ramificação "${node ? nodeId(node) : branchNavigationMatch[2]}" usa um destino de página não permitido. Escolha /apoio, /contatos ou /educacao.`,
      path: `${nodePath(context, node, branchNavigationMatch[2])}.branches.${branch?.id ?? branchNavigationMatch[1]}.navigation`,
    };
  }

  const scoreEffectMatch = /^O efeito de pontuação da opção (.+?) do fluxo (.+) precisa informar uma chave de pontuação \(scoreKey\) e um valor numérico\.$/.exec(
    rawMessage,
  );
  if (scoreEffectMatch) {
    const option = findOption(context, scoreEffectMatch[1], occurrence);
    return {
      message: `A pontuação da opção "${scoreEffectMatch[1]}" precisa informar uma chave e um valor numérico. Preencha esses dois campos para registrar a resposta.`,
      path: `${effectPath(context, option, 'score', occurrence)}`,
    };
  }

  const safetyEffectMatch = /^O efeito de interrupção de segurança da opção (.+?) do fluxo (.+) precisa informar mensagem, destino e se deve bloquear o retorno \(blockResume\)\.$/.exec(
    rawMessage,
  );
  if (safetyEffectMatch) {
    const option = findOption(context, safetyEffectMatch[1], occurrence);
    return {
      message: `A interrupção de segurança da opção "${safetyEffectMatch[1]}" precisa de mensagem, destino e indicação de bloqueio. Preencha os três campos.`,
      path: effectPath(context, option, 'safety_interrupt', occurrence),
    };
  }

  const deferredSafetyEffectMatch = /^O efeito de segurança adiada da opção (.+?) do fluxo (.+) precisa informar a chave de sinalização \(flagKey\), mensagem e destino permitido\.$/.exec(
    rawMessage,
  );
  if (deferredSafetyEffectMatch) {
    const option = findOption(context, deferredSafetyEffectMatch[1], occurrence);
    return {
      message: `A sinalização de segurança adiada da opção "${deferredSafetyEffectMatch[1]}" precisa de chave, mensagem e destino permitido. Preencha os três campos.`,
      path: effectPath(context, option, 'deferred_safety', occurrence),
    };
  }

  const flowStartEffectMatch = /^O efeito de início de fluxo da opção (.+?) do fluxo (.+) precisa informar o ID do fluxo de destino \(flowId\)\.$/.exec(
    rawMessage,
  );
  if (flowStartEffectMatch) {
    const option = findOption(context, flowStartEffectMatch[1], occurrence);
    return {
      message: `A ação de iniciar fluxo da opção "${flowStartEffectMatch[1]}" precisa informar o fluxo de destino. Selecione um fluxo existente.`,
      path: effectPath(context, option, 'flow_start', occurrence),
    };
  }

  const navigateEffectMatch = /^O efeito de navegação da opção (.+?) do fluxo (.+) precisa usar um destino permitido\.$/.exec(
    rawMessage,
  );
  if (navigateEffectMatch) {
    const option = findOption(context, navigateEffectMatch[1], occurrence);
    return {
      message: `A navegação da opção "${navigateEffectMatch[1]}" usa um destino não permitido. Escolha /apoio, /contatos ou /educacao.`,
      path: effectPath(context, option, 'navigate', occurrence),
    };
  }

  const endFlowEffectMatch = /^O efeito de encerramento da opção (.+?) do fluxo (.+) precisa informar uma mensagem\.$/.exec(
    rawMessage,
  );
  if (endFlowEffectMatch) {
    const option = findOption(context, endFlowEffectMatch[1], occurrence);
    return {
      message: `A ação de encerrar da opção "${endFlowEffectMatch[1]}" precisa informar a mensagem mostrada à pessoa. Escreva uma mensagem de encerramento.`,
      path: effectPath(context, option, 'end_flow', occurrence),
    };
  }

  const unsupportedEffectMatch = /^A opção (.+?) do fluxo (.+) contém um tipo de efeito não suportado: "(.+)"\.$/.exec(
    rawMessage,
  );
  if (unsupportedEffectMatch) {
    const option = findOption(context, unsupportedEffectMatch[1], occurrence);
    return {
      message: `A opção "${unsupportedEffectMatch[1]}" usa uma ação "${unsupportedEffectMatch[3]}" que o dashboard não reconhece. Remova essa ação ou escolha um tipo compatível.`,
      path: effectPath(context, option, unsupportedEffectMatch[3], occurrence),
    };
  }

  // Keep future validator messages actionable and localized even before a
  // dedicated field mapping is added for them.
  return {
    message: `O fluxo "${flowLabel}" contém um erro estrutural. Revise a configuração no editor antes de publicar.`,
    path: `${context.pathRoot}.validation`,
  };
}

interface NodeMatch {
  key: string;
  value: UnknownRecord;
}

interface OptionMatch {
  node: NodeMatch;
  nodeId: string;
  option: UnknownRecord;
  index: number;
}

interface IndexedRecord {
  value: UnknownRecord;
  index: number;
}

function createFlowValidationContext(flow: GuidedFlow): FlowValidationContext {
  const rawFlow = (isRecord(flow) ? flow : {}) as UnknownRecord;
  const rawNodes = rawFlow.nodes;
  const nodes = isRecord(rawNodes)
    ? Object.entries(rawNodes).map(([key, value]) => ({ key, value: isRecord(value) ? value : {} }))
    : [];
  const flowId = stringify(rawFlow.id);

  return {
    flow: rawFlow,
    flowId,
    pathRoot: flowId || 'fluxo',
    nodes,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown) {
  return value === undefined ? 'undefined' : String(value);
}

function hasTextValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nodeId(node: NodeMatch) {
  return hasTextValue(node.value.id) ? String(node.value.id) : node.key;
}

function findNode(context: FlowValidationContext, label: string, occurrence: number): NodeMatch | undefined {
  const candidates = context.nodes.filter(
    (node) => stringify(node.value.id) === label || node.key === label,
  );
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

function findNodeWithMissingId(context: FlowValidationContext, occurrence: number): NodeMatch | undefined {
  const candidates = context.nodes.filter((node) => !hasTextValue(node.value.id));
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

function nodePath(context: FlowValidationContext, node: NodeMatch | undefined, fallback: string) {
  return `${context.pathRoot}.nodes.${node ? nodeId(node) : fallback}`;
}

function allOptions(context: FlowValidationContext): OptionMatch[] {
  const options: OptionMatch[] = [];

  context.nodes.forEach((node) => {
    if (!Array.isArray(node.value.options)) return;
    node.value.options.forEach((value, index) => {
      if (!isRecord(value)) return;
      options.push({ node, nodeId: nodeId(node), option: value, index });
    });
  });

  return options;
}

function findOption(context: FlowValidationContext, label: string, occurrence: number): OptionMatch | undefined {
  const candidates = allOptions(context).filter((item) => stringify(item.option.id) === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

function findOptionByIndex(node: NodeMatch | undefined, index: number): IndexedRecord | undefined {
  if (!node || !Array.isArray(node.value.options)) return undefined;
  const value = node.value.options[index];
  return isRecord(value) ? { value, index } : undefined;
}

function optionPath(context: FlowValidationContext, option: OptionMatch | undefined, fallback: string) {
  const nodeSegment = option?.nodeId ?? 'etapa';
  const optionSegment = option
    ? hasTextValue(option.option.id)
      ? String(option.option.id)
      : String(option.index)
    : fallback;
  return `${context.pathRoot}.nodes.${nodeSegment}.options.${optionSegment}`;
}

function effectPath(
  context: FlowValidationContext,
  option: OptionMatch | undefined,
  kind: string,
  occurrence: number,
) {
  const effectValues = option?.option.effects;
  const effects = Array.isArray(effectValues) ? effectValues : [];
  const candidates = effects
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && stringify(item.value.kind) === kind);
  const selected = candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
  const effectSegment = selected ? String(selected.index) : kind;
  return `${optionPath(context, option, 'opção')}.effects.${effectSegment}`;
}

function findVideo(
  _context: FlowValidationContext,
  node: NodeMatch | undefined,
  label: string,
  occurrence: number,
): { index: number; value: UnknownRecord } | undefined {
  const videos = node?.value.videos;
  if (!Array.isArray(videos)) return undefined;

  const candidates = videos
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && videoId(item.value, item.index) === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

function videoId(video: UnknownRecord, index: number) {
  return hasTextValue(video.id) ? String(video.id) : `index-${index}`;
}

function findBranch(node: NodeMatch | undefined, label: string, occurrence: number) {
  const branches = node?.value.branches;
  if (!Array.isArray(branches)) return undefined;

  const candidates = branches
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && stringify(item.value.id) === label);
  const selected = candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
  return selected && {
    index: selected.index,
    id: hasTextValue(selected.value.id) ? String(selected.value.id) : undefined,
  };
}

function findBranchByIndex(node: NodeMatch | undefined, index: number) {
  const branches = node?.value.branches;
  if (!Array.isArray(branches)) return undefined;
  const value = branches[index];
  if (!isRecord(value)) return undefined;
  return {
    index,
    id: hasTextValue(value.id) ? String(value.id) : undefined,
  };
}

function countPreviousOccurrences(values: string[], value: string, index: number) {
  return values.slice(0, index).filter((candidate) => candidate === value).length;
}

function validateEffect(
  flowId: string,
  nodeId: string,
  optionId: string,
  effect: FlowEffect,
  flowIds: Set<string>,
): DashboardValidationIssue[] {
  if (effect.kind === 'flow_start' && !flowIds.has(effect.flowId)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `missing-flow-start:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta começar um fluxo que não existe: ${effect.flowId}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  if (effect.kind === 'navigate' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-navigate:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta abrir um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  if (effect.kind === 'safety_interrupt' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-safety-destination:${flowId}:${nodeId}:${optionId}`,
        message: `A interrupção de segurança usa um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  return [];
}

function collectScoringKeys(flow: GuidedFlow) {
  const keys = new Set<string>();

  Object.values(flow.nodes).forEach((node) => {
    if (node.kind !== 'choice') return;

    node.options.forEach((option) => {
      option.effects?.forEach((effect) => {
        if (effect.kind === 'score' && effect.scoreKey.trim()) {
          keys.add(effect.scoreKey);
        }
      });
    });
  });

  return keys;
}

function validateScoreBranch(
  flowId: string,
  node: ScoreBranchFlowNode,
  scoringKeys: Set<string>,
): DashboardValidationIssue[] {
  const issues: DashboardValidationIssue[] = [];

  if (!scoringKeys.has(node.scoreKey)) {
    issues.push({
      level: 'warning',
      area: 'flows',
      id: `unused-score-key:${flowId}:${node.id}:${node.scoreKey}`,
      message: `Esta ramificação usa a pontuação "${node.scoreKey}", mas nenhuma opção soma pontos nessa chave.`,
      path: `${flowId}.nodes.${node.id}.scoreKey`,
    });
  }

  const sortedBranches = [...node.branches].sort((a, b) => a.min - b.min || a.max - b.max);
  sortedBranches.forEach((branch, index) => {
    if (branch.navigation !== undefined && !allowedNavigateDestinations.has(branch.navigation)) {
      issues.push({
        level: 'error',
        area: 'flows',
        id: `invalid-score-branch-navigation:${flowId}:${node.id}:${branch.id}`,
        message: `A faixa "${branch.id}" tenta abrir um destino que não é permitido: ${branch.navigation}.`,
        path: `${flowId}.nodes.${node.id}.branches.${branch.id}.navigation`,
      });
    }

    const previousBranch = sortedBranches[index - 1];
    if (previousBranch && branch.min <= previousBranch.max) {
      issues.push({
        level: 'warning',
        area: 'flows',
        id: `overlapping-score-range:${flowId}:${node.id}:${branch.id}`,
        message: `A faixa "${branch.id}" sobrepõe outra faixa de pontuação neste redirecionamento.`,
        path: `${flowId}.nodes.${node.id}.branches.${branch.id}`,
      });
    }
  });

  return issues;
}

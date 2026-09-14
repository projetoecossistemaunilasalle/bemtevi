import {
  findNode,
  findNodeWithMissingId,
  findVideo,
  findVisual,
  nodeId,
  nodePath,
  type FlowValidationContext,
  type StructuralIssueDetails,
} from './flowStructuralValidationContext';

export function translateStructuralCoreIssue({
  context,
  rawMessage,
  occurrence,
  flowLabel,
}: {
  context: FlowValidationContext;
  rawMessage: string;
  occurrence: number;
  flowLabel: string;
}): StructuralIssueDetails | null {
  if (rawMessage === 'O ID do fluxo é obrigatório.') {
    return {
      message: 'O identificador do fluxo é obrigatório. Informe um identificador único para este fluxo.',
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
  if (/^O propósito do fluxo (.+?) deve ser um destes: (.+)\.$/.test(rawMessage)) {
    return {
      message: `O uso do fluxo "${flowLabel}" não é válido. Escolha uma das opções disponíveis nas configurações.`,
      path: `${context.pathRoot}.purpose`,
    };
  }
  const entryTargetMatch = /^A entrada do fluxo (.+?) aponta para um nó inexistente: (.+)\.$/.exec(rawMessage);
  if (entryTargetMatch) {
    return {
      message: `A entrada do fluxo "${flowLabel}" aponta para a etapa "${entryTargetMatch[2]}", mas ela não existe. Selecione uma etapa existente como primeira etapa.`,
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
    return {
      message: `A etapa "${nodeObjectMatch[1]}" do fluxo "${flowLabel}" precisa ser um objeto configurável. Revise ou recrie essa etapa.`,
      path: `${context.pathRoot}.nodes.${nodeObjectMatch[1]}`,
    };
  }
  if (/^O fluxo (.+) tem um nó sem ID\.$/.test(rawMessage)) {
    const node = findNodeWithMissingId(context, occurrence);
    const nodeLabel = node?.key ?? 'sem identificação';
    return {
      message: `A etapa "${nodeLabel}" do fluxo "${flowLabel}" não tem identificador. Informe um valor único para que os destinos possam encontrá-la.`,
      path: node ? `${context.pathRoot}.nodes.${node.key}.id` : `${context.pathRoot}.nodes`,
    };
  }
  const nodeKeyMatch = /^A chave do nó (.+?) no fluxo (.+) deve ser igual ao ID do nó (.+)\.$/.exec(rawMessage);
  if (nodeKeyMatch) {
    return {
      message: `A chave da etapa "${nodeKeyMatch[1]}" precisa ser igual ao identificador "${nodeKeyMatch[3]}". Renomeie um dos valores para que os destinos funcionem.`,
      path: `${context.pathRoot}.nodes.${nodeKeyMatch[1]}.id`,
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
      message: `O vídeo na posição ${Number(videoIndex) + 1} da etapa "${node ? nodeId(node) : videoIdRequiredMatch[2]}" precisa de um identificador único.`,
      path: `${nodePath(context, node, videoIdRequiredMatch[2])}.videos.${videoIndex}.id`,
    };
  }
  const duplicateVideoMatch = /^O nó (.+?) do fluxo (.+) tem o ID de vídeo repetido: (.+)\.$/.exec(rawMessage);
  if (duplicateVideoMatch) {
    const node = findNode(context, duplicateVideoMatch[1], occurrence);
    const video = findVideo(node, duplicateVideoMatch[3], occurrence);
    return {
      message: `A etapa "${node ? nodeId(node) : duplicateVideoMatch[1]}" tem mais de um vídeo com o identificador "${duplicateVideoMatch[3]}". Use um valor diferente em cada vídeo.`,
      path: `${nodePath(context, node, duplicateVideoMatch[1])}.videos.${video?.index ?? duplicateVideoMatch[3]}.id`,
    };
  }
  const videoTitleMatch = /^O vídeo (.+?) do nó (.+?), no fluxo (.+), precisa informar um título\.$/.exec(rawMessage);
  if (videoTitleMatch) {
    const node = findNode(context, videoTitleMatch[2], occurrence);
    const video = findVideo(node, videoTitleMatch[1], occurrence);
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
    const video = findVideo(node, videoUrlMatch[1], occurrence);
    return {
      message: `O vídeo "${videoUrlMatch[1]}" da etapa "${node ? nodeId(node) : videoUrlMatch[2]}" precisa usar uma URL válida do YouTube. Cole o link completo do vídeo.`,
      path: `${nodePath(context, node, videoUrlMatch[2])}.videos.${video?.index ?? videoUrlMatch[1]}.url`,
    };
  }
  const visualDataUrlMatch =
    /^O recurso visual (.+?) do nó (.+?), no fluxo (.+), usa um formato de imagem enviada inválido\.$/.exec(rawMessage);
  if (visualDataUrlMatch) {
    const node = findNode(context, visualDataUrlMatch[2], occurrence);
    const visual = findVisual(node, visualDataUrlMatch[1], occurrence);
    return {
      message: `A imagem "${visualDataUrlMatch[1]}" da etapa "${node ? nodeId(node) : visualDataUrlMatch[2]}" está corrompida ou em formato não suportado. Reenvie a imagem no painel da etapa.`,
      path: `${nodePath(context, node, visualDataUrlMatch[2])}.visuals.${visual?.index ?? visualDataUrlMatch[1]}.src`,
    };
  }
  const visualExternalUrlMatch =
    /^O recurso visual (.+?) do nó (.+?), no fluxo (.+), precisa usar um link http\(s\) ou caminho iniciado por "\/"\.$/.exec(
      rawMessage,
    );
  if (visualExternalUrlMatch) {
    const node = findNode(context, visualExternalUrlMatch[2], occurrence);
    const visual = findVisual(node, visualExternalUrlMatch[1], occurrence);
    return {
      message: `A imagem "${visualExternalUrlMatch[1]}" da etapa "${node ? nodeId(node) : visualExternalUrlMatch[2]}" precisa de um link http(s) ou caminho iniciado por "/". Cole um link completo no painel da etapa.`,
      path: `${nodePath(context, node, visualExternalUrlMatch[2])}.visuals.${visual?.index ?? visualExternalUrlMatch[1]}.src`,
    };
  }
  return null;
}

import {
  effectPath,
  findBranch,
  findBranchByIndex,
  findNode,
  findOption,
  findOptionByIndex,
  nodeId,
  nodePath,
  optionPath,
  type FlowValidationContext,
  type StructuralIssueDetails,
} from './flowStructuralValidationContext';

export function translateStructuralChoiceIssue({
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
  const emptyOptionsMatch = /^O nó de escolhas (.+?) do fluxo (.+) precisa ter pelo menos uma opção\.$/.exec(
    rawMessage,
  );
  if (emptyOptionsMatch) {
    const node = findNode(context, emptyOptionsMatch[1], occurrence);
    return {
      message: `A etapa de escolha "${node ? nodeId(node) : emptyOptionsMatch[1]}" do fluxo "${flowLabel}" precisa ter pelo menos uma opção ou um campo de texto livre. Adicione uma opção para a pessoa continuar.`,
      path: `${nodePath(context, node, emptyOptionsMatch[1])}.options`,
    };
  }
  const freeTextTargetMatch =
    /^A opção de texto livre do nó (.+?), no fluxo (.+), aponta para um nó inexistente: (.+)\.$/.exec(rawMessage);
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
      message: `A opção na posição ${(option?.index ?? occurrence) + 1} da etapa "${node ? nodeId(node) : optionIdMatch[1]}" não tem identificador. Informe um valor único para essa opção.`,
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
    const option = findOption(context, optionId, occurrence);
    return {
      message: `A opção "${optionId}" da etapa "${option?.nodeId ?? 'desconhecida'}" do fluxo "${flowLabel}" aponta para a etapa "${optionTargetMatch[3]}", mas ela não existe. Escolha uma etapa existente no destino desta opção.`,
      path: `${optionPath(context, option, optionId)}.next`,
    };
  }
  const scoreKeyMatch =
    /^O nó de ramificação de pontuação (.+?) do fluxo (.+) precisa informar uma chave de pontuação \(scoreKey\)\.$/.exec(
      rawMessage,
    );
  if (scoreKeyMatch) {
    const node = findNode(context, scoreKeyMatch[1], occurrence);
    return {
      message: `A ramificação de pontuação "${node ? nodeId(node) : scoreKeyMatch[1]}" precisa informar uma chave de pontuação. Escolha a mesma chave usada pelas opções que somam pontos.`,
      path: `${nodePath(context, node, scoreKeyMatch[1])}.scoreKey`,
    };
  }
  const branchListMatch =
    /^O nó de ramificação de pontuação (.+?) do fluxo (.+) precisa ter pelo menos uma faixa\.$/.exec(rawMessage);
  if (branchListMatch) {
    const node = findNode(context, branchListMatch[1], occurrence);
    return {
      message: `A ramificação de pontuação "${node ? nodeId(node) : branchListMatch[1]}" precisa ter pelo menos uma faixa. Adicione uma faixa com limites e destino válidos.`,
      path: `${nodePath(context, node, branchListMatch[1])}.branches`,
    };
  }
  const invalidBranchMatch = /^O nó de ramificação de pontuação (.+?) do fluxo (.+) tem uma faixa inválida\.$/.exec(
    rawMessage,
  );
  if (invalidBranchMatch) {
    const node = findNode(context, invalidBranchMatch[1], occurrence);
    const branch = findBranchByIndex(node, occurrence);
    return {
      message: `Uma faixa da ramificação "${node ? nodeId(node) : invalidBranchMatch[1]}" está incompleta ou inválida. Informe um identificador, o limite mínimo e o limite máximo.`,
      path: `${nodePath(context, node, invalidBranchMatch[1])}.branches.${branch?.id ?? branch?.index ?? occurrence}`,
    };
  }
  const branchTargetMatch =
    /^A faixa (.+?) do nó de ramificação (.+?), no fluxo (.+), aponta para um nó inexistente: (.+)\.$/.exec(rawMessage);
  if (branchTargetMatch) {
    const node = findNode(context, branchTargetMatch[2], occurrence);
    const branch = findBranch(node, branchTargetMatch[1], occurrence);
    return {
      message: `A faixa "${branchTargetMatch[1]}" da ramificação "${node ? nodeId(node) : branchTargetMatch[2]}" aponta para a etapa "${branchTargetMatch[4]}", mas ela não existe. Escolha uma etapa existente para essa faixa.`,
      path: `${nodePath(context, node, branchTargetMatch[2])}.branches.${branch?.id ?? branchTargetMatch[1]}.next`,
    };
  }
  const branchNavigationMatch =
    /^A faixa (.+?) do nó de ramificação (.+?), no fluxo (.+), usa um destino de navegação não permitido\.$/.exec(
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

  return translateEffectIssue(context, rawMessage, occurrence);
}

function translateEffectIssue(
  context: FlowValidationContext,
  rawMessage: string,
  occurrence: number,
): StructuralIssueDetails | null {
  const cases: Array<{ pattern: RegExp; kind: string; message: (optionId: string) => string }> = [
    {
      pattern:
        /^O efeito de pontuação da opção (.+?) do fluxo (.+) precisa informar uma chave de pontuação \(scoreKey\) e um valor numérico\.$/,
      kind: 'score',
      message: (id) =>
        `A pontuação da opção "${id}" precisa informar uma chave e um valor numérico. Preencha esses dois campos para registrar a resposta.`,
    },
    {
      pattern:
        /^O efeito de interrupção de segurança da opção (.+?) do fluxo (.+) precisa informar mensagem, destino e se deve bloquear o retorno \(blockResume\)\.$/,
      kind: 'safety_interrupt',
      message: (id) =>
        `A interrupção de segurança da opção "${id}" precisa de mensagem, destino e indicação de bloqueio. Preencha os três campos.`,
    },
    {
      pattern:
        /^O efeito de segurança adiada da opção (.+?) do fluxo (.+) precisa informar a chave de sinalização \(flagKey\), mensagem e destino permitido\.$/,
      kind: 'deferred_safety',
      message: (id) =>
        `A sinalização de segurança adiada da opção "${id}" precisa de chave, mensagem e destino permitido. Preencha os três campos.`,
    },
    {
      pattern:
        /^O efeito de início de fluxo da opção (.+?) do fluxo (.+) precisa informar o ID do fluxo de destino \(flowId\)\.$/,
      kind: 'flow_start',
      message: (id) =>
        `A ação de iniciar fluxo da opção "${id}" precisa informar o fluxo de destino. Selecione um fluxo existente.`,
    },
    {
      pattern: /^O efeito de navegação da opção (.+?) do fluxo (.+) precisa usar um destino permitido\.$/,
      kind: 'navigate',
      message: (id) =>
        `A navegação da opção "${id}" usa um destino não permitido. Escolha /apoio, /contatos ou /educacao.`,
    },
    {
      pattern: /^O efeito de encerramento da opção (.+?) do fluxo (.+) precisa informar uma mensagem\.$/,
      kind: 'end_flow',
      message: (id) =>
        `A ação de encerrar da opção "${id}" precisa informar a mensagem mostrada à pessoa. Escreva uma mensagem de encerramento.`,
    },
  ];
  for (const entry of cases) {
    const match = entry.pattern.exec(rawMessage);
    if (!match) continue;
    const option = findOption(context, match[1], occurrence);
    return { message: entry.message(match[1]), path: effectPath(context, option, entry.kind, occurrence) };
  }
  const unsupportedMatch = /^A opção (.+?) do fluxo (.+) contém um tipo de efeito não suportado: "(.+)"\.$/.exec(
    rawMessage,
  );
  if (unsupportedMatch) {
    const option = findOption(context, unsupportedMatch[1], occurrence);
    return {
      message: `A opção "${unsupportedMatch[1]}" usa uma ação que o painel não reconhece. Remova essa ação ou escolha um tipo compatível.`,
      path: effectPath(context, option, unsupportedMatch[3], occurrence),
    };
  }
  return null;
}

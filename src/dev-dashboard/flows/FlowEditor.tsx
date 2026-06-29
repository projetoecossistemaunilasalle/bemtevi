import { useState, useMemo, useEffect } from 'react';
import type {
  ChoiceFlowNode,
  DeferredSafetyFlowEffect,
  FlowNode,
  GlobalActionTarget,
  GuidedFlow,
  ScoreBranchFlowNode,
} from '../../domain/flow-engine/types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClass, inputClassSm, textareaClass } from '../components/fieldStyles';
import { getFlowNodeLabel } from './flowDisplay';
import { flowPurposeLabels } from './flowLabels';

export function FlowEditor({
  flow,
  flows,
  onChange,
  selectedNodeId,
  nodeSearch,
  activeNodeFilter,
  onSelectNodeId,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onChange: (patch: Partial<GuidedFlow>) => void;
  selectedNodeId: string | null;
  nodeSearch: string;
  activeNodeFilter: 'all' | 'result' | 'safety' | 'branch';
  onSelectNodeId: (nodeId: string | null) => void;
}) {
  const [activeOptionEdit, setActiveOptionEdit] = useState<{ nodeId: string; optionId: string } | null>(null);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const [initialConfigCollapsed, setInitialConfigCollapsed] = useState(true);

  useEffect(() => {
    if (selectedNodeId) {
      const element = document.getElementById(`flow-node-${selectedNodeId}`);
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedNodeId]);

  const nodes = useMemo(() => {
    if (flow.nodeOrder) {
      const nodeMap = flow.nodes;
      const ordered = flow.nodeOrder.filter((id) => nodeMap[id]).map((id) => nodeMap[id]);
      Object.values(nodeMap).forEach((node) => {
        if (!flow.nodeOrder?.includes(node.id)) {
          ordered.push(node);
        }
      });
      return ordered;
    }
    return Object.values(flow.nodes);
  }, [flow.nodes, flow.nodeOrder]);

  function handleMoveNode(nodeId: string, direction: 'up' | 'down') {
    const currentOrder = nodes.map((n) => n.id);
    const currentIndex = currentOrder.indexOf(nodeId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    onChange({ nodeOrder: newOrder });
  }
  const existingScoreKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.values(flow.nodes).forEach((node) => {
      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          option.effects?.forEach((effect) => {
            if (effect.kind === 'score') {
              keys.add(effect.scoreKey);
            }
          });
        });
      } else if (node.kind === 'score_branch') {
        keys.add(node.scoreKey);
      }
    });
    return Array.from(keys).filter(Boolean);
  }, [flow]);
  const firstNodeId = nodes[0]?.id ?? flow.entry.nodeId;

  function nodeHasDeferredSafety(node: FlowNode) {
    return (
      node.kind === 'choice' &&
      node.options.some((option) => option.effects?.some((effect) => effect.kind === 'deferred_safety'))
    );
  }

  const visibleNodes = nodes.filter((node) => {
    const normalizedSearch = nodeSearch.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch =
      !normalizedSearch ||
      node.id.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      node.text.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

    if (!matchesSearch) return false;
    if (activeNodeFilter === 'result') return node.kind === 'result';
    if (activeNodeFilter === 'branch') return node.kind === 'score_branch';
    if (activeNodeFilter === 'safety') return nodeHasDeferredSafety(node);
    return true;
  });

  function updateEntry(patch: Partial<GuidedFlow['entry']>) {
    onChange({ entry: { ...flow.entry, ...patch } });
  }

  function updateEnteringPhrase(index: number, value: string) {
    updateEntry({
      enteringPhrases: flow.entry.enteringPhrases.map((phrase, phraseIndex) =>
        phraseIndex === index ? value : phrase,
      ),
    });
  }

  function addEnteringPhrase() {
    updateEntry({ enteringPhrases: [...flow.entry.enteringPhrases, 'Nova frase'] });
  }

  function updateNode(nodeId: string, patch: Partial<FlowNode>) {
    onChange({
      nodes: {
        ...flow.nodes,
        [nodeId]: { ...flow.nodes[nodeId], ...patch } as FlowNode,
      },
    });
  }

  function replaceNode(node: FlowNode) {
    onChange({
      nodes: {
        ...flow.nodes,
        [node.id]: node,
      },
    });
  }

  function duplicateNode(nodeId: string) {
    const sourceNode = flow.nodes[nodeId];
    if (!sourceNode) return;

    const newId = createUniqueId(`${nodeId}_copia`, flow.nodes);
    const clonedNode = JSON.parse(JSON.stringify(sourceNode)) as FlowNode;
    clonedNode.id = newId;

    const nextNodes = { ...flow.nodes };
    nextNodes[newId] = clonedNode;

    if (sourceNode.kind === 'choice') {
      const updatedSource = {
        ...sourceNode,
        options: sourceNode.options.map((option) => ({
          ...option,
          next: newId,
        })),
      };
      nextNodes[nodeId] = updatedSource;
    }

    onChange({ nodes: nextNodes });
    onSelectNodeId(newId);
  }

  function deleteNode(nodeId: string) {
    const nextNodes = { ...flow.nodes };
    delete nextNodes[nodeId];
    onChange({ nodes: nextNodes });

    const remainingNodes = Object.values(nextNodes);
    if (remainingNodes.length > 0) {
      onSelectNodeId(remainingNodes[0].id);
    } else {
      onSelectNodeId(null);
    }
    setConfirmDeleteNodeId(null);
  }

  function updateNodeKind(node: FlowNode, kind: FlowNode['kind']) {
    if (node.kind === kind) return;

    if (kind === 'choice') {
      replaceNode({ id: node.id, kind: 'choice', text: node.text, options: [] });
      return;
    }

    if (kind === 'result') {
      replaceNode({ id: node.id, kind: 'result', text: node.text });
      return;
    }

    if (kind === 'score_branch') {
      replaceNode({
        id: node.id,
        kind: 'score_branch',
        text: node.text,
        scoreKey: existingScoreKeys[0] ?? '',
        branches: [{ id: 'faixa_1', min: 0, max: 0, next: firstNodeId }],
      });
    }
  }

  function updateChoiceOption(
    node: ChoiceFlowNode,
    optionId: string,
    patch: Partial<ChoiceFlowNode['options'][number]>,
  ) {
    updateNode(node.id, {
      options: node.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
    });
  }

  function handleOpenOptionEdit(node: ChoiceFlowNode, optionId: string) {
    const option = node.options.find((opt) => opt.id === optionId);
    if (option && existingScoreKeys.length > 0) {
      const isSrq20Q17 = flow.id === 'srq20' && node.id === 'q17';
      const isScoringOption = option.id === 'yes' || option.label.toLowerCase() === 'sim';
      if (!isSrq20Q17 && isScoringOption) {
        const hasScore = option.effects?.some((effect) => effect.kind === 'score');
        if (!hasScore) {
          // Auto-initialize score effect
          const nextEffects = [
            ...(option.effects ?? []),
            { kind: 'score' as const, scoreKey: existingScoreKeys[0], value: 1 },
          ];
          updateChoiceOption(node, optionId, { effects: nextEffects });
        }
      }
    }
    setActiveOptionEdit({ nodeId: node.id, optionId });
  }

  function addOption(node: ChoiceFlowNode) {
    const optionId = createUniqueId(
      'nova_opcao',
      Object.fromEntries(node.options.map((option) => [option.id, option])),
    );
    updateNode(node.id, {
      options: [
        ...node.options,
        {
          id: optionId,
          label: 'Nova opção',
          next: firstNodeId,
        },
      ],
    });
  }

  function updateOptionEffects(
    node: ChoiceFlowNode,
    optionId: string,
    update: (effects: ChoiceFlowNode['options'][number]['effects']) => ChoiceFlowNode['options'][number]['effects'],
  ) {
    const option = node.options.find((item) => item.id === optionId);
    if (!option) return;

    const currentEffects = option.effects ?? [];
    const nextEffects = update(currentEffects);

    updateChoiceOption(node, optionId, {
      effects: nextEffects?.length ? nextEffects : undefined,
    });
  }

  function getDeferredSafetyEffect(option: ChoiceFlowNode['options'][number]) {
    return option.effects?.find((effect): effect is DeferredSafetyFlowEffect => effect.kind === 'deferred_safety');
  }

  function updateScoreBranchNode(node: ScoreBranchFlowNode, patch: Partial<ScoreBranchFlowNode>) {
    replaceNode({ ...node, ...patch });
  }

  function updateScoreBranchRange(
    node: ScoreBranchFlowNode,
    branchId: string,
    patch: Partial<ScoreBranchFlowNode['branches'][number]>,
  ) {
    updateScoreBranchNode(node, {
      branches: node.branches.map((branch) => (branch.id === branchId ? { ...branch, ...patch } : branch)),
    });
  }

  function addScoreBranchRange(node: ScoreBranchFlowNode) {
    const branchId = createUniqueId('faixa', Object.fromEntries(node.branches.map((branch) => [branch.id, branch])));
    updateScoreBranchNode(node, {
      branches: [...node.branches, { id: branchId, min: 0, max: 0, next: firstNodeId }],
    });
  }

  function removeScoreBranchRange(node: ScoreBranchFlowNode, branchId: string) {
    updateScoreBranchNode(node, {
      branches: node.branches.filter((branch) => branch.id !== branchId),
    });
  }

  function parseOptionalNavigation(value: string) {
    return value === '' ? undefined : (value as Exclude<GlobalActionTarget, 'end'>);
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <section className="bg-white rounded-xl border border-outline-variant/40 shadow-sm overflow-hidden mb-4">
        <div
          role="button"
          tabIndex={0}
          className="px-5 py-3.5 bg-surface-container-low flex justify-between items-center cursor-pointer select-none"
          onClick={() => setInitialConfigCollapsed(!initialConfigCollapsed)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setInitialConfigCollapsed(!initialConfigCollapsed);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-primary text-lg">⚙️</span>
            <h3 className="font-bold text-sm text-[#191c1e]">Configurações Iniciais e Entrada do Fluxo</h3>
          </div>
          <span className="text-xs text-gray-500 font-bold font-mono">
            {initialConfigCollapsed ? '[+] expandir' : '[-] recolher'}
          </span>
        </div>
        {!initialConfigCollapsed && (
          <div className="p-5 flex flex-col gap-4 border-t border-outline-variant/20">
            <Field label="Título do fluxo">
              <input
                aria-label="Título do fluxo"
                className={inputClass}
                value={flow.title}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </Field>

            <Field label="Uso do fluxo" hint="Define onde este fluxo aparece no app e como ele pode ser iniciado.">
              <select
                aria-label="Uso do fluxo"
                className={inputClass}
                value={flow.purpose ?? 'common'}
                onChange={(event) =>
                  onChange({
                    purpose:
                      event.target.value === 'common' ? undefined : (event.target.value as GuidedFlow['purpose']),
                  })
                }
              >
                <option value="common">{flowPurposeLabels.common}</option>
                <option value="orientation_entry">{flowPurposeLabels.orientation_entry}</option>
                <option value="post_flow_routing">{flowPurposeLabels.post_flow_routing}</option>
              </select>
            </Field>

            <div className="flex flex-col gap-4 border-t border-outline-variant/60 pt-4">
              <h3 className="font-headline-sm text-on-surface">Configuração de entrada</h3>

              <div className="flex flex-col gap-2">
                <span className="font-label-md text-on-surface">Frases de entrada</span>
                <FieldHint>São frases que uma pessoa pode escolher para começar este fluxo.</FieldHint>
                <ul className="flex flex-col gap-3">
                  {flow.entry.enteringPhrases.map((phrase, phraseIndex) => (
                    <li key={`${phrase}-${phraseIndex}`}>
                      <textarea
                        aria-label={`Frase de entrada ${phraseIndex + 1}`}
                        className={textareaClass}
                        value={phrase}
                        onChange={(event) => updateEnteringPhrase(phraseIndex, event.target.value)}
                      />
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" size="sm" onClick={addEnteringPhrase} className="w-fit">
                  Adicionar frase de entrada
                </Button>
              </div>

              <Field
                label="Mensagem antes do fluxo"
                hint="Aparece no chat logo antes da primeira etapa, quando o app está abrindo este fluxo."
              >
                <textarea
                  aria-label="Mensagem antes do fluxo"
                  className={textareaClass}
                  value={flow.entry.transitionMessage}
                  onChange={(event) => updateEntry({ transitionMessage: event.target.value })}
                />
              </Field>

              <Field
                label="Primeira etapa"
                hint="Escolha qual etapa aparece primeiro para a pessoa. Os códigos técnicos ficam escondidos aqui."
              >
                <select
                  aria-label="Primeira etapa"
                  className={inputClass}
                  value={flow.entry.nodeId}
                  onChange={(event) => updateEntry({ nodeId: event.target.value })}
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {getFlowNodeLabel(node, nodes)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-stack-sm">
        <h3 className="font-headline-sm text-on-surface">Etapas</h3>

        <div className="flex flex-col gap-3">
          {visibleNodes.length > 0 ? (
            visibleNodes.map((node, index) => {
              const globalIndex = nodes.findIndex((n) => n.id === node.id);
              const stepNum = globalIndex !== -1 ? globalIndex + 1 : index + 1;
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === nodes.length - 1;
              const stepTitle = `Etapa ${stepNum} — ${node.text ? getNodePreview(node.text) : node.id}`;
              const stepLabel = `Etapa ${stepNum}`.toLowerCase();
              const panelId = `flow-node-${flow.id}-${node.id}`;
              const isSelected = node.id === selectedNodeId;

              return (
                <article
                  key={node.id}
                  id={`flow-node-${node.id}`}
                  className={`overflow-hidden rounded-lg border border-l-4 bg-surface-container-lowest shadow-sm border-outline-variant ${
                    isSelected ? 'border-l-primary' : 'border-l-outline-variant/40'
                  }`}
                >
                  <div className="flex w-full items-start justify-between gap-3 p-4 select-none">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex min-w-0 flex-1 flex-col gap-2 cursor-pointer text-left"
                      onClick={() => {
                        onSelectNodeId(isSelected ? null : node.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectNodeId(isSelected ? null : node.id);
                        }
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-label-lg text-on-surface font-bold">{stepTitle}</h4>
                        <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-on-surface-variant">
                          {getNodeKindLabel(node)}
                        </span>
                        <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-on-secondary-container">
                          {getNodeCountLabel(node)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveNode(node.id, 'up');
                          }}
                          aria-label={`Mover ${stepTitle} para cima`}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveNode(node.id, 'down');
                          }}
                          aria-label={`Mover ${stepTitle} para baixo`}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      {isSelected && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateNode(node.id);
                            }}
                          >
                            👯 Duplicar esta etapa
                          </Button>
                          {confirmDeleteNodeId === node.id ? (
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(node.id);
                              }}
                            >
                              Confirmar exclusão da etapa ⚠️
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteNodeId(node.id);
                              }}
                            >
                              Excluir etapa
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div id={panelId} className="flex flex-col gap-3 border-t border-outline-variant/60 p-3">
                      <label className="flex flex-col gap-2">
                        <span className="font-label-sm text-on-surface">Texto da etapa</span>
                        <textarea
                          aria-label={`Texto da ${stepLabel}`}
                          className={textareaClass}
                          value={node.text}
                          onChange={(event) => updateNode(node.id, { text: event.target.value })}
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="font-label-sm text-on-surface">Tipo da etapa</span>
                        <select
                          aria-label={`Tipo da ${stepLabel}`}
                          className={inputClassSm}
                          value={node.kind}
                          onChange={(event) => updateNodeKind(node, event.target.value as FlowNode['kind'])}
                        >
                          <option value="choice">Pergunta com opções</option>
                          <option value="result">Resultado final</option>
                          <option value="score_branch">Ramificação por pontuação</option>
                        </select>
                      </label>

                      {node.kind === 'choice' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-label-md text-on-surface">Opções</p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => addOption(node)}
                              aria-label={`Adicionar opção na ${stepLabel}`}
                            >
                              Adicionar opção nesta etapa
                            </Button>
                          </div>
                          {node.options.map((option, optionIndex) => (
                            <div
                              key={option.id}
                              className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3"
                            >
                              <div className="flex items-end gap-2">
                                <label className="flex flex-1 flex-col gap-1">
                                  <span className="font-label-sm text-on-surface">Texto da opção</span>
                                  <input
                                    aria-label={`Texto da opção ${optionIndex + 1} da ${stepLabel}`}
                                    className={inputClassSm}
                                    value={option.label}
                                    onChange={(event) =>
                                      updateChoiceOption(node, option.id, { label: event.target.value })
                                    }
                                  />
                                </label>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => handleOpenOptionEdit(node, option.id)}
                                  aria-label={`Ações/Score da opção ${optionIndex + 1} da ${stepLabel}`}
                                >
                                  Ações/Score ⚙️
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {option.effects?.some((effect) => effect.kind === 'deferred_safety') && (
                                  <span className="rounded bg-error-container px-2 py-0.5 text-xs font-label-sm text-on-error-container">
                                    [⚠ Segurança]
                                  </span>
                                )}
                                {option.effects?.some((effect) => effect.kind === 'score') && (
                                  <span className="rounded bg-secondary-container px-2 py-0.5 text-xs font-label-sm text-on-secondary-container">
                                    {`[+${option.effects.find((e) => e.kind === 'score')?.value ?? 1} score]`}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 rounded bg-primary px-3 py-2 text-on-primary font-label-sm">
                                <span>➔ Destino Principal:</span>
                                <select
                                  aria-label={
                                    optionIndex === 0 ? 'Ação principal da opção' : `Ação da opção ${optionIndex + 1}`
                                  }
                                  className={`${inputClassSm} text-on-surface bg-surface border-none rounded`}
                                  value={option.next}
                                  onChange={(event) =>
                                    updateChoiceOption(node, option.id, { next: event.target.value })
                                  }
                                >
                                  {nodes.map((targetNode) => (
                                    <option key={targetNode.id} value={targetNode.id}>
                                      {getFlowNodeLabel(targetNode, nodes)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {node.kind === 'score_branch' && (
                        <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
                          <Field
                            label="Pontuação usada"
                            hint="Use a mesma chave configurada nas opções que somam pontos."
                          >
                            <input
                              aria-label="Pontuação usada"
                              className={inputClassSm}
                              value={node.scoreKey}
                              onChange={(event) => updateScoreBranchNode(node, { scoreKey: event.target.value })}
                            />
                          </Field>

                          {existingScoreKeys.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-on-surface-variant font-medium">Chaves existentes:</span>
                              {existingScoreKeys.map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  className="px-2.5 py-1 text-xs font-label-sm bg-secondary-container text-on-secondary-container hover:bg-secondary-container/85 rounded-md transition-colors"
                                  onClick={() => updateScoreBranchNode(node, { scoreKey: key })}
                                >
                                  {key}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-label-md text-on-surface">Faixas de redirecionamento</p>
                              <Button variant="secondary" size="sm" onClick={() => addScoreBranchRange(node)}>
                                Adicionar faixa
                              </Button>
                            </div>

                            {node.branches.map((branch) => (
                              <div
                                key={branch.id}
                                className="grid gap-2 rounded-lg bg-surface-container-lowest p-3 md:grid-cols-2"
                              >
                                <label className="flex flex-col gap-1">
                                  <span className="font-label-sm text-on-surface">Nome da faixa</span>
                                  <input
                                    aria-label={`Nome da faixa ${branch.id}`}
                                    className={inputClassSm}
                                    value={branch.id}
                                    onChange={(event) =>
                                      updateScoreBranchRange(node, branch.id, { id: event.target.value })
                                    }
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-label-sm text-on-surface">Destino do resultado</span>
                                  <select
                                    aria-label={`Destino de resultado da faixa ${branch.id}`}
                                    className={inputClassSm}
                                    value={branch.next}
                                    onChange={(event) =>
                                      updateScoreBranchRange(node, branch.id, { next: event.target.value })
                                    }
                                  >
                                    {nodes.map((targetNode) => (
                                      <option key={targetNode.id} value={targetNode.id}>
                                        {getFlowNodeLabel(targetNode, nodes)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-label-sm text-on-surface">Mínimo</span>
                                  <input
                                    type="number"
                                    aria-label={`Mínimo da faixa ${branch.id}`}
                                    className={inputClassSm}
                                    value={branch.min}
                                    onChange={(event) =>
                                      updateScoreBranchRange(node, branch.id, { min: Number(event.target.value) })
                                    }
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-label-sm text-on-surface">Máximo</span>
                                  <input
                                    type="number"
                                    aria-label={`Máximo da faixa ${branch.id}`}
                                    className={inputClassSm}
                                    value={branch.max}
                                    onChange={(event) =>
                                      updateScoreBranchRange(node, branch.id, { max: Number(event.target.value) })
                                    }
                                  />
                                </label>
                                <label className="flex flex-col gap-1 md:col-span-2">
                                  <span className="font-label-sm text-on-surface">
                                    Destino de página após o resultado
                                  </span>
                                  <select
                                    aria-label={`Destino de página da faixa ${branch.id}`}
                                    className={inputClassSm}
                                    value={branch.navigation ?? ''}
                                    onChange={(event) =>
                                      updateScoreBranchRange(node, branch.id, {
                                        navigation: parseOptionalNavigation(event.target.value),
                                      })
                                    }
                                  >
                                    <option value="">Não abrir página automaticamente</option>
                                    <option value="/apoio">/apoio — Apoio imediato</option>
                                    <option value="/contatos">/contatos — Contatos de apoio</option>
                                    <option value="/educacao">/educacao — Materiais educativos</option>
                                  </select>
                                </label>
                                {node.branches.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="w-fit md:col-span-2"
                                    onClick={() => removeScoreBranchRange(node, branch.id)}
                                  >
                                    Remover faixa
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <p className="font-body-md text-on-surface-variant p-4 text-center bg-surface-container-lowest rounded-lg border border-outline-variant/50">
              Nenhuma etapa correspondente aos filtros.
            </p>
          )}
        </div>
      </section>

      {activeOptionEdit &&
        (() => {
          const editNode = flow.nodes[activeOptionEdit.nodeId];
          const editOption =
            editNode && editNode.kind === 'choice'
              ? editNode.options.find((opt) => opt.id === activeOptionEdit.optionId)
              : null;

          if (!editNode || !editOption) return null;

          const scoreEffect = editOption.effects?.find((e) => e.kind === 'score');
          const safetyEffect = getDeferredSafetyEffect(editOption);

          return (
            <div
              role="button"
              tabIndex={-1}
              data-testid="drawer-backdrop"
              className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm cursor-default"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveOptionEdit(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setActiveOptionEdit(null);
                }
              }}
            >
              <div className="h-full w-full max-w-md overflow-y-auto bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border-l border-outline-variant">
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                  <h3 className="font-headline-sm text-on-surface font-semibold">Configurações Avançadas</h3>
                  <button
                    type="button"
                    onClick={() => setActiveOptionEdit(null)}
                    className="text-on-surface hover:bg-surface-variant/20 rounded p-1 text-lg font-bold w-8 h-8 flex items-center justify-center"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <span className="font-label-sm text-on-surface-variant">Opção selecionada</span>
                    <p className="font-body-md text-on-surface font-semibold">{editOption.label}</p>
                  </div>

                  {/* Action/Flow Start configuration */}
                  <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-on-surface">Tipo de Ação</span>
                      <select
                        aria-label="Ação da opção"
                        className={inputClassSm}
                        value={
                          editOption.effects?.some((effect) => effect.kind === 'flow_start') ? 'flow_start' : 'next'
                        }
                        onChange={(event) => {
                          const otherEffects = editOption.effects?.filter((effect) => effect.kind !== 'flow_start');

                          if (event.target.value === 'flow_start') {
                            updateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
                              effects: [
                                ...(otherEffects ?? []),
                                {
                                  kind: 'flow_start',
                                  flowId: flows.find((item) => item.id !== flow.id)?.id ?? flow.id,
                                },
                              ],
                            });
                            return;
                          }

                          updateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
                            effects: otherEffects?.length ? otherEffects : undefined,
                          });
                        }}
                      >
                        <option value="next">Ir para etapa</option>
                        <option value="flow_start">Começar outro fluxo</option>
                      </select>
                    </label>

                    {editOption.effects?.some((effect) => effect.kind === 'flow_start') && (
                      <label className="flex flex-col gap-1">
                        <span className="font-label-sm text-on-surface">Fluxo de destino</span>
                        <select
                          aria-label="Fluxo de destino"
                          className={inputClassSm}
                          value={editOption.effects.find((effect) => effect.kind === 'flow_start')?.flowId ?? flow.id}
                          onChange={(event) => {
                            updateChoiceOption(editNode as ChoiceFlowNode, editOption.id, {
                              effects: [
                                ...(editOption.effects?.filter((effect) => effect.kind !== 'flow_start') ?? []),
                                { kind: 'flow_start', flowId: event.target.value },
                              ],
                            });
                          }}
                        >
                          {flows.map((targetFlow) => (
                            <option key={targetFlow.id} value={targetFlow.id}>
                              {targetFlow.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {/* Score / Pontuação effect configuration */}
                  <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
                    <p className="font-label-md text-on-surface font-semibold">Pontuação (Score)</p>
                    {scoreEffect ? (
                      <div className="grid gap-2 grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="font-label-sm text-on-surface">Chave da pontuação</span>
                          <input
                            aria-label="Chave da pontuação"
                            placeholder="Chave (ex: srq20)"
                            className={inputClassSm}
                            value={scoreEffect.scoreKey}
                            onChange={(event) =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.map((effect) =>
                                  effect.kind === 'score' ? { ...effect, scoreKey: event.target.value } : effect,
                                ),
                              )
                            }
                          />
                          <FieldHint>
                            A chave agrupa pontos do questionário (ex: 'srq20' para somar todas as respostas Sim).
                          </FieldHint>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-label-sm text-on-surface">Valor</span>
                          <input
                            type="number"
                            aria-label="Valor da pontuação"
                            className={inputClassSm}
                            value={scoreEffect.value}
                            onChange={(event) =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.map((effect) =>
                                  effect.kind === 'score' ? { ...effect, value: Number(event.target.value) } : effect,
                                ),
                              )
                            }
                          />
                        </label>
                        {existingScoreKeys.length > 0 && (
                          <div className="col-span-2 flex flex-wrap gap-1.5 items-center mt-1">
                            <span className="text-xs text-on-surface-variant font-medium">Sugestões:</span>
                            {existingScoreKeys.map((key) => (
                              <button
                                key={key}
                                type="button"
                                className="px-2.5 py-1 text-xs font-label-sm bg-secondary-container text-on-secondary-container hover:bg-secondary-container/85 active:bg-secondary-container/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md transition-colors cursor-pointer"
                                onClick={() =>
                                  updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                    effects?.map((effect) =>
                                      effect.kind === 'score' ? { ...effect, scoreKey: key } : effect,
                                    ),
                                  )
                                }
                              >
                                {key}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="col-span-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.filter((effect) => effect.kind !== 'score'),
                              )
                            }
                          >
                            Remover pontuação
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) => [
                              ...(effects ?? []),
                              { kind: 'score', scoreKey: '', value: 1 },
                            ])
                          }
                        >
                          Ativar pontuação
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Deferred Safety / Encaminhamento de segurança configuration */}
                  <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
                    <p className="font-label-md text-on-surface font-semibold">Encaminhamento de segurança</p>
                    <p className="font-body-sm text-on-surface-variant">
                      Marca um sinal sensível e encaminha ao apoio depois do resultado final.
                    </p>
                    {safetyEffect ? (
                      <div className="grid gap-2 grid-cols-1">
                        <label className="flex flex-col gap-1">
                          <span className="font-label-sm text-on-surface">Flag key</span>
                          <input
                            aria-label="Flag key"
                            className={inputClassSm}
                            value={safetyEffect.flagKey ?? ''}
                            onChange={(event) =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.map((effect) =>
                                  effect.kind === 'deferred_safety'
                                    ? { ...effect, flagKey: event.target.value }
                                    : effect,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-label-sm text-on-surface">Destino</span>
                          <select
                            aria-label="Destino de segurança"
                            className={inputClassSm}
                            value={safetyEffect.destination ?? '/apoio'}
                            onChange={(event) =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.map((effect) =>
                                  effect.kind === 'deferred_safety'
                                    ? {
                                        ...effect,
                                        destination: event.target.value as DeferredSafetyFlowEffect['destination'],
                                      }
                                    : effect,
                                ),
                              )
                            }
                          >
                            <option value="/apoio">/apoio — Apoio imediato</option>
                            <option value="/contatos">/contatos — Contatos de apoio</option>
                            <option value="/educacao">/educacao — Materiais educativos</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-label-sm text-on-surface">Mensagem</span>
                          <textarea
                            aria-label="Mensagem de segurança"
                            className={textareaClass}
                            value={safetyEffect.message ?? ''}
                            onChange={(event) =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.map((effect) =>
                                  effect.kind === 'deferred_safety'
                                    ? { ...effect, message: event.target.value }
                                    : effect,
                                ),
                              )
                            }
                          />
                        </label>
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) =>
                                effects?.filter((effect) => effect.kind !== 'deferred_safety'),
                              )
                            }
                          >
                            Remover encaminhamento
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            updateOptionEffects(editNode as ChoiceFlowNode, editOption.id, (effects) => [
                              ...(effects ?? []),
                              { kind: 'deferred_safety', flagKey: '', message: '', destination: '/apoio' },
                            ])
                          }
                        >
                          Ativar encaminhamento
                        </Button>
                      </div>
                    )}

                    {flow.id === 'srq20' &&
                      editNode.id === 'q17' &&
                      !editOption.effects?.some((effect) => effect.kind === 'score') && (
                        <p className="font-body-sm text-on-surface-variant mt-2">
                          Q17 não soma pontos no SRQ-20. Ela fica separada da pontuação para não esconder uma regra de
                          segurança dentro do cálculo.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}

function getNodeKindLabel(node: FlowNode) {
  if (node.kind === 'choice') return 'Pergunta com opções';
  if (node.kind === 'result') return 'Resultado final';
  return 'Ramificação por pontuação';
}

function getNodeCountLabel(node: FlowNode) {
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

function getNodePreview(text: string) {
  return text.trim().replace(/\s+/g, ' ') || 'Texto vazio';
}

function createUniqueId(baseId: string, records: Record<string, unknown>) {
  if (!records[baseId]) return baseId;

  let index = 2;
  while (records[`${baseId}_${index}`]) index += 1;
  return `${baseId}_${index}`;
}

import { useState } from 'react';
import type { ChoiceFlowNode, DeferredSafetyFlowEffect, FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClass, inputClassSm, textareaClass } from '../components/fieldStyles';
import { getFlowNodeLabel, getFlowNodeTitle } from './flowDisplay';
import { flowPurposeLabels } from './flowLabels';

export function FlowEditor({
  flow,
  flows,
  onChange,
  selectedNodeId,
  nodeSearch,
  activeNodeFilter,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onChange: (patch: Partial<GuidedFlow>) => void;
  selectedNodeId: string | null;
  nodeSearch: string;
  activeNodeFilter: 'all' | 'result' | 'safety' | 'branch';
}) {
  const [activeOptionEdit, setActiveOptionEdit] = useState<{ nodeId: string; optionId: string } | null>(null);
  const nodes = Object.values(flow.nodes);
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

  const activeNode = visibleNodes.find((node) => node.id === selectedNodeId) || visibleNodes[0];

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

  function updateNodeKind(node: FlowNode, kind: FlowNode['kind']) {
    if (node.kind === kind) return;

    if (kind === 'choice') {
      replaceNode({ id: node.id, kind: 'choice', text: node.text, options: [] });
      return;
    }

    if (kind === 'result') {
      replaceNode({ id: node.id, kind: 'result', text: node.text });
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

  function addResultNode() {
    const nodeId = createUniqueId('nova_etapa', flow.nodes);
    onChange({
      nodes: {
        ...flow.nodes,
        [nodeId]: {
          id: nodeId,
          kind: 'result',
          text: 'Nova etapa final.',
        },
      },
    });
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

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Dados do fluxo</h2>

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
              purpose: event.target.value === 'common' ? undefined : (event.target.value as GuidedFlow['purpose']),
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

      <section className="flex flex-col gap-stack-sm">
        <h3 className="font-headline-sm text-on-surface">Etapas</h3>

        <div className="flex flex-col gap-3">
          {activeNode ? (
            (() => {
              const node = activeNode;
              const stepTitle = getFlowNodeTitle(node.id, nodes);
              const stepLabel = stepTitle.toLowerCase();
              const panelId = `flow-node-${flow.id}-${node.id}`;

              return (
                <article
                  key={node.id}
                  className="overflow-hidden rounded-lg border border-l-4 bg-surface-container-lowest shadow-sm border-outline-variant border-l-primary"
                >
                  <h4>
                    <div className="flex w-full items-start justify-between gap-3 p-4 text-left">
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-label-lg text-on-surface">{`${stepTitle} — ${node.id}`}</span>
                          <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-on-surface-variant">
                            {getNodeKindLabel(node)}
                          </span>
                          <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-on-secondary-container">
                            {getNodeCountLabel(node)}
                          </span>
                        </span>
                        <span className="line-clamp-2 font-body-md text-on-surface-variant">
                          {getNodePreview(node.text)}
                        </span>
                      </span>
                    </div>
                  </h4>

                  <div id={panelId} className="flex flex-col gap-3 border-t border-outline-variant/60 p-3">
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
                        {node.kind === 'score_branch' && (
                          <option value="score_branch">Ramificação por pontuação</option>
                        )}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="font-label-sm text-on-surface">Texto da etapa</span>
                      <textarea
                        aria-label={`Texto da ${stepLabel}`}
                        className={textareaClass}
                        value={node.text}
                        onChange={(event) => updateNode(node.id, { text: event.target.value })}
                      />
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
                          <div key={option.id} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3">
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
                                onClick={() => setActiveOptionEdit({ nodeId: node.id, optionId: option.id })}
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
                                onChange={(event) => updateChoiceOption(node, option.id, { next: event.target.value })}
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
                  </div>
                </article>
              );
            })()
          ) : (
            <p className="font-body-md text-on-surface-variant p-4 text-center bg-surface-container-lowest rounded-lg border border-outline-variant/50">
              Nenhuma etapa correspondente aos filtros.
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={addResultNode} className="w-fit">
          Adicionar etapa
        </Button>
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
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
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

import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardFlows } from './flowValidation';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';
import { inputClassSm } from '../components/fieldStyles';
import { getFlowNodeTitle } from './flowDisplay';

type FlowDetailTab = 'editor' | 'preview' | 'map';
type NodeFilter = 'all' | 'result' | 'safety' | 'branch';

const flowDetailTabs: Array<{ id: FlowDetailTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
];

export function FlowDashboard({
  flows,
  resources,
  onFlowChange,
  onFlowAdd,
  onFlowRemove,
}: {
  flows: GuidedFlow[];
  resources: EducationResource[];
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
  onFlowAdd?: () => void;
  onFlowRemove?: (flowId: string) => void;
}) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => flows[0]?.id ?? null);
  const [confirmDeleteFlowId, setConfirmDeleteFlowId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<FlowDetailTab>('editor');

  // Lifted States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [activeNodeFilter, setActiveNodeFilter] = useState<NodeFilter>('all');

  const selectedIndex = useMemo(() => flows.findIndex((flow) => flow.id === selectedFlowId), [flows, selectedFlowId]);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedFlow = flows[effectiveIndex];

  const nodes = useMemo(() => (selectedFlow ? Object.values(selectedFlow.nodes) : []), [selectedFlow]);

  function nodeHasDeferredSafety(node: FlowNode) {
    return (
      node.kind === 'choice' &&
      node.options.some((option) => option.effects?.some((effect) => effect.kind === 'deferred_safety'))
    );
  }

  function addResultNode() {
    const nodeId = createUniqueId('nova_etapa', selectedFlow.nodes);
    const updatedNodes = {
      ...selectedFlow.nodes,
      [nodeId]: {
        id: nodeId,
        kind: 'result' as const,
        text: 'Nova etapa final.',
      },
    };
    onFlowChange(effectiveIndex, selectedFlow.id, { nodes: updatedNodes });
    setSelectedNodeId(nodeId); // auto-select the new stage
  }

  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
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
  }, [nodes, nodeSearch, activeNodeFilter]);

  const activeNodeId = useMemo(() => {
    if (selectedNodeId && visibleNodes.some((n) => n.id === selectedNodeId)) {
      return selectedNodeId;
    }
    return visibleNodes[0]?.id ?? null;
  }, [selectedNodeId, visibleNodes]);

  const validation = useMemo(
    () =>
      validateDashboardFlows(
        flows,
        resources.map((resource) => resource.id),
      ),
    [flows, resources],
  );

  if (!selectedFlow) {
    return (
      <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <p className="font-body-md text-on-surface-variant">Nenhum fluxo disponível.</p>
        {onFlowAdd && (
          <Button className="mt-3" onClick={onFlowAdd}>
            + Criar Novo Fluxo
          </Button>
        )}
      </section>
    );
  }

  function handleSelectFlow(flowId: string) {
    setSelectedFlowId(flowId);
    setSelectedNodeId(null);
    setConfirmDeleteFlowId(null);
  }

  function handleEditNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setActiveDetailTab('editor');
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg
            aria-hidden="true"
            className="lucide lucide-folder text-primary h-5 w-5"
            fill="none"
            height="20"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
          <h2 className="font-headline-sm text-on-surface" aria-label="Fluxos">
            Fluxos Ativos
          </h2>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {flows.map((flow) => {
            const isSelected = flow.id === selectedFlow.id;
            return (
              <div
                key={flow.id}
                className="flex flex-col gap-1.5 rounded-lg border border-outline-variant/30 p-2 bg-surface-container-lowest"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectFlow(flow.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {flow.title}
                  </button>
                  {flows.length > 1 && confirmDeleteFlowId !== flow.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteFlowId(flow.id)}
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      aria-label={`Remover fluxo ${flow.title}`}
                    >
                      <svg
                        aria-hidden="true"
                        className="lucide lucide-trash h-4 w-4"
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        width="16"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
                {flows.length > 1 && confirmDeleteFlowId === flow.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (flow.id === selectedFlowId) {
                        const otherFlows = flows.filter((f) => f.id !== flow.id);
                        if (otherFlows.length > 0) {
                          setSelectedFlowId(otherFlows[0].id);
                        } else {
                          setSelectedFlowId(null);
                        }
                      }
                      onFlowRemove?.(flow.id);
                      setConfirmDeleteFlowId(null);
                    }}
                    className="w-full rounded-lg bg-error px-3 py-2 text-xs font-label-md text-on-error hover:bg-error/90 transition-colors"
                    aria-label={`Confirmar exclusão de ${flow.title}`}
                  >
                    Confirmar exclusão de {flow.title}
                  </button>
                )}
              </div>
            );
          })}

          {onFlowAdd && (
            <button
              type="button"
              onClick={onFlowAdd}
              className="mt-2 w-full rounded-lg border border-dashed border-outline-variant bg-transparent py-2 text-center font-label-md text-primary hover:bg-surface-container transition-colors"
            >
              + Criar Novo Fluxo
            </button>
          )}
        </div>

        {activeDetailTab === 'editor' && (
          <div className="mt-4 flex flex-col gap-4">
            <h3 className="font-headline-sm text-on-surface">Etapas do fluxo</h3>

            <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <input
                aria-label="Buscar etapa"
                className={inputClassSm}
                placeholder="Buscar etapa..."
                value={nodeSearch}
                onChange={(event) => setNodeSearch(event.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'Todas'],
                    ['result', 'Resultado'],
                    ['safety', 'Apoio ao final'],
                    ['branch', 'Ramificação'],
                  ] as Array<[NodeFilter, string]>
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveNodeFilter(filter)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-label-sm transition-colors ${
                      activeNodeFilter === filter
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface text-on-surface hover:bg-surface-variant/30'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="font-body-sm text-on-surface-variant">
                {visibleNodes.length} {visibleNodes.length === 1 ? 'etapa visível' : 'etapas visíveis'}
              </p>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {visibleNodes.map((node) => {
                const isSelected = node.id === activeNodeId;
                const nodeTitle = getFlowNodeTitle(node.id, nodes);
                const hasScore =
                  node.kind === 'choice' &&
                  node.options.some((opt) => opt.effects?.some((eff) => eff.kind === 'score'));
                const hasSafety =
                  node.kind === 'choice' &&
                  node.options.some((opt) => opt.effects?.some((eff) => eff.kind === 'deferred_safety'));
                const hasHandoff =
                  node.kind === 'choice' &&
                  node.options.some((opt) => opt.effects?.some((eff) => eff.kind === 'flow_start'));
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    aria-label={`${nodeTitle} — ${node.text || node.id}`}
                    className={`w-full rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className="block font-medium truncate">{node.text || node.id}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasScore && (
                          <span className="bg-secondary-container text-on-secondary-container px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
                            +pts
                          </span>
                        )}
                        {hasSafety && (
                          <span className="bg-error-container text-error px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
                            ⚠
                          </span>
                        )}
                        {hasHandoff && (
                          <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
                            ⇄
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs block truncate ${isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}
                    >
                      {nodeTitle}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button variant="secondary" onClick={addResultNode} className="w-full mt-2">
              Adicionar etapa
            </Button>
          </div>
        )}
      </aside>
      <div className="flex flex-col gap-stack-md">
        <div
          aria-label="Detalhes do fluxo"
          className="flex flex-wrap gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2"
        >
          {flowDetailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeDetailTab === tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`min-h-9 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                activeDetailTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeDetailTab === 'editor' && (
          <FlowEditor
            key={`${selectedFlow.id}-${effectiveIndex}`}
            flow={selectedFlow}
            flows={flows}
            onChange={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
            selectedNodeId={activeNodeId}
            nodeSearch={nodeSearch}
            activeNodeFilter={activeNodeFilter}
            onSelectNodeId={setSelectedNodeId}
          />
        )}

        {activeDetailTab === 'preview' && (
          <FlowPreview key={`${selectedFlow.id}-${effectiveIndex}`} flow={selectedFlow} flows={flows} />
        )}

        {activeDetailTab === 'map' && (
          <FlowMap
            key={selectedFlow.id}
            flow={selectedFlow}
            flows={flows}
            onFlowChange={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
            onEditNode={handleEditNode}
          />
        )}

        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}

function createUniqueId(baseId: string, records: Record<string, unknown>) {
  if (!records[baseId]) return baseId;
  let index = 2;
  while (records[`${baseId}_${index}`]) index += 1;
  return `${baseId}_${index}`;
}

import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardFlows } from './flowValidation';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';
import { FlowRedirections } from './FlowRedirectionsPanel';
import { inputClass, inputClassSm } from '../components/fieldStyles';
import { getFlowNodeTitle } from './flowDisplay';

type FlowDetailTab = 'editor' | 'preview' | 'map' | 'redirections';
type NodeFilter = 'all' | 'result' | 'safety' | 'branch';

const flowDetailTabs: Array<{ id: FlowDetailTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
  { id: 'redirections', label: 'Redirecionamentos' },
];

export function FlowDashboard({
  flows,
  resources,
  onFlowChange,
  onFlowAdd,
}: {
  flows: GuidedFlow[];
  resources: EducationResource[];
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
  onFlowAdd?: () => void;
}) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => flows[0]?.id ?? null);
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
            Novo fluxo
          </Button>
        )}
      </section>
    );
  }

  function handleSelectFlow(flowId: string) {
    setSelectedFlowId(flowId);
    setSelectedNodeId(null);
  }

  function handleEditNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setActiveDetailTab('editor');
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <h2 className="font-headline-sm text-on-surface mb-3">Fluxos</h2>
        {flows.length > 1 ? (
          <div className="mb-4 flex flex-col gap-1">
            <label htmlFor="flow-select" className="font-label-md text-on-surface-variant">Selecionar fluxo</label>
            <select
              id="flow-select"
              aria-label="Selecionar fluxo"
              value={selectedFlow.id}
              onChange={(e) => handleSelectFlow(e.target.value)}
              className={`${inputClass} w-full`}
            >
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-4">
            <div className="mt-2 font-label-md text-on-surface-variant">
              {selectedFlow.title}
            </div>
          </div>
        )}

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
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    aria-label={`${nodeTitle} — ${node.id}`}
                    className={`w-full rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="block font-medium truncate">{node.id}</span>
                    <span className={`text-xs block truncate ${isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                      {nodeTitle}
                    </span>
                  </button>
                );
              })}
            </div>
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
          />
        )}

        {activeDetailTab === 'preview' && (
          <FlowPreview key={`${selectedFlow.id}-${effectiveIndex}`} flow={selectedFlow} flows={flows} />
        )}

        {activeDetailTab === 'map' && <FlowMap flow={selectedFlow} flows={flows} />}

        {activeDetailTab === 'redirections' && <FlowRedirections flow={selectedFlow} onEditNode={handleEditNode} />}

        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}

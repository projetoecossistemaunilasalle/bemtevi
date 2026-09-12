import type { ChangeEventHandler, RefObject } from 'react';
import { AlertTriangle, ArrowRightLeft, Folder, Trash2 } from 'lucide-react';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { inputClassSm } from '../components/fieldStyles';
import { getFlowNodeTitle } from './flowDisplay';
import type { FlowDetailTab, NodeFilter } from './flowDashboardTypes';

export function FlowDashboardSidebar({
  flows,
  selectedFlow,
  confirmDeleteFlowId,
  activeDetailTab,
  nodes,
  visibleNodes,
  activeNodeId,
  nodeSearch,
  activeNodeFilter,
  importInputRef,
  importError,
  canAdd,
  canImport,
  onSelectFlow,
  onRequestRemove,
  onConfirmRemove,
  onAddFlow,
  onOpenImport,
  onImportFile,
  onSearchChange,
  onFilterChange,
  onSelectNode,
  onAddResultNode,
}: {
  flows: GuidedFlow[];
  selectedFlow: GuidedFlow;
  confirmDeleteFlowId: string | null;
  activeDetailTab: FlowDetailTab;
  nodes: FlowNode[];
  visibleNodes: FlowNode[];
  activeNodeId: string | null;
  nodeSearch: string;
  activeNodeFilter: NodeFilter;
  importInputRef: RefObject<HTMLInputElement | null>;
  importError: string | null;
  canAdd: boolean;
  canImport: boolean;
  onSelectFlow: (flowId: string) => void;
  onRequestRemove: (flowId: string) => void;
  onConfirmRemove: (flowId: string) => void;
  onAddFlow: () => void;
  onOpenImport: () => void;
  onImportFile: ChangeEventHandler<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: NodeFilter) => void;
  onSelectNode: (nodeId: string) => void;
  onAddResultNode: () => void;
}) {
  return (
    <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      <div className="flex items-center gap-2 mb-3">
        <Folder aria-hidden="true" className="text-primary h-5 w-5" />
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
                  onClick={() => onSelectFlow(flow.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                    isSelected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {flow.title}
                </button>
                {flows.length > 1 && confirmDeleteFlowId !== flow.id ? (
                  <button
                    type="button"
                    onClick={() => onRequestRemove(flow.id)}
                    className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    aria-label={`Remover fluxo ${flow.title}`}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {flows.length > 1 && confirmDeleteFlowId === flow.id ? (
                <button
                  type="button"
                  onClick={() => onConfirmRemove(flow.id)}
                  className="w-full rounded-lg bg-error px-3 py-2 text-xs font-label-md text-on-error hover:bg-error/90 transition-colors"
                  aria-label={`Confirmar exclusão de ${flow.title}`}
                >
                  Confirmar exclusão de {flow.title}
                </button>
              ) : null}
            </div>
          );
        })}
        {canAdd ? (
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={onAddFlow}
              className="w-full rounded-lg border border-dashed border-outline-variant bg-transparent py-2 text-center font-label-md text-primary hover:bg-surface-container transition-colors"
            >
              + Criar Novo Fluxo
            </button>
            {canImport ? (
              <>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 text-center font-label-md text-primary hover:bg-surface-container transition-colors"
                >
                  Importar fluxo JSON
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onImportFile}
                />
              </>
            ) : null}
            {importError ? (
              <p role="alert" className="font-body-sm text-error">
                {importError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {activeDetailTab === 'editor' ? (
        <NodeDirectory
          nodes={nodes}
          visibleNodes={visibleNodes}
          activeNodeId={activeNodeId}
          nodeSearch={nodeSearch}
          activeNodeFilter={activeNodeFilter}
          onSearchChange={onSearchChange}
          onFilterChange={onFilterChange}
          onSelectNode={onSelectNode}
          onAddResultNode={onAddResultNode}
        />
      ) : null}
    </aside>
  );
}

function NodeDirectory({
  nodes,
  visibleNodes,
  activeNodeId,
  nodeSearch,
  activeNodeFilter,
  onSearchChange,
  onFilterChange,
  onSelectNode,
  onAddResultNode,
}: {
  nodes: FlowNode[];
  visibleNodes: FlowNode[];
  activeNodeId: string | null;
  nodeSearch: string;
  activeNodeFilter: NodeFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: NodeFilter) => void;
  onSelectNode: (nodeId: string) => void;
  onAddResultNode: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h3 className="font-headline-sm text-on-surface">Etapas do fluxo</h3>
      <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
        <input
          aria-label="Buscar etapa"
          className={inputClassSm}
          placeholder="Buscar etapa..."
          value={nodeSearch}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {nodeFilters.map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
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
        {visibleNodes.map((node) => (
          <NodeDirectoryItem
            key={node.id}
            node={node}
            nodes={nodes}
            selected={node.id === activeNodeId}
            onSelect={() => onSelectNode(node.id)}
          />
        ))}
      </div>
      <Button variant="secondary" onClick={onAddResultNode} className="w-full mt-2">
        Adicionar etapa
      </Button>
    </div>
  );
}

function NodeDirectoryItem({
  node,
  nodes,
  selected,
  onSelect,
}: {
  node: FlowNode;
  nodes: FlowNode[];
  selected: boolean;
  onSelect: () => void;
}) {
  const title = getFlowNodeTitle(node.id, nodes);
  const effects = node.kind === 'choice' ? node.options.flatMap((option) => option.effects ?? []) : [];
  const hasScore = effects.some((effect) => effect.kind === 'score');
  const hasSafety = effects.some((effect) => effect.kind === 'deferred_safety');
  const hasHandoff = effects.some((effect) => effect.kind === 'flow_start');
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${title} — ${node.text || node.id}`}
      className={`w-full rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
    >
      <div className="flex items-center justify-between gap-1 w-full min-w-0">
        <span className="block font-medium truncate">{node.text || node.id}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasScore ? (
            <span className="bg-secondary-container text-on-secondary-container px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
              +pts
            </span>
          ) : null}
          {hasSafety ? (
            <span className="bg-error-container text-error px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
              <AlertTriangle aria-hidden="true" className="h-3 w-3" />
            </span>
          ) : null}
          {hasHandoff ? (
            <span className="bg-secondary-container text-on-secondary-container px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
              <ArrowRightLeft aria-hidden="true" className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      </div>
      <span className={`text-xs block truncate ${selected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
        {title}
      </span>
    </button>
  );
}

const nodeFilters: Array<[NodeFilter, string]> = [
  ['all', 'Todas'],
  ['result', 'Resultado'],
  ['safety', 'Apoio ao final'],
  ['branch', 'Ramificação'],
];

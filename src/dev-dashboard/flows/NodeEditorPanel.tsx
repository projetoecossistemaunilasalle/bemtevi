import { useEffect, useRef, useState } from 'react';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { deleteNode, duplicateNode, setEntryNode } from './flowMutations';
import { Button } from '../../design-system/components/Button';

const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

/**
 * Same ordering rules as flowTopology's `getOrderedNodes`: `nodeOrder` ids
 * first (skipping unknown/duplicate ids), then remaining nodes in insertion
 * order. Kept local because neither copy is exported today.
 */
function getOrderedNodes(flow: GuidedFlow): FlowNode[] {
  const ordered: FlowNode[] = [];
  const seen = new Set<string>();
  if (flow.nodeOrder) {
    for (const id of flow.nodeOrder) {
      const node = flow.nodes[id];
      if (node && !seen.has(node.id)) {
        ordered.push(node);
        seen.add(node.id);
      }
    }
  }
  for (const node of Object.values(flow.nodes)) {
    if (!seen.has(node.id)) {
      ordered.push(node);
      seen.add(node.id);
    }
  }
  return ordered;
}

/**
 * Structured side panel that will replace the map inspector (integration is a
 * later task).
 *
 * Callers must remount this panel per node (key={nodeId}) — the text guard
 * assumes unmount on switch.
 */
export interface NodeEditorPanelProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  nodeId: string;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onClose: () => void;
  /** Opens the legacy full editor for this node. */
  onEditLegacy: () => void;
  /** Scroll/focus request for a named section ('texto'|'opcoes'|'ramificacao'|'midia'); bump requestId to re-fire. */
  focusRequest?: { section?: string; requestId: number } | null;
}

export function NodeEditorPanel({
  flow,
  nodeId,
  onFlowChange,
  onClose,
  onEditLegacy,
  focusRequest,
}: NodeEditorPanelProps) {
  const node = flow.nodes[nodeId];
  const [localText, setLocalText] = useState(node?.text ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Follow external text changes unless the user is mid-edit in the textarea.
  if (node && localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  useEffect(() => {
    if (!focusRequest?.section) return;
    const section = containerRef.current?.querySelector<HTMLElement>(`[data-section="${focusRequest.section}"]`);
    section?.scrollIntoView({ block: 'nearest' });
    // Keyed on requestId only so repeated identical requests re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.requestId]);

  if (!node) return null;

  const isEntry = flow.entry.nodeId === nodeId;
  const stepNumber = getOrderedNodes(flow).findIndex((item) => item.id === nodeId) + 1;

  /** Structural patches stay narrow: only the keys the mutation actually touched. */
  const toNodesPatch = (next: GuidedFlow): Partial<GuidedFlow> => ({
    nodes: next.nodes,
    ...(next.nodeOrder ? { nodeOrder: next.nodeOrder } : {}),
  });

  const handleSetEntryClick = () => {
    onFlowChange({ entry: setEntryNode(flow, nodeId).entry });
  };

  const handleDuplicateClick = () => {
    onFlowChange(toNodesPatch(duplicateNode(flow, nodeId).flow));
  };

  const handleDeleteClick = () => {
    const result = deleteNode(flow, nodeId);
    if (result.error === 'last-node') {
      window.alert('O fluxo precisa ter pelo menos uma etapa.');
      return;
    }
    const brokenCount = result.broken.length;
    const consequence =
      brokenCount === 0
        ? 'Nenhuma conexão será afetada'
        : brokenCount === 1
          ? '1 conexão ficará sem destino'
          : `${brokenCount} conexões ficarão sem destino`;
    if (window.confirm(`Excluir esta etapa? ${consequence}`)) {
      onFlowChange(toNodesPatch(result.flow));
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="node-editor-panel"
      className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest p-4 shadow-lg"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-label-md text-on-surface">{`Etapa ${stepNumber}`}</h2>
          <span className="mt-1 inline-block rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-xs text-on-surface-variant">
            {kindLabels[node.kind]}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fechar painel de edição"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <section data-section="texto" className="flex flex-col gap-1">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Texto</h3>
        <textarea
          aria-label="Texto da etapa"
          className="min-h-[80px] rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            if (localText !== node.text) {
              onFlowChange({ nodes: { ...flow.nodes, [nodeId]: { ...node, text: localText } } });
            }
          }}
        />
      </section>

      {/* Placeholder sections for later tasks; Task 10 fills in their fields. */}
      <section data-section="opcoes">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Opções</h3>
      </section>
      <section data-section="ramificacao">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Ramificação</h3>
      </section>
      <section data-section="midia">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Mídia</h3>
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button variant="secondary" size="sm" className="w-full" disabled={isEntry} onClick={handleSetEntryClick}>
          Definir como entrada
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={handleDuplicateClick}>
          Duplicar etapa
        </Button>
        <Button variant="danger" size="sm" className="w-full" onClick={handleDeleteClick}>
          Excluir etapa
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onEditLegacy}>
          Abrir no editor legado
        </Button>
      </div>
    </div>
  );
}

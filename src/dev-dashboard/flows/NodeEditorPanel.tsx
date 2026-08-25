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

export interface NodeEditorPanelProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  nodeId: string;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onClose: () => void;
  /** Opens the legacy full editor for this node. */
  onEditLegacy: () => void;
  /** Scroll/focus a named section ('texto'|'opcoes'|'ramificacao'|'midia'); wired fully in a later task. */
  focusSection?: string;
}

export function NodeEditorPanel({
  flow,
  nodeId,
  onFlowChange,
  onClose,
  onEditLegacy,
  focusSection,
}: NodeEditorPanelProps) {
  const node = flow.nodes[nodeId];
  const [localText, setLocalText] = useState(node?.text ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Follow external text changes unless the user is mid-edit in the textarea.
  if (node && localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  useEffect(() => {
    if (!focusSection) return;
    const section = containerRef.current?.querySelector<HTMLElement>(`[data-section="${focusSection}"]`);
    section?.scrollIntoView({ block: 'nearest' });
  }, [focusSection]);

  if (!node) return null;

  const isEntry = flow.entry.nodeId === nodeId;
  const stepNumber = getOrderedNodes(flow).findIndex((item) => item.id === nodeId) + 1;

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
      onFlowChange(result.flow);
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
          <p className="font-label-md text-on-surface">{`Etapa ${stepNumber}`}</p>
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
        <label className="font-label-sm text-xs text-on-surface-variant" htmlFor="node-editor-text">
          Texto da etapa
        </label>
        <textarea
          id="node-editor-text"
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

      {/* Placeholder anchors for later tasks (options, branching, media). */}
      <div data-section="opcoes" />
      <div data-section="ramificacao" />
      <div data-section="midia" />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={isEntry}
          aria-disabled={isEntry}
          onClick={() => onFlowChange(setEntryNode(flow, nodeId))}
        >
          Definir como entrada
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => onFlowChange(duplicateNode(flow, nodeId).flow)}
        >
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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChoiceFlowNode, FlowNode, GuidedFlow, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { deleteNode, duplicateNode, moveNode, setEntryNode, switchNodeKind } from './flowMutations';
import type { MapFocusSection } from './flowDisplay';
import { buildFlowTopology } from './flowTopology';
import { ChoiceOptionsSection } from './flowNodeEditorChoice';
import { MediaSection } from './flowNodeEditorMedia';
import { ScoreBranchSection } from './flowNodeEditorScoreBranch';
import { KIND_SWITCH_OPTIONS, kindLabels } from './nodeEditorUtils';

/**
 * Structured side panel for editing a single flow stage in place, mounted
 * inside the destination map: the map owns canvas selection and drives
 * `nodeId`, forwards this panel's narrow patches through its `onFlowChange`,
 * and routes `onEditLegacy` to the full legacy editor.
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
  /** Scroll/focus request for a named panel section; bump requestId to re-fire. */
  focusRequest?: { section?: MapFocusSection; targetId?: string; requestId: number } | null;
}

export function NodeEditorPanel({
  flow,
  flows,
  nodeId,
  onFlowChange,
  onClose,
  onEditLegacy,
  focusRequest,
}: NodeEditorPanelProps) {
  const node = flow.nodes[nodeId];
  const [localText, setLocalText] = useState(node?.text ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'focused' | 'all'>(() => {
    if (focusRequest?.section && ['opcao', 'faixa', 'texto', 'midia'].includes(focusRequest.section)) {
      return 'focused';
    }
    return 'all';
  });
  const [prevRequestId, setPrevRequestId] = useState(focusRequest?.requestId);
  if (focusRequest?.requestId !== prevRequestId) {
    setPrevRequestId(focusRequest?.requestId);
    if (focusRequest?.section && ['opcao', 'faixa', 'texto', 'midia'].includes(focusRequest.section)) {
      setViewMode('focused');
    } else {
      setViewMode('all');
    }
  }

  // Inline “Trocar tipo” chooser; remounts with the panel (keyed per node),
  // so an open chooser can never leak across stage switches.
  const [kindChooserOpen, setKindChooserOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const kindChooserRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Topology feeds every target select; recomputed only when flow/flows change.
  const topology = useMemo(() => buildFlowTopology(flow, flows), [flow, flows]);

  // Follow external text changes unless the user is mid-edit in the textarea.
  if (node && localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  useEffect(() => {
    if (!focusRequest?.section) return;
    const section = containerRef.current?.querySelector<HTMLElement>(`[data-section="${focusRequest.section}"]`);
    section?.scrollIntoView?.({ block: 'nearest' });
    // Keyed on requestId only so repeated identical requests re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.requestId]);

  // Grab focus when the kind chooser opens so Escape works immediately.
  useEffect(() => {
    if (kindChooserOpen) kindChooserRef.current?.focus();
  }, [kindChooserOpen]);

  // Focus textarea when focused section is text
  useEffect(() => {
    if (viewMode === 'focused' && focusRequest?.section === 'texto') {
      textareaRef.current?.focus();
    }
  }, [viewMode, focusRequest?.section, focusRequest?.requestId]);

  if (!node) return null;

  const isEntry = flow.entry.nodeId === nodeId;
  // Same ordering the topology uses for TargetSelect step labels; 0 only for a
  // node missing from its own topology (defensive, not reachable today).
  const stepNumber = topology.nodeById[nodeId]?.stepNumber ?? 0;

  // Effective step order behind moveNode: explicit nodeOrder when present,
  // otherwise the nodes record's insertion order. Drives the footer buttons'
  // disabled states (first/last of that order cannot move further).
  const effectiveOrder = flow.nodeOrder ?? Object.keys(flow.nodes);
  const effectiveIndex = effectiveOrder.indexOf(nodeId);
  const isFirstStep = effectiveIndex <= 0;
  const isLastStep = effectiveIndex === -1 || effectiveIndex >= effectiveOrder.length - 1;
  const isOnlyStep = effectiveOrder.length === 1;

  const focusedSection = focusRequest?.section;
  const focusedTargetId = focusRequest?.targetId;

  let focusedSectionLabel = '';
  if (focusedSection === 'opcao' && node.kind === 'choice') {
    const idx = node.options.findIndex((o) => o.id === focusedTargetId);
    focusedSectionLabel = idx !== -1 ? `Opção ${idx + 1}` : 'Opção';
  } else if (focusedSection === 'faixa' && node.kind === 'score_branch') {
    const idx = node.branches.findIndex((b) => b.id === focusedTargetId);
    focusedSectionLabel = idx !== -1 ? `Faixa ${idx + 1}` : 'Faixa';
  } else if (focusedSection === 'texto') {
    focusedSectionLabel = 'Texto da etapa';
  } else if (focusedSection === 'midia') {
    focusedSectionLabel = 'Mídia';
  }

  /** Structural patches stay narrow: only the keys the mutation actually touched. */
  const toNodesPatch = (next: GuidedFlow): Partial<GuidedFlow> => ({
    nodes: next.nodes,
    ...(next.nodeOrder ? { nodeOrder: next.nodeOrder } : {}),
  });

  /**
   * Reordering only ever changes `nodeOrder` — moveNode swaps within an
   * existing order or materializes it from insertion order, so the patch is
   * exactly `{nodeOrder}` either way (nodes content is untouched).
   */
  const handleMoveClick = (direction: 'up' | 'down') => {
    const result = moveNode(flow, nodeId, direction);
    if (!result.moved) return;
    onFlowChange({ nodeOrder: result.flow.nodeOrder });
  };

  const handleSetEntryClick = () => {
    onFlowChange({ entry: setEntryNode(flow, nodeId).entry });
  };

  const handleDuplicateClick = () => {
    onFlowChange(toNodesPatch(duplicateNode(flow, nodeId).flow));
  };

  const handleDeleteClick = () => {
    const result = deleteNode(flow, nodeId);
    if (result.error === 'last-node') {
      setOperationError('Esta é a única etapa do fluxo. Crie outra etapa antes de excluir esta.');
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
      setOperationError(null);
      onFlowChange(toNodesPatch(result.flow));
    }
  };

  /**
   * Kind switch chosen from the inline chooser: confirmed first (the node's
   * format is rebuilt — only its text survives), then committed as a narrow
   * `{nodes}` patch. The panel stays mounted on the same nodeId; the header
   * badge updates from the new flow. Declining closes the chooser.
   */
  const handleKindOptionClick = (kind: FlowNode['kind'], label: string) => {
    const currentNode = flow.nodes[nodeId];
    if (!currentNode || currentNode.kind === kind) return;
    if (!window.confirm(`Trocar para ${label} recria o formato desta etapa; o texto será preservado. Continuar?`)) {
      setKindChooserOpen(false);
      return;
    }
    onFlowChange({ nodes: switchNodeKind(flow, nodeId, { kind }).flow.nodes });
    setKindChooserOpen(false);
  };

  /**
   * Whole-node replacement scoped to this node's record key.
   *
   * One-commit-per-event contract: editing helpers hand this an UPDATER and it
   * is resolved against the flow props current at event time — never against a
   * render-time snapshot captured in a closure. Helpers must call it at most
   * once per user event; multi-field edits must compose into a single updater.
   */
  const handleChoiceNodeChange = (update: (current: ChoiceFlowNode) => ChoiceFlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (currentNode?.kind !== 'choice') return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
  };

  /** Score-branch twin of the choice channel above: same updater-at-event-time, one-commit-per-event contract. */
  const handleScoreBranchNodeChange = (update: (current: ScoreBranchFlowNode) => ScoreBranchFlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (currentNode?.kind !== 'score_branch') return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
  };

  /**
   * Kind-agnostic media channel (videos on every kind, recommendations on
   * results): resolves the UPDATER against the flow props current at event
   * time and emits one narrow `{nodes}` patch per user event, like the
   * kind-scoped channels above.
   */
  const handleNodeMediaChange = (update: (current: FlowNode) => FlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (!currentNode) return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
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
          <div className="mt-1">
            <button
              type="button"
              aria-expanded={kindChooserOpen}
              onClick={() => setKindChooserOpen((open) => !open)}
              className="rounded-full px-2 py-0.5 font-label-sm text-xs text-primary transition-colors hover:bg-surface-container"
            >
              Trocar tipo
            </button>
          </div>
          {kindChooserOpen && (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The focused chooser container itself must catch Escape to dismiss; the rule can't tell this group is interactive chrome, not a static wrapper.
            <div
              ref={kindChooserRef}
              role="group"
              aria-label="Novo tipo da etapa"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setKindChooserOpen(false);
              }}
              className="mt-2 flex flex-col gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2 focus:outline focus:outline-2 focus:outline-primary"
            >
              {KIND_SWITCH_OPTIONS.map((option) => {
                const isCurrent = option.kind === node.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handleKindOptionClick(option.kind, option.label)}
                    className={`rounded-full px-2 py-1 font-label-sm text-xs transition-colors ${
                      isCurrent
                        ? 'cursor-not-allowed bg-secondary-container text-on-secondary-container'
                        : 'text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    {isCurrent ? `✓ ${option.label} (atual)` : option.label}
                  </button>
                );
              })}
            </div>
          )}
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

      {viewMode === 'focused' && focusedSectionLabel ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
          <span className="font-semibold text-primary">Editando {focusedSectionLabel}</span>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Ver etapa inteira ▾
          </button>
        </div>
      ) : null}

      {(viewMode === 'all' || focusedSection === 'texto') && (
        <section data-section="texto" className="flex flex-col gap-1">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Texto</h3>
          <textarea
            ref={textareaRef}
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
      )}

      {node.kind === 'choice' && (viewMode === 'all' || focusedSection === 'opcao' || focusedSection === 'opcoes') && (
        <section data-section="opcoes" className="flex flex-col gap-2">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Opções</h3>
          <ChoiceOptionsSection
            node={node}
            targets={topology.nodes}
            flows={flows}
            onNodeChange={handleChoiceNodeChange}
            focusedOptionId={focusedSection === 'opcao' ? focusedTargetId : undefined}
            viewMode={viewMode}
            onShowAll={() => setViewMode('all')}
          />
        </section>
      )}
      {node.kind === 'score_branch' &&
        (viewMode === 'all' || focusedSection === 'faixa' || focusedSection === 'ramificacao') && (
          <section data-section="ramificacao" className="flex flex-col gap-2">
            <h3 className="font-label-sm text-xs text-on-surface-variant">Ramificação</h3>
            <ScoreBranchSection
              node={node}
              targets={topology.nodes}
              onNodeChange={handleScoreBranchNodeChange}
              focusedBranchId={focusedSection === 'faixa' ? focusedTargetId : undefined}
              viewMode={viewMode}
              onShowAll={() => setViewMode('all')}
            />
          </section>
        )}
      {/* Mídia stays renderable for every kind: the add-video affordance is always available. */}
      {(viewMode === 'all' || focusedSection === 'midia') && (
        <section data-section="midia" className="flex flex-col gap-2">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Mídia</h3>
          <MediaSection node={node} onNodeChange={handleNodeMediaChange} />
        </section>
      )}

      {viewMode === 'focused' ? (
        <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
          <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => setViewMode('all')}>
            Ver todas as seções da etapa ▾
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={isFirstStep}
              aria-label="Mover etapa para cima"
              onClick={() => handleMoveClick('up')}
            >
              Mover etapa para cima
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={isLastStep}
              aria-label="Mover etapa para baixo"
              onClick={() => handleMoveClick('down')}
            >
              Mover etapa para baixo
            </Button>
          </div>
          <Button variant="secondary" size="sm" className="w-full" disabled={isEntry} onClick={handleSetEntryClick}>
            Definir como entrada
          </Button>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleDuplicateClick}>
            Duplicar etapa
          </Button>
          {operationError ? (
            <div role="alert" className="rounded-lg bg-error-container p-3 text-on-error-container">
              <p className="font-label-sm">Não foi possível excluir a etapa</p>
              <p className="mt-1 font-body-sm">{operationError}</p>
            </div>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            disabled={isOnlyStep}
            aria-describedby={isOnlyStep ? `${nodeId}-delete-hint` : undefined}
            onClick={handleDeleteClick}
          >
            Excluir etapa
          </Button>
          {isOnlyStep ? (
            <p id={`${nodeId}-delete-hint`} className="font-label-sm text-on-surface-variant">
              Crie outra etapa antes de excluir a única etapa do fluxo.
            </p>
          ) : null}
          <Button variant="ghost" size="sm" className="w-full" onClick={onEditLegacy}>
            Abrir no editor legado
          </Button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChoiceFlowNode, FlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { deleteNode, duplicateNode, setEntryNode } from './flowMutations';
import { buildFlowTopology, type FlowTopologyNode } from './flowTopology';
import { Button } from '../../design-system/components/Button';

const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

/**
 * Same collapsing rules as flowTopology's private excerpt helper: trims,
 * collapses whitespace and ellipsizes past `length` characters.
 */
function excerpt(text: string, length: number) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

/** First free `${node.id}-option-N`, matching switchNodeKind's naming convention. */
function uniqueOptionId(node: ChoiceFlowNode): string {
  let index = node.options.length + 1;
  let candidate = `${node.id}-option-${index}`;
  while (node.options.some((option) => option.id === candidate)) {
    index += 1;
    candidate = `${node.id}-option-${index}`;
  }
  return candidate;
}

/** Group bucket for a topology node; determines which `<optgroup>` lists it. */
function targetGroupLabel(node: FlowTopologyNode): string {
  if (node.kind === 'result') return 'Finais';
  if (!node.reachable) return 'Sem acesso pela entrada';
  if ((node.depth ?? 0) === 0) return 'Entrada';
  return `Prof. ${node.depth}`;
}

const TARGET_GROUP_ORDER = ['Entrada', 'Prof.', 'Sem acesso pela entrada', 'Finais'];

/** Shared styling for every native select in the panel. */
const selectClassName =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary';

function targetGroupRank(label: string): number {
  if (label.startsWith('Prof.')) return 1;
  const index = TARGET_GROUP_ORDER.indexOf(label);
  return index === -1 ? TARGET_GROUP_ORDER.length : index;
}

function groupTargetNodes(nodes: FlowTopologyNode[]): Array<{ label: string; nodes: FlowTopologyNode[] }> {
  const buckets = new Map<string, FlowTopologyNode[]>();
  for (const item of nodes) {
    const label = targetGroupLabel(item);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(item);
    else buckets.set(label, [item]);
  }
  // Numeric compare keeps `Prof. 2` before `Prof. 10`.
  return [...buckets.entries()]
    .map(([label, grouped]) => ({ label, nodes: grouped }))
    .sort(
      (left, right) =>
        targetGroupRank(left.label) - targetGroupRank(right.label) ||
        left.label.localeCompare(right.label, undefined, { numeric: true }),
    );
}

interface TargetSelectProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  nodes: FlowTopologyNode[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  ariaLabel: string;
}

/**
 * Native select over the flow's topology nodes grouped by depth/reachability.
 * The current value is ALWAYS representable: when it points at a removed or
 * unknown node it renders as `Destino ausente · <id>` instead of silently
 * showing the wrong option. Exported for direct testing of the fallback guard.
 */
export function TargetSelect({
  id,
  value,
  onChange,
  nodes,
  allowEmpty,
  emptyLabel = '— sem destino —',
  ariaLabel,
}: TargetSelectProps) {
  const groups = useMemo(() => groupTargetNodes(nodes), [nodes]);
  const knownIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const isRepresentable = value === '' ? Boolean(allowEmpty) : knownIds.has(value);

  return (
    <select
      {...(id ? { id } : {})}
      aria-label={ariaLabel}
      className={selectClassName}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.nodes.map((node) => (
            <option key={node.id} value={node.id}>{`Etapa ${node.stepNumber} · ${excerpt(node.node.text, 40)}`}</option>
          ))}
        </optgroup>
      ))}
      {/* An empty value without allowEmpty is a caller bug, not "missing data" — don't render a bogus option. */}
      {!isRepresentable && value !== '' && <option value={value}>{`Destino ausente · ${value}`}</option>}
    </select>
  );
}

interface OptionRowProps {
  option: FlowOption;
  index: number;
  targets: FlowTopologyNode[];
  /**
   * Updater-style edit channel for this row's option. Callers must invoke it
   * AT MOST ONCE per user event (single synchronous commit per event); the
   * `update` function is resolved against the latest committed option when the
   * panel handles the event, so it must never capture a render-time snapshot.
   */
  onOptionUpdate: (update: (current: FlowOption) => FlowOption) => void;
  onRemove: () => void;
}

/**
 * One editable option row. The label keeps a per-row draft (null = no pending
 * edit, so external values flow straight through). Commit happens onBlur by
 * comparing the draft to the last committed label — scoped per row on purpose,
 * never via the shared document.activeElement guard, so editing a label can't
 * clobber sibling rows or the texto textarea.
 */
function OptionRow({ option, index, targets, onOptionUpdate, onRemove }: OptionRowProps) {
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const displayedLabel = draftLabel ?? option.label;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
      <input
        aria-label={`Rótulo da opção ${index + 1}`}
        className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
        value={displayedLabel}
        onChange={(event) => setDraftLabel(event.target.value)}
        onBlur={() => {
          setDraftLabel(null);
          if (draftLabel !== null && draftLabel !== option.label) {
            onOptionUpdate((current) => ({ ...current, label: draftLabel }));
          }
        }}
      />
      {/* Selects don't blur reliably; commit the target immediately on change. */}
      <TargetSelect
        ariaLabel={`Destino da opção ${index + 1}`}
        value={option.next}
        onChange={(next) => onOptionUpdate((current) => ({ ...current, next }))}
        nodes={targets}
        allowEmpty
      />
      <button
        type="button"
        aria-label={`Remover opção ${index + 1}`}
        onClick={onRemove}
        className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
      >
        Remover opção
      </button>
    </div>
  );
}

/** Opções body for choice nodes: one row per option plus free-text routing. */
function ChoiceOptionsSection({
  node,
  targets,
  onNodeChange,
}: {
  node: ChoiceFlowNode;
  targets: FlowTopologyNode[];
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: (update: (current: ChoiceFlowNode) => ChoiceFlowNode) => void;
}) {
  /**
   * Routes one option-scoped edit through the node-level updater. The mapping
   * runs against the LATEST options at event time — never against this
   * render's snapshot — and performs exactly one commit.
   */
  const commitOption = (optionId: string, update: (current: FlowOption) => FlowOption) =>
    onNodeChange((current) => ({
      ...current,
      options: current.options.map((candidate) => (candidate.id === optionId ? update(candidate) : candidate)),
    }));

  return (
    <>
      {node.options.map((option, index) => (
        <OptionRow
          key={option.id}
          option={option}
          index={index}
          targets={targets}
          onOptionUpdate={(update) => commitOption(option.id, update)}
          onRemove={() =>
            onNodeChange((current) => ({
              ...current,
              options: current.options.filter((candidate) => candidate.id !== option.id),
            }))
          }
        />
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            options: [...current.options, { id: uniqueOptionId(current), label: '', next: '' }],
          }))
        }
      >
        Adicionar opção
      </Button>
      <label className="flex items-center gap-2 font-label-sm text-sm text-on-surface">
        <input
          type="checkbox"
          checked={Boolean(node.freeText)}
          onChange={(event) =>
            onNodeChange((current) => {
              if (event.target.checked) return { ...current, freeText: { next: current.freeText?.next ?? '' } };
              const { freeText: _dropped, ...nodeWithoutFreeText } = current;
              return nodeWithoutFreeText;
            })
          }
        />
        Aceitar resposta livre
      </label>
      {node.freeText && (
        <TargetSelect
          ariaLabel="Destino da resposta livre"
          value={node.freeText.next}
          onChange={(next) => onNodeChange((current) => ({ ...current, freeText: { next } }))}
          nodes={targets}
          allowEmpty
        />
      )}
    </>
  );
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
  // Topology feeds every target select; recomputed only when flow/flows change.
  const topology = useMemo(() => buildFlowTopology(flow, flows), [flow, flows]);

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
  // Same ordering the topology uses for TargetSelect step labels; 0 only for a
  // node missing from its own topology (defensive, not reachable today).
  const stepNumber = topology.nodeById[nodeId]?.stepNumber ?? 0;

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

      {node.kind === 'choice' && (
        <section data-section="opcoes" className="flex flex-col gap-2">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Opções</h3>
          <ChoiceOptionsSection node={node} targets={topology.nodes} onNodeChange={handleChoiceNodeChange} />
        </section>
      )}
      {/* Placeholder sections for later tasks; Task 10 fills in their fields. */}
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

import { useMemo } from 'react';

import type { FlowTopologyNode } from './flowTopology';
import { selectClassName } from './flowEffectFields';

/**
 * Shared node-target select used by NodeEditorPanel (option/free-text/branch
 * rows) and FlowSettingsPanel (entry stage): one native select over the
 * flow's topology nodes, grouped by depth/reachability.
 */

/**
 * Same collapsing rules as flowTopology's private excerpt helper: trims,
 * collapses whitespace and ellipsizes past `length` characters.
 */
function excerpt(text: string, length: number) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length <= length ? normalized : `${normalized.slice(0, length - 1).trimEnd()}…`;
}

/** Group bucket for a topology node; determines which `<optgroup>` lists it. */
function targetGroupLabel(node: FlowTopologyNode): string {
  if (node.kind === 'result') return 'Finais';
  if (!node.reachable) return 'Sem acesso pela entrada';
  if ((node.depth ?? 0) === 0) return 'Entrada';
  return `Prof. ${node.depth}`;
}

const TARGET_GROUP_ORDER = ['Entrada', 'Prof.', 'Sem acesso pela entrada', 'Finais'];

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

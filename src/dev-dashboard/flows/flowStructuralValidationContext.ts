import type { GuidedFlow } from '../../domain/flow-engine/types';

export type UnknownRecord = Record<string, unknown>;

export interface FlowValidationContext {
  flow: UnknownRecord;
  flowId: string;
  pathRoot: string;
  nodes: NodeMatch[];
}

export interface StructuralIssueDetails {
  message: string;
  path: string;
}

export interface NodeMatch {
  key: string;
  value: UnknownRecord;
}

export interface OptionMatch {
  node: NodeMatch;
  nodeId: string;
  option: UnknownRecord;
  index: number;
}

export interface IndexedRecord {
  value: UnknownRecord;
  index: number;
}

export function createFlowValidationContext(flow: GuidedFlow): FlowValidationContext {
  const rawFlow = (isRecord(flow) ? flow : {}) as UnknownRecord;
  const rawNodes = rawFlow.nodes;
  const nodes = isRecord(rawNodes)
    ? Object.entries(rawNodes).map(([key, value]) => ({ key, value: isRecord(value) ? value : {} }))
    : [];
  const flowId = stringify(rawFlow.id);
  return { flow: rawFlow, flowId, pathRoot: flowId || 'fluxo', nodes };
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringify(value: unknown) {
  return value === undefined ? 'undefined' : String(value);
}

export function hasTextValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function nodeId(node: NodeMatch) {
  return hasTextValue(node.value.id) ? String(node.value.id) : node.key;
}

export function findNode(context: FlowValidationContext, label: string, occurrence: number): NodeMatch | undefined {
  const candidates = context.nodes.filter((node) => stringify(node.value.id) === label || node.key === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

export function findNodeWithMissingId(context: FlowValidationContext, occurrence: number): NodeMatch | undefined {
  const candidates = context.nodes.filter((node) => !hasTextValue(node.value.id));
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

export function nodePath(context: FlowValidationContext, node: NodeMatch | undefined, fallback: string) {
  return `${context.pathRoot}.nodes.${node ? nodeId(node) : fallback}`;
}

export function findOption(context: FlowValidationContext, label: string, occurrence: number): OptionMatch | undefined {
  const candidates = allOptions(context).filter((item) => stringify(item.option.id) === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

export function findOptionByIndex(node: NodeMatch | undefined, index: number): IndexedRecord | undefined {
  if (!node || !Array.isArray(node.value.options)) return undefined;
  const value = node.value.options[index];
  return isRecord(value) ? { value, index } : undefined;
}

export function optionPath(context: FlowValidationContext, option: OptionMatch | undefined, fallback: string) {
  const nodeSegment = option?.nodeId ?? 'etapa';
  const optionSegment = option
    ? hasTextValue(option.option.id)
      ? String(option.option.id)
      : String(option.index)
    : fallback;
  return `${context.pathRoot}.nodes.${nodeSegment}.options.${optionSegment}`;
}

export function effectPath(
  context: FlowValidationContext,
  option: OptionMatch | undefined,
  kind: string,
  occurrence: number,
) {
  const effectValues = option?.option.effects;
  const effects = Array.isArray(effectValues) ? effectValues : [];
  const candidates = effects
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && stringify(item.value.kind) === kind);
  const selected = candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
  return `${optionPath(context, option, 'opção')}.effects.${selected ? String(selected.index) : kind}`;
}

export function findVideo(node: NodeMatch | undefined, label: string, occurrence: number): IndexedRecord | undefined {
  const videos = node?.value.videos;
  if (!Array.isArray(videos)) return undefined;
  const candidates = videos
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && recordId(item.value, item.index) === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

export function findVisual(node: NodeMatch | undefined, label: string, occurrence: number): IndexedRecord | undefined {
  const visuals = node?.value.visuals;
  if (!Array.isArray(visuals)) return undefined;
  const candidates = visuals
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && recordId(item.value, item.index) === label);
  return candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
}

export function findBranch(node: NodeMatch | undefined, label: string, occurrence: number) {
  const branches = node?.value.branches;
  if (!Array.isArray(branches)) return undefined;
  const candidates = branches
    .map((value, index) => ({ value, index }))
    .filter((item) => isRecord(item.value) && stringify(item.value.id) === label);
  const selected = candidates[Math.min(occurrence, Math.max(candidates.length - 1, 0))];
  return (
    selected && { index: selected.index, id: hasTextValue(selected.value.id) ? String(selected.value.id) : undefined }
  );
}

export function findBranchByIndex(node: NodeMatch | undefined, index: number) {
  const branches = node?.value.branches;
  if (!Array.isArray(branches)) return undefined;
  const value = branches[index];
  if (!isRecord(value)) return undefined;
  return { index, id: hasTextValue(value.id) ? String(value.id) : undefined };
}

export function countPreviousOccurrences(values: string[], value: string, index: number) {
  return values.slice(0, index).filter((candidate) => candidate === value).length;
}

function allOptions(context: FlowValidationContext): OptionMatch[] {
  const options: OptionMatch[] = [];
  context.nodes.forEach((node) => {
    if (!Array.isArray(node.value.options)) return;
    node.value.options.forEach((value, index) => {
      if (isRecord(value)) options.push({ node, nodeId: nodeId(node), option: value, index });
    });
  });
  return options;
}

function recordId(record: UnknownRecord, index: number) {
  return hasTextValue(record.id) ? String(record.id) : `index-${index}`;
}

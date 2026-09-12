import type { MapFocusSection } from './flowDisplay';

export type FlowDetailTab = 'editor' | 'preview' | 'map';
export type NodeFilter = 'all' | 'result' | 'safety' | 'branch';
export type FlowValidationSection = 'texto' | 'opcoes' | 'ramificacao' | 'midia' | 'configuracoes';

export type FlowValidationTarget = {
  flowId: string;
  nodeId?: string;
  section?: FlowValidationSection;
  description: string;
};

export function isNodePanelSection(
  section: FlowValidationSection | undefined,
): section is Extract<MapFocusSection, FlowValidationSection> {
  return section !== undefined && section !== 'configuracoes';
}

export const flowDetailTabs: Array<{ id: FlowDetailTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
];

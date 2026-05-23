import type { FlowPurpose } from '../../domain/flow-engine/types';

export const flowPurposeLabels: Record<'common' | FlowPurpose, string> = {
  common: 'Fluxo comum',
  orientation_entry: 'Entrada da orientação',
  post_flow_routing: 'Continuação após um fluxo',
};

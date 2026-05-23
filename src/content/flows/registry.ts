import type { ContentMetadata } from '../../domain/content/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { parseGuidedFlow } from '../../domain/flow-engine/parseFlow';
import { neutralFlows } from './neutral';
import { restRecoveryFlow } from './rest-recovery';
import { workStressFlow } from './work-stress';

const jsonFlowModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
});

const jsonFlows = Object.entries(jsonFlowModules)
  .map(([path, flow]) => ({
    path,
    flow: parseGuidedFlow(flow),
  }))
  .sort((left, right) => left.path.localeCompare(right.path))
  .map(({ flow }) => flow);

export const flowRegistry = {
  id: 'flow-registry',
  version: '1.0.0',
  status: 'draft',
  locale: 'pt-BR',
  flows: [...neutralFlows, workStressFlow, restRecoveryFlow, ...jsonFlows],
} satisfies ContentMetadata & { flows: GuidedFlow[] };

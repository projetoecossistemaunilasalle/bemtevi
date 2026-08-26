import type { ContentMetadata } from '../../domain/content/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { parseGuidedFlow } from '../../domain/flow-engine/parseFlow';
import { neutralFlows } from './neutral';
import { restRecoveryFlow } from './rest-recovery';
import { workStressFlow } from './work-stress';
import who5Json from './who5.json';
import srq20Json from './srq20.json';
import jobSatisfactionJson from './job-satisfaction.json';

const staticJsonFlows = [jobSatisfactionJson, srq20Json, who5Json].map((flow) => parseGuidedFlow(flow));

const jsonFlows =
  typeof import.meta.glob === 'function'
    ? Object.entries(import.meta.glob('./*.json', { eager: true, import: 'default' }))
        .map(([path, flow]) => ({
          path,
          flow: parseGuidedFlow(flow),
        }))
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ flow }) => flow)
    : staticJsonFlows;

export const flowRegistry = {
  id: 'flow-registry',
  version: '1.0.0',
  status: 'draft',
  locale: 'pt-BR',
  flows: [...neutralFlows, workStressFlow, restRecoveryFlow, ...jsonFlows],
} satisfies ContentMetadata & { flows: GuidedFlow[] };

import type { ContentMetadata } from '../../domain/content/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { workStressFlow } from './work-stress';

export const flowRegistry = {
  id: 'flow-registry',
  version: '1.0.0',
  status: 'draft',
  locale: 'pt-BR',
  flows: [workStressFlow],
} satisfies ContentMetadata & { flows: GuidedFlow[] };

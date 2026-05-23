import { flowRegistry } from '../../content/flows/registry';
import { resourcesContent } from '../../content/resources/resources';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';

export interface DashboardShippedContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
}

export function getShippedDashboardContent(): DashboardShippedContent {
  return {
    flows: flowRegistry.flows,
    educationMaterials: resourcesContent.resources,
  };
}

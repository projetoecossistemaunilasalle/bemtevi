import { flowRegistry } from '../../content/flows/registry';
import { resourcesContent } from '../../content/resources/resources';
import { educationResourceGroups } from '../../content/resources/groups';
import { canoasServices } from '../../content/services/canoas-services';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { ServiceDirectoryEntry } from '../../domain/services/types';

export interface DashboardShippedContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
}

export function getShippedDashboardContent(): DashboardShippedContent {
  return {
    flows: flowRegistry.flows,
    educationMaterials: resourcesContent.resources,
    educationGroups: educationResourceGroups,
    contacts: canoasServices.services,
  };
}

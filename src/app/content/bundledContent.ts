import { flowRegistry } from '../../content/flows/registry';
import { educationResourceGroups } from '../../content/resources/groups';
import { resourcesContent } from '../../content/resources/resources';
import { canoasServices } from '../../content/services/canoas-services';
import type { PublishedContentPayload } from './publishedContent';

export function getBundledContent(): PublishedContentPayload {
  return {
    flows: [...flowRegistry.flows],
    educationMaterials: [...resourcesContent.resources],
    educationGroups: [...educationResourceGroups],
    contacts: [...canoasServices.services],
    defaultGroupOrder: 0,
  };
}

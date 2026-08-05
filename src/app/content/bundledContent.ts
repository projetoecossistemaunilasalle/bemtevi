import { flowRegistry } from '../../content/flows/registry';
import { educationResourceGroups } from '../../content/resources/groups';
import { resourcesContent } from '../../content/resources/resources';
import { canoasServices } from '../../content/services/canoas-services';
import { deriveLocationsFromContacts, normalizeContactLocations } from '../../domain/services/locations';
import type { PublishedContentPayload } from './publishedContent';

export function getBundledContent(): PublishedContentPayload {
  const locations = deriveLocationsFromContacts(canoasServices.services);
  const normalizedContacts = normalizeContactLocations(canoasServices.services, locations, {
    allowDerivation: false,
  });

  return {
    flows: [...flowRegistry.flows],
    educationMaterials: [...resourcesContent.resources],
    educationGroups: [...educationResourceGroups],
    contacts: normalizedContacts.contacts,
    locations: normalizedContacts.locations,
    defaultGroupOrder: 0,
  };
}

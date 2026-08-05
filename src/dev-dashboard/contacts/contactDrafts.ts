import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';

export { applyLocationSelection, locationLabel } from '../../domain/services/locations';

export function normalizePhoneHref(phoneDisplay: string) {
  return `tel:${phoneDisplay.replace(/\D/g, '')}`;
}

export function badgeToneForServiceType(type: string): ServiceDirectoryEntry['badgeTone'] {
  const normalizedType = type.trim().toLocaleUpperCase('pt-BR');

  if (normalizedType === 'CAPS') return 'primary';
  if (normalizedType === 'UBS') return 'secondary';
  return 'neutral';
}

export function createLocalService(
  existingIds: Iterable<string>,
  locations: ServiceLocation[] = [],
): ServiceDirectoryEntry {
  const ids = new Set(existingIds);
  let suffix = 1;

  while (ids.has(`service-local-${suffix}`)) suffix += 1;

  const defaultLocation = locations[0];

  return {
    id: `service-local-${suffix}`,
    name: 'Novo contato',
    type: 'Outro',
    badgeTone: 'neutral',
    city: defaultLocation?.city ?? '',
    state: defaultLocation?.state ?? '',
    locationId: defaultLocation?.id ?? null,
    address: '',
    phoneDisplay: '',
    phoneHref: 'tel:',
    review: {
      status: 'pending_review',
      reviewedBy: null,
      reviewedAt: null,
      notes: '',
    },
  };
}

export function createLocalLocation(existingIds: Iterable<string>): ServiceLocation {
  const ids = new Set(existingIds);
  let suffix = 1;

  while (ids.has(`location-local-${suffix}`)) suffix += 1;

  return { id: `location-local-${suffix}`, city: '', state: '' };
}

export interface ContactLocationGroup {
  location: ServiceLocation | null;
  entries: Array<{ service: ServiceDirectoryEntry; index: number }>;
}

export function groupContactsByLocation(
  services: ServiceDirectoryEntry[],
  locations: ServiceLocation[],
): ContactLocationGroup[] {
  const groups = locations.map((location) => ({
    location,
    entries: [] as Array<{ service: ServiceDirectoryEntry; index: number }>,
  }));
  const unassigned: ContactLocationGroup = { location: null, entries: [] };

  services.forEach((service, index) => {
    const group = groups.find((candidate) => candidate.location?.id === service.locationId);
    (group ?? unassigned).entries.push({ service, index });
  });

  return [
    ...groups.filter((group) => group.entries.length > 0),
    ...(unassigned.entries.length > 0 ? [unassigned] : []),
  ];
}

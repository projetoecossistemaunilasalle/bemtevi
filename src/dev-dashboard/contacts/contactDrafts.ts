import type { ServiceDirectoryEntry } from '../../domain/services/types';

export function normalizePhoneHref(phoneDisplay: string) {
  return `tel:${phoneDisplay.replace(/\D/g, '')}`;
}

export function badgeToneForServiceType(type: string): ServiceDirectoryEntry['badgeTone'] {
  const normalizedType = type.trim().toLocaleUpperCase('pt-BR');

  if (normalizedType === 'CAPS') return 'primary';
  if (normalizedType === 'UBS') return 'secondary';
  return 'neutral';
}

export function createLocalService(existingIds: Iterable<string>): ServiceDirectoryEntry {
  const ids = new Set(existingIds);
  let suffix = 1;

  while (ids.has(`service-local-${suffix}`)) suffix += 1;

  return {
    id: `service-local-${suffix}`,
    name: 'Novo contato',
    type: 'Outro',
    badgeTone: 'neutral',
    city: 'Canoas',
    state: 'RS',
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

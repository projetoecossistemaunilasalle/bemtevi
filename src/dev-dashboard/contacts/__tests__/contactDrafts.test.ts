import { describe, expect, it } from 'vitest';
import { badgeToneForServiceType, createLocalService, normalizePhoneHref } from '../contactDrafts';

describe('contactDrafts', () => {
  it('derives a tel URL from a formatted phone number', () => {
    expect(normalizePhoneHref('(51) 3236-1500')).toBe('tel:5132361500');
  });

  it.each([
    ['CAPS', 'primary'],
    ['  caps  ', 'primary'],
    ['UBS', 'secondary'],
    [' uBs ', 'secondary'],
    ['Universidade', 'neutral'],
    ['Outro', 'neutral'],
  ] as const)('maps the service type %j to the %s badge tone', (type, expectedTone) => {
    expect(badgeToneForServiceType(type)).toBe(expectedTone);
  });

  it('creates the first unused stable local service ID', () => {
    expect(createLocalService(['service-local-1', 'service-local-3']).id).toBe('service-local-2');
  });

  it('creates a contact with friendly starter values and pending review metadata', () => {
    expect(createLocalService(['service-local-1'])).toEqual({
      id: 'service-local-2',
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
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyLocationSelection,
  deriveLocationsFromContacts,
  locationLabel,
  normalizeContactLocations,
} from '../locations';
import type { ServiceDirectoryEntry } from '../types';

const review = { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' };

function contact(overrides: Partial<ServiceDirectoryEntry> = {}): ServiceDirectoryEntry {
  return {
    id: 'contact-one',
    name: 'Contato',
    type: 'CAPS',
    badgeTone: 'primary',
    city: 'Canoas',
    state: 'RS',
    address: 'Rua Um',
    phoneDisplay: '5133334444',
    phoneHref: 'tel:5133334444',
    review,
    ...overrides,
  };
}

describe('service locations', () => {
  it('deduplicates locations and creates stable collision-safe IDs', () => {
    const contacts = [
      { city: 'Canoas', state: 'RS' },
      { city: 'Canoas', state: 'rs' },
      { city: '', state: '' },
      { city: 'A B', state: 'SP' },
      { city: 'A-B', state: 'SP' },
    ];

    const locations = deriveLocationsFromContacts(contacts);
    const reversed = deriveLocationsFromContacts([...contacts].reverse());

    expect(locations[0]).toEqual({ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' });
    expect(locations).toHaveLength(3);
    expect(new Set(locations.map((location) => location.id)).size).toBe(3);
    expect(reversed.find((location) => location.city === 'A B')?.id).toBe(
      locations.find((location) => location.city === 'A B')?.id,
    );
  });

  it('attaches matching locations and refreshes denormalized fields after a rename', () => {
    const locations = [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }];
    const result = normalizeContactLocations(
      [contact({ locationId: 'loc-canoas-rs', city: 'Old name', state: 'XX' })],
      [{ id: 'loc-canoas-rs', city: 'Porto Alegre', state: 'RS' }],
      { allowDerivation: false },
    );

    expect(result.locations).toEqual([{ id: 'loc-canoas-rs', city: 'Porto Alegre', state: 'RS' }]);
    expect(result.contacts[0]).toMatchObject({
      locationId: 'loc-canoas-rs',
      city: 'Porto Alegre',
      state: 'RS',
    });
    expect(locationLabel(locations[0])).toBe('Canoas - RS');
  });

  it('derives legacy orphan pairs only when derivation is enabled', () => {
    const orphan = contact({ city: 'Esteio', state: 'RS' });
    const derived = normalizeContactLocations([orphan], [], { allowDerivation: true });
    const preserved = normalizeContactLocations([orphan], [], { allowDerivation: false });

    expect(derived.contacts[0].locationId).toBe(derived.locations[0]?.id);
    expect(preserved.contacts[0]).toMatchObject({ locationId: null, city: 'Esteio', state: 'RS' });
    expect(preserved.locations).toEqual([]);
  });

  it('does not reassign an explicit national contact from matching city data', () => {
    const location = { id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' };
    const national = contact({ locationId: null, city: 'Canoas', state: 'RS' });

    const normalized = normalizeContactLocations([national], [location], { allowDerivation: false });

    expect(normalized.contacts[0]).toMatchObject({ locationId: null, city: 'Canoas', state: 'RS' });
  });

  it('clears an unassigned contact and applies picker selections', () => {
    const national = contact({ city: '', state: '', locationId: null });
    const location = { id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' };
    const normalized = normalizeContactLocations([national], [], { allowDerivation: false });

    expect(normalized.contacts[0]).toMatchObject({ locationId: null, city: '', state: '' });
    expect(applyLocationSelection(national, location.id, [location])).toEqual({
      locationId: location.id,
      city: 'Canoas',
      state: 'RS',
    });
    expect(applyLocationSelection(national, null, [location])).toEqual({
      locationId: null,
      city: '',
      state: '',
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../../domain/services/types';
import { validateDashboardContacts } from '../contactsValidation';

const service: ServiceDirectoryEntry = {
  id: 'service-one',
  name: 'CAPS Centro',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 10',
  phoneDisplay: '(51) 3333-4444',
  phoneHref: 'tel:5133334444',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

const location: ServiceLocation = { id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' };

describe('validateDashboardContacts', () => {
  it('accepts a complete normalized contact', () => {
    expect(validateDashboardContacts([service])).toEqual({ errors: [], warnings: [] });
  });

  it('accepts a contact assigned to a managed location', () => {
    expect(validateDashboardContacts([{ ...service, locationId: location.id }], [location])).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('allows national contacts and warns when the managed catalog is empty', () => {
    const result = validateDashboardContacts([{ ...service, city: '', state: '', locationId: null }], []);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ id: 'no-locations', area: 'contacts' })]);
  });

  it('rejects dangling and mismatched location references', () => {
    const dangling = validateDashboardContacts([{ ...service, locationId: 'missing' }], [location]);
    const mismatch = validateDashboardContacts([{ ...service, locationId: location.id, city: 'Esteio' }], [location]);

    expect(dangling.errors).toEqual([expect.objectContaining({ id: 'unknown-location:service-one:0' })]);
    expect(mismatch.errors).toEqual([expect.objectContaining({ id: 'location-mismatch:service-one:0' })]);
  });

  it('rejects leftover city data on an unassigned contact and duplicate locations', () => {
    const result = validateDashboardContacts(
      [{ ...service, locationId: null }],
      [location, { ...location, id: 'loc-canoas-rs-2' }],
    );

    expect(result.errors.map((issue) => issue.id)).toEqual([
      'duplicate-location:canoas|RS',
      'unassigned-city:service-one:0',
    ]);
  });

  it('reports duplicate location IDs and invalid managed location fields with paths', () => {
    const result = validateDashboardContacts(
      [],
      [
        { id: 'same-location', city: '', state: 'R1' },
        { id: 'same-location', city: 'Canoas', state: 'RS' },
      ],
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'duplicate-location-id:same-location' }),
        expect.objectContaining({ id: 'missing-location-city:same-location:0', path: 'locations.0.city' }),
        expect.objectContaining({ id: 'invalid-location-state:same-location:0', path: 'locations.0.state' }),
      ]),
    );
  });

  it('rejects a sentence used as the short category', () => {
    const result = validateDashboardContacts([
      { ...service, type: 'Atendimento psicossocial para adultos em sofrimento.' },
    ]);

    expect(result.errors).toEqual([
      expect.objectContaining({
        id: 'long-type:service-one:0',
        path: 'contacts.0.type',
        message: expect.stringMatching(/no máximo 24 caracteres/i),
      }),
    ]);
  });

  it('reports every missing required field with its indexed path', () => {
    const result = validateDashboardContacts([{ ...service, name: ' ', type: '\t', city: '', address: '\n' }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'missing-name:service-one:0',
        message: 'O nome do contato é obrigatório.',
        path: 'contacts.0.name',
      },
      {
        level: 'error',
        area: 'contacts',
        id: 'missing-type:service-one:0',
        message: 'O tipo de serviço é obrigatório.',
        path: 'contacts.0.type',
      },
      {
        level: 'error',
        area: 'contacts',
        id: 'missing-city:service-one:0',
        message: 'A cidade é obrigatória.',
        path: 'contacts.0.city',
      },
      {
        level: 'error',
        area: 'contacts',
        id: 'missing-address:service-one:0',
        message: 'O endereço é obrigatório.',
        path: 'contacts.0.address',
      },
    ]);
  });

  it.each(['R', 'R1', 'RÉ', ' RS'])('rejects state %j because it is not exactly two ASCII letters', (state) => {
    const result = validateDashboardContacts([{ ...service, state }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'invalid-state:service-one:0',
        message: 'O estado precisa ter exatamente duas letras.',
        path: 'contacts.0.state',
      },
    ]);
  });

  it('accepts two lowercase ASCII letters as a state', () => {
    expect(validateDashboardContacts([{ ...service, state: 'rs' }])).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a phone display with fewer than eight digits', () => {
    const result = validateDashboardContacts([{ ...service, phoneDisplay: '123-4567', phoneHref: 'tel:1234567' }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'invalid-phone-display:service-one:0',
        message: 'O telefone precisa ter pelo menos 8 dígitos.',
        path: 'contacts.0.phoneDisplay',
      },
    ]);
  });

  it('rejects a phone link that does not exactly match the normalized display number', () => {
    const result = validateDashboardContacts([{ ...service, phoneHref: 'tel:5133334445' }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'invalid-phone-href:service-one:0',
        message: 'O link do telefone precisa corresponder ao número informado.',
        path: 'contacts.0.phoneHref',
      },
    ]);
  });

  it.each(['', '   '])('reports a blank contact ID %j as a summary-level error', (id) => {
    const result = validateDashboardContacts([{ ...service, id }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'missing-contact-id:0',
        message: 'O ID do contato é obrigatório.',
      },
    ]);
  });

  it('reports duplicate IDs once as a summary-level error', () => {
    const result = validateDashboardContacts([service, { ...service }, { ...service }]);

    expect(result.errors).toEqual([
      {
        level: 'error',
        area: 'contacts',
        id: 'duplicate-contact-id:service-one',
        message: 'Existe mais de um contato com o ID "service-one".',
      },
    ]);
  });
});

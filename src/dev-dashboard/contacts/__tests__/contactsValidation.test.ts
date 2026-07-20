import { describe, expect, it } from 'vitest';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
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

describe('validateDashboardContacts', () => {
  it('accepts a complete normalized contact', () => {
    expect(validateDashboardContacts([service])).toEqual({ errors: [], warnings: [] });
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

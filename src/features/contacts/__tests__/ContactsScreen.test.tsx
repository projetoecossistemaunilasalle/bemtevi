import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishedContentContext } from '../../../app/content/PublishedContentContext';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { canoasServices } from '../../../content/services/canoas-services';
import { ContactsScreen } from '../ContactsScreen';

function buildContentValue(payload: PublishedContentPayload) {
  const snapshot = {
    schemaVersion: '1.0.0',
    revision: 1,
    payload,
    publishedAt: '2026-07-15T00:00:00.000Z',
    publishedBy: 'admin',
  } as const;
  return {
    content: payload,
    snapshot,
    source: 'database' as const,
    status: 'ready' as const,
    loadError: null,
    refresh: async () => {},
    publish: async () => snapshot,
  };
}

function renderWithContent(ui: ReactElement, payload: PublishedContentPayload = getBundledContent()) {
  return render(
    <PublishedContentContext.Provider value={buildContentValue(payload)}>{ui}</PublishedContentContext.Provider>,
  );
}

function buildDatabaseContactsPayload(): PublishedContentPayload {
  const bundled = getBundledContent();
  const databaseContacts = [
    { ...bundled.contacts[0], name: 'Contato do Banco de Dados' },
    bundled.contacts[1],
    bundled.contacts[2],
    {
      id: 'db-novo-contato',
      name: 'Novo Contato DB',
      type: 'CAPS',
      badgeTone: 'primary' as const,
      city: 'Canoas',
      state: 'RS',
      address: 'Rua do Banco de Dados, 1',
      phoneDisplay: '(51) 1111-1111',
      phoneHref: 'tel:5111111111',
      review: { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' },
    },
  ];
  return { ...bundled, contacts: databaseContacts };
}

describe('ContactsScreen', () => {
  it('renders all configured Canoas services', () => {
    renderWithContent(<ContactsScreen />, getBundledContent());

    canoasServices.services.forEach((service) => {
      expect(screen.getByText(service.name)).toBeInTheDocument();
    });
  });

  it('renders contacts from published content instead of bundled services', () => {
    const payload = buildDatabaseContactsPayload();
    renderWithContent(<ContactsScreen />, payload);

    expect(screen.getByText('Contato do Banco de Dados')).toBeInTheDocument();
    expect(screen.queryByText('CAPS II Praça Brasil')).not.toBeInTheDocument();
  });
});

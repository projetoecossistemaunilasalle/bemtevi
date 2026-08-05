import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function buildMultiCityContactsPayload(): PublishedContentPayload {
  const bundled = getBundledContent();
  return {
    ...bundled,
    contacts: [
      bundled.contacts[0],
      {
        id: 'porto-alegre-contato',
        name: 'CAPS Centro de Porto Alegre',
        type: 'CAPS',
        badgeTone: 'primary' as const,
        city: 'Porto Alegre',
        state: 'RS',
        address: 'Rua da Independência, 100 - Centro, Porto Alegre - RS',
        phoneDisplay: '(51) 3222-2222',
        phoneHref: 'tel:5132222222',
        review: { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' },
      },
      {
        id: 'servico-nacional',
        name: 'CVV - Centro de Valorização da Vida',
        type: 'Nacional',
        badgeTone: 'neutral' as const,
        city: '',
        state: '',
        address: 'Atendimento por telefone e chat em todo o Brasil',
        phoneDisplay: '188',
        phoneHref: 'tel:188',
        review: { status: 'pending_review' as const, reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ],
  };
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

  it('filters the grid when a city is selected and keeps national services visible', async () => {
    const user = userEvent.setup();
    renderWithContent(<ContactsScreen />, buildMultiCityContactsPayload());

    expect(screen.getByRole('heading', { name: 'Rede de apoio' })).toBeInTheDocument();
    expect(screen.getByText('CAPS II Praça Brasil')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /todas as cidades/i }));
    await user.click(screen.getByRole('option', { name: /porto alegre - rs/i }));

    expect(screen.getByText('CAPS Centro de Porto Alegre')).toBeInTheDocument();
    expect(screen.getByText('CVV - Centro de Valorização da Vida')).toBeInTheDocument();
    expect(screen.queryByText('CAPS II Praça Brasil')).not.toBeInTheDocument();
  });

  it('resets the filter back to all cities', async () => {
    const user = userEvent.setup();
    renderWithContent(<ContactsScreen />, buildMultiCityContactsPayload());

    await user.click(screen.getByRole('button', { name: /todas as cidades/i }));
    await user.click(screen.getByRole('option', { name: /porto alegre - rs/i }));
    expect(screen.queryByText('CAPS II Praça Brasil')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /porto alegre - rs/i }));
    await user.click(screen.getByRole('option', { name: /todas as cidades/i }));

    expect(screen.getByText('CAPS II Praça Brasil')).toBeInTheDocument();
    expect(screen.getByText('CAPS Centro de Porto Alegre')).toBeInTheDocument();
  });
});

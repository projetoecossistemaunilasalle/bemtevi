import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PublishDashboard } from '../PublishDashboard';
import {
  PublishedContentContext,
  type PublishedContentContextValue,
} from '../../../app/content/PublishedContentContext';
import { AdminAuthContext, type AdminAuthContextValue } from '../../../app/auth/AdminAuthContext';
import type { AdminAccount } from '../../../app/auth/adminAuth';
import { type PublishedContentPayload, type PublishedContentSnapshot } from '../../../app/content/publishedContent';
import { PublishedContentRepositoryError } from '../../../app/content/publishedContentRepository';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
import type { DashboardValidationResult } from '../../validation/validationTypes';

const contact: ServiceDirectoryEntry = {
  id: 'contact-one',
  name: 'Contato Um',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 123',
  phoneDisplay: '(51) 3000-0000',
  phoneHref: 'tel:5130000000',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

const baseline: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

const draftWithChanges: PublishedContentPayload = {
  ...baseline,
  contacts: [contact],
};

const emptyValidation: DashboardValidationResult = { errors: [], warnings: [] };

const validationWithError: DashboardValidationResult = {
  errors: [{ level: 'error', area: 'contacts', id: 'e1', message: 'Erro impeditivo.' }],
  warnings: [],
};

function makeSnapshot(revision: number, payload: PublishedContentPayload = baseline): PublishedContentSnapshot {
  return {
    schemaVersion: '1.0.0',
    revision,
    payload,
    publishedAt: '2026-07-12T00:00:00.000Z',
    publishedBy: 'admin-id',
  };
}

const account: AdminAccount = { id: 'admin-id', email: 'admin@bemtevi.test' };

function renderPublish({
  publish = vi.fn<PublishedContentContextValue['publish']>(),
  snapshot = makeSnapshot(4),
  currentAccount = account as AdminAccount | null,
  draft = draftWithChanges,
  basePayload,
  refreshLatest,
  validation = emptyValidation,
  onMergeConflict = vi.fn(),
  onPublished = vi.fn(),
}: {
  publish?: PublishedContentContextValue['publish'];
  snapshot?: PublishedContentSnapshot | null;
  currentAccount?: AdminAccount | null;
  draft?: PublishedContentPayload;
  basePayload?: PublishedContentPayload;
  refreshLatest?: () => Promise<PublishedContentSnapshot | null>;
  validation?: DashboardValidationResult;
  onMergeConflict?: (snapshot: PublishedContentSnapshot) => void;
  onPublished?: (next: PublishedContentSnapshot) => void;
} = {}) {
  const publishedValue: PublishedContentContextValue = {
    content: baseline,
    snapshot,
    source: 'database',
    status: 'ready',
    loadError: null,
    refresh: vi.fn(),
    refreshLatest,
    publish,
  };
  const authValue: AdminAuthContextValue = {
    status: currentAccount ? 'authenticated' : 'unauthenticated',
    account: currentAccount,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  };

  const ui: ReactElement = (
    <PublishedContentContext.Provider value={publishedValue}>
      <AdminAuthContext.Provider value={authValue}>
        <PublishDashboard
          baseline={baseline}
          draft={draft}
          validation={validation}
          draftUpdatedAt="2026-07-12T00:00:00.000Z"
          basePayload={basePayload}
          onMergeConflict={onMergeConflict}
          onPublished={onPublished}
          onResetDrafts={vi.fn()}
        />
      </AdminAuthContext.Provider>
    </PublishedContentContext.Provider>
  );

  return { ...render(ui), publish, onPublished };
}

describe('PublishDashboard', () => {
  it('shows the complete change summary and current revision', () => {
    renderPublish();

    expect(screen.getByText('Contatos')).toBeInTheDocument();
    expect(screen.getByText('1 adicionado')).toBeInTheDocument();
    expect(screen.getByText(/Revisão atual: 4/)).toBeInTheDocument();
  });

  it('disables publication for validation errors', () => {
    renderPublish({ validation: validationWithError });

    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('disables publication when there are no changes', () => {
    renderPublish({ draft: baseline });

    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('requires an explicit second confirmation action', async () => {
    const user = userEvent.setup();
    const { publish } = renderPublish();

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));

    expect(screen.getByRole('button', { name: 'Confirmar publicação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes the full merged payload with the admin id', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockResolvedValue(makeSnapshot(5));
    const onPublished = vi.fn();
    renderPublish({ publish, onPublished });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith(draftWithChanges, 'admin-id', 4));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(makeSnapshot(5)));
  });

  it('shows pending state and prevents duplicate publication', async () => {
    const user = userEvent.setup();
    let resolvePublish: (value: PublishedContentSnapshot) => void = () => undefined;
    const publish = vi.fn(
      () =>
        new Promise<PublishedContentSnapshot>((resolve) => {
          resolvePublish = resolve;
        }),
    );
    renderPublish({ publish });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    expect(publish).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Confirmar publicação' })).not.toBeInTheDocument();
    expect(screen.getByText('Publicando…')).toBeInTheDocument();

    resolvePublish(makeSnapshot(5));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
  });

  it('reports conflict without calling onPublished', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new PublishedContentRepositoryError('conflict', 'boom'));
    const onPublished = vi.fn();
    renderPublish({ publish, onPublished });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Outra publicação foi salva antes desta. Recarregue o conteúdo publicado antes de tentar novamente.',
    );
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('automatically retries with a merged payload for independent concurrent edits', async () => {
    const user = userEvent.setup();
    const base = { ...baseline, contacts: [contact] };
    const local = { ...base, contacts: [{ ...contact, name: 'Nome local' }] };
    const remote = { ...base, contacts: [{ ...contact, phoneDisplay: '(51) 3111-0000' }] };
    const latestSnapshot = makeSnapshot(5, remote);
    const publishedSnapshot = makeSnapshot(6, {
      ...remote,
      contacts: [{ ...contact, name: 'Nome local', phoneDisplay: '(51) 3111-0000' }],
    });
    const publish = vi
      .fn<PublishedContentContextValue['publish']>()
      .mockRejectedValueOnce(new PublishedContentRepositoryError('conflict', 'conflito'))
      .mockResolvedValueOnce(publishedSnapshot);
    const refreshLatest = vi.fn().mockResolvedValue(latestSnapshot);
    const onPublished = vi.fn();

    renderPublish({
      publish,
      snapshot: makeSnapshot(4, base),
      draft: local,
      basePayload: base,
      refreshLatest,
      onPublished,
    });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(publishedSnapshot));
    expect(refreshLatest).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(2, publishedSnapshot.payload, 'admin-id', 5);
  });

  it('keeps the draft and identifies overlapping concurrent edits', async () => {
    const user = userEvent.setup();
    const base = { ...baseline, contacts: [contact] };
    const local = { ...base, contacts: [{ ...contact, name: 'Nome local' }] };
    const remote = { ...base, contacts: [{ ...contact, name: 'Nome remoto' }] };
    const latestSnapshot = makeSnapshot(5, remote);
    const publish = vi
      .fn<PublishedContentContextValue['publish']>()
      .mockRejectedValue(new PublishedContentRepositoryError('conflict', 'conflito'));
    const refreshLatest = vi.fn().mockResolvedValue(latestSnapshot);
    const onMergeConflict = vi.fn();
    const onPublished = vi.fn();

    renderPublish({
      publish,
      snapshot: makeSnapshot(4, base),
      draft: local,
      basePayload: base,
      refreshLatest,
      onMergeConflict,
      onPublished,
    });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('contacts[contact-one].name');
    expect(onMergeConflict).toHaveBeenCalledWith(latestSnapshot);
    expect(onPublished).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('reports real-auth requirement for unauthorized publication', async () => {
    const user = userEvent.setup();
    const publish = vi.fn();
    renderPublish({ publish, currentAccount: null });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Entre com uma conta administrativa real para publicar.');
    expect(publish).not.toHaveBeenCalled();
  });

  it('maps an unauthorized repository error to the real-auth message', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new PublishedContentRepositoryError('unauthorized', 'boom'));
    renderPublish({ publish });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Entre com uma conta administrativa real para publicar.');
  });

  it('reports configuration failures safely', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new PublishedContentRepositoryError('not_configured', 'secret detail'));
    renderPublish({ publish });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A conexão pública com o Neon não está configurada.');
    expect(alert).not.toHaveTextContent('secret detail');
  });

  it('reports generic failures safely without leaking error text', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new Error('neon secret leak'));
    renderPublish({ publish });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível publicar agora. Tente novamente.');
    expect(alert).not.toHaveTextContent('neon secret leak');
  });

  it('calls onPublished only after repository success', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockResolvedValue(makeSnapshot(6));
    const onPublished = vi.fn();
    renderPublish({ publish, onPublished });

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    expect(onPublished).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(makeSnapshot(6)));
  });
});

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
  city: '',
  state: '',
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
  onOpenValidationArea = vi.fn(),
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
  onOpenValidationArea?: (area: import('../../validation/validationTypes').DashboardValidationArea) => void;
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
          onOpenValidationArea={onOpenValidationArea}
        />
      </AdminAuthContext.Provider>
    </PublishedContentContext.Provider>
  );

  return { ...render(ui), publish, onPublished, onOpenValidationArea };
}

describe('PublishDashboard', () => {
  async function prepare(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    await screen.findByRole('heading', { name: 'Revisão final' });
  }
  async function review(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Confirmar revisão do resultado' }));
    await screen.findByRole('button', { name: 'Confirmar publicação' });
  }
  it('shows all local changes and blocks invalid content', () => {
    renderPublish({ validation: validationWithError });
    expect(screen.getByRole('heading', { name: 'Alterações do seu rascunho (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });
  it('requires review of the exact combined candidate before sending', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockResolvedValue(makeSnapshot(5, draftWithChanges));
    const { onPublished } = renderPublish({ publish });
    await prepare(user);
    expect(publish).not.toHaveBeenCalled();
    await review(user);
    expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(makeSnapshot(5, draftWithChanges)));
    expect(publish).toHaveBeenCalledWith(draftWithChanges, account.id, 4);
  });
  it('prepares independent concurrent changes without automatically publishing', async () => {
    const user = userEvent.setup();
    const remote = { ...baseline, defaultGroupOrder: 2 };
    const publish = vi.fn().mockResolvedValue(makeSnapshot(6));
    renderPublish({
      publish,
      basePayload: baseline,
      refreshLatest: vi.fn().mockResolvedValue(makeSnapshot(5, remote)),
    });
    await prepare(user);
    expect(publish).not.toHaveBeenCalled();
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    expect(publish).toHaveBeenCalledWith({ ...draftWithChanges, defaultGroupOrder: 2 }, account.id, 5);
  });
  it('resolves and undoes a field conflict without resetting the draft', async () => {
    const user = userEvent.setup();
    const b = { ...baseline, contacts: [contact] };
    const local = { ...b, contacts: [{ ...contact, name: 'Minha alteração' }] };
    const remote = { ...b, contacts: [{ ...contact, name: 'Alteração publicada' }] };
    const publish = vi.fn().mockResolvedValue(makeSnapshot(6, local));
    const onMergeConflict = vi.fn();
    renderPublish({
      publish,
      basePayload: b,
      draft: local,
      onMergeConflict,
      refreshLatest: vi.fn().mockResolvedValue(makeSnapshot(5, remote)),
    });
    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));
    expect(await screen.findByText('1 conflitos pendentes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Contatos \/ contact-one \/ Nome/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Alterações já publicadas/ })).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
    expect(onMergeConflict).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Usar minha alteração' }));
    expect(await screen.findByText('0 conflitos pendentes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer escolha' }));
    expect(await screen.findByText('1 conflitos pendentes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usar minha alteração' }));
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    expect(publish).toHaveBeenCalledWith(local, account.id, 5);
  });
  it('does not blindly retry when the remote advances after review', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new PublishedContentRepositoryError('conflict', 'private detail'));
    const refreshLatest = vi
      .fn()
      .mockResolvedValueOnce(makeSnapshot(4))
      .mockResolvedValueOnce(makeSnapshot(5, { ...baseline, defaultGroupOrder: 2 }));
    renderPublish({ publish, refreshLatest });
    await prepare(user);
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    expect(await screen.findByText(/Há uma nova publicação/)).toBeInTheDocument();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Confirmar publicação' })).not.toBeInTheDocument();
  });
  it('blocks confirmation without real authentication', async () => {
    const user = userEvent.setup();
    const { publish } = renderPublish({ currentAccount: null });
    await prepare(user);
    await review(user);
    expect(screen.getByRole('button', { name: 'Confirmar publicação' })).toBeDisabled();
    expect(publish).not.toHaveBeenCalled();
  });
  it('preserves export and does not leak comparison errors', () => {
    const invalid = { ...draftWithChanges, contacts: [contact, contact] };
    renderPublish({ draft: invalid });
    expect(screen.getByRole('alert')).toHaveTextContent('Seu rascunho não foi descartado');
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });
  it('reports uncertain results safely and prevents duplicate sends', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockRejectedValue(new Error('secret database stack'));
    renderPublish({ publish });
    await prepare(user);
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível confirmar o resultado');
    expect(alert).not.toHaveTextContent('secret');
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

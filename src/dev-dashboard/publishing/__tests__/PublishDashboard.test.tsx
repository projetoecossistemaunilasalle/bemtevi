import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import type { DashboardValidationResult } from '../../validation/validationTypes';
import { PublishDashboard, type PublishDashboardProps } from '../PublishDashboard';
import type { PublicationPreview } from '../usePublicationController';

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
  defaultGroupOrder: 1,
};

const emptyValidation: DashboardValidationResult = { errors: [], warnings: [] };

const validationWithError: DashboardValidationResult = {
  errors: [{ level: 'error', area: 'contacts', id: 'e1', message: 'Erro impeditivo.' }],
  warnings: [],
};

function renderPublish(overrides: Partial<PublishDashboardProps> = {}) {
  const callbacks = {
    onOpenReview: vi.fn(),
    onPublish: vi.fn(),
    onCloseReview: vi.fn(),
  };
  const props: PublishDashboardProps = {
    baseline,
    draft: draftWithChanges,
    validation: emptyValidation,
    phase: 'editing',
    message: null,
    preview: null,
    busy: false,
    disabled: false,
    readOnly: false,
    ...callbacks,
    ...overrides,
  };
  return { ...render(<PublishDashboard {...props} />), ...callbacks };
}

describe('PublishDashboard', () => {
  it('shows the V2 diff and blocks invalid content', () => {
    renderPublish({ validation: validationWithError });

    expect(screen.getByRole('heading', { name: 'Alterações do seu rascunho (1)' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ainda não é possível publicar');
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('requests the guarded review through the controller callback', async () => {
    const user = userEvent.setup();
    const { onOpenReview } = renderPublish();

    await user.click(screen.getByRole('button', { name: 'Publicar alterações' }));

    expect(onOpenReview).toHaveBeenCalledOnce();
  });

  it('keeps review and publication actions disabled in read-only mode', () => {
    renderPublish({ readOnly: true });

    expect(screen.getByRole('status')).toHaveTextContent('temporariamente desativadas');
    expect(screen.getByRole('button', { name: 'Publicar alterações' })).toBeDisabled();
  });

  it('renders the exact controller preview and forwards review actions', async () => {
    const user = userEvent.setup();
    const { onPublish, onCloseReview } = renderPublish({
      preview: {
        draft: { generation: 7 } as PublicationPreview['draft'],
        liveRevision: 4,
        candidate: draftWithChanges,
      },
    });

    expect(screen.getByRole('heading', { name: 'Revisão final antes de publicar' })).toBeInTheDocument();
    expect(screen.getByText(/Geração do rascunho: 7/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Encerrar revisão' }));

    expect(onPublish).toHaveBeenCalledOnce();
    expect(onCloseReview).toHaveBeenCalledOnce();
  });

  it('renders controller errors and successful publication state without leaking details', () => {
    const { rerender } = renderPublish({ phase: 'error', message: 'Não foi possível publicar.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível publicar.');

    rerender(
      <PublishDashboard
        {...{
          baseline,
          draft: draftWithChanges,
          validation: emptyValidation,
          phase: 'success',
          message: null,
          preview: null,
          busy: false,
          disabled: false,
          readOnly: false,
          onOpenReview: vi.fn(),
          onPublish: vi.fn(),
          onCloseReview: vi.fn(),
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('O conteúdo está publicado.');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import type { ContentDraft } from '../../draft-sync/contentDraft';
import { McpDraftSection } from '../McpDraftSection';

const payload: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    schemaVersion: 1,
    draftId: 'draft-123',
    generation: 2,
    base: { revision: 8, digest: 'base', payload },
    candidate: payload,
    candidateDigest: 'candidate',
    validation: { valid: true, issues: [] },
    createdAt: '2026-09-09T12:00:00.000Z',
    updatedAt: '2026-09-09T12:01:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('McpDraftSection', () => {
  it('lista gerações locais e abre uma geração sem alterar outra cópia', async () => {
    const remote = makeDraft();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ drafts: [remote], nextCursor: null }))),
    );
    const onOpen = vi.fn();
    sessionStorage.setItem('bemtevi:draft-sync:token', 'secret');

    render(<McpDraftSection candidate={payload} activeDraft={null} onOpen={onOpen} onSynced={vi.fn()} />);

    expect(await screen.findByText('draft-123')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir geração' }));

    expect(onOpen).toHaveBeenCalledWith(remote);
  });

  it('envia a geração esperada e preserva o rascunho quando o servidor acusa conflito', async () => {
    const remote = makeDraft();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ drafts: [remote], nextCursor: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'stale_generation' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchImpl);
    sessionStorage.setItem('bemtevi:draft-sync:token', 'secret');
    const onSynced = vi.fn();

    render(<McpDraftSection candidate={payload} activeDraft={remote} onOpen={vi.fn()} onSynced={onSynced} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sincronizar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/geração mais recente/i);
    expect(onSynced).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({ body: expect.stringContaining('"expectedGeneration":2') }),
      );
    });
  });

  it('reabre a geração vinculada ao workspace em vez de adotar silenciosamente a mais nova', async () => {
    const latest = makeDraft({ generation: 3 });
    const checkpoint = makeDraft({ generation: 2 });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ drafts: [latest], nextCursor: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify(checkpoint)));
    vi.stubGlobal('fetch', fetchImpl);
    sessionStorage.setItem('bemtevi:draft-sync:token', 'secret');
    const onAttach = vi.fn();

    render(
      <McpDraftSection
        candidate={payload}
        activeDraft={null}
        activeDraftId={checkpoint.draftId}
        activeDraftGeneration={checkpoint.generation}
        onOpen={vi.fn()}
        onAttach={onAttach}
        onSynced={vi.fn()}
      />,
    );

    await waitFor(() => expect(onAttach).toHaveBeenCalledWith(checkpoint));
    expect(fetchImpl.mock.calls[1]?.[0]).toContain(`/v1/drafts/${checkpoint.draftId}?generation=2`);
  });

  it('sincroniza rascunhos inválidos para permitir recuperação sem habilitar publicação', async () => {
    const remote = makeDraft();
    const invalid = makeDraft({
      generation: 3,
      validation: { valid: false, issues: [{ level: 'error', message: 'Conteúdo incompleto.' }] },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ drafts: [remote], nextCursor: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify(invalid)));
    vi.stubGlobal('fetch', fetchImpl);
    sessionStorage.setItem('bemtevi:draft-sync:token', 'secret');
    const onSynced = vi.fn();

    render(<McpDraftSection candidate={payload} activeDraft={remote} onOpen={vi.fn()} onSynced={onSynced} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sincronizar alterações' }));
    await waitFor(() => expect(onSynced).toHaveBeenCalledWith(invalid));
  });
});

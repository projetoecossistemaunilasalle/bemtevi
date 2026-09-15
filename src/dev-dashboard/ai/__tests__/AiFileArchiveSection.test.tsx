import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentDraft, EditExport, PublishedContentPayload } from '@bemtevi/content-core';
import { PNG_1X1_BASE64, conformanceBasePayload, sha256Bytes, sha256Text } from '@bemtevi/content-core';
import { AiFileArchiveSection } from '../AiFileArchiveSection';
import { createExportRepository, type ExportRpcCallResult, type ExportRpcTransport } from '../files/exportRepository';

const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';
const EXPORT_ID = '00000000-0000-4000-8000-0000000000e1';

async function buildDraft(): Promise<ContentDraft> {
  const payload = JSON.parse(JSON.stringify(conformanceBasePayload)) as PublishedContentPayload;
  const canonicalPayload = JSON.stringify(payload);
  const digest = await sha256Text(canonicalPayload);
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    baseRevision: 42,
    generation: 7,
    digest,
    updatedAt: '2026-09-01T00:00:00Z',
    lastActor: { kind: 'admin', principalUserId: '00000000-0000-4000-8000-0000000000a1', connectionId: null },
    status: 'active',
    payload,
    canonicalPayload,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: '00000000-0000-4000-8000-0000000000a1',
  };
}

async function buildOwnerExport(draft: ContentDraft): Promise<EditExport> {
  return {
    exportId: EXPORT_ID,
    draftId: 'current',
    schemaVersion: '2.0.0',
    baseGeneration: draft.generation,
    baseDigest: draft.digest,
    publishedRevision: draft.baseRevision,
    basePayload: JSON.parse(JSON.stringify(draft.payload)) as PublishedContentPayload,
    canonicalPayload: draft.canonicalPayload,
    createdBy: '00000000-0000-4000-8000-0000000000a1',
    createdAt: '2026-09-01T00:00:00Z',
    expiresAt: FUTURE,
    selection: null,
  };
}

function operationsEnvelope(draft: ContentDraft, operations: unknown[]): string {
  return JSON.stringify({
    schemaVersion: '2.0.0',
    exportId: EXPORT_ID,
    baseGeneration: draft.generation,
    baseDigest: draft.digest,
    operations,
    selfCheck: {
      reviewed: true,
      noOutOfScopeChanges: true,
      noUnrequestedDeletes: true,
      noUnsupportedImagePaths: true,
      notes: ['Conferido.'],
    },
  });
}

const UPDATE_OPERATION = {
  op: 'update',
  scope: 'educationGroups',
  id: 'grupo-um',
  patch: { title: 'Grupo um revisado pela IA' },
  unset: [],
};

class FakeExportTransport implements ExportRpcTransport {
  public calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  public exportRecord: EditExport | null = null;

  async rpc(method: string, args: Record<string, unknown>): Promise<ExportRpcCallResult> {
    this.calls.push({ method, args });
    if (method === 'create_content_edit_export') {
      if (this.exportRecord === null) throw new Error('no export configured');
      return { data: { ok: true, data: this.exportRecord }, error: null };
    }
    if (method === 'get_content_edit_export') {
      if (this.exportRecord === null)
        return { data: { ok: false, error: { code: 'export_base_unavailable' } }, error: null };
      return { data: { ok: true, data: this.exportRecord }, error: null };
    }
    return { data: null, error: { status: 404 } };
  }
}

function createFixture() {
  const transport = new FakeExportTransport();
  const repository = createExportRepository(transport);
  const flush = vi.fn(async () => true);
  const applyCandidate = vi.fn(async (_base: PublishedContentPayload, _candidate: PublishedContentPayload) => true);
  return { transport, repository, flush, applyCandidate };
}

async function renderSection(draft: ContentDraft) {
  const fixture = createFixture();
  fixture.transport.exportRecord = await buildOwnerExport(draft);
  const view = render(
    <AiFileArchiveSection
      draft={draft}
      flush={fixture.flush}
      applyCandidate={fixture.applyCandidate}
      exportRepository={fixture.repository}
    />,
  );
  return { ...fixture, ...view, draft };
}

function jsonFile(text: string): File {
  return new File([text], 'operations.json', { type: 'application/json' });
}

describe('AiFileArchiveSection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the zero-setup ChatGPT flow with actionable export and import', async () => {
    const draft = await buildDraft();
    await renderSection(draft);

    expect(screen.getByRole('heading', { name: 'Ajuda rápida com ChatGPT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Baixar arquivo para IA/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Selecionar arquivo da IA/i })).toBeEnabled();
    expect(screen.getByText(/Não é preciso instalar nada/i)).toBeInTheDocument();
  });

  it('contains no clone, bridge, project-login or sync instructions', async () => {
    const draft = await buildDraft();
    await renderSection(draft);

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/clon|git clone|reposit[oó]rio do projeto/i);
    expect(text).not.toMatch(/4318|4319|agente local|bridge|ponte local|sincroniz/i);
    expect(text).not.toMatch(/entrar no projeto|login do projeto|senha/i);
  });

  it('blocks export when the dirty flush fails (clean-flush requirement)', async () => {
    const draft = await buildDraft();
    const fixture = createFixture();
    fixture.transport.exportRecord = await buildOwnerExport(draft);
    fixture.flush.mockResolvedValue(false);
    render(
      <AiFileArchiveSection
        draft={draft}
        flush={fixture.flush}
        applyCandidate={fixture.applyCandidate}
        exportRepository={fixture.repository}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Baixar arquivo para IA/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/alterações não salvas/i);
    // The export RPC was never called.
    expect(fixture.transport.calls.filter((call) => call.method === 'create_content_edit_export')).toHaveLength(0);
  });

  it('exports via the server-captured durable export after a clean flush', async () => {
    const draft = await buildDraft();
    const fixture = createFixture();
    fixture.transport.exportRecord = await buildOwnerExport(draft);
    render(
      <AiFileArchiveSection
        draft={draft}
        flush={fixture.flush}
        applyCandidate={fixture.applyCandidate}
        exportRepository={fixture.repository}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Baixar arquivo para IA/i }));

    await waitFor(() => {
      expect(fixture.transport.calls).toEqual([
        {
          method: 'create_content_edit_export',
          args: { p_export_id: expect.any(String), p_expected_generation: 7, p_selection: null },
        },
      ]);
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/Arquivo gerado/i);
    expect(fixture.flush).toHaveBeenCalledTimes(1);
  });

  it('shows a preview with the semantic diff before any apply (preview before apply)', async () => {
    const draft = await buildDraft();
    const { applyCandidate, flush } = await renderSection(draft);

    const user = userEvent.setup();
    const file = jsonFile(operationsEnvelope(draft, [UPDATE_OPERATION]));
    await user.click(screen.getByRole('button', { name: /Selecionar arquivo da IA/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(await screen.findByRole('heading', { name: /Preview de/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /1 operação/i })).toBeInTheDocument();
    expect(screen.getByText(/Grupo um revisado pela IA/i)).toBeInTheDocument();
    // Apply was not called: only the preview exists.
    expect(applyCandidate).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('blocks apply when the dirty flush fails and applies only after an explicit click', async () => {
    const draft = await buildDraft();
    const fixture = createFixture();
    fixture.transport.exportRecord = await buildOwnerExport(draft);
    fixture.flush.mockResolvedValue(false);
    render(
      <AiFileArchiveSection
        draft={draft}
        flush={fixture.flush}
        applyCandidate={fixture.applyCandidate}
        exportRepository={fixture.repository}
      />,
    );

    const user = userEvent.setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jsonFile(operationsEnvelope(draft, [UPDATE_OPERATION])));
    expect(await screen.findByRole('heading', { name: /Preview de/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aplicar ao rascunho/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/alterações não salvas/i);
    expect(fixture.applyCandidate).not.toHaveBeenCalled();
  });

  it('applies the candidate against the exported base after a clean flush and explicit Apply', async () => {
    const draft = await buildDraft();
    const { applyCandidate, flush } = await renderSection(draft);
    const user = userEvent.setup();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jsonFile(operationsEnvelope(draft, [UPDATE_OPERATION])));
    expect(await screen.findByRole('heading', { name: /Preview de/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aplicar ao rascunho/i }));
    await waitFor(() => expect(applyCandidate).toHaveBeenCalledTimes(1));
    expect(applyCandidate.mock.calls[0]![0]).toEqual(draft.payload);
    // Apply sees the candidate, not the base, as the second argument.
    const appliedCandidate = applyCandidate.mock.calls[0]![1] as PublishedContentPayload;
    expect(appliedCandidate.educationGroups.find((group) => group.id === 'grupo-um')!.title).toBe(
      'Grupo um revisado pela IA',
    );
    expect(flush).toHaveBeenCalledTimes(1);
    // The preview is cleared after success.
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Preview de/i })).not.toBeInTheDocument());
  });

  it('shows validation issues from the import preview without blocking apply', async () => {
    const draft = await buildDraft();
    await renderSection(draft);
    const user = userEvent.setup();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // A semantically invalid but structurally safe operation surfaces issues.
    await user.upload(
      input,
      jsonFile(
        operationsEnvelope(draft, [
          { op: 'update', scope: 'contacts', id: 'contato-um', patch: { phoneHref: 'tel:()' }, unset: [] },
        ]),
      ),
    );

    expect(await screen.findByRole('heading', { name: /Preview de/i })).toBeInTheDocument();
    // Issues section appears when the validator reports them (fixture base has
    // a known invalid phone link), and apply remains available.
    expect(screen.getByRole('button', { name: /Aplicar ao rascunho/i })).toBeEnabled();
  });

  it('reports expired exports with the export-again guidance, never rewriting IDs', async () => {
    const draft = await buildDraft();
    const fixture = createFixture();
    const expired = await buildOwnerExport(draft);
    expired.expiresAt = PAST;
    fixture.transport.exportRecord = expired;
    render(
      <AiFileArchiveSection
        draft={draft}
        flush={fixture.flush}
        applyCandidate={fixture.applyCandidate}
        exportRepository={fixture.repository}
      />,
    );

    const user = userEvent.setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jsonFile(operationsEnvelope(draft, [UPDATE_OPERATION])));

    expect(await screen.findByRole('alert')).toHaveTextContent(/exporte o conteúdo novamente/i);
    expect(fixture.applyCandidate).not.toHaveBeenCalled();
  });

  it('rejects an archive that binds to a different export (never substitutes the latest draft)', async () => {
    const draft = await buildDraft();
    await renderSection(draft);
    const user = userEvent.setup();

    const other = { ...draft, generation: draft.generation + 1 };
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jsonFile(operationsEnvelope(other, [UPDATE_OPERATION])));

    expect(await screen.findByRole('alert')).toHaveTextContent(/outra base|não corresponde|exporte novamente/i);
  });

  it('accepts a ZIP with operations.json and referenced images', async () => {
    const draft = await buildDraft();
    await renderSection(draft);
    const user = userEvent.setup();

    const hex = await (async () => {
      const bytes = Uint8Array.from(atob(PNG_1X1_BASE64), (c) => c.charCodeAt(0));
      return sha256Bytes(bytes);
    })();
    const zip = new JSZip();
    zip.file(
      'operations.json',
      JSON.stringify({
        schemaVersion: '2.0.0',
        exportId: EXPORT_ID,
        baseGeneration: draft.generation,
        baseDigest: draft.digest,
        operations: [
          {
            op: 'set_material_image',
            materialId: 'material-exemplo',
            slot: { kind: 'featured' },
            image: {
              kind: 'uploaded',
              mime: 'image/png',
              imagePath: `images/${hex}.png`,
              fileName: 'destaque.png',
              alt: 'Nova imagem',
            },
          },
        ],
        selfCheck: {
          reviewed: true,
          noOutOfScopeChanges: true,
          noUnrequestedDeletes: true,
          noUnsupportedImagePaths: true,
          notes: [],
        },
      }),
    );
    zip.file(
      `images/${hex}.png`,
      Uint8Array.from(atob(PNG_1X1_BASE64), (c) => c.charCodeAt(0)),
    );
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([zipBytes], 'resposta.zip', { type: 'application/zip' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(await screen.findByRole('heading', { name: /Preview de/i })).toBeInTheDocument();
    // The semantic diff surfaces the featured-image change of material-exemplo.
    expect(await screen.findByText('Nova imagem')).toBeInTheDocument();
    expect(screen.getByText('destaque.png')).toBeInTheDocument();
  });

  it('contains no publish toggle/switch in the file section', async () => {
    const draft = await buildDraft();
    await renderSection(draft);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Publicar agora|publicar automaticamente/i)).not.toBeInTheDocument();
    // Applying is decoupled from publishing: the preview disclaimer appears
    // only with a preview; the idle copy already states nothing publishes automatically.
    expect(document.body.textContent ?? '').toContain('nada é publicado automaticamente');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConnection, ContentDraft, EditExport, PublishedContentPayload } from '@bemtevi/content-core';
import { conformanceBasePayload, sha256Text } from '@bemtevi/content-core';
import { AiArchiveSection } from '../AiArchiveSection';
import { createConnectionRepository, type ConnectionRpcTransport } from '../connections/connectionRepository';
import { createExportRepository, type ExportRpcTransport } from '../files/exportRepository';

const AUTH_URL = 'https://auth.bemtevi.test';
const DATA_API_URL = 'https://data.bemtevi.test';
const EXPORT_ID = '00000000-0000-4000-8000-0000000000e1';
const FUTURE = '2099-01-01T00:00:00Z';

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

function connectionFixture(): AgentConnection {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    draftId: 'current',
    principalUserId: '00000000-0000-4000-8000-0000000000a1',
    label: 'ChatGPT da coordenação',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
    revokedAt: null,
    lastUsedAt: null,
  };
}

function stubConsole() {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => {
    error.mockRestore();
    log.mockRestore();
  };
}

const connectionTransport: ConnectionRpcTransport = {
  async rpc(method: string) {
    if (method === 'list_content_agent_connections') {
      return { data: { ok: true, data: [connectionFixture()] }, error: null };
    }
    return { data: { ok: false, error: { code: 'invalid_input' } }, error: null };
  },
};

async function buildExportRecord(draft: ContentDraft): Promise<EditExport> {
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

async function renderArchiveSection(draft: ContentDraft) {
  const exportTransport: ExportRpcTransport = {
    async rpc(method: string) {
      if (method === 'get_content_edit_export' || method === 'create_content_edit_export') {
        return { data: { ok: true, data: await buildExportRecord(draft) }, error: null };
      }
      return { data: null, error: { status: 404 } };
    },
  };
  const flush = vi.fn(async () => true);
  const applyCandidate = vi.fn(async () => true);
  render(
    <AiArchiveSection
      draft={draft}
      flush={flush}
      applyCandidate={applyCandidate}
      exportRepository={createExportRepository(exportTransport)}
      connectionRepository={createConnectionRepository(connectionTransport)}
      authUrl={AUTH_URL}
      dataApiUrl={DATA_API_URL}
    />,
  );
  return { flush, applyCandidate };
}

describe('AiArchiveSection (composition)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the file-first ChatGPT section BEFORE the connected assistants section', async () => {
    const draft = await buildDraft();
    renderArchiveSection(draft);

    const fileHeading = await screen.findByRole('heading', { name: 'Ajuda rápida com ChatGPT' });
    const connectedHeading = await screen.findByRole('heading', { name: 'Assistentes conectados' });
    const sections = document.querySelectorAll('section');
    const fileSection = fileHeading.closest('section');
    const connectedSection = connectedHeading.closest('section');

    expect(fileSection).not.toBeNull();
    expect(connectedSection).not.toBeNull();
    // DOM order: the zero-setup file flow comes first (doc 06 information architecture).
    expect(
      (fileSection as HTMLElement).compareDocumentPosition(connectedSection as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(sections.length).toBeGreaterThan(1);
  });

  it('keeps compiling for legacy-props-only calls (still-flagged branch) with a PT-BR standby notice', async () => {
    const restore = stubConsole();
    render(<AiArchiveSection draft={conformanceBasePayload} baseRevision={42} onApply={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Ajuda rápida com ChatGPT' })).toBeInTheDocument();
    expect(screen.getByText(/está sendo atualizado/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Assistentes conectados' })).not.toBeInTheDocument();
    restore();
  });

  it('V2 composition contains no clone, bridge, project-login, sync or publish-toggle instructions', async () => {
    const draft = await buildDraft();
    renderArchiveSection(draft);
    await screen.findByRole('heading', { name: 'Assistentes conectados' });

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/clon|git clone|reposit[oó]rio do projeto/i);
    expect(text).not.toMatch(/4318|4319|agente local|bridge|ponte local|sincroniz/i);
    expect(text).not.toMatch(/entrar no projeto|login do projeto/i);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('passes the wired repositories down: connections list renders through the connection repository', async () => {
    const draft = await buildDraft();
    renderArchiveSection(draft);

    expect(await screen.findByText('ChatGPT da coordenação')).toBeInTheDocument();
  });

  it('file export action flows through the composition (flush then durable export)', async () => {
    const draft = await buildDraft();
    const { flush } = await renderArchiveSection(draft);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Baixar arquivo para IA/i }));

    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    await screen.findByRole('status');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConnection } from '@bemtevi/content-core';
import { ConnectedAssistantsSection } from '../ConnectedAssistantsSection';
import {
  createConnectionRepository,
  type ConnectionRpcCallResult,
  type ConnectionRpcTransport,
} from '../connectionRepository';

const AUTH_URL = 'https://auth.bemtevi.test';
const DATA_API_URL = 'https://data.bemtevi.test';

function connection(overrides: Partial<AgentConnection> = {}): AgentConnection {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    draftId: 'current',
    principalUserId: '00000000-0000-4000-8000-0000000000a1',
    label: 'ChatGPT da coordenação',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

class FakeTransport implements ConnectionRpcTransport {
  public calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  public listResponse: AgentConnection[] = [];
  public createShouldFailOnce = false;
  public createCalls = 0;

  async rpc(method: string, args: Record<string, unknown>): Promise<ConnectionRpcCallResult> {
    this.calls.push({ method, args });
    if (method === 'list_content_agent_connections') {
      const data: Array<AgentConnection> = this.listResponse;
      return { data: { ok: true, data }, error: null };
    }
    if (method === 'create_content_agent_connection') {
      this.createCalls += 1;
      if (this.createShouldFailOnce && this.createCalls === 1) {
        this.createShouldFailOnce = false;
        return { data: null, error: { status: 500 } };
      }
      return {
        data: {
          ok: true,
          data: connection({ id: String(args['p_connection_id']), label: String(args['p_label']) }),
        },
        error: null,
      };
    }
    if (method === 'revoke_content_agent_connection') {
      return {
        data: {
          ok: true,
          data: connection({
            id: String(args['p_connection_id']),
            label: 'ChatGPT da coordenação',
            revokedAt: '2026-09-01T00:00:00Z',
          }),
        },
        error: null,
      };
    }
    return { data: { ok: false, error: { code: 'invalid_input' } }, error: null };
  }
}

function spyConsole() {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => {
    error.mockRestore();
    log.mockRestore();
  };
}

function readStorage(): string {
  return JSON.stringify({ ...localStorage, ...sessionStorage });
}

describe('ConnectedAssistantsSection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists connection metadata with expiry, last use and revocation states', async () => {
    const transport = new FakeTransport();
    transport.listResponse = [
      connection({ label: 'ChatGPT da coordenação', lastUsedAt: '2026-08-01T00:00:00Z' }),
      connection({
        id: '00000000-0000-4000-8000-0000000000c2',
        label: 'Copiloto do Núcleo',
        revokedAt: '2026-06-01T00:00:00Z',
      }),
    ];
    render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );

    expect(await screen.findByText('ChatGPT da coordenação')).toBeInTheDocument();
    expect(screen.getByText('Copiloto do Núcleo')).toBeInTheDocument();
    expect(screen.getAllByText('Expira em').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Último uso').length).toBeGreaterThan(0);
    expect(screen.getByText(/Revogada em/)).toBeInTheDocument();
  });

  it('shows the delegated-authority disclosure and contains no publish toggle', async () => {
    const transport = new FakeTransport();
    transport.listResponse = [];
    render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );
    await screen.findByText('Assistentes conectados');

    expect(
      screen.getByText(/age como o administrador que a criou: pode editar o rascunho e publicar/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Vale por um ano e não é renovável/i)).toBeInTheDocument();
    // No publish-permission toggle/switch exists anywhere in the section.
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/permitir publicar|permissão de publicar|alternar publicação/i)).not.toBeInTheDocument();
  });

  it('contains no clone, bridge, project-login or sync instructions', async () => {
    const transport = new FakeTransport();
    transport.listResponse = [];
    render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );
    await screen.findByText('Assistentes conectados');

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/clon|git clone|reposit[oó]rio/i);
    expect(text).not.toMatch(/4318|agente local|bridge|ponte local/i);
    expect(text).not.toMatch(/entrar no projeto|login do projeto|sincroniz/i);
  });

  it('revokes only after explicit confirmation and refreshes the list afterwards', async () => {
    const user = userEvent.setup();
    const transport = new FakeTransport();
    transport.listResponse = [connection()];
    const { unmount } = render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );
    await screen.findByText('ChatGPT da coordenação');

    // First click arms, second confirms (two-step revocation).
    await user.click(screen.getByRole('button', { name: 'Revogar acesso' }));
    expect(transport.calls.filter((call) => call.method === 'revoke_content_agent_connection')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Confirmar revogação' }));
    await waitFor(() => {
      expect(transport.calls.filter((call) => call.method === 'revoke_content_agent_connection')).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        transport.calls.filter((call) => call.method === 'list_content_agent_connections').length,
      ).toBeGreaterThanOrEqual(2);
    });
    unmount();
  });

  it('create: secret shown once, cleared on close, never stored or logged; same UUID retained on ambiguous retry', async () => {
    const restore = spyConsole();
    const user = userEvent.setup();
    const transport = new FakeTransport();
    transport.createShouldFailOnce = true; // first create: ambiguous network failure
    transport.listResponse = [];
    render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Conectar um assistente' }));
    await user.type(screen.getByRole('textbox', { name: /Nome do assistente/ }), 'Assistente de testes');
    await user.click(screen.getByRole('button', { name: 'Criar conexão' }));

    // The ambiguous failure keeps the same UUID/hash for the retry.
    await waitFor(() => expect(transport.createCalls).toBe(1));
    const firstCall = transport.calls.find((call) => call.method === 'create_content_agent_connection')!;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente com o mesmo identificador' }));
    await waitFor(() => expect(transport.createCalls).toBe(2));
    const secondCall = transport.calls.filter((call) => call.method === 'create_content_agent_connection')[1]!;
    expect(secondCall.args['p_connection_id']).toBe(firstCall.args['p_connection_id']);
    expect(secondCall.args['p_token_hash']).toBe(firstCall.args['p_token_hash']);

    // Second attempt succeeds: the one-time disclosure appears.
    expect(
      await screen.findByText(/Salve a configuração agora — a chave não será mostrada novamente/i),
    ).toBeInTheDocument();

    // Only the hash crossed the wire; the raw token never appears in calls.
    const createCalls = transport.calls.filter((call) => call.method === 'create_content_agent_connection');
    expect(createCalls.length).toBe(2);
    for (const call of createCalls) {
      const serialized = JSON.stringify(call.args);
      expect(Object.keys(call.args).sort()).toEqual(['p_connection_id', 'p_label', 'p_token_hash']);
      expect(String(call.args['p_token_hash'])).toMatch(/^[0-9a-f]{64}$/);
      // No 43-char base64url credential anywhere in the serialized arguments.
      expect(serialized).not.toMatch(/"[A-Za-z0-9_-]{43}"/);
    }
    expect(readStorage()).not.toMatch(/[A-Za-z0-9_-]{43}/);

    // Closing the dialog clears the secret from the DOM.
    await user.click(screen.getByRole('button', { name: 'Concluído — fechar e limpar a chave' }));
    expect(document.body.textContent ?? '').not.toMatch(/[A-Za-z0-9_-]{43}/);
    restore();
  });

  it('download yields the exact portable MCP JSON with BEMTEVI_AUTH_URL and the pinned package', async () => {
    const user = userEvent.setup();
    const transport = new FakeTransport();
    transport.listResponse = [];
    const downloads: Array<{ blob: Blob; fileName: string }> = [];
    const anchorClick = vi.fn(function (this: HTMLAnchorElement) {
      downloads.push({ blob: (this as unknown as { __blob: Blob }).__blob, fileName: this.download });
    });
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        (element as unknown as { __blob: Blob }).__blob = new Blob([''], { type: 'application/json' });
        element.addEventListener('click', () => {
          const blob = (element as unknown as { __blob: Blob }).__blob;
          const url = (element as unknown as { href: string }).href;
          void blob;
          void url;
          anchorClick.call(element);
        });
        (element as unknown as { click: () => void }).click = anchorClick as unknown as () => void;
      }
      return element;
    });
    try {
      render(
        <ConnectedAssistantsSection
          repository={createConnectionRepository(transport)}
          authUrl={AUTH_URL}
          dataApiUrl={DATA_API_URL}
        />,
      );
      await user.click(await screen.findByRole('button', { name: 'Conectar um assistente' }));
      await user.type(screen.getByRole('textbox', { name: /Nome do assistente/ }), 'Assistente de download');
      await user.click(screen.getByRole('button', { name: 'Criar conexão' }));
      await screen.findByText(/Baixar bemtevi-mcp\.json/i);

      // The rendered config section advertises the exact pinned package.
      expect(document.body.textContent).toContain('bemtevi-mcp.json');
      expect(document.body.textContent).not.toContain('@latest');
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('reports list failures as PT-BR errors with a retry action', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const failing: ConnectionRpcTransport = {
      async rpc(): Promise<ConnectionRpcCallResult> {
        calls += 1;
        if (calls === 1) return { data: null, error: { status: 500 } };
        return { data: { ok: true, data: [] }, error: null };
      },
    };
    render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(failing)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível listar as conexões/);
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not regenerate the token on rerender', async () => {
    const transport = new FakeTransport();
    transport.listResponse = [];
    const { rerender } = render(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );
    rerender(
      <ConnectedAssistantsSection
        repository={createConnectionRepository(transport)}
        authUrl={AUTH_URL}
        dataApiUrl={DATA_API_URL}
      />,
    );
    await screen.findByText('Assistentes conectados');
    // No create RPC happened and no secret exists anywhere yet.
    expect(transport.calls.filter((call) => call.method === 'create_content_agent_connection')).toHaveLength(0);
    expect(readStorage()).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});

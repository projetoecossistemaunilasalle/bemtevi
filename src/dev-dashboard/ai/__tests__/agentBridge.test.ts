import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAgentBridgeStatus, normalizeBridgeUrl, pairAgentBridge, runAgent } from '../agentBridge';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('agentBridge', () => {
  it('normaliza o endereço e rejeita protocolos inseguros', () => {
    expect(normalizeBridgeUrl('http://127.0.0.1:4318/')).toBe('http://127.0.0.1:4318');
    expect(() => normalizeBridgeUrl('file:///tmp/bridge')).toThrow(/http/);
  });

  it('pareia e consulta os agentes disponíveis', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'secret' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            connected: true,
            workspace: 'bemtevi',
            providers: [{ id: 'codex', label: 'Codex', available: true }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const token = await pairAgentBridge('http://127.0.0.1:4318', '123456');
    const status = await getAgentBridgeStatus('http://127.0.0.1:4318', token);

    expect(token).toBe('secret');
    expect(status.providers[0]).toMatchObject({ id: 'codex', available: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:4318/v1/status',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }),
    );
  });

  it('consome eventos NDJSON até o resultado final', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"started","provider":"codex"}\n{"type":"pro'));
        controller.enqueue(
          encoder.encode('gress","message":"Analisando"}\n{"type":"result","output":"{\\"flows\\":[]}"}\n'),
        );
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const onEvent = vi.fn();

    const output = await runAgent('http://127.0.0.1:4318', 'secret', 'codex', 'prompt', { onEvent });

    expect(output).toBe('{"flows":[]}');
    expect(onEvent).toHaveBeenCalledWith({ type: 'progress', message: 'Analisando' });
  });
});

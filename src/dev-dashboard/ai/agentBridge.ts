export type AgentProviderId = 'codex' | 'claude' | 'hermes' | 'antigravity';

export interface AgentProviderStatus {
  id: AgentProviderId;
  label: string;
  available: boolean;
}

export interface AgentBridgeStatus {
  connected: true;
  workspace: string;
  providers: AgentProviderStatus[];
}

export type AgentRunEvent =
  | { type: 'started'; provider: AgentProviderId }
  | { type: 'progress'; message: string }
  | { type: 'result'; output: string }
  | { type: 'error'; message: string };

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:4318';

export function normalizeBridgeUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  const url = new URL(normalized || DEFAULT_BRIDGE_URL);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('O endereço da conexão deve começar com http:// ou https://.');
  }
  return url.toString().replace(/\/$/, '');
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `A conexão local respondeu com o código ${response.status}.`;
  } catch {
    return `A conexão local respondeu com o código ${response.status}.`;
  }
}

export async function pairAgentBridge(baseUrl: string, code: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBridgeUrl(baseUrl)}/v1/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
  } catch {
    throw new Error(
      'Não foi possível alcançar a conexão local. Confirme se a janela “BemTeVi - Conexão com assistente de IA” está aberta.',
    );
  }
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error('O serviço local não confirmou a conexão.');
  return body.token;
}

export async function getAgentBridgeStatus(baseUrl: string, token: string): Promise<AgentBridgeStatus> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBridgeUrl(baseUrl)}/v1/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('A conexão local não está respondendo.');
  }
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AgentBridgeStatus;
}

export async function runAgent(
  baseUrl: string,
  token: string,
  provider: AgentProviderId,
  prompt: string,
  options: { signal?: AbortSignal; onEvent?: (event: AgentRunEvent) => void } = {},
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBridgeUrl(baseUrl)}/v1/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, prompt }),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('A conexão local foi interrompida.', { cause: error });
  }
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error('O navegador não conseguiu ler a resposta do agente.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result = '';

  function consumeLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AgentRunEvent;
    options.onEvent?.(event);
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'result') result = event.output;
  }

  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  consumeLine(pending);
  if (!result) throw new Error('O agente encerrou sem devolver o conteúdo editado.');
  return result;
}

export const agentBridgeDefaults = {
  url: DEFAULT_BRIDGE_URL,
  urlStorageKey: 'bemtevi:agent-bridge:url',
  tokenStorageKey: 'bemtevi:agent-bridge:token',
} as const;

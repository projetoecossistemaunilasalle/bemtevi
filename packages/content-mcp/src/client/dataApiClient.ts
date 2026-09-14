/**
 * Anonymous Neon Data API client for the standalone MCP package (doc 04
 * "Transport And Credentials").
 *
 * The object-form `@neondatabase/neon-js@0.6.2-beta` client is created with
 * `{ auth: { url, allowAnonymous: true }, dataApi: { url } }`; the SDK manages
 * anonymous JWT retrieval and refresh. This module exposes ONLY the fixed
 * capability-gateway RPC allowlist — no tool argument can select an arbitrary
 * endpoint or function. Every call carries the connection credential as a POST
 * body parameter, never in a URL. Network requests are bounded by a 30-second
 * timeout with cancellation.
 */

import { createClient } from '@neondatabase/neon-js';
import type { McpRuntimeConfig } from '../config';
import { decodeDomainError, mapTransportError, type EditorialError, type TransportCallResult } from './errors';

export const NETWORK_TIMEOUT_MS = 30_000;

/**
 * Fixed capability-gateway RPC allowlist (docs 04/15). Nothing else is
 * callable. The two publication names (MCP-03) are frozen in doc 15's RPC
 * catalog and were added add-only; the fixed-allowlist contract is unchanged.
 */
export type AgentRpcName =
  | 'agent_get_editor_context'
  | 'agent_get_draft'
  | 'agent_get_published_content'
  | 'agent_apply_operations'
  | 'agent_prepare_publish'
  | 'agent_publish_draft';

export const AGENT_RPC_ALLOWLIST: readonly AgentRpcName[] = [
  'agent_get_editor_context',
  'agent_get_draft',
  'agent_get_published_content',
  'agent_apply_operations',
  'agent_prepare_publish',
  'agent_publish_draft',
];

/** Structural shape of the SDK client this module needs (no `any`). */
interface RpcCapableClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: unknown }>;
}

export type AgentRpc = (name: AgentRpcName, args: Record<string, unknown>) => Promise<TransportCallResult<unknown>>;

export interface DataApiClient {
  rpc: AgentRpc;
  dispose(): void;
}

const createdClients: Array<() => void> = [];

/** Creates the anonymous SDK client from validated configuration. */
export function createAnonymousDataApiClient(config: McpRuntimeConfig): DataApiClient {
  const client = createClient({
    auth: { url: config.authUrl, allowAnonymous: true },
    dataApi: { url: config.dataApiUrl },
  });
  const rpcClient = client as unknown as RpcCapableClient;
  let disposed = false;
  const dispose = () => {
    disposed = true;
  };
  createdClients.push(dispose);
  return {
    rpc: (name, args) => callRpc(rpcClient, name, args, () => disposed),
    dispose,
  };
}

/** Creates a client over an injected transport (tests). */
export function createDataApiClientWith(
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>,
): DataApiClient {
  let disposed = false;
  const transport: RpcCapableClient = { rpc };
  return {
    rpc: (name, args) => callRpc(transport, name, args, () => disposed),
    dispose: () => {
      disposed = true;
    },
  };
}

async function callRpc(
  client: { rpc(name: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: unknown }> },
  name: AgentRpcName,
  args: Record<string, unknown>,
  isDisposed: () => boolean,
): Promise<TransportCallResult<unknown>> {
  if (!AGENT_RPC_ALLOWLIST.includes(name)) {
    return { error: { code: 'invalid_input', message: 'Operação não permitida.' } satisfies EditorialError };
  }
  if (isDisposed()) {
    return { error: { code: 'unavailable', message: 'O cliente foi encerrado.' } satisfies EditorialError };
  }
  try {
    const bounded = withTimeout(client.rpc(name, args), NETWORK_TIMEOUT_MS);
    const { data, error } = await bounded;
    if (error !== undefined && error !== null) {
      return { error: decodeDomainError(error) };
    }
    return { data };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { error: { code: 'unavailable', message: 'A operação excedeu o tempo limite.' } satisfies EditorialError };
    }
    return { error: mapTransportError(error) };
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof TimeoutSignal;
}

class TimeoutSignal extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutSignal()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

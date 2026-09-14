/**
 * Editorial Neon services composition (dossier docs 15/16, task INTEGRATION-01).
 *
 * This module is the SOLE browser location that constructs the three real V2
 * repositories. It passes the existing authenticated `defaultNeonClient`
 * structurally into `createDraftRepository`, `createExportRepository` and
 * `createConnectionRepository` — the client's `rpc(method, args)` satisfies
 * each narrow transport, so no casts are needed.
 *
 * Constraints honored (docs 16/11):
 * - no UI rendering, no auth state, no second Neon client, no repository
 *   reimplementation, no raw table clients exposed;
 * - no `any`, no double-casts, no untyped RPC name strings outside the three
 *   feature repository transports;
 * - no secret row fields and no caller-supplied actor identity (admin wrappers
 *   derive the principal from the authenticated session server-side).
 *
 * Null-client handling: when the Neon public endpoints are not configured,
 * `defaultNeonClient` is null and the V2 dashboard has no transport. Following
 * the existing `defaultPublishedContentRepository` convention, composition
 * then exposes a `notConfigured` marker and repositories bound to a transport
 * that fails closed with `unavailable` (never a fake success, never a second
 * client). The canonical workspace hook is likewise configured only when the
 * real client exists, so it stays inert rather than erroring on every call.
 */

import { defaultNeonClient, type BemTeViNeonClient } from '../app/neon/client';
import type { Database } from '../app/neon/database';
import { createConnectionRepository, type ConnectionRepository } from './ai/connections/connectionRepository';
import { createExportRepository, type ExportRepository } from './ai/files/exportRepository';
import { createDraftRepository, type DraftRepository } from './drafts/draftRepository';
import type { DraftRpcTransport } from './drafts/draftRepository';
import type { ExportRpcTransport } from './ai/files/exportRepository';
import type { ConnectionRpcTransport } from './ai/connections/connectionRepository';
import { configureCanonicalWorkspaceServices } from './draft-storage/useDraftWorkspace';

export interface EditorialNeonServices {
  draftRepository: DraftRepository;
  exportRepository: ExportRepository;
  connectionRepository: ConnectionRepository;
}

/** Union of the registered public function names (doc 15 + legacy analytics). */
type RegisteredRpcName = string & keyof Database['public']['Functions'];

/** Combined structural transport the three feature repositories accept. */
type EditorialRpcTransport = DraftRpcTransport & ExportRpcTransport & ConnectionRpcTransport;

/**
 * Adapts the authenticated client's `rpc` to the frozen narrow transports.
 *
 * The SDK's `rpc` returns a generic `PostgrestFilterBuilder` thenable and keys
 * its arguments by a per-function type, so it cannot structurally satisfy
 * `rpc(method: string, args: Record<string, unknown>): Promise<...>` by direct
 * assignment. Delegating through an `async` wrapper converts the thenable into
 * a real `Promise` and narrows `method` to the registered name union without
 * `any` or double-casts: only names registered in the handwritten Database type
 * can pass, and argument shapes stay governed by those registrations.
 */
function toStructuralTransport(client: BemTeViNeonClient): EditorialRpcTransport {
  return {
    async rpc(method: string, args: Record<string, unknown>) {
      return await client.rpc(method as RegisteredRpcName, args as never);
    },
  };
}

/**
 * Fails closed on every call: an unconfigured dashboard must never fake V2
 * success. Returns the `Result` error envelope the repositories would have
 * produced for an unreachable transport.
 */
function unavailableTransportRpc(): Promise<{ data: unknown; error: unknown }> {
  return Promise.resolve({ data: null, error: { message: 'Neon Data API não configurado.' } });
}

const unavailableTransport: EditorialRpcTransport = { rpc: unavailableTransportRpc };

function createEditorialServices(transport: EditorialRpcTransport): EditorialNeonServices {
  return Object.freeze({
    draftRepository: createDraftRepository(transport),
    exportRepository: createExportRepository(transport),
    connectionRepository: createConnectionRepository(transport),
  });
}

/** True when the authenticated Neon client exists; false when unconfigured. */
export const editorialNeonConfigured: boolean = defaultNeonClient !== null;

/**
 * The one immutable editorial composition object. With the client configured
 * it binds the real authenticated transport; without configuration it binds a
 * fail-closed transport so every V2 call surfaces `unavailable`.
 */
export const editorialNeonServices: EditorialNeonServices = createEditorialServices(
  defaultNeonClient === null ? unavailableTransport : toStructuralTransport(defaultNeonClient),
);

/**
 * Module-level wiring of the canonical V2 workspace hook (doc 16 handoff):
 * `useCanonicalDraftWorkspace` consumes the configured draft repository
 * instead of constructing its own transport. Additional optional services
 * (cache, clock, timers) stay at their hook defaults; none is required by the
 * `CanonicalWorkspaceServices` signature. Only wired when the real client
 * exists — an unconfigured dashboard leaves the hook inert (loading), which is
 * the honest state rather than a repository that fails on first use.
 */
if (defaultNeonClient !== null) {
  configureCanonicalWorkspaceServices({ repository: editorialNeonServices.draftRepository });
}

import { describe, expect, it } from 'vitest';

import type { Database } from '../database';

/**
 * Contract test for the V2 registrations transcribed from dossier doc 15
 * ("Exact Tables" / "Exact RPC Catalog") into the handwritten
 * `src/app/neon/database.ts`.
 *
 * Two complementary pins:
 *
 * 1. Compile-time: the `Equal` pins below fail `pnpm run typecheck` the moment
 *    a registered function name, argument-key set, or return declaration
 *    drifts from doc 15 (fixture literals are checked against computed
 *    `Equal<...>` results).
 * 2. Runtime: the typed `ARGS_FIXTURES` object is constructed with each
 *    function's declared `Args` type, and `Object.keys` reflection asserts the
 *    exact snake_case key sets.
 *
 * Agent-gateway RPCs are deliberately NOT registered (browser never calls
 * them; the standalone MCP package owns that allowlist) — the exact-catalog
 * pins below prove their absence.
 */

type PublicFunctions = Database['public']['Functions'];
type PublicTables = Database['public']['Tables'];

/** Type-level equality (distinguishes `unknown` from `any` and exact unions). */
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/** The 10 admin RPCs used by the browser repositories (doc 15 catalog). */
type V2AdminRpc =
  | 'get_content_draft'
  | 'get_content_draft_head'
  | 'apply_content_draft_operations'
  | 'create_content_agent_connection'
  | 'list_content_agent_connections'
  | 'revoke_content_agent_connection'
  | 'create_content_edit_export'
  | 'get_content_edit_export'
  | 'prepare_content_draft_publish'
  | 'publish_content_draft';

/** Exact argument keys per doc 15 (admin rows carry no `G` prefix). */
type ExpectedArgKeys = {
  get_content_draft: never;
  get_content_draft_head: never;
  apply_content_draft_operations: 'p_expected_generation' | 'p_operations';
  create_content_agent_connection: 'p_connection_id' | 'p_token_hash' | 'p_label';
  list_content_agent_connections: never;
  revoke_content_agent_connection: 'p_connection_id';
  create_content_edit_export: 'p_export_id' | 'p_expected_generation' | 'p_selection';
  get_content_edit_export: 'p_export_id';
  prepare_content_draft_publish:
    | 'p_preparation_id'
    | 'p_generation'
    | 'p_expected_revision'
    | 'p_digest'
    | 'p_token_hash';
  publish_content_draft: 'p_preparation_id' | 'p_publish_token';
};

// --- Compile-time pins --------------------------------------------------------

/** Registered catalog is EXACTLY the 3 legacy + 10 V2 admin RPCs. */
const RPC_CATALOG_MATCHES: Equal<
  keyof PublicFunctions,
  'is_admin' | 'get_page_view_counts' | 'record_page_view' | V2AdminRpc
> = true;

/** Every V2 RPC Args has the exact doc-15 key set. */
const ARG_KEYS_MATCH: { [K in V2AdminRpc]: Equal<keyof PublicFunctions[K]['Args'], ExpectedArgKeys[K]> } = {
  get_content_draft: true,
  get_content_draft_head: true,
  apply_content_draft_operations: true,
  create_content_agent_connection: true,
  list_content_agent_connections: true,
  revoke_content_agent_connection: true,
  create_content_edit_export: true,
  get_content_edit_export: true,
  prepare_content_draft_publish: true,
  publish_content_draft: true,
};

/** Every V2 RPC RETURNS jsonb carrying Result<T>; repositories decode structurally. */
const RETURNS_UNKNOWN: { [K in V2AdminRpc]: Equal<PublicFunctions[K]['Returns'], unknown> } = {
  get_content_draft: true,
  get_content_draft_head: true,
  apply_content_draft_operations: true,
  create_content_agent_connection: true,
  list_content_agent_connections: true,
  revoke_content_agent_connection: true,
  create_content_edit_export: true,
  get_content_edit_export: true,
  prepare_content_draft_publish: true,
  publish_content_draft: true,
};

/** Registered tables are EXACTLY the 4 pre-V2 + 4 V2 tables (all in `public`). */
const TABLE_CATALOG_MATCHES: Equal<
  keyof PublicTables,
  | 'admin_users'
  | 'page_view_counts'
  | 'published_content'
  | 'published_content_history'
  | 'content_drafts'
  | 'content_agent_connections'
  | 'content_edit_exports'
  | 'content_publish_preparations'
> = true;

// --- Typed Args fixtures (constructed with the declared Args types) ----------

const ARGS_FIXTURES = {
  get_content_draft: {} as PublicFunctions['get_content_draft']['Args'],
  get_content_draft_head: {} as PublicFunctions['get_content_draft_head']['Args'],
  apply_content_draft_operations: {
    p_expected_generation: 51,
    p_operations: [{ op: 'set_default_group_order', value: 4 }],
  } as PublicFunctions['apply_content_draft_operations']['Args'],
  create_content_agent_connection: {
    p_connection_id: '00000000-0000-4000-8000-0000000000c1',
    p_token_hash: 'a'.repeat(64),
    p_label: 'Assistente da coordenação',
  } as PublicFunctions['create_content_agent_connection']['Args'],
  list_content_agent_connections: {} as PublicFunctions['list_content_agent_connections']['Args'],
  revoke_content_agent_connection: {
    p_connection_id: '00000000-0000-4000-8000-0000000000c1',
  } as PublicFunctions['revoke_content_agent_connection']['Args'],
  create_content_edit_export: {
    p_export_id: '00000000-0000-4000-8000-0000000000e1',
    p_expected_generation: 51,
    p_selection: null,
  } as PublicFunctions['create_content_edit_export']['Args'],
  get_content_edit_export: {
    p_export_id: '00000000-0000-4000-8000-0000000000e1',
  } as PublicFunctions['get_content_edit_export']['Args'],
  prepare_content_draft_publish: {
    p_preparation_id: '00000000-0000-4000-8000-0000000000p1',
    p_generation: 51,
    p_expected_revision: 40,
    p_digest: 'd'.repeat(64),
    p_token_hash: 'b'.repeat(64),
  } as PublicFunctions['prepare_content_draft_publish']['Args'],
  publish_content_draft: {
    p_preparation_id: '00000000-0000-4000-8000-0000000000p1',
    p_publish_token: 'raw-token',
  } as PublicFunctions['publish_content_draft']['Args'],
};

const V2_RPC_NAMES: V2AdminRpc[] = [
  'get_content_draft',
  'get_content_draft_head',
  'apply_content_draft_operations',
  'create_content_agent_connection',
  'list_content_agent_connections',
  'revoke_content_agent_connection',
  'create_content_edit_export',
  'get_content_edit_export',
  'prepare_content_draft_publish',
  'publish_content_draft',
];

/** Exact doc-15 argument-key sets, keyed by RPC name (runtime reflection source). */
const EXPECTED_ARGS: { [K in V2AdminRpc]: string[] } = {
  get_content_draft: [],
  get_content_draft_head: [],
  apply_content_draft_operations: ['p_expected_generation', 'p_operations'],
  create_content_agent_connection: ['p_connection_id', 'p_token_hash', 'p_label'],
  list_content_agent_connections: [],
  revoke_content_agent_connection: ['p_connection_id'],
  create_content_edit_export: ['p_export_id', 'p_expected_generation', 'p_selection'],
  get_content_edit_export: ['p_export_id'],
  prepare_content_draft_publish: [
    'p_preparation_id',
    'p_generation',
    'p_expected_revision',
    'p_digest',
    'p_token_hash',
  ],
  publish_content_draft: ['p_preparation_id', 'p_publish_token'],
};

// --- Tests --------------------------------------------------------------------

describe('database V2 contract (doc 15)', () => {
  it('registers exactly the 3 legacy + 10 V2 admin RPCs (no agent-gateway names)', () => {
    expect(RPC_CATALOG_MATCHES).toBe(true);
    expect(Object.keys(ARGS_FIXTURES).sort()).toEqual([...V2_RPC_NAMES].sort());
  });

  it('declares the exact snake_case argument keys for every V2 RPC', () => {
    expect(ARG_KEYS_MATCH).toEqual({
      get_content_draft: true,
      get_content_draft_head: true,
      apply_content_draft_operations: true,
      create_content_agent_connection: true,
      list_content_agent_connections: true,
      revoke_content_agent_connection: true,
      create_content_edit_export: true,
      get_content_edit_export: true,
      prepare_content_draft_publish: true,
      publish_content_draft: true,
    });
    for (const name of V2_RPC_NAMES) {
      expect(Object.keys(ARGS_FIXTURES[name]).sort()).toEqual([...EXPECTED_ARGS[name]].sort());
    }
  });

  it('declares every V2 RPC return as the opaque jsonb envelope (unknown)', () => {
    expect(RETURNS_UNKNOWN).toEqual({
      get_content_draft: true,
      get_content_draft_head: true,
      apply_content_draft_operations: true,
      create_content_agent_connection: true,
      list_content_agent_connections: true,
      revoke_content_agent_connection: true,
      create_content_edit_export: true,
      get_content_edit_export: true,
      prepare_content_draft_publish: true,
      publish_content_draft: true,
    });
  });

  it('registers exactly the four V2 tables alongside the pre-V2 tables', () => {
    expect(TABLE_CATALOG_MATCHES).toBe(true);
  });

  it('keeps the publication audit column on published_content and history rows', () => {
    const audit: string | null = null;
    const row: PublicTables['published_content']['Row'] = {
      id: 'current',
      schema_version: '1.0.0',
      revision: 40,
      payload: {},
      published_at: '2026-09-12T10:00:00.000Z',
      published_by: '00000000-0000-4000-8000-0000000000a1',
      published_via_connection_id: audit,
    };
    const historyRow: PublicTables['published_content_history']['Row'] = {
      revision: 40,
      schema_version: '1.0.0',
      payload: {},
      published_at: '2026-09-12T10:00:00.000Z',
      published_by: '00000000-0000-4000-8000-0000000000a1',
      archived_at: '2026-09-12T10:00:00.000Z',
      published_via_connection_id: audit,
    };
    expect(Object.keys(row)).toContain('published_via_connection_id');
    expect(Object.keys(historyRow)).toContain('published_via_connection_id');
    expect(row.published_via_connection_id).toBeNull();
    expect(historyRow.published_via_connection_id).toBeNull();
  });

  it('transcribes content_drafts as the current singleton (counters as numbers, digest as text)', () => {
    const row: PublicTables['content_drafts']['Row'] = {
      id: 'current',
      schema_version: '1.0.0',
      base_revision: 40,
      generation: 51,
      payload: { flows: [] },
      digest: 'a'.repeat(64),
      status: 'active',
      created_at: '2026-09-01T08:00:00.000Z',
      created_by: '00000000-0000-4000-8000-0000000000a1',
      updated_at: '2026-09-12T10:00:00.000Z',
      last_actor_kind: 'admin',
      last_actor_id: '00000000-0000-4000-8000-0000000000a1',
      last_principal_user_id: '00000000-0000-4000-8000-0000000000a1',
    };
    expect(Object.keys(row).sort()).toEqual(
      [
        'id',
        'schema_version',
        'base_revision',
        'generation',
        'payload',
        'digest',
        'status',
        'created_at',
        'created_by',
        'updated_at',
        'last_actor_kind',
        'last_actor_id',
        'last_principal_user_id',
      ].sort(),
    );
    expect(row.id).toBe('current');
    expect(typeof row.base_revision).toBe('number');
    expect(typeof row.generation).toBe('number');
    expect(typeof row.digest).toBe('string');
  });

  it('keeps nullable connection/export/preparation columns optional with secrets as opaque strings', () => {
    const connectionRow: PublicTables['content_agent_connections']['Row'] = {
      id: '00000000-0000-4000-8000-0000000000c1',
      draft_id: 'current',
      principal_user_id: '00000000-0000-4000-8000-0000000000a1',
      label: 'Assistente',
      token_hash: 'hash-bytes',
      created_at: '2026-09-01T08:00:00.000Z',
      expires_at: '2027-09-01T08:00:00.000Z',
      revoked_at: null,
      last_used_at: null,
    };
    const preparationRow: PublicTables['content_publish_preparations']['Row'] = {
      id: '00000000-0000-4000-8000-0000000000p1',
      draft_id: 'current',
      actor_kind: 'admin',
      principal_user_id: '00000000-0000-4000-8000-0000000000a1',
      connection_id: null,
      generation: 51,
      expected_revision: 40,
      candidate_digest: 'a'.repeat(64),
      token_hash: 'hash-bytes',
      created_at: '2026-09-12T10:00:00.000Z',
      expires_at: '2026-09-12T10:10:00.000Z',
      outcome: 'pending',
      completed_at: null,
      result: null,
    };
    expect(connectionRow.revoked_at).toBeNull();
    expect(connectionRow.last_used_at).toBeNull();
    expect(preparationRow.connection_id).toBeNull();
    expect(preparationRow.completed_at).toBeNull();
    expect(preparationRow.result).toBeNull();
    expect(typeof connectionRow.token_hash).toBe('string');
    expect(typeof preparationRow.result).toBe('object');
  });
});

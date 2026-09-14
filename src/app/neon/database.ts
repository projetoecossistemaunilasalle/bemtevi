/**
 * Handwritten Neon Data API database types.
 *
 * V2 editorial tables/functions are transcribed from the frozen database
 * contract (dossier doc 15 "Exact Tables" / "Exact RPC Catalog"). Tables exist
 * for schema documentation; all V2 access is RPC-only (RLS enabled without
 * policies), so the browser never performs V2 table reads/writes.
 *
 * bytea: `token_hash` columns are Postgres bytea. The neon-js browser stack
 * (postgrest-js) has no bytea convention and these columns are never returned
 * (all reads go through jsonb RPCs exposing only secret-free metadata), so
 * `string` documents the wire reality without exposing secrets. Args named
 * `p_token_hash` are text (64 lowercase hex) decoded inside SQL.
 *
 * Every V2 RPC RETURNS jsonb carrying a `Result<T>` envelope (doc 14) which
 * the feature repositories decode structurally, so `Returns: unknown` is the
 * honest declaration. Agent-gateway RPCs are NOT registered here: the browser
 * never calls them; the standalone MCP package owns their allowlist.
 */

/** Postgrest table shape with exact Row/Insert/Update column maps. */
type TableShape<
  Row extends Record<string, unknown>,
  InsertOptional extends keyof Row,
  UpdateOptional extends keyof Row,
> = {
  Row: Row;
  Insert: { [C in Exclude<keyof Row, InsertOptional>]: Row[C] } & {
    [C in InsertOptional]?: Row[C];
  };
  Update: { [C in UpdateOptional]?: Row[C] };
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      admin_users: TableShape<{ user_id: string }, never, 'user_id'>;
      page_view_counts: TableShape<
        { view_date: string; route: string; view_count: number },
        'view_count',
        'view_date' | 'route' | 'view_count'
      >;
      published_content: TableShape<
        {
          id: string;
          schema_version: string;
          revision: number;
          payload: unknown;
          published_at: string;
          published_by: string;
          published_via_connection_id: string | null;
        },
        'published_via_connection_id',
        | 'id'
        | 'schema_version'
        | 'revision'
        | 'payload'
        | 'published_at'
        | 'published_by'
        | 'published_via_connection_id'
      >;
      published_content_history: TableShape<
        {
          revision: number;
          schema_version: string;
          payload: unknown;
          published_at: string;
          published_by: string;
          archived_at: string;
          published_via_connection_id: string | null;
        },
        'archived_at' | 'published_via_connection_id',
        | 'revision'
        | 'schema_version'
        | 'payload'
        | 'published_at'
        | 'published_by'
        | 'archived_at'
        | 'published_via_connection_id'
      >;
      content_drafts: TableShape<
        {
          id: string;
          schema_version: string;
          base_revision: number;
          generation: number;
          payload: unknown;
          digest: string;
          status: string;
          created_at: string;
          created_by: string;
          updated_at: string;
          last_actor_kind: string | null;
          last_actor_id: string | null;
          last_principal_user_id: string | null;
        },
        | 'id'
        | 'schema_version'
        | 'generation'
        | 'status'
        | 'created_at'
        | 'updated_at'
        | 'last_actor_kind'
        | 'last_actor_id'
        | 'last_principal_user_id',
        keyof ContentDraftsRow | never
      >;
      content_agent_connections: TableShape<
        {
          id: string;
          draft_id: string;
          principal_user_id: string;
          label: string;
          token_hash: string;
          created_at: string;
          expires_at: string;
          revoked_at: string | null;
          last_used_at: string | null;
        },
        'created_at' | 'revoked_at' | 'last_used_at',
        keyof ContentAgentConnectionsRow | never
      >;
      content_edit_exports: TableShape<
        {
          export_id: string;
          draft_id: string;
          schema_version: string;
          base_generation: number;
          base_digest: string;
          published_revision: number;
          base_payload: unknown;
          selection: unknown;
          created_by: string;
          created_at: string;
          expires_at: string;
        },
        'schema_version' | 'selection' | 'created_at',
        keyof ContentEditExportsRow | never
      >;
      content_publish_preparations: TableShape<
        {
          id: string;
          draft_id: string;
          actor_kind: string;
          principal_user_id: string;
          connection_id: string | null;
          generation: number;
          expected_revision: number;
          candidate_digest: string;
          token_hash: string;
          created_at: string;
          expires_at: string;
          outcome: string;
          completed_at: string | null;
          result: unknown;
        },
        'connection_id' | 'created_at' | 'outcome' | 'completed_at' | 'result',
        keyof ContentPublishPreparationsRow | never
      >;
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      get_page_view_counts: {
        Args: { p_start_date: string };
        Returns: Array<{
          view_date: string;
          route: string;
          view_count: number;
        }>;
      };
      record_page_view: {
        Args: { p_route: string };
        Returns: undefined;
      };
      get_content_draft: {
        Args: Record<never, never>;
        Returns: unknown;
      };
      get_content_draft_head: {
        Args: Record<never, never>;
        Returns: unknown;
      };
      apply_content_draft_operations: {
        Args: { p_expected_generation: number; p_operations: unknown };
        Returns: unknown;
      };
      create_content_agent_connection: {
        Args: { p_connection_id: string; p_token_hash: string; p_label: string };
        Returns: unknown;
      };
      list_content_agent_connections: {
        Args: Record<never, never>;
        Returns: unknown;
      };
      revoke_content_agent_connection: {
        Args: { p_connection_id: string };
        Returns: unknown;
      };
      create_content_edit_export: {
        Args: { p_export_id: string; p_expected_generation: number; p_selection: unknown };
        Returns: unknown;
      };
      get_content_edit_export: {
        Args: { p_export_id: string };
        Returns: unknown;
      };
      prepare_content_draft_publish: {
        Args: {
          p_preparation_id: string;
          p_generation: number;
          p_expected_revision: number;
          p_digest: string;
          p_token_hash: string;
        };
        Returns: unknown;
      };
      publish_content_draft: {
        Args: { p_preparation_id: string; p_publish_token: string };
        Returns: unknown;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** Row shapes referenced by their own Insert/Update optionality parameters. */
interface ContentDraftsRow {
  id: string;
  schema_version: string;
  base_revision: number;
  generation: number;
  payload: unknown;
  digest: string;
  status: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  last_actor_kind: string | null;
  last_actor_id: string | null;
  last_principal_user_id: string | null;
}

interface ContentAgentConnectionsRow {
  id: string;
  draft_id: string;
  principal_user_id: string;
  label: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

interface ContentEditExportsRow {
  export_id: string;
  draft_id: string;
  schema_version: string;
  base_generation: number;
  base_digest: string;
  published_revision: number;
  base_payload: unknown;
  selection: unknown;
  created_by: string;
  created_at: string;
  expires_at: string;
}

interface ContentPublishPreparationsRow {
  id: string;
  draft_id: string;
  actor_kind: string;
  principal_user_id: string;
  connection_id: string | null;
  generation: number;
  expected_revision: number;
  candidate_digest: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  outcome: string;
  completed_at: string | null;
  result: unknown;
}

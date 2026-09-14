-- Emergency kill switch: disable_editorial_writes.sql (dossier 15).
-- Operator-invoked ONLY; never part of normal migration enumeration. Run after
-- taking the UI read-only. It revokes EXECUTE on the editorial write wrappers
-- (exact signatures below), marks every active agent connection revoked, and
-- keeps all read and admin revoke/list/export-retrieval RPCs plus the public
-- published SELECT. In-flight transactions can finish before the revocation
-- is linearized; verify no new write succeeds afterward. Restore only by an
-- owner-reviewed regrant of these exact V2 wrapper signatures — never by
-- regranting direct published-table writes or unrevoking old connections.

revoke execute on function public.apply_content_draft_operations(bigint, jsonb)
  from authenticated;
revoke execute on function public.prepare_content_draft_publish(uuid, bigint, bigint, text, text)
  from authenticated;
revoke execute on function public.publish_content_draft(uuid, text)
  from authenticated;
revoke execute on function public.create_content_agent_connection(uuid, text, text)
  from authenticated;

revoke execute on function public.agent_apply_operations(uuid, text, bigint, jsonb)
  from anonymous;
revoke execute on function public.agent_prepare_publish(uuid, text, uuid, bigint, bigint, text, text)
  from anonymous;
revoke execute on function public.agent_publish_draft(uuid, text, uuid, text)
  from anonymous;

update public.content_agent_connections
set revoked_at = clock_timestamp()
where revoked_at is null;

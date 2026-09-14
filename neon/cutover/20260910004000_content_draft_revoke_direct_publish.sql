-- Cutover: 20260910004000_content_draft_revoke_direct_publish.sql
-- Description: Direct-publication cutover (dossier 15, Migration Order item 5).
--   NOT part of the automatic additive migration enumeration: apply manually,
--   only after INTEGRATION-03 verification and with the draft base revision
--   aligned to the live publication (a base/live mismatch fails publication
--   closed by design). The statements below are the literal revision-8 frozen
--   cutover statements and MUST NOT be renamed or extended by an
--   implementation agent. The read policy
--   "Anyone can read current published content" is kept, so public SELECT and
--   admin-only history SELECT survive the cutover; guarded V2 publication via
--   publish_content_draft / agent_publish_draft is unaffected.

-- Literal cutover statements (dossier 15):
revoke insert, update, delete on table public.published_content from authenticated, anonymous, public;
drop policy if exists "Administrators can create published content" on public.published_content;
drop policy if exists "Administrators can update published content" on public.published_content;

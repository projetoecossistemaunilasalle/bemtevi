# Revision 8 Executor-Determinism Hardening

## Status

This is the normative change record from Revision 7 to Revision 8. Audited implementation base remains `e030264786ae7010aac7832203244882d12f9265`.

Revision 8 is a specification/change-control release only. It does not change the canonical Neon-draft architecture, RPC business semantics, optimistic concurrency model, semantic merge behavior, MCP product/tool intent, archive format intent, capability trust model, or guarded publication model.

## C1 — change classification

Normative classes affected:

- task dependencies/gate sequencing;
- task file ownership/module boundaries;
- exact V2 operation field contract wording;
- exact existing SQL policy identifiers at cutover;
- client feature-flag parsing/composition rule;
- database test-provisioning command contract;
- final verification command/ownership boundary.

No product requirement or data-migration meaning changed.

## C2 — impacted documents/tasks

Primary normative edits:

- README, 00, 08, 09, 11–17;
- 14 operation field/image-protection section;
- 15 direct-write cutover statements;
- 16 feature flags/coexistence adapter boundary;
- task README and DB, DASHBOARD, AI-FILE, MCP, MERGE, INTEGRATION, LEGACY task files.

Historical records 18/19 are retained and marked superseded where Revision 8 is more explicit.

## C3 — repository evidence

Against the unchanged audited SHA, review verified:

- `check:db` fails closed until DB-04's `neon/tests/run.ts` exists;
- protected `v2-database` CI already exists and calls that command;
- DB Vitest discovery already includes live `*.test.ts` files;
- exact current publication policy names are knowable and stable at the audited base;
- current route/tab/publication/provider/legacy AI/storage files can be named rather than discovered by the executor;
- old operation `ITEM_KEYS` and domain optional fields can be transcribed into a frozen V2 contract rather than treated as runtime/normative authority.

## C4 — decisions frozen in Revision 8

1. **DB-01..03 defer the live gate.** They author live tests and run credential-free checks. DB-04 is the sole first executable `check:db` owner and runs all accumulated suites.
2. **Ownership is mechanical.** Normative task ownership uses explicit paths or bounded new subtrees. Phrases such as “as applicable,” “if required,” “files needed,” and “tests discovered” do not grant write permission.
3. **INTEGRATION-02 creates the temporary direct-publication adapter.** Exact path: `src/dev-dashboard/publishing/legacyPublication.ts`; V2 never imports it; LEGACY-01 deletes it.
4. **V2 operation fields are literal.** 14's add/update/unset lists are authoritative; V1 `ITEM_KEYS`/TypeScript optionality are evidence only.
5. **Image protection is explicit.** Generic material updates cannot alter protected image slots; specialized image operations own retained-slot image changes.
6. **Cutover policy identifiers are literal.** Drop only the two named administrator write policies; preserve the public-read policy.
7. **Feature flags use exact string parsing.** Only `value === "true"` enables. After legacy cleanup the enablement flag disappears; read-only remains.
8. **DB-04 uses the pinned CLI command family.** Version/flags are checked; rejection by the pinned binary is specification drift, not permission to switch provisioning approaches.
9. **Existing CI is adopted.** INTEGRATION-03 adds live suites under the existing DB harness and does not conditionally modify root CI.
10. **INTEGRATION-04 is verification-only.** It appends evidence and runs exact gates; it has no source/config repair authority.
11. **Legacy cleanup names deletions/survivors.** The read-only legacy recovery adapter and original browser bytes survive; browser-canonical store implementations, local bridge/draft-sync, V1 AI facades and temporary publication adapter do not.

## C5 — compatibility and security impact

These changes reduce implementation ambiguity. They do not broaden credentials/grants or grant a weaker model extra discretion. In particular:

- no new Data API/table privilege is introduced;
- no new fallback to direct publication is allowed;
- no pre-DB-04 fake harness is permitted;
- no feature lane may cast around handwritten DB typing;
- no cleanup task may delete unrelated MCP tooling or recovery bytes.

## C6 — release of hardening state

Revision 8 returns the dossier to `IMPLEMENTATION_READY` because the same audited repository base was revalidated and all identified executor-level decisions above are frozen. Any later normative edit follows 13 and temporarily returns the dossier to `HARDENING_REQUIRED` while impact is assessed.

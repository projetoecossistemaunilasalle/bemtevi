# Revision 8 Bundle Manifest

This directory is the complete, self-contained Revision 8 implementation dossier for repository destination `docs/plans/ai-content-editor-v2/`.

**Audited implementation base:** `e030264786ae7010aac7832203244882d12f9265`  
**Specification status:** `IMPLEMENTATION_READY`  
**Specification revision:** `8`  
**Revision type:** executor-determinism/change-control hardening over Revision 7; product/source-of-truth/security/concurrency/publication architecture unchanged.

## Revision 8 changes

Revision 8 closes the remaining literal-executor hazards found while reviewing Revision 7 against the unchanged audited repository:

1. DB-01..03 no longer require the impossible pre-DB-04 `check:db`; DB-04 is the sole first live-harness owner and runs all accumulated suites.
2. Task ownership/handoffs are explicit, including exact INTEGRATION-02 publication/provider paths, exact temporary `legacyPublication.ts`, exact legacy deletion/survival paths, and verification-only INTEGRATION-04.
3. 14 freezes literal add/update/unset field lists and protected-image behavior instead of referring implementers back to V1 `ITEM_KEYS`/optional domain fields.
4. 15 freezes literal audited publication write-policy names for cutover and explicitly preserves the public-read policy.
5. 16 freezes feature-flag parsing (`value === "true"` only), V2-versus-legacy coexistence selection and the exact temporary direct-publication adapter lifecycle.
6. DB-04 freezes the `neon@4.14.6` command family/flags and stop-on-drift behavior for disposable-branch provisioning.
7. Existing protected DB CI/test discovery is adopted rather than conditionally re-owned by INTEGRATION-03.
8. MCP, AI-file, merge and cleanup tasks name bounded production/test paths instead of “adjacent/as applicable/discovered” ownership.

See `20-revision-8-executor-determinism.md` for the normative delta and `17-readiness-audit.md` for repository evidence/readiness boundaries.

## Complete contents

The bundle contains:

- `README.md`;
- numbered chapters `00` through `20`;
- `architecture-baseline.json`;
- all eight task documents under `tasks/`;
- `REVISION-8-MANIFEST.md`;
- `SHA256SUMS.txt`;
- Bash and PowerShell apply helpers.

Chapters 18 and 19 are retained historical change records. Chapter 20 is the current Revision-8 delta.

## Integrity verification

From the extracted bundle directory:

```bash
sha256sum -c SHA256SUMS.txt
```

`SHA256SUMS.txt` covers every distributed file except itself. The final ZIP is additionally tested with the standard ZIP integrity check before delivery.

## Applying the complete dossier

From the BemTeVi repository root:

```bash
bash /path/to/ai-content-editor-v2-revision-8/apply-revision-8.sh .
```

PowerShell:

```powershell
& C:\path\to\ai-content-editor-v2-revision-8\apply-revision-8.ps1 -RepoRoot .
```

Then inspect/run repository-side baseline checks before implementation:

```bash
git diff -- docs/plans/ai-content-editor-v2
pnpm exec prettier --check docs/plans/ai-content-editor-v2
pnpm run check:architecture
pnpm run check
```

The bundle itself changes no production code/database/content/package release/deployment state.

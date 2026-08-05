# Front 11A — Privacy, LGPD & Session Policy Breakdown

## Purpose

This document breaks down the eleventh implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/11-privacy-lgpd-session.md`
- `docs/fronts/07a-home-philosophy-onboarding-breakdown.md`
- `docs/fronts/12-anonymous-analytics.md`

The goal is to turn privacy constraints into explicit product and engineering policy. The current product keeps answers, scores, and transcripts in memory only, while allowing one disclosed non-sensitive onboarding preference.

---

## Current State

The public experience avoids requesting personal identification. Neon supports administrator authentication and published content, but the app does not save public-user answers, scores, transcripts, precise location, or analytics and persists only `bemtevi:onboarding-seen="true"` in `localStorage` to remember that onboarding was seen. The contacts screen may use a rounded device coordinate in memory after an explicit location action to choose a city filter.

---

## Policy Outputs

Create written, repository-visible policy documents/content:

```txt
docs/fronts/11-privacy-lgpd-session.md
src/domain/privacy/README.md
```

The policy should answer what is never collected, what exists only in memory, what may be persisted later if approved, how location may work, what analytics are blocked, and what copy Home can safely claim.

---

## Default Rules

Until a stricter approved policy says otherwise:

- no login;
- no name, email, CPF, school ID, or teacher ID;
- no saved questionnaire answers;
- no saved chat transcripts;
- no persistent flow progress;
- no stored or transmitted location;
- no analytics;
- onboarding completion is persisted only as the non-sensitive `bemtevi:onboarding-seen="true"` preference.

---

## Implementation Slices

### PR 11A — Write Session And Data Policy

Scope:

1. create `docs/privacy/session-policy.md`;
2. document allowed in-memory state;
3. document blocked persistence;
4. document location and analytics prerequisites;
5. align policy wording with PRD.

Acceptance criteria:

- policy is explicit and reviewable;
- no sensitive flow/questionnaire data is persisted; the onboarding preference is the documented exception;
- Home/support/orientation claims can reference the policy.

### PR 11B — Place Privacy Content In Relevant Surfaces

Scope:

1. keep privacy copy in Home, onboarding, and Orientation aligned with the session policy;
2. do not introduce a standalone `/privacidade` route or navigation item;
3. explain the no-identification posture, current storage behavior, and limits;
4. keep copy plain-language and Portuguese-first.

Acceptance criteria:

- relevant public surfaces communicate privacy without requiring a dedicated route;
- copy does not overpromise;
- no legalistic wall of text is required for basic understanding.

### PR 11C — Add Privacy Guardrail Tests/Checks

Scope:

1. add tests or static checks for forbidden storage APIs in sensitive modules;
2. document allowed exceptions if any;
3. verify no analytics package is present unless approved.

Acceptance criteria:

- sensitive flow/questionnaire modules do not use persistent browser storage;
- checks are practical and low-noise;
- exceptions require explicit documentation.

### PR 11D — Review Onboarding, Location, And Analytics Gates

Scope:

1. preserve the documented onboarding completion preference;
2. document the explicit city-filter action, approximate on-device lookup, and pre-permission explanation requirement;
3. document analytics approval prerequisites.

Acceptance criteria:

- future PRs have clear gates;
- location sorting remains disabled unless approved;
- analytics remains blocked until Front 12 approval.

---

## Files Expected To Change First

```txt
docs/fronts/11-privacy-lgpd-session.md
src/domain/privacy/types.ts
src/features/home/HomeScreen.tsx
src/tests/privacy/*.test.ts
```

---

## Risks and Guardrails

### Risk: privacy as copy-only

Guardrail: policy must constrain architecture, not just create a page.

### Risk: harmless-looking persistence

Guardrail: onboarding persistence must remain limited to the documented non-sensitive completion flag; never store answers, scores, transcripts, or progress recovery.

### Risk: vague analytics approval

Guardrail: no analytics code until event taxonomy, provider, and disclosure are approved.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 11A is done when BemTeVi has a clear session/privacy policy, a real privacy screen, and enforceable guardrails that keep sensitive flow/questionnaire state, location, and analytics from being persisted or collected by default.

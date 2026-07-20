# Front 11A — Privacy, LGPD & Session Policy Breakdown

## Purpose

This document breaks down the eleventh implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/11-privacy-lgpd-session.md`
- `docs/fronts/07a-home-philosophy-onboarding-breakdown.md`
- `docs/fronts/12-anonymous-analytics.md`

The goal is to turn privacy constraints into explicit product and engineering policy before adding saving, location, onboarding persistence, or analytics.

---

## Current State

The project direction is anonymous by default. The app currently has no backend, account system, persistence layer, analytics, or location access. This is a strength and should remain true unless deliberately changed after review.

---

## Policy Outputs

Create written, repository-visible policy documents/content:

```txt
docs/privacy/session-policy.md
src/content/copy/privacy.ts
src/features/privacy/PrivacyScreen.tsx
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
- no stored location;
- no analytics;
- onboarding completion is not persisted.

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
- no code introduces persistence;
- Home/support/orientation claims can reference the policy.

### PR 11B — Build Privacy Content And Screen

Scope:

1. create or expand `src/content/copy/privacy.ts`;
2. render `/privacidade` from content;
3. explain anonymity, no-login posture, current storage behavior, and limits;
4. keep copy plain-language and Portuguese-first.

Acceptance criteria:

- `/privacidade` exists and is not a placeholder;
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

1. document whether onboarding completion may ever be stored;
2. document the pre-permission location explanation requirement;
3. document analytics approval prerequisites.

Acceptance criteria:

- future PRs have clear gates;
- location sorting remains disabled unless approved;
- analytics remains blocked until Front 12 approval.

---

## Files Expected To Change First

```txt
docs/privacy/session-policy.md
src/content/copy/privacy.ts
src/domain/privacy/types.ts
src/features/privacy/PrivacyScreen.tsx
src/features/home/HomeScreen.tsx
src/tests/privacy/*.test.ts
```

---

## Risks and Guardrails

### Risk: privacy as copy-only

Guardrail: policy must constrain architecture, not just create a page.

### Risk: harmless-looking persistence

Guardrail: onboarding flags, progress recovery, and preferences still count as persistence and need explicit approval.

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

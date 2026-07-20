# Front 12A — Anonymous Analytics Breakdown

## Purpose

This document breaks down the twelfth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/12-anonymous-analytics.md`
- `docs/fronts/11a-privacy-lgpd-session-breakdown.md`

The goal is to define aggregate-only analytics that could improve the app without undermining anonymity. Implementation must wait for Privacy/LGPD approval.

---

## Current State

There is no analytics in the repository. That should remain true until taxonomy, provider, and disclosure are approved.

This front can start as a design/policy front before code integration.

---

## Allowed Direction

Potential aggregate event categories:

- screen view;
- resource opened;
- flow started;
- flow completed by result band;
- support contact clicked;
- education filter used.

Never collect questionnaire answers, chat transcript, individual path, location, persistent user ID, device identifiers, advertising identifiers, or personal identifiers.

---

## Implementation Slices

### PR 12A — Draft Analytics Taxonomy Only

Scope:

1. create `docs/privacy/analytics-taxonomy.md`;
2. list allowed and blocked events;
3. define event properties at aggregate level;
4. mark implementation as blocked until approval.

Acceptance criteria:

- taxonomy exists;
- answer-level and path-level tracking are explicitly blocked;
- no analytics package or runtime code is added.

### PR 12B — Review Provider Options

Scope:

1. document provider constraints;
2. prefer cookieless, non-ad-network, anonymized, self-hostable options;
3. document IP handling and data retention requirements.

Acceptance criteria:

- provider decision is documented or deferred;
- privacy disclosure requirements are known;
- no provider SDK is installed yet unless approval is recorded.

### PR 12C — Add Disabled Analytics Interface After Approval

Scope:

1. create a small `analytics` interface only after approval;
2. default implementation should be no-op;
3. block forbidden event/property names in types or tests;
4. do not send data by default in development.

Acceptance criteria:

- no-op analytics is safe by default;
- event types exclude sensitive properties;
- code cannot track answers or transcripts through the typed interface.

### PR 12D — Enable Approved Provider And Disclosure

Scope:

1. integrate the approved provider;
2. update privacy copy;
3. track only approved aggregate events;
4. test that forbidden events are unavailable.

Acceptance criteria:

- analytics provider matches approved constraints;
- privacy copy discloses analytics plainly;
- no answer-level, location, or user-trajectory data is collected.

---

## Files Expected To Change First

```txt
docs/privacy/analytics-taxonomy.md
docs/privacy/analytics-provider-review.md
src/lib/analytics/types.ts
src/lib/analytics/noopAnalytics.ts
src/lib/analytics/track.ts
src/content/copy/privacy.ts
src/tests/analytics/*.test.ts
```

`src/lib/analytics/*` should not be created before PR 12C approval.

---

## Risks and Guardrails

### Risk: analytics starts before consent/policy approval

Guardrail: first PRs are documentation-only; code comes after approval.

### Risk: aggregate events become individual journeys

Guardrail: do not track event sequences, session IDs, or per-user paths.

### Risk: answer-level tracking sneaks in

Guardrail: type allowed events so answer/question payloads are impossible through the analytics API.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 12A is done when analytics has an approved taxonomy, provider, privacy disclosure, and safe typed implementation that collects only aggregate non-identifying events and excludes answers, transcripts, location, and individual journeys.

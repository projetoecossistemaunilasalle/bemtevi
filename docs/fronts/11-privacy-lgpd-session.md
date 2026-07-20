# Front 11 — Privacy, LGPD & Session Policy

## Goal

Define what the app may collect, store, remember, transmit, or analyze.

Privacy is not a later legal screen. It shapes architecture.

---

## Known Product Direction

BemTeVi should not require:

```txt
login
account creation
name
email
CPF
school identification
teacher ID
```

The app should avoid collecting personally identifiable information.

---

## Session Policy

This front must verify what “session” means for the product.

Until verified:

- Do not build saving features.
- Do not persist questionnaire answers.
- Do not store chat transcripts in localStorage.
- Do not store location.
- Do not imply progress will survive closing the app.

In-memory state during active use is acceptable for runtime behavior, but persistence needs explicit review.

---

## One-Time Onboarding

A one-time onboarding completion flag may seem harmless, but it is still persistence.

Options:

1. Do not persist onboarding.
2. Persist only a generic UI preference.
3. Ask for consent.
4. Wait until privacy review.

Recommended now:

- Build onboarding as a regular accessible section.
- Add persistence later only after Privacy/LGPD approval.

---

## Location

Location use must be optional.

Rules:

- Explain purpose before permission.
- Use only for on-device sorting.
- Do not store.
- Do not transmit.
- Directory works without permission.

---

## Analytics

Analytics require a separate approved event taxonomy.

Until approved:

- Do not collect analytics.
- Do not add third-party trackers.
- Do not collect question answers.
- Do not collect individual journeys.

---

## Acceptance Criteria

- A written session policy exists.
- Saving features are postponed until verified.
- No sensitive data is persisted by default.
- Location behavior is documented before implementation.
- Analytics are blocked until taxonomy/privacy disclosure are approved.

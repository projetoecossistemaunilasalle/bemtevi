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

The app does not save questionnaire answers, scores, or chat transcripts. These values exist only in memory during active use and are discarded when the session ends. The contacts screen may request location only after an explicit user action; it rounds coordinates, uses them on-device for city filtering, and does not store or transmit them. The only product-level browser persistence is the non-sensitive onboarding preference `bemtevi:onboarding-seen="true"`.

---

## One-Time Onboarding

Onboarding completion is persisted only as a generic UI preference. The key is `bemtevi:onboarding-seen`, the value is `"true"`, and it contains no health or personal-identification data. No additional consent, cookies, analytics, or saved user content are introduced by this preference.

---

## Location

Location use must be optional and limited to the explicit city-filter action.

Rules:

- Explain purpose before permission.
- Use only for on-device city filtering.
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

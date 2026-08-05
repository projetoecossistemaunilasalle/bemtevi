# Front 06 — Questionnaire Framework & SRQ-20 Test Flow

## Goal

Build questionnaire support as part of the guided-flow framework, with SRQ-20 as the first validation/test case.

SRQ-20 should not be treated as the only special or sensitive questionnaire. The architecture should support multiple structured, scored, interruptible questionnaires in the future.

---

## Principle

A questionnaire is represented as dashboard-editable JSON guided-flow content:

```txt
src/content/flows/*.json
  -> import.meta.glob discovery
  -> generic flow parser and validator
  -> generic flow engine
  -> generic chatbot UI
```

The app must not create a separate questionnaire screen, route, TypeScript workflow file, or questionnaire-specific runtime. SRQ-20 proves that the chatbot framework can execute structured, scored, interruptible flows from JSON-compatible content.

---

## SRQ-20 Role

SRQ-20 is the first implementation because it exercises the important framework capabilities:

```txt
consent
fixed question count
scoring
threshold result
safety interruption
recommendation mapping
```

It should be used to prove the questionnaire framework, not hardcoded as a unique one-off.

---

## SRQ-20 Required Behavior

- User is told clearly they are answering SRQ-20.
- User consents before beginning.
- There are 20 yes/no questions.
- Affirmative answers are scored.
- Score of 7 or more produces a possible-distress support result.
- Result copy must avoid diagnostic language.
- If the suicidal ideation question is answered affirmatively, a priority safety condition is recorded and the questionnaire continues through the remaining questions.
- After completion, the user receives a welcoming support message and is routed to `/apoio`.
- This deferred safety destination takes priority over the ordinary scored result destination.

---

## JSON Model

```json
{
  "id": "srq20",
  "type": "questionnaire",
  "questionnaire": {
    "instrument": "SRQ-20",
    "scoring_method": "sum_affirmative",
    "thresholds": [
      {
        "id": "possible_distress",
        "min": 7,
        "recommendation_id": "professional-support"
      }
    ]
  },
  "safety_rules": [
    {
      "id": "srq20-q17-support",
      "when": {
        "node_id": "q17",
        "answer_value": true
      },
      "action": "route_to_support",
      "target": "/apoio"
    }
  ]
}
```

---

## Testing Requirements

Minimum tests:

```txt
loads valid questionnaire
rejects questionnaire without consent
rejects missing question IDs
rejects broken next references
scores affirmative answers correctly
maps score >= 7 to correct result
Q17 affirmative allows Q18-Q20 to continue
Q17 affirmative redirects to support after completion with priority over the ordinary result
declined consent exits gracefully
result copy avoids diagnosis wording
```

---

## Acceptance Criteria

- SRQ-20 is represented as JSON-compatible content.
- Questionnaire logic is generic.
- Scoring is not implemented inside React components.
- Safety rules are declarative.
- SRQ-20 validates successfully.
- SRQ-20 tests pass.
- The framework can support another questionnaire without major refactor.

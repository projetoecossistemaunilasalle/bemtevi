# Flow Engine

Deterministic guided-flow runtime, validation, switching, and safety-rule helpers.

This domain is React-independent. It powers the constrained orientation chat by loading flow content, resolving valid runtime options, advancing through predefined nodes, suspending/resuming flows, and validating flow records.

## Effect Kinds

The engine supports these effects on choice options:

- `score` — adds a numeric value to a score key (used by questionnaires like SRQ-20).
- `safety_interrupt` — clears the active flow, sets `pendingNavigation`, and optionally blocks resume.
- `flow_start` — starts another flow by ID without suspending the current flow (used by neutral routers).
- `navigate` — clears the active flow and sets `pendingNavigation` to an app destination.
- `end_flow` — clears the active flow and emits a sign-off bot message.

`validateFlow` performs exhaustive effect-kind checking — unknown effect kinds produce validation errors rather than being silently ignored.

## Neutral Flows

Flows may declare an optional `purpose` field:

- `orientation_entry` — broad, low-pressure flows that help users choose a more specific path.
- `post_flow_routing` — a calm next-step router offered after regular flow result nodes.
- `undefined` (omitted) — regular content flows.

Neutral flows are ordinary `guided_conversation` flows. They use the same engine, parser, registry, and UI patterns as regular flows.

## Cross-Flow Validation

`loadFlows.ts:validateRegisteredFlows` checks that every `flow_start` effect targets an existing flow ID in the same registry. `scripts/validate-flows.ts` performs the same check in the CLI validation gate.

Current guardrails:

- no free-text interpretation;
- no fake-AI behavior;
- no persistence of chat transcripts;
- no UI imports from this domain layer.

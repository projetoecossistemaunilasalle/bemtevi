# Neutral Flow Concept

## Purpose

BemTeVi's guided chat should not depend only on users typing or choosing exact entry phrases to reach useful flows.

Some flows should exist mainly to help route the user toward another flow. These are **neutral flows**: low-pressure, non-clinical conversation paths whose main job is to understand the user's broad need and nudge them toward a more specific guided flow.

## Problem

The current flow model supports:

- starting a specific flow from known entry phrases;
- switching flows when the user selects another flow's entry phrase;
- ending a flow with a result node and optional resource recommendations.

This is useful, but too passive. A user may not know which phrase to choose, or may finish one flow and still need help deciding what to do next.

## Concept

A neutral flow is a guided flow with a routing purpose.

It should:

- avoid diagnosis or strong assumptions;
- ask broad, easy questions;
- present options that map to existing flow entry phrases or direct flow starts;
- help users continue rather than leaving them at a dead end;
- remain deterministic and constrained, like every other guided flow.

## Initial Neutral Flows

Initial neutral flows are the flows launched from the main choices on the orientation page.

Instead of sending the user directly into a specific concern flow, the orientation entry choices can start neutral flows such as:

- understand how I am feeling;
- talk through what I am experiencing;
- find a next care step.

Each one should gently narrow the user's intent and then offer one or more specific guided flows.

## Ending Neutral Flow

When a specific flow reaches its ending, the chat should not simply stop.

After the result message and recommendations, the app can start or offer an ending neutral flow whose purpose is to help the user choose what happens next.

Examples:

- continue with another topic;
- try a rest or grounding flow;
- view education materials;
- view support contacts;
- end for now.

This should feel like a calm continuation, not a loop or pressure to keep interacting.

## Dashboard Implications

The dashboard should let editors distinguish neutral flows from regular guided flows.

Possible model additions:

```ts
type FlowPurpose = 'orientation_entry' | 'topic_support' | 'post_flow_routing';
```

or:

```ts
type FlowType = 'guided_conversation' | 'neutral_router';
```

The final implementation should choose the smallest model change that keeps validation clear.

Dashboard editing should support:

- marking a flow as neutral/routing;
- choosing where a neutral flow appears;
- linking options to specific flows or entry phrases;
- previewing the handoff from one flow into another;
- validating that routing options point to existing flows.

## Guardrails

- Neutral flows must not imply real AI or free-text understanding.
- Neutral flows must not store chat transcripts or answers beyond the current in-memory session.
- Neutral flows must not trap the user in endless continuation.
- Immediate support and exit actions should remain available.
- The UI copy should be in pt-BR and explain the concept to editors without technical wording.

## Open Implementation Decision

The implementation plan should decide whether neutral flows are:

1. normal guided flows with a `purpose` field; or
2. a separate `neutral_router` flow type.

The likely recommendation is option 1, because it reuses the existing engine while adding clearer metadata and validation.

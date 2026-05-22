# Neutral Flow Design

## Purpose

SeCuida's orientation chat should start from calm, broad user intents instead of routing every intro choice into a specific concern flow. Neutral flows provide that bridge: they are ordinary deterministic guided flows whose purpose is to help users choose a more specific next path without implying diagnosis, free-text understanding, or real AI.

Dashboard editing and dashboard UI are out of scope for this implementation. The design only covers the main app flow model, content, runtime behavior, chat UI integration, validation, and tests.

## Scope

This implementation will:

- add flow-purpose metadata to the guided-flow model;
- create hardcoded orientation intro choices that start neutral orientation flows;
- add initial neutral flows for broad orientation needs;
- add one post-flow routing neutral flow offered after regular result nodes;
- keep all flow state in memory;
- preserve existing global actions for immediate support, contacts, education, and ending;
- keep all user-facing copy in pt-BR.

This implementation will not:

- build dashboard editing controls;
- store chat answers, transcripts, or routing decisions;
- add AI/free-text interpretation;
- turn neutral flows into a separate runtime engine.

## Model

Use normal guided flows with an optional purpose field:

```ts
export type FlowPurpose = 'orientation_entry' | 'topic_support' | 'post_flow_routing';

export interface GuidedFlow {
  id: string;
  version: string;
  locale: ContentLocale;
  title: string;
  type: FlowType;
  purpose?: FlowPurpose;
  status: ContentStatus;
  entry: FlowEntry;
  nodes: Record<string, FlowNode>;
}
```

The flow `type` remains `guided_conversation`. This keeps neutral flows inside the existing deterministic engine and avoids branching runtime behavior for a content distinction.

The validator should accept missing `purpose` for existing flows and reject unknown purpose values when present. It should also continue validating every registered flow before runtime state is created.

## Initial Orientation Behavior

The current pre-chat screen stays as a curated entry screen, but each intro choice maps to a neutral flow ID instead of always starting `work-stress`.

Initial intro choices:

- "Quero entender como estou me sentindo" starts `orientation-understand-feelings`;
- "Quero falar sobre o que estou vivendo" starts `orientation-talk-through-experience`;
- "Quero encontrar um próximo passo de cuidado" starts `orientation-next-care-step`;
- "Preciso de um momento mais leve" starts `orientation-calm-moment`;
- "Outro" starts `orientation-understand-feelings` without adding "Outro" as a user message.

The selected intro label should still appear as a user message when it is not "Outro". This preserves the chat feeling while keeping state in memory only.

## Neutral Flow Content

Neutral orientation flows should ask broad, low-pressure questions and route users toward existing guided flows or global support paths. They must not claim to understand the user's typed text or infer a diagnosis.

Initial neutral flow responsibilities:

- `orientation-understand-feelings`: helps the user choose among overload, rest/difficulty disconnecting, SRQ-20, or a calmer next step.
- `orientation-talk-through-experience`: helps the user name whether the day involved tasks, conflict/pressure, body tiredness, or uncertainty.
- `orientation-next-care-step`: helps the user choose between guided reflection, rest, educational material, contacts, or immediate support.
- `orientation-calm-moment`: routes directly toward rest/recovery, education, or ending for now.
- `post-flow-next-step`: appears after ordinary result nodes and offers another topic, rest/recovery, education, contacts, immediate support, or ending.

Neutral flows may route to specific flows in two ways:

1. A neutral flow option can use a new `flow_start` effect that starts a target flow by ID.
2. Existing flow entry phrases remain visible through autocomplete and can still switch flows.

The `flow_start` effect is preferred for curated neutral-flow buttons because it keeps labels natural and avoids making users select exact entry phrases like "Estou sobrecarregado no trabalho" when the neutral copy has already done the narrowing.

## Runtime Behavior

Add a `flow_start` effect:

```ts
export interface FlowStartFlowEffect {
  kind: 'flow_start';
  flowId: string;
}
```

Add a matching runtime option kind for engine-generated direct starts:

```ts
export interface RuntimeFlowStartOption {
  kind: 'flow_start';
  id: string;
  label: string;
  flowId: string;
}
```

When a user selects a node option with a `flow_start` effect, the engine should append the user message, then start the target flow with `createInitialFlowState`. When a user selects a runtime `flow_start` option, the engine should append the user message and start the target flow the same way. In both cases, the previous neutral or completed flow should not be resumable. Neutral routing flows are stepping stones, not tasks the user needs to return to.

The existing `entry_phrase` switching behavior remains unchanged for autocomplete-driven flow switching. Suspending and resuming still apply to regular flow switching unless safety rules block it.

When the active node is a result node from a non-neutral, non-post-flow flow, `resolveOptions` should include a runtime option:

```ts
{
  kind: 'flow_start',
  id: 'post-flow-next-step-start',
  label: 'Escolher o que fazer agora',
  flowId: 'post-flow-next-step'
}
```

This option should not appear while already inside `post-flow-next-step`, and it should not replace global actions. Users must always be able to end, seek support, view contacts, or view education without going through another flow.

## UI Integration

`OrientationScreen` should replace `INTRO_STARTERS` with intro starters that include `flowId` and `recordAsMessage`.

Starting a conversation should call:

```ts
createInitialFlowStateFromRegistry(flows, starter.flowId)
```

The typing delay, accessible log, exact-match composer behavior, autocomplete suggestions, direct option click behavior, and pending navigation behavior should remain unchanged.

For "Outro", the screen should start `orientation-understand-feelings` and avoid recording "Outro" as a user message, matching the current no-message behavior.

## Error Handling

Validation should fail fast when:

- a flow purpose is present but not one of the allowed values;
- a `flow_start` effect is missing a target flow ID;
- a registered `flow_start` target does not exist in the same registry.

Runtime should throw a clear error if a validated registry is bypassed and a selected `flow_start` target cannot be found.

## Testing

Add flow-engine tests for:

- valid purpose metadata;
- invalid purpose metadata;
- invalid `flow_start` effect shape;
- invalid `flow_start` target in a registered flow;
- selecting a neutral-flow option starts the target flow and does not suspend the neutral flow;
- result nodes on regular flows offer "Escolher o que fazer agora";
- `post-flow-next-step` does not offer itself again.

Add orientation UI tests for:

- intro starters use neutral-flow copy;
- selecting each intro starts the expected neutral flow;
- "Outro" starts the default neutral flow without recording "Outro";
- selecting a curated neutral option reaches the intended specific flow;
- post-flow routing appears after a regular result.

Update content tests to include the new flow IDs and purpose metadata.

## Rollout

The change is content/model/runtime only and stays local to the main app. No migration is required because current persisted flow state does not exist. Existing regular flows remain valid because `purpose` is optional.

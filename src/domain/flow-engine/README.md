# Flow Engine

Deterministic guided-flow runtime, validation, switching, and safety-rule helpers.

This domain is React-independent. It powers the constrained orientation chat by loading flow content, resolving valid runtime options, advancing through predefined nodes, suspending/resuming flows, and validating flow records.

Current guardrails:

- no free-text interpretation;
- no fake-AI behavior;
- no persistence of chat transcripts;
- no UI imports from this domain layer.

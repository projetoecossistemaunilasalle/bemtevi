# BemTeVi Documentation

> **Living handbook.** This index and the documents marked **Current** describe the repository as implemented and were audited on **2026-08-12**. Files under `docs/fronts`, `docs/plans`, and `docs/superpowers` preserve historical intent and implementation reasoning; they are not current-status trackers.

BemTeVi is a Portuguese, mobile-first mental-health support PWA for educators. It helps a person pause, reflect through deterministic guided flows, learn from curated material, and find support without creating a public account or saving sensitive conversation data.

The shortest useful mental model is:

```text
public anonymous experience
  + deterministic orientation engine
  + reviewed, publishable content
  + immediate and local support paths
  + a protected editorial dashboard
```

## Explore Interactively

The [BemTeVi Project Atlas](../public/project-atlas/index.html) is a self-contained interactive guide. It provides:

- role-based reading paths;
- a user-journey simulator;
- a clickable architecture map;
- current, enabled, and gated capability filters;
- a searchable decision explorer;
- direct links from product behavior to its implementation.

It can be opened directly from the filesystem. After a normal GitHub Pages deployment it is also available at `/bemtevi/project-atlas/`.

The Markdown handbook complements the atlas with reviewable detail, Mermaid diagrams, tables, and explicit source references.

## Start By Role

| If you are...                          | Start here                                    | Then read                                                                                     |
| -------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Product or design                      | [Vision](./VISION.md)                         | [Experience and capabilities](./EXPERIENCE.md), [Decisions](./DECISIONS.md)                   |
| Engineering                            | [Architecture](./ARCHITECTURE.md)             | [Development](./DEVELOPMENT.md), [Privacy and safety](./PRIVACY-AND-SAFETY.md)                |
| Content editor                         | [Content operations](./CONTENT-OPERATIONS.md) | [Experience and capabilities](./EXPERIENCE.md), [Privacy and safety](./PRIVACY-AND-SAFETY.md) |
| Clinical, editorial, or legal reviewer | [Privacy and safety](./PRIVACY-AND-SAFETY.md) | [Product requirements](./PRD.md), [Decisions](./DECISIONS.md)                                 |
| New contributor                        | [README](../README.md)                        | [Architecture](./ARCHITECTURE.md), [Development](./DEVELOPMENT.md)                            |

## Current Handbook

| Document                                          | Question it answers                                                              | Status                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Vision](./VISION.md)                             | Why does BemTeVi exist, what promise does it make, and what could it become?     | **Current**                                     |
| [Experience and capabilities](./EXPERIENCE.md)    | What can each user do, and how do the journeys connect?                          | **Current**                                     |
| [Architecture](./ARCHITECTURE.md)                 | How do the runtime, layers, data flows, and failure modes work?                  | **Current**                                     |
| [Content operations](./CONTENT-OPERATIONS.md)     | How is content modeled, drafted, validated, previewed, published, and recovered? | **Current**                                     |
| [Privacy and safety](./PRIVACY-AND-SAFETY.md)     | What data exists, where does it go, and which safety constraints are deliberate? | **Current**                                     |
| [Development](./DEVELOPMENT.md)                   | How do I set up, test, build, deploy, and troubleshoot the project?              | **Current**                                     |
| [Decisions](./DECISIONS.md)                       | Why were the major product and technical choices made?                           | **Current**                                     |
| [Product requirements](./PRD.md)                  | Which outcomes and guardrails define the product?                                | **Direction**, reconciled with current behavior |
| [Project context](./Project-Context.md)           | What compact context should a coding or review agent load first?                 | **Current summary**                             |
| [Front status tracker](./front-status-tracker.md) | Which original project fronts are delivered or still open?                       | **Current summary**                             |

## Historical Record

The repository intentionally keeps detailed planning artifacts because they explain tradeoffs that are not obvious from final code.

| Area                                            | Use it for                                                     | Do not use it for                               |
| ----------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| [`docs/fronts`](./fronts/README.md)             | Original workstreams, product boundaries, and acceptance ideas | Current completion status                       |
| [`docs/plans`](./plans/README.md)               | Early implementation sequences and intended file boundaries    | Exact current commands or architecture          |
| [`docs/superpowers/specs`](./superpowers/specs) | Design rationale for specific features                         | A consolidated product roadmap                  |
| [`docs/superpowers/plans`](./superpowers/plans) | Detailed implementation history                                | Proof that every described step remains current |
| [`mocks`](../mocks/README.md)                   | UI decision prototypes and behavior experiments                | Production behavior                             |

## Source-Of-Truth Order

When two documents disagree, use this order:

1. Executable code, tests, migrations, and deployment workflows.
2. The current handbook documents listed above.
3. `docs/PRD.md` for product direction and guardrails.
4. Dated specs, plans, mockups, and old status notes for historical context.

This order is important because public content is also dynamic: a valid Neon `published_content` snapshot replaces the content bundled in `src/content` at runtime. Repository content is the fallback and schema example, not necessarily the exact live copy.

## Status Language

The handbook uses four labels consistently:

| Label         | Meaning                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Current**   | Implemented and verified in the repository at the audit date                                       |
| **Direction** | Product intent that should guide changes but may not be fully implemented                          |
| **Enabled**   | The architecture has an extension seam, but the capability is not a committed feature              |
| **Gated**     | Deliberately blocked until clinical, editorial, legal, privacy, security, or product review occurs |

## Documentation Contract

Update the handbook in the same change when any of these contracts change:

| Change                                                  | Documentation to update                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| Public route or journey                                 | `EXPERIENCE.md`, `ARCHITECTURE.md`, Project Atlas |
| Persistence, network call, analytics, auth, or location | `PRIVACY-AND-SAFETY.md`, `DECISIONS.md`           |
| Content schema, validation, dashboard, or publishing    | `CONTENT-OPERATIONS.md`, `ARCHITECTURE.md`        |
| Environment variable, command, CI, build, or deployment | `DEVELOPMENT.md`, root `README.md`                |
| Product promise, audience, non-goal, or success measure | `VISION.md`, `PRD.md`                             |
| Reversal or addition of a major tradeoff                | `DECISIONS.md` and the relevant dated spec        |

Before merging documentation changes, run `pnpm run format:check`. Before merging implementation changes, run the full `pnpm run check` gate.

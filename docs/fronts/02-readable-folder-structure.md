# Front 02 — Readable Folder Structure

## Goal

Create a folder structure that is easy to read, easy to scale, and friendly to both developers and future AI agents.

The structure should make product domains visible.

---

## Principles

1. Features should be obvious.
2. Domain logic should not live inside React components.
3. Editable content should not be hidden inside JSX.
4. The guided-flow engine should be independent from UI.
5. Future dashboard-editable data should live in JSON-compatible structures.
6. Privacy-sensitive logic should be explicit and easy to audit.

---

## Recommended Structure

```txt
src/
  app/
    App.tsx
    router.tsx
    routes.ts
    providers.tsx
    shell/
      AppShell.tsx
      BottomNav.tsx
      TopBar.tsx

  design-system/
    components/
      Button.tsx
      Card.tsx
      Badge.tsx
      Callout.tsx
      Page.tsx
      ActionCard.tsx
    forms/
      Combobox.tsx
      OptionChip.tsx
    feedback/
      EmptyState.tsx
      LoadingState.tsx
    chat/
      ChatBubble.tsx
      ChatTranscript.tsx
    styles/
      tokens.css

  features/
    home/
      HomeScreen.tsx
      OnboardingIntro.tsx
      PhilosophyCard.tsx

    support/
      SupportScreen.tsx
      SupportContactCard.tsx
      BreathingExerciseCard.tsx

    orientation/
      OrientationScreen.tsx
      FlowEntryScreen.tsx
      GuidedChatScreen.tsx
      components/

    contacts/
      ContactsScreen.tsx
      ServiceCard.tsx
      LocationPermissionPrompt.tsx

    education/
      EducationLibraryScreen.tsx
      ResourceDetailScreen.tsx
      ResourceCard.tsx

  domain/
    flow-engine/
      types.ts
      loadFlows.ts
      validateFlow.ts
      resolveOptions.ts
      advanceFlow.ts
      suspendFlow.ts
      scoreFlow.ts
      safetyRules.ts

    questionnaires/
      types.ts
      questionnaireRules.ts

    resources/
      types.ts

    services/
      types.ts

    privacy/
      types.ts
      sessionPolicy.ts
      analyticsPolicy.ts

  content/
    flows/
      registry.json
      srq20.json
      work-stress.json
      sleep-anxiety.json
      sadness-helplessness.json
      other.json

    resources/
      resources.json

    services/
      canoas-services.json
      national-services.json

    support/
      contacts.json
      breathing.json

    copy/
      home.json
      privacy.json
      onboarding.json

  lib/
    analytics/
      analytics.ts
      events.ts
    geo/
      distance.ts
    validation/
      jsonSchema.ts

  tests/
    fixtures/
```

---

## Naming Conventions

Use product language for user-facing features:

```txt
home
orientation
support
contacts
education
```

Use technical language only where it clarifies architecture:

```txt
domain
flow-engine
design-system
content
lib
```

Avoid emotionally heavy names in routes and files where possible. For example, prefer:

```txt
features/support
```

over:

```txt
features/crisis
```

Internally, safety rules may still use precise names when needed, but product-facing naming should be calm.

---

## What Belongs Where

### `features/`

React screens and feature-specific UI.

### `domain/`

Business/domain logic independent from React.

Examples:

- flow runtime;
- scoring;
- safety rules;
- questionnaire behavior;
- resource types;
- privacy policy rules.

### `content/`

Editable or future-dashboard data.

Examples:

- flow JSON;
- services;
- resources;
- copy blocks;
- support contacts.

### `design-system/`

Reusable visual primitives.

### `lib/`

Generic utilities that are not specific to BemTeVi’s domain.

---

## Acceptance Criteria

- A new developer can find every main product area in under one minute.
- The flow engine can be tested without rendering React.
- Flow files can be edited without touching TypeScript.
- Resource and service content is not embedded in JSX.
- Privacy-sensitive logic has a clear location.

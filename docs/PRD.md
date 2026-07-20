# BemTeVi — Product Requirements Document

**Version:** 1.1  
**Status:** Draft  
**Audience:** Product, Design, Development, Clinical Review  
**Product Name:** BemTeVi

---

## 1. Product Vision

BemTeVi is a mental-health support platform for teachers, especially public school teachers, designed to provide a safe, welcoming, privacy-preserving space where users can reflect on their emotional state, access guided orientation, find curated mental-health resources, and discover professional support options.

The platform does not diagnose, does not replace professional care, and does not collect personally identifiable information by default.

Its role is to inform, orient, support, and connect.

---

## 2. Target Users

### Primary Users

Teachers, with an initial emphasis on public school teachers.

### Initial Geographic Focus

The initial support directory may prioritize Canoas, RS, but the product itself should not be architected as Canoas-only.

### Context of Use

The typical user may be:

- emotionally exhausted;
- time-constrained;
- skeptical of institutional or digital tools;
- concerned about privacy;
- unsure whether what they are feeling is “serious enough” to seek help.

BemTeVi must earn trust quickly and avoid feeling like a clinical intake system.

---

## 3. Product Principles

### Welcoming over clinical

The app should feel like a trusted, supportive colleague — not a hospital form.

### Anonymous by default

No login, account, CPF, email, school ID, or personal identification.

### Action over information

The app should always help the user take a next step.

### Honest constraints

The guided chat is not real AI. It is a structured, guided conversation with predefined options.

### Privacy by design

Any persistence, analytics, location behavior, or data collection must be explicitly reviewed before implementation.

### Calm safety

Immediate support must always be available, but the app should avoid alarmist language and visual treatment.

---

## 4. Product Scope

BemTeVi is a mobile-first Progressive Web App.

The entire app should be installable and usable as a PWA.

---

## 5. Information Architecture

### Primary Navigation

Persistent bottom navigation:

| Section           | Suggested Label | Route         |
| ----------------- | --------------- | ------------- |
| Home              | Início          | `/`           |
| Orientation       | Orientação      | `/orientacao` |
| Contacts          | Contatos        | `/contatos`   |
| Immediate Support | Apoio           | `/apoio`      |

The final visible label for the immediate support tab should be reviewed by product/design. Avoid route path `/crise`.

### Secondary Navigation

| Section           | Route                   |
| ----------------- | ----------------------- |
| Education Library | `/educacao`             |
| Resource Detail   | `/educacao/:resourceId` |
| Privacy           | `/privacidade`          |

The education library may be accessed from result screens, Home, and resource recommendations.

---

## 6. Feature Requirements

## 6.1 Home, Philosophy & Onboarding

The Home screen is responsible for explaining BemTeVi’s purpose and building trust.

It should include:

- warm welcome;
- brief explanation of the app’s philosophy;
- privacy/anonymity reassurance;
- three equal-weight entry paths;

The app-style starting screen is the onboarding-style explanation. Do not duplicate it as a visible “Como funciona” card or section on Home; Home should become actionable after onboarding.

### Entry Paths

Suggested equal-weight actions:

- understand how I am feeling;
- talk through what I am experiencing;
- find professional support.

Immediate support remains persistently available through the bottom navigation.

### One-Time Onboarding

A mobile-app-style onboarding may be implemented, but any persistence of “already seen” status must be reviewed by the Privacy/LGPD front.

When onboarding is implemented as the app starting screen, Home must not include a regular “Como funciona” section. If repeat access is needed later, use a distinct help/onboarding route or settings entry.

---

## 6.2 Immediate Support Screen

The immediate support screen is available at all times.

Recommended route:

```txt
/apoio
```

The screen includes:

- grounding message;
- CVV 188;
- SAMU 192;
- Bombeiros 193;
- direct call actions;
- calming breathing exercise.

The screen should avoid red-first or alarmist visual language.

The breathing exercise should be treated as a first-care action, not decorative filler.

---

## 6.3 Guided Orientation Chat

The guided chat is the core interactive feature.

It should operate as a constrained guided conversation:

- bot messages appear on the left;
- user responses appear on the right;
- the user may type into an autocomplete input;
- only predefined options can be submitted;
- current options are also shown as chips before typing;
- chips hide when the input exactly matches an option label and reappear when it no longer does.

The app must not pretend that this is real AI.

---

## 6.4 JSON-Driven Flow Framework

Each guided flow should be represented as a JSON-compatible document.

Each flow includes:

- stable ID;
- version;
- locale;
- title;
- type;
- status;
- entry node;
- entering phrases;
- transition message;
- nodes;
- options;
- result rules;
- safety rules if applicable.

### Entering Phrases

Each flow declares `entering_phrases`.

The chat autocomplete combines:

```txt
current node options
+ entering phrases from other flows
+ global support/navigation actions
```

This allows users to change direction without requiring free text or real NLP.

### Flow Switching

When the user selects an entering phrase from another flow:

1. The current flow is suspended.
2. The new flow starts.
3. A transition message is shown.
4. The previous flow may be offered for resumption later unless a safety rule prevents it.

---

## 6.5 Questionnaire Framework

Questionnaires are specialized guided flows.

The framework should support:

- consent;
- fixed question sets;
- scoring;
- thresholds;
- result rules;
- interruption rules;
- recommendation mapping.

SRQ-20 is the first questionnaire implementation and should be treated as the framework’s first major test flow.

The architecture should support additional structured questionnaires later.

---

## 6.6 SRQ-20 Test Flow

SRQ-20 requirements:

- user consents before beginning;
- user is told this is SRQ-20;
- questionnaire is not disguised;
- 20 yes/no questions;
- affirmative answers are scored;
- score of 7 or more indicates possible mental distress and leads to supportive resources;
- result copy avoids diagnosis language;
- suicidal ideation question interrupts immediately if affirmative;
- immediate support is surfaced;
- the interrupted flow is not offered for resumption.

SRQ-20 must have automated tests.

---

## 6.7 Contacts Directory

The contacts directory lists professional support services.

Initial content may focus on Canoas, RS, but the product model should support other cities and broader teacher audiences.

Each service card includes:

- service name;
- type badge;
- city/state;
- address;
- phone number;
- opening hours;
- notes if needed.

### Optional Location Sorting

Location permission may later be used to sort nearby services.

Rules:

- optional only;
- clear explanation before permission;
- no storage;
- no transmission;
- app works without permission.

Implementation should wait for Privacy/LGPD review.

---

## 6.8 Education Library

The education library provides curated mental-health resources for teachers.

Each resource card includes:

- title;
- source badge;
- description;
- tags;
- access button.

Resources may be:

- in-app articles;
- annotated summaries;
- PDFs;
- external links.

All resources should have editorial/clinical review metadata.

Flow results may recommend a primary resource by stable resource ID.

---

## 7. Privacy and LGPD

BemTeVi must avoid collecting personally identifiable information by default.

The platform should not request:

- name;
- email;
- CPF;
- school ID;
- teacher registration;
- account login.

### Session Data

Session and persistence policy must be verified before implementing saving features.

Until verified:

- no saved questionnaire answers;
- no saved chat transcripts;
- no localStorage for sensitive flow state;
- no persistent progress recovery;
- no stored location.

Runtime in-memory state is allowed for current interaction.

### Location

Location is optional and only for on-device sorting if approved.

### Onboarding Persistence

Remembering whether onboarding was seen requires privacy review.

---

## 8. Anonymous Analytics

Analytics are not automatically included in MVP.

If implemented, analytics must be:

- aggregate only;
- cookieless;
- non-identifying;
- free of advertising networks;
- disclosed to users.

Allowed event categories may include:

- screen views;
- resource interactions;
- flow starts;
- flow completions by result band;
- support contact clicks.

Never collect:

- questionnaire answers;
- chat transcript;
- individual path;
- location;
- device identifiers;
- IP in identifiable form.

---

## 9. Design Requirements

BemTeVi should feel:

- calm;
- safe;
- human;
- welcoming;
- teacher-oriented;
- non-clinical;
- non-alarmist.

Visual hierarchy:

```txt
white / soft background
green primary accent
blue secondary accent
warm neutral surfaces
```

The current prototype’s visual mood is a good starting point, but the real app should use a reusable design system.

Avoid:

- red-first crisis/support treatment;
- heavy clinical symbols;
- excessive forms;
- fake-AI framing;
- fragile remote generated images.

---

## 10. Technical Requirements

- React.
- React Router.
- Vite.
- TypeScript.
- Full-app PWA.
- JSON-compatible content models.
- Flow validation scripts.
- Questionnaire tests.
- No backend required for MVP unless analytics or dashboard needs change.
- No account system.
- No persistence of sensitive data before privacy review.

---

## 11. Out of Scope for Current Version

- Real AI or NLP responses.
- Login/accounts.
- Cross-session memory.
- Saved questionnaire history.
- Push notifications.
- Telepsychology/live support.
- Integration with health systems.
- Native app store distribution.
- Admin dashboard implementation.
- Backend-driven content editing.
- Analytics before privacy review.

---

## 12. MVP Recommendation

A strong MVP includes:

1. Full app routing and PWA shell.
2. Home with philosophy/trust explanation.
3. Persistent bottom navigation.
4. Immediate support screen at `/apoio`.
5. Contacts directory from structured data.
6. Education library from structured data.
7. JSON-driven guided flow framework.
8. One non-questionnaire guided flow.
9. SRQ-20 as first questionnaire test flow.
10. Flow validation and tests.
11. Privacy/session policy documented before saving features.

---

## 13. Success Criteria

BemTeVi succeeds if a teacher can:

- understand what the app is within seconds;
- trust that they are not being identified;
- access immediate support quickly;
- follow a guided orientation without feeling judged;
- receive a useful next step;
- find professional contacts;
- access reliable educational resources.

The product should feel supportive without pretending to be a therapist, diagnostic system, or real AI.

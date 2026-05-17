# SeCuida — Project Fronts Overview

## Purpose

This document defines the main project fronts for transforming the current SeCuida demo into a real privacy-preserving, mobile-first PWA for teacher mental-health support.

The current prototype already establishes a calm visual direction and basic screens, but the real product requires a broader architecture: routing, content modeling, guided flows, questionnaire support, privacy constraints, curated resources, local support contacts, and future dashboard-readiness.

The official product name is **SeCuida**.

---

## Product Direction

SeCuida is a mental-health support platform for teachers, especially public school teachers, designed to offer orientation, educational resources, immediate support paths, and professional contact information without requiring login or personal identification.

The app does not diagnose, does not replace professional care, and should not feel like a clinical intake system.

Its role is to:

- welcome;
- orient;
- inform;
- connect;
- offer immediate support paths when needed;
- preserve user trust through anonymity and privacy by design.

---

## Front List

The project is divided into the following fronts:

1. **App Architecture & PWA**
2. **Readable Folder Structure**
3. **Design System & UI Primitives**
4. **Content/Data Modeling**
5. **Guided Flow / Chatbot Framework**
6. **Questionnaire Framework & SRQ-20 Test Flow**
7. **Home, Philosophy & Onboarding**
8. **Immediate Support Screen**
9. **Contacts Directory**
10. **Education Library**
11. **Privacy, LGPD & Session Policy**
12. **Anonymous Analytics**
13. **Quality, Validation & Tooling**
14. **Dashboard Readiness**

---

## Detailed Breakdown Documents

Each front has a corresponding `A` breakdown document with implementation slices, risks, expected files, validation commands, and definition of done:

| Front | Parent Plan | Breakdown |
|---|---|---|
| 01 | [`01-app-architecture-pwa.md`](./01-app-architecture-pwa.md) | [`01a-app-architecture-breakdown.md`](./01a-app-architecture-breakdown.md) |
| 02 | [`02-readable-folder-structure.md`](./02-readable-folder-structure.md) | [`02a-folder-structure-breakdown.md`](./02a-folder-structure-breakdown.md) |
| 03 | [`03-design-system-ui.md`](./03-design-system-ui.md) | [`03a-design-system-breakdown.md`](./03a-design-system-breakdown.md) |
| 04 | [`04-content-data-modeling.md`](./04-content-data-modeling.md) | [`04a-content-data-modeling-breakdown.md`](./04a-content-data-modeling-breakdown.md) |
| 05 | [`05-guided-flow-chatbot-framework.md`](./05-guided-flow-chatbot-framework.md) | [`05a-guided-flow-chatbot-framework-breakdown.md`](./05a-guided-flow-chatbot-framework-breakdown.md) |
| 06 | [`06-questionnaire-framework-srq20.md`](./06-questionnaire-framework-srq20.md) | [`06a-questionnaire-framework-srq20-breakdown.md`](./06a-questionnaire-framework-srq20-breakdown.md) |
| 07 | [`07-home-philosophy-onboarding.md`](./07-home-philosophy-onboarding.md) | [`07a-home-philosophy-onboarding-breakdown.md`](./07a-home-philosophy-onboarding-breakdown.md) |
| 08 | [`08-immediate-support.md`](./08-immediate-support.md) | [`08a-immediate-support-breakdown.md`](./08a-immediate-support-breakdown.md) |
| 09 | [`09-contacts-directory.md`](./09-contacts-directory.md) | [`09a-contacts-directory-breakdown.md`](./09a-contacts-directory-breakdown.md) |
| 10 | [`10-education-library.md`](./10-education-library.md) | [`10a-education-library-breakdown.md`](./10a-education-library-breakdown.md) |
| 11 | [`11-privacy-lgpd-session.md`](./11-privacy-lgpd-session.md) | [`11a-privacy-lgpd-session-breakdown.md`](./11a-privacy-lgpd-session-breakdown.md) |
| 12 | [`12-anonymous-analytics.md`](./12-anonymous-analytics.md) | [`12a-anonymous-analytics-breakdown.md`](./12a-anonymous-analytics-breakdown.md) |
| 13 | [`13-quality-validation-tooling.md`](./13-quality-validation-tooling.md) | [`13a-quality-validation-tooling-breakdown.md`](./13a-quality-validation-tooling-breakdown.md) |
| 14 | [`14-dashboard-readiness.md`](./14-dashboard-readiness.md) | [`14a-dashboard-readiness-breakdown.md`](./14a-dashboard-readiness-breakdown.md) |

Additional Privacy/LGPD decision note:

- [`12b-anonymous-analytics-lgpd-policy.md`](./12b-anonymous-analytics-lgpd-policy.md)

---

## High-Level Dependency Map

```txt
App Architecture & PWA
  ├─ Readable Folder Structure
  ├─ Design System & UI Primitives
  ├─ Privacy, LGPD & Session Policy
  └─ Content/Data Modeling
       ├─ Guided Flow / Chatbot Framework
       │    └─ Questionnaire Framework & SRQ-20 Test Flow
       ├─ Contacts Directory
       ├─ Education Library
       ├─ Home, Philosophy & Onboarding
       └─ Immediate Support Screen

Anonymous Analytics depends on Privacy/LGPD.
Dashboard Readiness depends on Content/Data Modeling.
Quality/Tooling supports every front.
````

---

## Suggested Milestones

### Milestone 1 — Real App Foundation

* Preserve official name: SeCuida.
* Introduce React Router.
* Define full-app PWA setup.
* Replace local `currentView` navigation with routes.
* Create app shell and persistent bottom navigation.
* Define readable folder structure.
* Set document language to `pt-BR`.
* Establish base design primitives.

### Milestone 2 — Static Product Surfaces

* Rebuild Home as a trust/philosophy entry point.
* Build Immediate Support screen under a calmer route name.
* Build Contacts Directory from data files.
* Build Education Library from data files.
* Extract crisis contacts, support services, resources, and copy from JSX.

### Milestone 3 — Guided Flow Framework

* Define JSON flow schema.
* Create flow registry.
* Build flow validator.
* Build deterministic runtime engine.
* Build constrained chat UI.
* Support `entering_phrases` for flow switching.
* Implement one non-questionnaire guided flow.

### Milestone 4 — Questionnaire Framework + SRQ-20

* Treat SRQ-20 as the first validation/test case of a generic questionnaire framework.
* Add consent handling.
* Add scoring.
* Add interruption/safety rules.
* Add tests.
* Validate that the framework can later support other structured questionnaires.

### Milestone 5 — Privacy-Sensitive Enhancements

* Evaluate session policy.
* Decide whether any saving/persistence is allowed.
* Postpone saving features until Privacy/LGPD verification is complete.
* Add optional location sorting for contacts only after privacy review.
* Add anonymous analytics only after taxonomy and disclosure review.

---

## Naming and Route Principles

Avoid emotionally loaded route names when possible.

Recommended public routes:

```txt
/
 /orientacao
 /apoio
 /contatos
 /educacao
 /educacao/:resourceId
```

Where:

* `/apoio` is the immediate support screen.
* The bottom navigation label may still be carefully chosen through design/copy review.
* Avoid `/crise` as the route path because the route itself can leak or reinforce a word the product may intentionally avoid surfacing.

---

## Strategic Principle

The real app should not be a larger version of the current demo.

It should become a structured product where React renders typed, validated domain content:

```txt
flows
questionnaires
resources
support contacts
service directories
privacy copy
home/onboarding copy
```

The UI should stay calm and human, but the architecture should be content-driven and dashboard-ready from the beginning.

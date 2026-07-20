# Front 03 — Design System & UI Primitives

## Goal

Preserve the current calm, welcoming visual direction while creating reusable UI primitives that prevent duplicated card, button, typography, and navigation patterns.

---

## Design Direction

BemTeVi should feel:

- calm;
- human;
- warm;
- trustworthy;
- non-clinical;
- not childish;
- not alarmist.

The current green/blue direction is strong and should remain. White should dominate, green should carry health/primary identity, and blue should support psychology/academic credibility.

---

## Improvements Over Current Demo

- Reduce raw hex colors inside components.
- Move repeated card patterns into components.
- Remove dependency on fragile remote generated image URLs.
- Create a consistent illustration/logo style.
- Ensure all screens use the same spacing, typography, and touch target rules.
- Make accessibility part of the primitives, not a later patch.

---

## Core Components

```txt
Button
Card
Badge
Callout
Page
PageHeader
ActionCard
ResourceCard
ServiceCard
SupportContactCard
BottomNav
TopBar
ChatBubble
ChatTranscript
OptionChip
Combobox
BreathingExerciseCard
```

---

## Typography

Continue with accessible, highly readable fonts.

The current use of Atkinson Hyperlegible and Source Sans is directionally good. Formalize typography tokens instead of relying on ad-hoc classes.

Suggested scale:

```txt
display
headline-lg
headline-md
headline-sm
body-lg
body-md
body-sm
label
caption
```

---

## Color Rules

Avoid red for immediate support unless legally or clinically necessary.

Recommended semantic tokens:

```txt
background
surface
surface-muted
surface-raised
primary
primary-soft
secondary
secondary-soft
text
text-muted
border
warning-soft
success-soft
support-soft
```

Use semantic names, not emotion-heavy names like `danger`, unless strictly required.

---

## Motion Rules

Use motion gently:

- route fade/slide;
- chat bubble entrance;
- breathing exercise animation;
- bottom nav active transition.

Avoid heavy animation on serious support screens.

---

## Accessibility Rules

- Minimum touch target: 44px.
- Buttons must have visible focus states.
- Icons should not carry meaning alone.
- Chat options must be keyboard-selectable.
- Combobox must follow accessible combobox behavior.
- Breathing animation must not rely only on animation; text steps must be visible.
- Support phone links must be clear and large.

---

## Acceptance Criteria

- Repeated cards are componentized.
- New screens can be built mostly from design-system primitives.
- No new screen should need to invent its own button/card pattern.
- Components support accessible labels and focus states.
- Design tokens cover the common visual cases.

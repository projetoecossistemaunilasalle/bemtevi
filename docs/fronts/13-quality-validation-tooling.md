# Front 13 — Quality, Validation & Tooling

## Goal

Create enough tooling to safely evolve a content-heavy, privacy-sensitive app.

For BemTeVi, content validation is as important as code validation.

---

## Recommended Tools

```txt
TypeScript strict mode
ESLint
Prettier
Vitest
React Testing Library
Zod or Valibot
tsx for scripts
```

---

## Core Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest",
    "validate:flows": "tsx scripts/validate-flows.ts",
    "check": "npm run typecheck && npm run lint && npm run validate:flows && npm run test && npm run build"
  }
}
```

---

## Flow Validation

The validator should check:

```txt
valid JSON
schema compliance
unique IDs
entry node exists
all next references exist
all options have labels
entering phrases are present
no duplicate entering phrases
safety rules point to valid nodes
recommendation IDs exist
questionnaire scoring rules are valid
```

---

## Tests

Priority tests:

```txt
flow engine
flow switching
suspended flow behavior
questionnaire scoring
safety interruption
resource lookup
contacts sorting
route rendering
support screen actions
```

---

## Acceptance Criteria

- `npm run check` exists.
- Flow validation blocks invalid content.
- SRQ-20 test flow has automated tests.
- App builds successfully.
- Design-system components have basic render/accessibility tests.

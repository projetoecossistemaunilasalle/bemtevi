# Folder Structure And Feature Boundaries Plan

## Goal

Make BemTeVi readable by product domain so future work can land without turning the app back into a large view folder.

## Source Context

Front 02 requires product-facing feature folders, explicit domain/content/design-system boundaries, and removal of `src/views` after migration.

## Target Structure

```txt
src/
  app/
  features/
    home/
    orientation/
    support/
    contacts/
    education/
    privacy/
  design-system/
    components/
    forms/
    feedback/
    styles/
  domain/
    content/
    copy/
    flow-engine/
    questionnaires/
    resources/
    services/
    support/
    privacy/
  content/
    copy/
    flows/
    resources/
    services/
    support/
  lib/
    geo/
    validation/
```

## RED-GREEN-REFACTOR Steps

### Step 1: Move Screens Into Features

**RED:** Ask a subagent to search for imports from `src/views` and report every current screen file.

**GREEN:** Ask a worker subagent to move:

- `HomeView` to `features/home/HomeScreen`
- `AssessmentView` to `features/orientation/OrientationScreen`
- `EmergencyView` to `features/support/SupportScreen`
- `NetworkView` to `features/contacts/ContactsScreen`

**REFACTOR:** Ask a review subagent to verify behavior did not change during the move and `src/views` imports are gone.

### Step 2: Add Reserved Feature Owners

**RED:** Ask a subagent to confirm education and privacy routes have no feature-owned screens.

**GREEN:** Ask a worker subagent to create education and privacy screens under their future feature folders.

**REFACTOR:** Ask a review subagent to ensure these are clearly scoped placeholders and do not add hidden data or persistence.

### Step 3: Establish Non-React Boundaries

**RED:** Ask a subagent to list planned domain/content/design-system/lib folders missing from the tree.

**GREEN:** Ask a worker subagent to add folders and lightweight README/type files where useful.

**REFACTOR:** Ask a review subagent to verify domain/content/lib files do not import React or feature screens.

## Acceptance Criteria

- A developer can find each product area by folder name.
- Route screens live under `src/features/*`.
- `src/views` is no longer referenced.
- Domain and content boundaries are present but not overbuilt.
- Analytics and persistence folders are not introduced early.

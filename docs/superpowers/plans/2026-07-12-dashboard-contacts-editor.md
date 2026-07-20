# Dashboard Contacts Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact dashboard tab for creating, editing, validating, removing, persisting, and exporting the local support services shown on `/contatos`.

**Architecture:** Extend the existing shipped-content/draft/export pipeline with service-directory records, then render them through a focused master-detail `ContactsDashboard`. Keep formatting and validation logic in small pure helpers; `DashboardRoute` remains the single owner of persisted draft mutations.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Vitest 4, Testing Library, localStorage dashboard drafts

---

## File Structure

- Create `src/dev-dashboard/contacts/contactDrafts.ts`: pure new-contact, phone normalization, and badge-tone helpers.
- Create `src/dev-dashboard/contacts/contactsValidation.ts`: service-directory validation producing dashboard issues.
- Create `src/dev-dashboard/contacts/ContactsDashboard.tsx`: compact responsive list-and-editor UI.
- Create `src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts`: helper behavior.
- Create `src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts`: contact validation behavior.
- Create `src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx`: interaction and accessibility behavior.
- Modify `src/dev-dashboard/content/shippedContent.ts`: expose shipped services.
- Modify `src/dev-dashboard/draft-storage/dashboardStorage.ts`: persist, migrate, merge, and remove service drafts.
- Modify `src/dev-dashboard/components/DashboardShell.tsx`: add the `Contatos` tab.
- Modify `src/dev-dashboard/draft-storage/dashboardTabStorage.ts`: restore `contacts` as a valid tab.
- Modify `src/dev-dashboard/validation/validationTypes.ts`: allow contact validation issues.
- Modify `src/dev-dashboard/DashboardRoute.tsx`: aggregate validation and wire contact draft callbacks.
- Modify `src/dev-dashboard/export/exportBundle.ts`: export changed and removed services.
- Modify `src/dev-dashboard/export/ExportDashboard.tsx`: show contact change counts.
- Modify the existing dashboard storage, route, and export tests to cover end-to-end integration.

### Task 1: Pure Contact Helpers And Validation

**Files:**

- Create: `src/dev-dashboard/contacts/contactDrafts.ts`
- Create: `src/dev-dashboard/contacts/contactsValidation.ts`
- Create: `src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts`
- Create: `src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts`
- Modify: `src/dev-dashboard/validation/validationTypes.ts`

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { badgeToneForServiceType, createLocalService, normalizePhoneHref } from '../contactDrafts';

describe('contactDrafts', () => {
  it('derives a tel URL from a formatted phone number', () => {
    expect(normalizePhoneHref('(51) 3236-1500')).toBe('tel:5132361500');
  });

  it('creates the first unused stable local service ID', () => {
    const service = createLocalService(['service-local-1', 'service-local-2']);
    expect(service).toMatchObject({ id: 'service-local-3', type: 'Outro', badgeTone: 'neutral' });
    expect(service.review.status).toBe('pending_review');
  });

  it('maps common service types to existing badge tones', () => {
    expect(badgeToneForServiceType('CAPS')).toBe('primary');
    expect(badgeToneForServiceType('UBS')).toBe('secondary');
    expect(badgeToneForServiceType('Universidade')).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run helper tests and verify the missing-module failure**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts
```

Expected: FAIL because `../contactDrafts` does not exist.

- [ ] **Step 3: Implement the pure helper module**

```ts
import type { ServiceDirectoryEntry } from '../../domain/services/types';

export function normalizePhoneHref(phoneDisplay: string) {
  return `tel:${phoneDisplay.replace(/\D/g, '')}`;
}

export function badgeToneForServiceType(type: string): ServiceDirectoryEntry['badgeTone'] {
  const normalized = type.trim().toLocaleUpperCase('pt-BR');
  if (normalized === 'CAPS') return 'primary';
  if (normalized === 'UBS') return 'secondary';
  return 'neutral';
}

export function createLocalService(existingIds: Iterable<string>): ServiceDirectoryEntry {
  const ids = new Set(existingIds);
  let suffix = 1;
  while (ids.has(`service-local-${suffix}`)) suffix += 1;

  return {
    id: `service-local-${suffix}`,
    name: 'Novo contato',
    type: 'Outro',
    badgeTone: 'neutral',
    city: 'Canoas',
    state: 'RS',
    address: '',
    phoneDisplay: '',
    phoneHref: 'tel:',
    review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
  };
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run the command from Step 2.

Expected: PASS, 3 tests.

- [ ] **Step 5: Write failing validator tests**

```ts
import { describe, expect, it } from 'vitest';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
import { validateDashboardContacts } from '../contactsValidation';

const service: ServiceDirectoryEntry = {
  id: 'service-one',
  name: 'CAPS Centro',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 10',
  phoneDisplay: '(51) 3333-4444',
  phoneHref: 'tel:5133334444',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

describe('validateDashboardContacts', () => {
  it('accepts a complete normalized contact', () => {
    expect(validateDashboardContacts([service])).toEqual({ errors: [], warnings: [] });
  });

  it('reports field paths for missing required values, state, and phone mismatch', () => {
    const result = validateDashboardContacts([
      { ...service, name: ' ', state: 'R', phoneDisplay: '123', phoneHref: 'tel:999' },
    ]);
    expect(result.errors.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'contacts.0.name',
        'contacts.0.state',
        'contacts.0.phoneDisplay',
        'contacts.0.phoneHref',
      ]),
    );
  });

  it('reports duplicate IDs as a summary-level error', () => {
    const result = validateDashboardContacts([service, { ...service }]);
    expect(result.errors).toContainEqual(expect.objectContaining({ id: 'duplicate-contact-id:service-one' }));
  });
});
```

- [ ] **Step 6: Run validator tests and verify the missing-module failure**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts
```

Expected: FAIL because `../contactsValidation` does not exist.

- [ ] **Step 7: Add `contacts` to the validation area and implement validation**

Change the area union in `validationTypes.ts` to:

```ts
export type DashboardValidationArea = 'flows' | 'education' | 'contacts' | 'export';
```

Create `contactsValidation.ts` with `findDuplicateIds`, `normalizePhoneHref`, and `createValidationResult`. For each service index, emit errors with these exact paths and messages:

```ts
const requiredFields = [
  ['name', service.name, 'O nome do contato é obrigatório.'],
  ['type', service.type, 'O tipo de serviço é obrigatório.'],
  ['city', service.city, 'A cidade é obrigatória.'],
  ['address', service.address, 'O endereço é obrigatório.'],
] as const;

requiredFields.forEach(([field, value, message]) => {
  if (!value.trim()) {
    issues.push({
      level: 'error',
      area: 'contacts',
      id: `missing-${field}:${service.id}:${index}`,
      message,
      path: `contacts.${index}.${field}`,
    });
  }
});
```

Require `/^[A-Za-z]{2}$/` for state, at least eight digits for `phoneDisplay`, and exact equality between `phoneHref` and `normalizePhoneHref(phoneDisplay)`. Return `createValidationResult(issues)`.

- [ ] **Step 8: Run both contact unit tests**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 9: Commit the pure contact domain slice**

```powershell
git add src/dev-dashboard/contacts/contactDrafts.ts src/dev-dashboard/contacts/contactsValidation.ts src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts src/dev-dashboard/validation/validationTypes.ts
git commit -m "feat: add dashboard contact validation"
```

### Task 2: Contact Draft Storage And Migration

**Files:**

- Modify: `src/dev-dashboard/content/shippedContent.ts`
- Modify: `src/dev-dashboard/draft-storage/dashboardStorage.ts`
- Modify: `src/dev-dashboard/__tests__/dashboardStorage.test.ts`

- [ ] **Step 1: Extend storage tests with shipped, merged, removed, and migrated contacts**

Add a `ServiceDirectoryEntry` fixture and assertions equivalent to:

```ts
it('merges patched, added, and removed contacts', () => {
  const shippedService = { ...service, id: 'shipped-service', name: 'Original' };
  const removedService = { ...service, id: 'removed-service' };
  const addedService = { ...service, id: 'service-local-1', name: 'Adicionado' };
  const draft = {
    ...emptyDraft,
    contactPatches: [{ id: 'shipped-service', sourceIndex: 0, patch: { name: 'Editado' } }],
    addedContacts: [addedService],
    removedContactIds: ['removed-service'],
  };

  const merged = mergeDashboardDrafts(
    { flows: [], educationMaterials: [], educationGroups: [], contacts: [shippedService, removedService] },
    draft,
  );

  expect(merged.contacts).toEqual([{ ...shippedService, name: 'Editado' }, addedService]);
});

it('migrates v2 drafts by initializing contact collections', () => {
  localStorage.setItem(
    'bemtevi:dev-dashboard:drafts:v1',
    JSON.stringify({
      ...legacyV2Draft,
      schemaVersion: '2.0.0',
    }),
  );
  const loaded = loadDashboardDrafts();
  expect(loaded.schemaVersion).toBe('3.0.0');
  expect(loaded.contactPatches).toEqual([]);
  expect(loaded.addedContacts).toEqual([]);
  expect(loaded.removedContactIds).toEqual([]);
});
```

Also update every shipped-content fixture in this test file to include `contacts: []`, and assert `getShippedDashboardContent().contacts` contains the Canoas services.

- [ ] **Step 2: Run the storage test and verify type or assertion failures**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/__tests__/dashboardStorage.test.ts
```

Expected: FAIL because shipped content and draft state do not yet include contacts.

- [ ] **Step 3: Expose shipped service-directory records**

In `shippedContent.ts`, import `canoasServices` and `ServiceDirectoryEntry`, then add:

```ts
export interface DashboardShippedContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
}

export function getShippedDashboardContent(): DashboardShippedContent {
  return {
    flows: flowRegistry.flows,
    educationMaterials: resourcesContent.resources,
    educationGroups: educationResourceGroups,
    contacts: canoasServices.services,
  };
}
```

- [ ] **Step 4: Advance and migrate the draft schema**

In `dashboardStorage.ts`, import `ServiceDirectoryEntry`, change the version to `3.0.0`, and add:

```ts
contactPatches: Array<DashboardRecordPatch<ServiceDirectoryEntry>>;
addedContacts: ServiceDirectoryEntry[];
removedContactIds?: string[];
```

Initialize all three collections in `createEmptyDashboardDraftState`. Treat both `1.0.0` and `2.0.0` as known legacy versions and normalize all optional legacy collections with `?? []`, including the new contact fields. Unknown versions still reset to an empty v3 state.

- [ ] **Step 5: Merge contact drafts**

Add this to `mergeDashboardDrafts`:

```ts
const removedContactIds = new Set(drafts.removedContactIds ?? []);
const contacts = mergeRecords(shipped.contacts, drafts.contactPatches, drafts.addedContacts).filter(
  (contact) => !removedContactIds.has(contact.id),
);

return {
  flows,
  educationMaterials: mergeRecords(...),
  educationGroups: sortGroupsByOrder(educationGroups),
  contacts,
  defaultGroupOrder: drafts.defaultGroupOrder ?? 0,
};
```

- [ ] **Step 6: Run the storage test and verify it passes**

Run the command from Step 2.

Expected: PASS for the complete storage test file.

- [ ] **Step 7: Commit the storage slice**

```powershell
git add src/dev-dashboard/content/shippedContent.ts src/dev-dashboard/draft-storage/dashboardStorage.ts src/dev-dashboard/__tests__/dashboardStorage.test.ts
git commit -m "feat: persist dashboard contact drafts"
```

### Task 3: Compact Contacts Editor Component

**Files:**

- Create: `src/dev-dashboard/contacts/ContactsDashboard.tsx`
- Create: `src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx`

- [ ] **Step 1: Write a stateful component test for selection, editing, phone derivation, add, and remove**

Build a small test harness that owns `services` state and passes real callbacks to `ContactsDashboard`. Cover these visible behaviors:

```ts
expect(screen.getByRole('heading', { name: 'Contatos' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /CAPS Centro/ })).toHaveAttribute('aria-pressed', 'true');

await user.click(screen.getByRole('button', { name: /UBS Norte/ }));
expect(screen.getByLabelText('Nome')).toHaveValue('UBS Norte');

await user.clear(screen.getByLabelText('Telefone'));
await user.type(screen.getByLabelText('Telefone'), '(51) 99999-0000');
expect(onServiceChange).toHaveBeenLastCalledWith(
  1,
  'service-two',
  expect.objectContaining({ phoneDisplay: '(51) 99999-0000', phoneHref: 'tel:51999990000' }),
);

await user.click(screen.getByRole('button', { name: 'Novo contato' }));
expect(screen.getByLabelText('Nome')).toHaveValue('Novo contato');

await user.click(screen.getByRole('button', { name: 'Remover contato Novo contato' }));
await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato Novo contato' }));
expect(screen.queryByRole('button', { name: /Novo contato/ })).not.toBeInTheDocument();
```

Add separate cases for the empty state and inline error association (`aria-invalid="true"`).

- [ ] **Step 2: Run the component test and verify the missing-component failure**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx
```

Expected: FAIL because `../ContactsDashboard` does not exist.

- [ ] **Step 3: Implement the component shell and selection model**

Use this public contract:

```ts
export interface ContactsDashboardProps {
  services: ServiceDirectoryEntry[];
  validation: DashboardValidationResult;
  onServiceChange: (serviceIndex: number, serviceId: string, patch: Partial<ServiceDirectoryEntry>) => void;
  onServiceAdd: () => string;
  onServiceRemove: (serviceIndex: number, serviceId: string) => void;
}
```

Track the selected service ID, default to the first record, and derive a first-record fallback when the selected ID no longer exists. Before removing the selected record, choose the next or previous record ID; this avoids a state-repair effect. `Novo contato` calls `onServiceAdd()` and selects the returned ID.

Render:

```tsx
<section className="flex flex-col gap-stack-md">
  <header>
    <h2 className="font-headline-md text-on-surface">Contatos</h2>
    <p className="mt-1 font-body-md text-on-surface-variant">Edite os serviços que aparecem na rede de apoio.</p>
  </header>
  <div className="grid gap-stack-md lg:grid-cols-[280px_minmax(0,1fr)]">
    {/* compact list */}
    {/* focused form or empty state */}
  </div>
  <ValidationSummary result={validation} />
</section>
```

The list card uses `surface-container-lowest`, each service button includes name plus `${type} · ${city}`, and the selected button sets `aria-pressed` plus primary-container styling.

- [ ] **Step 4: Implement the focused form with shared field primitives**

Use `Field`, `issuesForPath`, `inputClass`, `inputInvalidClass`, `textareaClass`, `Button`, and `ConfirmButton`. Use `contacts.${selectedIndex}.<field>` paths. Render name and type, city/state in a responsive two-column row, address, phone, hours, and notes. Type changes also patch `badgeTone`; phone changes patch `phoneDisplay` and `phoneHref`; state changes uppercase the value and cap it at two characters.

Keep the technical ID, `phoneHref`, badge tone, and review metadata out of the form. Use this deletion call:

```tsx
<ConfirmButton
  prompt="Remover contato"
  aria-label={`Remover contato ${selectedService.name}`}
  onConfirm={() => onServiceRemove(selectedIndex, selectedService.id)}
/>
```

- [ ] **Step 5: Run the component test and verify all cases pass**

Run the command from Step 2.

Expected: PASS for selection, editing, add/remove, empty state, and inline validation.

- [ ] **Step 6: Commit the contacts UI slice**

```powershell
git add src/dev-dashboard/contacts/ContactsDashboard.tsx src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx
git commit -m "feat: add compact dashboard contacts editor"
```

### Task 4: Dashboard Tab And Route Integration

**Files:**

- Modify: `src/dev-dashboard/components/DashboardShell.tsx`
- Modify: `src/dev-dashboard/draft-storage/dashboardTabStorage.ts`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add a failing route integration test**

Extend the mocked shipped content with a complete `contacts` fixture. Add a test that selects the new tab, edits a shipped contact, creates a contact, removes it with confirmation, and verifies tab persistence:

```ts
it('edits contacts in a persisted dashboard tab', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<MemoryRouter><DashboardRoute /></MemoryRouter>);

  await user.click(screen.getByRole('tab', { name: 'Contatos' }));
  expect(screen.getByRole('heading', { name: 'Contatos' })).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Nome'));
  await user.type(screen.getByLabelText('Nome'), 'CAPS Atualizado');
  expect(screen.getByLabelText('Nome')).toHaveValue('CAPS Atualizado');
  expect(localStorage.getItem('bemtevi:dev-dashboard:active-tab')).toBe('contacts');

  unmount();
  render(<MemoryRouter><DashboardRoute /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Contatos' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the route test and verify the missing-tab failure**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because the `Contatos` tab is not rendered.

- [ ] **Step 3: Add and persist the tab**

Change the shell type and tab list to:

```ts
export type DashboardTab = 'flows' | 'education' | 'contacts' | 'export';

const tabs = [
  { id: 'flows', label: 'Fluxos' },
  { id: 'education', label: 'Materiais' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'export', label: 'Exportar' },
] satisfies Array<{ id: DashboardTab; label: string }>;
```

Add `'contacts'` to `validTabs` in `dashboardTabStorage.ts`.

- [ ] **Step 4: Aggregate contact validation and expose contact drafts**

In `DashboardRoute`, calculate `contactValidation = validateDashboardContacts(mergedDrafts.contacts)`, append its errors and warnings to the global validation, and add these values to `drafts`:

```ts
contacts: mergedDrafts.contacts,
removedContactIds: draftState.removedContactIds ?? [],
```

Update the page header description to `Rascunhos locais para fluxos, materiais e contatos.`

- [ ] **Step 5: Wire edit, add, and remove callbacks**

Render `ContactsDashboard` when `activeTab === 'contacts'`. Shipped records update `contactPatches` with `upsertPatchById`; local records update `addedContacts` by ID. Add with `createLocalService(mergedDrafts.contacts.map(({ id }) => id))` and return the new ID. Remove local records from `addedContacts`; remove shipped records by adding the ID to `removedContactIds` and clearing stale patches for that ID.

- [ ] **Step 6: Run route, storage, and contacts tests**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/__tests__/dashboardRoute.test.tsx src/dev-dashboard/__tests__/dashboardStorage.test.ts src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx
```

Expected: PASS for all selected files.

- [ ] **Step 7: Commit route integration**

```powershell
git add src/dev-dashboard/components/DashboardShell.tsx src/dev-dashboard/draft-storage/dashboardTabStorage.ts src/dev-dashboard/DashboardRoute.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: integrate contacts dashboard tab"
```

### Task 5: Contact Export Integration

**Files:**

- Modify: `src/dev-dashboard/export/exportBundle.ts`
- Modify: `src/dev-dashboard/export/ExportDashboard.tsx`
- Modify: `src/dev-dashboard/__tests__/exportBundle.test.ts`
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write failing export-bundle tests**

Update all shipped/draft fixtures with `contacts: []`. Add:

```ts
it('exports changed contacts and removed contact IDs', () => {
  const changedContact = { ...service, name: 'CAPS Atualizado' };
  const bundle = buildExportBundle({
    shipped: { flows: [], educationMaterials: [], educationGroups: [], contacts: [service] },
    drafts: {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [changedContact],
      removedContactIds: ['contact-removed'],
    },
    validation: { errors: [], warnings: [] },
    exportedAt: '2026-07-12T00:00:00.000Z',
  });
  expect(bundle.changes.contacts).toEqual([changedContact]);
  expect(bundle.changes.removedContactIds).toEqual(['contact-removed']);
});

it('exports with schema version 3.0.0', () => {
  expect(DASHBOARD_EXPORT_SCHEMA_VERSION).toBe('3.0.0');
});
```

- [ ] **Step 2: Run export tests and verify failures**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/__tests__/exportBundle.test.ts
```

Expected: FAIL because contacts are absent and the schema is still `2.0.0`.

- [ ] **Step 3: Extend the export bundle**

Import `ServiceDirectoryEntry`, advance `DASHBOARD_EXPORT_SCHEMA_VERSION` to `3.0.0`, and add:

```ts
contacts: ServiceDirectoryEntry[];
removedContactIds?: string[];
```

to `DashboardDraftContent`. In `buildExportBundle`, set:

```ts
contacts: changedRecords(shipped.contacts, drafts.contacts),
removedContactIds: drafts.removedContactIds ?? [],
```

- [ ] **Step 4: Add contact change counts to the Export tab**

Compute shipped/draft contact ID sets and return `contacts` counts from `computeChangeCounts`. Include added, patched, and removed contacts in `totalChanges`. Replace the four-column stats grid with a responsive `sm:grid-cols-2 lg:grid-cols-4` grid and render `Contatos` as one `ChangeStat`. Keep the existing removed-group summary, yielding five concise stats that wrap without horizontal overflow.

- [ ] **Step 5: Add a route-level export summary assertion**

After editing a contact in `dashboardRoute.test.tsx`, switch to `Exportar` and assert the `Contatos` stat reads `1 editado`. This proves route drafts reach the export UI.

- [ ] **Step 6: Run export and route tests**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/__tests__/exportBundle.test.ts src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS for both files.

- [ ] **Step 7: Commit export integration**

```powershell
git add src/dev-dashboard/export/exportBundle.ts src/dev-dashboard/export/ExportDashboard.tsx src/dev-dashboard/__tests__/exportBundle.test.ts src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: export dashboard contact changes"
```

### Task 6: Full Verification And Browser UX Review

**Files:**

- Modify only files required to resolve verified failures or visual defects in the contacts feature.

- [ ] **Step 1: Run the focused contact/dashboard suite**

Run:

```powershell
node node_modules.win/vitest/vitest.mjs run src/dev-dashboard/contacts src/dev-dashboard/__tests__/dashboardRoute.test.tsx src/dev-dashboard/__tests__/dashboardStorage.test.ts src/dev-dashboard/__tests__/exportBundle.test.ts src/content/__tests__/content.test.ts src/features/contacts/__tests__/ContactsScreen.test.tsx
```

Expected: all selected tests pass with no warnings.

- [ ] **Step 2: Run the repository quality gate**

Run:

```powershell
pnpm run check
```

Expected: typecheck, ESLint, Prettier check, flow validation, all Vitest tests, and production build pass.

- [ ] **Step 3: Start the app with the dashboard enabled**

Run:

```powershell
$env:VITE_ENABLE_DEV_DASHBOARD='true'; pnpm run dev -- --host 127.0.0.1
```

Expected: Vite serves the app locally. Use the existing authorized admin session or the route/test harness available in the current worktree to open `/dashboard`.

- [ ] **Step 4: Verify desktop behavior in the browser**

At approximately 1280px width, confirm tab order, list/editor alignment, selected state, short labels, phone normalization, add/remove confirmation, inline errors, local persistence after reload, and contact counts in Exportar. Confirm no horizontal overflow and no contact form fields expose technical IDs or review metadata.

- [ ] **Step 5: Verify mobile behavior in the browser**

At approximately 390px width, confirm tabs wrap cleanly, list and form stack, controls remain at least 44px high, labels do not clip, the delete confirmation remains usable, and keyboard focus follows the visual order.

- [ ] **Step 6: Review scope and diff hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended contacts-dashboard files plus the user's pre-existing unrelated changes appear.

- [ ] **Step 7: Commit any verification fixes**

If verification required contact-feature changes, stage only those files and commit them:

```powershell
git commit -m "fix: refine dashboard contacts editor"
```

If no fix was required, do not create an empty commit.

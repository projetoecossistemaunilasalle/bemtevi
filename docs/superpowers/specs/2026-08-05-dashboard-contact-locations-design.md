# Dashboard Contact Locations Design

## Goal

Make location a first-class concept in the dashboard's `Contatos` tab: a managed list of locations (city + state) that administrators can add, rename, and remove; contacts attributed to a location through a picker instead of free text; and the contact list grouped by location.

The published payload gains an explicit `locations` array so the public `CityFilter` can later read the managed list instead of deriving it from contacts. `src/lib/geo/cities.ts` already documents this intent: "When cities become dashboard-managed via the database, this module becomes the fallback catalog and the UI reads the published list instead."

## Current State

- `ServiceDirectoryEntry` (`src/domain/services/types.ts`) carries required free-text `city`/`state`; the dashboard edits them in `ContactFields` (`ContactsDashboard.tsx:238-261`).
- The dashboard sidebar list is a flat `<ul aria-label="Contatos disponíveis">` of contact buttons showing `type · city` (`ContactsDashboard.tsx:102-129`).
- Drafts live in `localStorage` (`bemtevi:dev-dashboard:drafts:v1`, schema v4, `DASHBOARD_DRAFT_SCHEMA_VERSION = '4.0.0'` at `dashboardStorage.ts:8`): `contactPatches`, `addedContacts`, `removedContactIds`; `mergeDashboardDrafts` merges patches by source index and returns `{ flows, educationMaterials, educationGroups, contacts, defaultGroupOrder }`.
- The published payload (`PublishedContentPayload`) has exactly five keys (`PAYLOAD_KEYS`, `publishedContent.ts:46-52`), no `locations`; `bundledContent.ts` builds it from `canoasServices` + registry modules; `validateContacts` requires `city`/`state` non-empty (`publishedContent.ts:175-180`).
- Public `CityFilter` receives `string[]` labels `"${city} - ${state}"` derived from contacts (`ContactsScreen.tsx:14-19`) and matches the geolocation result against those labels.
- `localCityCatalog` (`src/lib/geo/cities.ts`) holds 6 cities with coordinates for on-device lookup.
- The public model already treats contacts with empty `city` as "always visible" (`ContactsScreen.tsx:24`), and `ContactsScreen.test.tsx:77-87` ships a national fixture ("CVV") with `city: ''`, `state: ''` — but both `validateDashboardContacts` (`contactsValidation.ts:37`) and `validateContacts` (`publishedContent.ts:175-180`) require non-empty city/state, so a national contact cannot be authored or published through the dashboard today. This design resolves the latent inconsistency by making "Sem local" an explicit picker choice.

## Decisions

### Data model: managed `locations` array + denormalized contact `city`/`state` + optional `locationId` reference

Contacts keep `city`/`state` as denormalized display fields refreshed from the location record on every merge/parse, and gain an optional `locationId` reference to a managed location. The single source of truth is the location record. Because merge/parse always re-derive contact `city`/`state` from the referenced location, renaming a location automatically updates every affected public card, the dashboard list, and the CityFilter options — no per-contact edit needed. Contacts referencing no location are the explicit "Sem local" (national) case.

Rejected alternatives:

- **Derive-only (no new payload key):** gives the dashboard nothing to manage; the owner explicitly wants a manageable list.
- **Contacts switch to `locationId` only, city/state computed at render:** breaks `validateContacts`, `ServiceCard`, `CityFilter`, every fixture, and already-published DB rows for zero user-visible gain. The denormalized fields are the backward-compatibility bridge.

**Schema versioning:** keep `PUBLISHED_CONTENT_SCHEMA_VERSION = '1.0.0'`. `locations` is required in the in-memory TypeScript type but optional on parse (absent → derived from contacts). This keeps old DB rows readable (no forced migration/re-publish), while every code path that builds a payload must include it. A `2.0.0` bump is deferred until a breaking change requires it.

### Location management UX: in-tab "Gerenciar locais" collapsible

No new dashboard tab (dashboard tabs are a global construct — `DashboardTab` in `DashboardShell.tsx:6`, persisted via `dashboardTabStorage`; adding a tab would touch shell, tab storage, error counts, and route plumbing). Locations exist to serve contacts; the management UI lives inside the `Contatos` tab, mirroring the existing "Grupos de materiais" collapsible in `EducationDashboard.tsx:840-937` (toggle button with `aria-expanded`, inline rename inputs, `ConfirmButton` removal).

### Removal semantics: block while contacts reference the location

Unlike education groups (which reassign to the default group on removal), there is no natural default location — silently flipping contacts to "Sem local" would be a surprising data mutation. Removal is blocked with inline guidance listing the count of affected contacts ("Remova ou realoque os N contatos desta cidade antes de removê-la.").

## Data Model

### `src/domain/services/types.ts`

```ts
export interface ServiceLocation {
  id: string;     // stable, e.g. 'loc-canoas' / 'location-local-3' for drafts
  city: string;
  state: string;  // exactly two ASCII letters
}

export interface ServiceDirectoryEntry {
  // ...existing fields...
  city: string;
  state: string;
  locationId?: string | null;   // NEW: references ServiceLocation.id; null = "Sem local" (national)
  // ...
}

export interface ServicesContent extends ContentMetadata {
  title: string;
  description: string;
  services: ServiceDirectoryEntry[];
  // NOTE: no `locations` here — bundled ServicesContent stays unchanged;
  // locations exist only on the PublishedContentPayload.
}
```

### New pure module `src/domain/services/locations.ts`

Shared by dashboard and `app/content` (keeps `publishedContent.ts` free of dev-dashboard imports):

- `deriveLocationsFromContacts(contacts): ServiceLocation[]` — deduped by `(city, state)`, ordered by first appearance, **skipping contacts with empty city**. Ids from a stable slug: `loc-${slug(city)}-${state.toLowerCase()}`, where `slug` lowercases, strips accents, and replaces non-alphanumerics with `-`. Deterministic across sessions so merge/parse of the same data produces the same ids.
- `normalizeContactLocations(contacts, locations): { contacts, locations }` — for each contact: (1) `locationId` resolves → refresh `city`/`state` from the record; (2) `locationId` missing but `city`/`state` match a location → attach that id; (3) `city`/`state` set but no match → derive a location, attach it, and add it to the returned locations list; (4) `locationId` null → clear `city`/`state` to `''`.
- `locationLabel(location): string` → `"Canoas - RS"`.
- `applyLocationSelection(contact, locationId, locations): Partial<ServiceDirectoryEntry>` — returns `{ locationId, city, state }` for the chosen location, or `{ locationId: null, city: '', state: '' }` for "Sem local".

### `src/app/content/publishedContent.ts`

- `PublishedContentPayload` gains required `locations: ServiceLocation[]`.
- New `validateLocations(locations: unknown): ServiceLocation[]` — array of records with non-empty `id`/`city`, 2-ASCII-letter `state`, no duplicate `(city, state)` pairs; throws `PublishedContentValidationError` otherwise.
- `validateContacts(contacts, locations)` — existing checks plus: `contact.locationId` (when present) must reference a known location id; **city/state non-empty is now required only when the contact references a location** — a contact with `locationId` null/absent may have empty `city`/`state` ("Sem local"). This relaxation is mandatory: without it the feature cannot be published end-to-end (`validatePublicationPayload` at the repository boundary would reject every "Sem local" contact).
- `parsePayload` — `locations: payload.locations !== undefined ? validateLocations(payload.locations) : deriveLocationsFromContacts(contacts)`, then run `normalizeContactLocations` on the returned payload. `PAYLOAD_KEYS` (the five strict keys) is unchanged, so old rows still parse.

### `src/app/content/bundledContent.ts`

`getBundledContent()` returns `locations: deriveLocationsFromContacts(canoasServices.services)` — guarantees fallback parity (CityFilter options identical to today).

## Dashboard UI

All changes in `src/dev-dashboard/contacts/ContactsDashboard.tsx` plus route wiring.

### 1. Grouped contact list (sidebar)

New pure helper `groupContactsByLocation(services, locations)` (in `contactDrafts.ts` or `locations.ts`): groups in **locations array order** (admin-defined), then a final "Sem local" group for `locationId == null`.

The sidebar keeps the single `<ul aria-label="Contatos disponíveis">` and flat button semantics (index-based selection in `ContactsDashboard` stays untouched — grouping is purely presentational; the id-based `selectedIndex` fallback at `ContactsDashboard.tsx:41-48` already survives list reflow). Each group renders:

- a non-interactive `<li>` heading: `<span className="font-label-sm text-on-surface-variant">Canoas - RS</span>` + count pill (`N` in a small `bg-surface-container-low rounded-full` span), wrapped in `role="group"` with `aria-labelledby` so the accessible name of each contact button stays unique.
- the existing contact `<button>`s (`aria-pressed`, secondary line `type · city`, unchanged).

Sections are always expanded; an accordion adds interaction complexity for no need at this scale.

### 2. Location picker (replaces city/state inputs)

In `ContactFields`, remove the "Cidade"/"Estado" text inputs (`ContactsDashboard.tsx:238-261`) and add a single `Field`:

```tsx
<Field label="Local" htmlFor={`${fieldId}-location`}
  hint="Cidade onde o atendimento é oferecido. Gerencie as cidades em “Gerenciar locais”."
  issues={locationIssues}>
  <select id={`${fieldId}-location`} className={fieldClass(locationIssues)}
    value={service.locationId ?? ''}
    onChange={(e) => onChange(applyLocationSelection(service, e.target.value || null, locations))}>
    <option value="">Sem local (atendimento nacional)</option>
    {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.city} - {loc.state}</option>)}
  </select>
</Field>
```

`Field` clones `aria-invalid`/`aria-describedby` onto any control (`Field.tsx:66-77`), so the select gets inline errors for free (same pattern as the education group picker, `EducationDashboard.tsx:615-629`). New `ContactsDashboard` props: `locations: ServiceLocation[]`, plus `onLocationChange/onLocationAdd/onLocationRemove` (same signatures as the service trio). `issuesForPath(validation, 'contacts.<i>.locationId')` feeds `locationIssues`.

### 3. Location management ("Gerenciar locais")

Collapsible section at the top of the tab, cloned from `EducationDashboard.tsx:840-937`:

- Toggle button: "Gerenciar locais" / "Ocultar", `aria-expanded`, `aria-controls="contacts-location-management-content"`.
- Each row: city text input, state text input (`maxLength={2}`, uppercase like `ContactsDashboard.tsx:258`), a count label "N contatos", and a `ConfirmButton` "Remover local" that is disabled (with the guidance message rendered beside it) when the location has any contacts.
- `Novo local` button appends `createLocalLocation(existingIds)` → `{ id: 'location-local-N', city: '', state: '' }`.
- Renames propagate automatically to contacts' denormalized `city`/`state` at merge time; the change summary will show those contacts as "edited" too — honest, since published cards do change.

### `src/dev-dashboard/contacts/contactDrafts.ts`

- `createLocalService(existingIds, locations)` — defaults to `locations[0]` (id + denormalized city/state) when the list is non-empty, else "Sem local". (Currently hard-codes Canoas/RS at `contactDrafts.ts:26-27`.)
- `createLocalLocation(existingIds)` — stable `location-local-N` id.

## Validation

### `src/dev-dashboard/contacts/contactsValidation.ts`

Signature becomes `validateDashboardContacts(services, locations)`. Existing contact rules unchanged, except:

- City required only when `locationId` resolves: contact with `locationId` set → `city`/`state` must equal the location record (error `location-mismatch:<contactId>:<index>`, path `contacts.<i>.locationId`).
- Contact with `locationId` null/undefined and non-empty `city`/`state` → error `unassigned-city:<contactId>:<index>`, path `contacts.<i>.locationId` ("Use 'Sem local' para atendimento nacional."). The existing `/^[A-Za-z]{2}$/` state rule must skip "Sem local" contacts the same way (empty city implies empty state is allowed).
- Dangling `locationId` (not in `locations`) → error `unknown-location:<contactId>:<index>`, path `contacts.<i>.locationId` (defense-in-depth; normalization should prevent it).
- New location rules using area `'contacts'` (do not extend `DashboardValidationArea` with a new value — locations issues surface in the same tab):
  - duplicate location ids (reuse `findDuplicateIds`);
  - blank city; state not exactly two letters (paths `locations.<j>.city` / `locations.<j>.state`);
  - duplicate `(city, state)` pair → summary error `duplicate-location:<city>:<state>`;
  - **zero locations → warning** `no-locations` ("Nenhuma cidade cadastrada — contatos sem local aparecerão como nacionais.") rather than an error, so a national-only catalog stays publishable.

## Publishing and Backward Compatibility

- **Already-published DB rows** (schema 1.0.0, no `locations`, contacts without `locationId`): parse derives `locations` from contacts and attaches `locationId`s — identical rendering, identical CityFilter options, no forced re-publish. The next admin publish writes the explicit key.
- **localStorage drafts** (schema v4): `DASHBOARD_DRAFT_SCHEMA_VERSION` → `'5.0.0'`; `loadDashboardDrafts` migrates by initializing `locationPatches: []`, `addedLocations: []`, `removedLocationIds: []` (mirroring the v3→v4 contacts migration at `dashboardStorage.ts:102-118`). **The migration branch must explicitly include `'4.0.0'`** (`else if (version === '3.0.0' || version === '4.0.0' || version === DASHBOARD_DRAFT_SCHEMA_VERSION)`) so real v4 drafts in the wild receive the new collections. `hasDashboardChanges` gains the three collections.
- **`mergeDashboardDrafts`** (`dashboardStorage.ts`): additionally merges locations via the existing `mergeRecords` helper (filtered by `removedLocationIds`) and returns `{ ...existing, locations, contacts: normalized }` where contacts+locations pass through `normalizeContactLocations`.
- **`DashboardRoute.tsx`**:
  - `publishedDraft` and the exported `drafts` object gain `locations: mergedDrafts.locations`; the export `DashboardDraftContent` interface (`exportBundle.ts:11`) gains `locations` (`DashboardShippedContent = Omit<PublishedContentPayload, 'defaultGroupOrder'>` propagates it automatically).
  - New callbacks `onLocationChange/onLocationAdd/onLocationRemove` with origin resolution via `upsertPatchById` (`DashboardRoute.tsx:31`): shipped → `locationPatches` upsert; added → `addedLocations` index update; removal filters `addedLocations`, clears `locationPatches`, appends to `removedLocationIds`.
  - `contactValidation = useMemo(() => validateDashboardContacts(mergedDrafts.contacts, mergedDrafts.locations), ...)`.
- **`changeSummary.ts`** gains `locations: RecordChangeCount` and includes it in `total`; **`PublishDashboard.tsx`** and **`ExportDashboard.tsx`** show a fifth stat "Locais" (the stats grid at `PublishDashboard.tsx:106` is `lg:grid-cols-4` and needs a fifth column); both files' local baseline/draft `PublishedContentPayload` builders include `locations`.

## Public Side

No changes in this feature. `ContactsScreen.tsx` and `CityFilter.tsx` keep deriving options from contacts — normalization guarantees the derived labels equal the managed locations' labels for every city that has contacts. Switching `CityFilter` to read `content.locations` is a separate, later task (it unlocks locations with zero contacts and lets the geolocation catalog read the published list). Public tests must stay green unchanged, which is itself a regression guard.

## Testing

New/updated cases:

1. **`src/domain/services/__tests__/locations.test.ts`** (new): derive dedupes, orders by first appearance, skips empty-city contacts, stable slug ids; normalize attaches `locationId` from matching city/state; derives missing locations for orphan pairs; refreshes denormalized city/state after a rename; clears city/state for `locationId: null`; `applyLocationSelection` for a location and for "Sem local".
2. **`src/app/content/__tests__/publishedContent.test.ts`**: payload with `locations` parses and normalizes; payload **without** `locations` derives (backward compat); invalid locations rejected (duplicate pair, bad state, blank city); contact with dangling `locationId` rejected; "Sem local" contact (empty city/state, no `locationId`) parses; existing missing-keys and size-limit tests unchanged.
3. **`src/dev-dashboard/__tests__/dashboardStorage.test.ts`**: `DASHBOARD_DRAFT_SCHEMA_VERSION` now `'5.0.0'` (assertion at line 86); v4→v5 migration seeds empty location collections without losing contact drafts; merge returns `locations` and normalized contacts; `hasDashboardChanges` counts location collections. **All 13 `mergeDashboardDrafts(shipped, ...)` call sites (lines 130, 146, 168, 184, 197, 212, 228, 250, 268, 304, 325, 344, 480) and the typed `emptyDraft` (19-33) gain `locations` in their shipped literals.**
4. **`src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts`**: dangling `locationId`; city/state mismatch vs. location; leftover city on "Sem local"; duplicate `(city,state)`; zero-locations warning; city allowed empty only when `locationId` is null (update the existing "reports every missing required field" case).
5. **`src/dev-dashboard/contacts/__tests__/ContactsDashboard.test.tsx`**: grouped sidebar headings with counts and "Sem local" group; picker select present and city/state inputs gone; selecting a location emits `{ locationId, city, state }`; "Sem local" clears both; cross-group selection keeps `aria-pressed`; "Gerenciar locais" add/rename/remove; removal disabled with guidance when contacts reference the location.
6. **`src/dev-dashboard/contacts/__tests__/contactDrafts.test.ts`**: `createLocalLocation` ids; `createLocalService` defaults to first location / "Sem local" when none.
7. **`src/dev-dashboard/__tests__/dashboardRoute.test.tsx`** (including the v4 localStorage fixtures at lines 2074, 2122) and **`PublishDashboard.test.tsx`**: published draft includes locations; location add/change/remove origin wiring; "Locais" stat and change counts.
8. **`src/dev-dashboard/__tests__/changeSummary.test.ts`**: `clonePayload` (6-14) and all inline payload literals (20, 37, 76, 83, 101, 108) gain `locations`.
9. **`src/dev-dashboard/__tests__/exportBundle.test.ts`**: all 12 `buildExportBundle` calls with `shipped`/`drafts` literals (52-250) gain `locations`.
10. **`src/app/content/__tests__/publishedContentRepository.test.ts`**: `buildValidPayload()` (20-69) gains `locations`.
11. Public tests (`ContactsScreen`, `CityFilter`, `ServiceCard`) pass **unchanged**.

## Task Breakdown

Sequential, each sized for one implementer, each leaves the app compiling and tests green.

**Task 1 — Domain model + payload (backward compatible).**
Files: `src/domain/services/types.ts` (new `ServiceLocation`, `locationId`), new `src/domain/services/locations.ts`, `src/app/content/publishedContent.ts` (`PublishedContentPayload.locations` required, `validateLocations`, optional-key parse with derivation+normalization, relaxed city/state for "Sem local"), `src/app/content/bundledContent.ts`. Interim: payload constructors in `DashboardRoute.tsx`/`ExportDashboard.tsx` derive `locations` from contacts until Task 5 lands.
AC: old-payload parse derives locations; invalid locations/dangling refs rejected; "Sem local" contacts parse; `validatePublicationPayload` covers locations; new `locations.test.ts` green; all payload construction sites compile.

**Task 2 — Draft storage + merge.**
Files: `src/dev-dashboard/draft-storage/dashboardStorage.ts` (schema v5, three new collections, v4-inclusive migration, `mergeDashboardDrafts` returns locations + normalized contacts), `src/dev-dashboard/contacts/contactDrafts.ts` (`createLocalLocation`, new `createLocalService` signature), `dashboardStorage.test.ts`.
AC: v4 drafts load without loss; merge derives/attaches/refreshes; id-stable across reloads; fixture churn done.

**Task 3 — Dashboard validation.**
Files: `src/dev-dashboard/contacts/contactsValidation.ts` (+ tests).
AC: all location rules above with exact issue ids/paths; existing contact rules intact; "Sem local" state skip rule; `DashboardRoute` still compiles (validator call updated to pass `mergedDrafts.locations`).

**Task 4 — Contacts tab UI.**
Files: `src/dev-dashboard/contacts/ContactsDashboard.tsx` (grouped sidebar, picker, "Gerenciar locais" panel, new props), `ContactsDashboard.test.tsx`, `contactDrafts.test.ts`.
AC: grouping with counts; picker replaces city/state; blocked removal; keyboard/aria behavior per existing conventions (`aria-pressed`, `Field` a11y, 44px targets); all tests green.

**Task 5 — Route + publishing/export wiring.**
Files: `DashboardRoute.tsx`, `changeSummary.ts`, `PublishDashboard.tsx`, `ExportDashboard.tsx`, `exportBundle.ts` (+ route/publish/export tests).
AC: location CRUD persisted via drafts with origin resolution; "Locais" stat in both publish and export; publish blocked by location validation errors; end-to-end publish round-trips locations into the DB payload and reloads via `parsePayload`.

Final sweep: full `vitest` suite, `eslint`, `tsc`; manual check of `/contatos` (filter, geolocation) against bundled content — must render identically to today.

## Out of Scope

- Public `CityFilter` reading `content.locations` (and geolocation reading the published list) — separate follow-up.
- Coordinates/lat-lng on `ServiceLocation` records.
- Auto-reassignment of contacts on location removal (removal is blocked instead).
- Multiple locations per contact.
- Per-location ordering controls (list order is insertion order; reordering can follow the education group `onGroupMove` pattern later if requested).
- Changes to the global dashboard tab system.

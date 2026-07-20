# Dashboard Contacts Editor Design

## Goal

Add a compact `Contatos` tab to the existing admin dashboard so an administrator can create, edit, and remove the local support services shown on `/contatos` without navigating a long or technical form.

This feature edits the service directory backed by `canoasServices.services`. It does not edit the emergency support numbers shown on `/apoio`.

## Product Direction

The editor will use the same responsive master-detail pattern as the dashboard's Materials area:

- A compact service list shows the name, type, and city for quick recognition.
- `Novo contato` creates a local draft and selects it immediately.
- Selecting a service opens one focused editor instead of expanding every service at once.
- On smaller screens, the list and editor stack vertically; on large screens, the list remains a narrow left column.
- Removing a service uses the existing inline two-step confirmation rather than a modal.

This approach is preferred over a single long form because it keeps the page scannable, and over modal editing because it preserves context and keyboard flow.

## Information Architecture

The dashboard tab order will be:

1. `Fluxos`
2. `Materiais`
3. `Contatos`
4. `Exportar`

The selected tab remains persisted through the existing dashboard tab storage helper. `Contatos` is part of the existing `/dashboard` route and does not introduce a nested route.

Within the tab, the editor is intentionally limited to fields that affect the public service card:

- Name
- Type
- City and two-letter state code
- Address
- Phone number
- Opening hours (optional)
- Notes (optional)

Technical fields stay out of the form:

- The stable `id` is generated for new services and preserved for existing services.
- `phoneHref` is derived from the digits in the displayed phone number.
- Review metadata is preserved for existing services and initialized as pending review for new services.
- Badge tone is preserved unless the type changes, then derived from the service type.
- Directory-level title and description remain shipped content and are out of scope.

## Interaction Details

The first available service is selected when the tab opens. Each list item is a real button with selected state and a concise secondary line. The active item is visually distinct using existing primary-container tokens.

`Novo contato` adds a service with friendly starter values, scrolls/focuses the editing context naturally through normal document order, and avoids opening a dialog. Changes save to the dashboard draft state on each field change, matching the current dashboard behavior.

The phone field accepts human-readable formatting. A shared normalization helper strips non-digits and produces a `tel:` URL. The administrator never has to maintain two versions of the same phone number.

Deleting a service removes local additions outright or records a shipped service ID as removed. After deletion, selection moves to the nearest remaining service. An empty directory shows a concise empty state with the `Novo contato` action still available.

## Components And Boundaries

### `ContactsDashboard`

Owns only presentation and local selection. It receives the merged service list, validation result, and add/change/remove callbacks from `DashboardRoute`. It does not access storage directly.

### Contact Helpers

Pure helpers create a new service draft, normalize a display phone number into a `tel:` URL, and choose a badge tone from a service type. These helpers are independently testable and keep the route/editor components small.

### Contact Validation

A contacts validator returns the dashboard's existing `DashboardValidationResult` shape with area `contacts`. It checks:

- IDs are present and unique.
- Name, type, city, address, and phone are not blank.
- State is exactly two letters.
- Phone contains enough digits for a usable call action.
- `phoneHref` matches the normalized displayed phone number.

Field paths use `contacts.<index>.<field>` so the existing `Field` component can show errors beside the relevant control. Duplicate IDs remain summary-level errors because IDs are not editable.

## Draft Storage And Export

Contacts participate in the dashboard data flow end to end:

- Shipped dashboard content includes the current service directory entries.
- Draft storage adds contact patches, locally added contacts, and removed contact IDs.
- The draft schema advances to `3.0.0` and migrates existing `1.0.0` and `2.0.0` values by initializing the new contact collections to empty arrays.
- Merging applies contact patches by source index, appends local contacts, and filters removed shipped contacts.
- The export schema advances to `3.0.0` and includes complete changed contact records plus removed contact IDs.
- The Export tab reports contact changes alongside flows, materials, and groups.

Draft edits remain local to the current browser until they are exported, consistent with the dashboard notice and current publishing boundary. The public `/contatos` route continues to use shipped content during this phase.

## Accessibility And Responsive UX

- The dashboard's existing tab semantics and minimum touch targets are retained.
- Contact list buttons expose selected state with `aria-pressed` and do not rely on color alone.
- Every input uses the shared `Field` wrapper for labels, descriptions, invalid state, and error association.
- Form controls use existing focus rings and minimum 44-pixel heights.
- City/state share a row only when space permits; address and notes remain full width.
- The large-screen layout uses a 280-pixel list column and flexible editor column; mobile uses one column without horizontal scrolling.
- Destructive confirmation remains inline and keyboard accessible.

## Error Handling

Storage failures continue to use the existing best-effort dashboard behavior. Invalid contact drafts remain editable and locally saved, but their errors appear inline and in a validation summary. Any validation error prevents ZIP export through the existing global export guard.

No network request is introduced. No geolocation, map SDK, or location permission is added.

## Testing

Automated coverage will verify:

- The new tab is visible, selectable, and restorable from tab storage.
- Shipped contacts are included in dashboard content and merged with patches, additions, and removals.
- Older local-storage schemas migrate without losing existing draft data.
- Contact validation reports required-field, state, phone, and duplicate-ID failures.
- The editor selects, edits, adds, and removes contacts with accessible controls.
- Phone display changes update the derived `tel:` value.
- Export bundles and change counts include edited, added, and removed contacts.
- Existing dashboard and public Contacts screen tests remain green.

Manual browser verification will cover the dashboard at desktop and mobile widths, keyboard focus order, empty state, add/edit/remove behavior, inline validation, persistence after reload, and the export summary.

## Out Of Scope

- Editing emergency support numbers from `/apoio`
- Editing directory title or description
- Database-backed publishing
- Public previewing of local drafts
- Geolocation, distance sorting, maps, or filters
- Review workflow controls or exposing internal review metadata

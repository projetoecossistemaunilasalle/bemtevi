# Design Spec: Dashboard "Limpar TODAS as alterações" Button

## Overview

Adds a clear, obvious, and destructive action card to discard all local draft modifications in the dashboard. The action resets uncommitted/unpublished local draft state and reverts to the currently published content.

## User Intent & Requirements

- **Action**: Discard all local draft alterations across flows, materials, groups, and contacts in `localStorage`.
- **Button Label**: `"Limpar TODAS as alterações"`
- **Confirmation**: Two-step inline confirmation using `ConfirmButton` (danger variant).
- **Location**: Rendered on both the **Publicar** tab (`PublishDashboard.tsx`) and **Exportar** tab (`ExportDashboard.tsx`).
- **Explanatory Copy**: Explicitly clarifies that only local draft changes in the browser are discarded and that published content remains safe.
- **State**: Disabled when there are no local draft alterations (`!hasChanges`).

## Architecture & Component Changes

### 1. `DashboardRoute.tsx`

- Passes an `onResetDrafts={() => setDraftState(resetDashboardDrafts())}` callback to both `PublishDashboard` and `ExportDashboard`.
- Exports or utilizes `hasDashboardChanges(draftState)` from `dashboardStorage.ts`.

### 2. `PublishDashboard.tsx` & `ExportDashboard.tsx`

- Accepts `onResetDrafts: () => void`.
- Computes `hasChanges = summary.total > 0` (or `changeCounts.total > 0`).
- Renders the "Descartar rascunho local" section card at the bottom of the tab content:
  - Header: `"Descartar rascunho local"`
  - Explanation: `"Esta ação descarta apenas o rascunho local deste navegador (edições, adições e remoções pendentes em fluxos, materiais, grupos e contatos) e restaura tudo de volta ao conteúdo atualmente publicado. O conteúdo já publicado não será alterado ou apagado."`
  - `ConfirmButton`:
    - `prompt="Limpar TODAS as alterações"`
    - `confirmLabel="Confirmar e limpar tudo"`
    - `cancelLabel="Cancelar"`
    - `disabled={!hasChanges}`
    - `onConfirm={onResetDrafts}`

## Testing Strategy

- Unit & integration tests in `dashboardRoute.test.tsx` verifying:
  - "Limpar TODAS as alterações" button is present in Publicar and Exportar tabs.
  - Button is disabled when no local draft changes exist.
  - Button becomes enabled when local draft changes exist.
  - Clicking armed button clears all local draft changes and resets the state.

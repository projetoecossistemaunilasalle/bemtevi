# Design Spec: Dashboard UI/UX Simplification & Overhaul

**Date:** 2026-06-23  
**Status:** Approved  
**Spec Path:** [2026-06-23-dashboard-ui-simplification-design.md](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/docs/superpowers/specs/2026-06-23-dashboard-ui-simplification-design.md)

---

## 1. Goal & Context

The Guided Flow Editor has been overhauled to improve focus and navigation. Based on user feedback, the interface will be refined to ensure:
- The stages list and active editor card are closely linked through automatic scrolling and collapsing.
- The initial configuration (metadata and entry settings) doesn't push the active stages down the page.
- The outline sidebar features clear badges detailing the behavior of each stage (`+pts`, `⚠`, `⇄`).
- The flow selection area is highly prominent, modeled like the stages list, and features a "Novo fluxo" creation button.

---

## 2. Proposed Changes

### A. Sidebar Layout: Flow Selector & Outline Badges

We will replace the simple flow select dropdown with a prominent list matching the style of the stages outline:
- **Flow List:** Displays active flows as buttons in a dedicated section at the top of the sidebar.
- **"Novo fluxo" Button:** Rendered directly below/near the flow list to easily trigger flow creation.
- **Outline Badges:** Each stage button in the outline list displays compact visual indicators based on its options' effects:
  - `+pts` (Score): Shown if the stage choice options have `score` effects.
  - `⚠` (Safety): Shown if the stage options contain `deferred_safety` effects.
  - `⇄` (Flow Start): Shown if the stage options contain `flow_start` effects (handoff to other flows).

### B. Collapsible Initial Configuration

The flow metadata ("Dados do fluxo") and entry settings ("Configuração de entrada") will be moved into a single collapsible card at the very top of the main detail panel:
- **Title:** "Configurações Iniciais e Entrada do Fluxo ⚙️"
- **State:** Collapsed by default once a stage is selected, preventing it from pushing stage cards off-screen.

### C. Collapsible Stage Cards with Scroll-Anchoring

Instead of rendering *only* the active stage, the main area will display all stages as collapsible accordion-style cards:
- **Collapsed Preview:** Displays the technical ID, title, kind, and option count.
- **Expanded Detail:** Displays the editable text, options list, duplicate/remove buttons, and option configurations.
- **Scroll-Anchoring:** Clicking a stage in the left sidebar outline:
  - Expands that stage's card and collapses the others.
  - Smoothly scrolls the main area to bring that stage card into view.

---

## 3. Design Tokens & Styling

Adheres to the official **SeCuida** design tokens defined in [index.css](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/index.css):
- **Primary:** `var(--color-primary)` (`#006a43`) green.
- **Secondary:** `var(--color-secondary)` (`#425e91`) blueish gray.
- **Safety Badge:** `bg-error-container text-on-error-container` or `var(--color-error)`.
- **Score Badge:** `bg-secondary-container text-on-secondary-container`.
- **Redirection/Handoff Badge:** `bg-surface-variant text-on-surface-variant` with a transition icon.

---

## 4. Verification Plan

### Automated Tests
- Test cases verifying outline badge rendering for stages with score, safety, and handoff effects.
- Test cases checking that selecting a stage in the outline expands the corresponding stage card.
- Test cases verifying that clicking "Novo fluxo" calls the creation handler.

### Manual Verification
- Verify in the browser that clicking outline stages smooth-scrolls and expands their cards in the detail pane.
- Verify that initial config toggles correctly and stays collapsed by default.

# Dashboard UI/UX Simplification & Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the flow editor dashboard by making all stages list vertically as collapsible/expandable cards with sidebar scroll-anchoring, adding visual effect badges to the sidebar, making the flow selector prominent with a delete action, adding a stage delete action with confirmation, auto-activating scoring when a flow has score keys, explaining the score key field, and dismissing the drawer on backdrop click.

**Architecture:**

1. Update `DashboardDraftState` and the draft storage merging utility to support filtering out deleted flows using `removedFlowIds`.
2. Re-style the flow selector in `FlowDashboard` as a sidebar list with a "+ Criar Novo Fluxo" button and a delete action with a toggle-confirmation state.
3. Add `+pts` (score), `⚠` (deferred safety), and `⇄` (flow start redirection) badges to the stage outline sidebar.
4. Move the "+ Adicionar etapa" button from the bottom of the card list to the sidebar stages outline.
5. In `FlowEditor`, list all stages as collapsible cards. The card heading displays the stage index and its text content (removing the technical ID and separate text preview). Expand only the selected stage and smooth-scroll it into view.
6. Swap "Texto da etapa" on top of "Tipo da etapa" inside the card.
7. Add a "Remover etapa" button to the card header with a toggle-confirmation state.
8. Add backdrop click handler to dismiss the slide-over drawer, and automatically pre-create/enable score effects when editing options in flows that already have score keys configured.

**Tech Stack:** React, Tailwind CSS, TypeScript, Vitest, Testing Library.

---

### Task 1: Prominent Flow Selector & Delete Flow Action

**Files:**

- Modify: [dashboardStorage.ts](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/draft-storage/dashboardStorage.ts)
- Modify: [DashboardRoute.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/DashboardRoute.tsx)
- Modify: [FlowDashboard.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/flows/FlowDashboard.tsx)
- Test: [dashboardRoute.test.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/__tests__/dashboardRoute.test.tsx)

- [ ] **Step 1: Write the failing test**
      Add a test verifying that flows are listed prominently, flows can be deleted with confirmation, and new flows can be created.

  ```tsx
  it('displays flow list in sidebar, allows adding and deleting a flow with confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Verify "+ Criar Novo Fluxo" button is in the sidebar
    expect(screen.getByRole('button', { name: /\+ Criar Novo Fluxo/i })).toBeInTheDocument();

    // Verify list displays flows
    expect(screen.getByRole('button', { name: /SRQ-20/i })).toBeInTheDocument();

    // Select 'mock-flow' (second option in flows)
    await user.click(screen.getByRole('button', { name: /Fluxo de teste/i }));

    // Click delete flow button next to mock-flow
    await user.click(screen.getByRole('button', { name: /Remover fluxo Fluxo de teste/i }));

    // Confirmation button is shown
    const confirmBtn = screen.getByRole('button', { name: /Confirmar exclusão de Fluxo de teste/i });
    expect(confirmBtn).toBeInTheDocument();

    // Click confirm
    await user.click(confirmBtn);

    // Flow is gone
    expect(screen.queryByRole('button', { name: /Fluxo de teste/i })).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm run test dashboardRoute`
      Expected: FAIL

- [ ] **Step 3: Update dashboardStorage.ts and DashboardRoute.tsx**
  1. Add `removedFlowIds?: string[]` to `DashboardDraftState` in `dashboardStorage.ts`.
  2. Filter out flows whose ID is in `removedFlowIds` inside `mergeDashboardDrafts`.
  3. In `DashboardRoute.tsx`, add an `onFlowRemove` handler to remove added flows from `addedFlows` or add shipped flow IDs to `removedFlowIds` in state. Pass `onFlowRemove` prop to `FlowDashboard`.

- [ ] **Step 4: Refactor FlowDashboard.tsx sidebar flow selection**
  1. Add a `confirmDeleteFlowId` state: `const [confirmDeleteFlowId, setConfirmDeleteFlowId] = useState<string | null>(null);`
  2. Replace the `<select>` dropdown inside the sidebar with a beautiful prominent listing container.
  3. Map `flows` and render each as a button with Tailwind styling (`px-3 py-2 rounded-lg text-sm border flex justify-between items-center transition-all`).
  4. Next to each flow button (if flows.length > 1), render a delete button. If clicked, set `confirmDeleteFlowId` to that flow ID. If `confirmDeleteFlowId === flow.id`, render a red button `Confirmar exclusão de [Título]`. If they click the confirm button, trigger `onFlowRemove(flow.id)`.
  5. Add a "+ Criar Novo Fluxo" button in the selector container wired to trigger `onFlowAdd()`.

- [ ] **Step 5: Run test to verify it passes**
      Run: `pnpm run test dashboardRoute`
      Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git commit -am "feat: implement prominent flow selector and delete flow option"
  ```

---

### Task 2: Stage Outline Badges & Move "+ Adicionar etapa" to Sidebar

**Files:**

- Modify: [FlowDashboard.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/flows/FlowDashboard.tsx)
- Modify: [FlowEditor.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/flows/FlowEditor.tsx)
- Test: [dashboardRoute.test.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/__tests__/dashboardRoute.test.tsx)

- [ ] **Step 1: Write the failing test**
      Add a test verifying outline badges are shown for nodes containing scoring, safety warnings, and transitions, and the "Adicionar Etapa" button is in the sidebar list.

  ```tsx
  it('renders visual effect badges in outline list and supports stage addition in sidebar', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Stage q1 should show +pts badge
    expect(screen.getByText(/Etapa 3/i)).toBeInTheDocument();
    expect(screen.getByText('+pts')).toBeInTheDocument();

    // Stage q17 should show ⚠ badge
    expect(screen.getByText('⚠')).toBeInTheDocument();

    // Verify "+ Adicionar etapa" is visible in the sidebar stages area
    const addStageBtn = screen.getByRole('button', { name: /Adicionar etapa/i });
    expect(addStageBtn).toBeInTheDocument();

    // Click it and verify a new node is created
    await user.click(addStageBtn);
    expect(screen.getByText(/nova_etapa/i)).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm run test dashboardRoute`
      Expected: FAIL

- [ ] **Step 3: Implement badges inside FlowDashboard.tsx list mapping**
  1. For each stage node in `visibleNodes.map((node) => ...)`:
     - Check if it has a score effect (`+pts`).
     - Check if it has a deferred safety effect (`⚠`).
     - Check if it has a flow start effect (`⇄`).
     - Render these as compact tags inline inside the stage list button:
       - Score badge: `bg-secondary-container text-on-secondary-container px-1 py-0.5 rounded text-[10px] font-bold` with text `+pts`.
       - Safety badge: `bg-error-container text-error px-1.5 py-0.5 rounded text-[10px] font-bold` with text `⚠`.
       - Redirection badge: `bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-[10px] font-bold` with text `⇄`.
  2. Implement an `onNodeAdd` callback/prop on `FlowEditor` that is handled by parent, or implement node addition in `FlowDashboard` directly (modifying `flow.nodes` and calling `onFlowChange`).
  3. Move the "+ Adicionar etapa" button from the bottom of the card list in `FlowEditor.tsx` to the bottom of the stages sidebar list in `FlowDashboard.tsx`.

- [ ] **Step 4: Run test to verify it passes and update existing tests**
      Run: `pnpm run test dashboardRoute`
      Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat: add outline badges and move add stage button to sidebar"
  ```

---

### Task 3: Collapsible Stage Cards in Detail Panel & Scroll-Anchoring

**Files:**

- Modify: [FlowEditor.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/flows/FlowEditor.tsx)
- Test: [dashboardRoute.test.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/__tests__/dashboardRoute.test.tsx)

- [ ] **Step 1: Write the failing test**
      Add a test verifying all stages are listed, but only the active stage is expanded. The card title displays index and text preview instead of technical ID. The "Texto da etapa" editor is on top of "Tipo da etapa". Stage can be deleted with confirmation.

  ```tsx
  it('renders all stages as collapsible cards, expands active, swaps text/type position, and supports deletion with confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));

    // Click Etapa 3 (q1)
    await user.click(screen.getByRole('button', { name: /Etapa 3/i }));

    // Active stage card header shows Etapa 3 — Você tem dores de cabeça frequentes? (ID is hidden/demoted)
    expect(
      screen.getByRole('heading', { name: /Etapa 3 — Você tem dores de cabeça frequentes\?/i }),
    ).toBeInTheDocument();

    // Verify "Texto da etapa" textarea is positioned above "Tipo da etapa" select in DOM order
    const textLabel = screen.getByText('Texto da etapa');
    const typeLabel = screen.getByText('Tipo da etapa');
    expect(textLabel.compareDocumentPosition(typeLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Verify stage q2 card is collapsed (its text content is not editable/visible initially)
    expect(screen.queryByLabelText(/Texto da Etapa 4/i)).not.toBeInTheDocument();

    // Click delete stage button
    await user.click(screen.getByRole('button', { name: /Excluir etapa/i }));

    // Confirm delete
    const confirmBtn = screen.getByRole('button', { name: /Confirmar exclusão da etapa/i });
    expect(confirmBtn).toBeInTheDocument();
    await user.click(confirmBtn);

    // Etapa 3 (q1) is deleted, now Etapa 3 becomes Q2
    expect(
      screen.queryByRole('heading', { name: /Etapa 3 — Você tem dores de cabeça frequentes\?/i }),
    ).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm run test dashboardRoute`
      Expected: FAIL

- [ ] **Step 3: Modify FlowEditor.tsx layout structure**
  1. Wrap flow settings ("Dados do fluxo" and "Configuração de entrada") inside a single collapsible `<details>` or styled state-based panel `Configurações Iniciais e Entrada do Fluxo ⚙️`. Collapsed by default.
  2. Instead of rendering only `activeNode`, loop over all `visibleNodes` and render an `<article>` card for each:
     - Header: Displays `Etapa ${index + 1} — ${node.text ? getNodePreview(node.text) : node.id}`. If it's a choice node, render option counts and kind badges. Do not render the technical ID prominently in the header. Remove the duplicate text preview from below the heading.
     - Add `Excluir etapa` button in the header next to `Duplicar esta etapa`. Implement confirmation state: clicking it once changes text to `Confirmar exclusão da etapa ⚠️`, clicking again deletes the node.
     - Body panel: Render if `node.id === selectedNodeId`. Inside the body panel, render the "Texto da etapa" textarea first, followed by "Tipo da etapa" select underneath it.
  3. Implement `deleteNode(nodeId)`: deletes node from `flow.nodes`, updates state, and selects the first visible node or next available.
  4. Ensure scroll-anchoring: When `selectedNodeId` changes, use `useEffect` or `onClick` handler to scroll to `document.getElementById('flow-node-' + selectedNodeId)` using `{ behavior: 'smooth', block: 'start' }`.

- [ ] **Step 4: Run test to verify it passes**
      Run: `pnpm run test dashboardRoute`
      Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat: implement collapsible stage cards with scroll-anchoring, delete stage, and layout swap"
  ```

---

### Task 4: Drawer Backdrop Dismiss & Auto-Score Default Activation

**Files:**

- Modify: [FlowEditor.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/flows/FlowEditor.tsx)
- Test: [dashboardRoute.test.tsx](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo/src/dev-dashboard/__tests__/dashboardRoute.test.tsx)

- [ ] **Step 1: Write the failing test**
      Add a test verifying that clicking the drawer backdrop overlay closes it, score effects are automatically enabled/active when a flow has score keys, and helper text is displayed for the score key input.

  ```tsx
  it('dismisses drawer on backdrop click, auto-activates score, and displays score key description', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: /Etapa 4/i })); // Q2

    // Click option 1 actions to open drawer
    await user.click(screen.getAllByRole('button', { name: /Ações\/Score/i })[0]);

    // Verify helper hint explaining what "Chave da pontuação" means
    expect(screen.getByText(/A chave agrupa pontos do questionário/i)).toBeInTheDocument();

    // Q2 does NOT have a score effect in default state, but since flow SRQ-20 has active scoring,
    // the score inputs should ALREADY be active/visible (no "Ativar pontuação" button)
    expect(screen.getByLabelText('Chave da pontuação')).toBeInTheDocument();

    // Click backdrop (the outer overlay) to close drawer
    const backdrop = screen.getByTestId('drawer-backdrop');
    await user.click(backdrop);

    // Verify drawer is closed
    expect(screen.queryByLabelText('Chave da pontuação')).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm run test dashboardRoute`
      Expected: FAIL

- [ ] **Step 3: Modify FlowEditor.tsx drawer logic**
  1. Add `data-testid="drawer-backdrop"` and `onClick={() => setActiveOptionEdit(null)}` to the drawer outer overlay element. Add `onClick={(e) => e.stopPropagation()}` to the drawer inner container so clicks inside don't close it.
  2. Add a description hint below the "Chave da pontuação" input: `A chave agrupa pontos do questionário (ex: 'srq20' para somar todas as respostas Sim).`
  3. In the drawer score rendering block:
     - Check if `!scoreEffect && existingScoreKeys.length > 0`. If this is true, automatically append/create a score effect with key `existingScoreKeys[0]` and value `1` on the option when the drawer is opened or the options are configured, or render the score inputs directly and auto-save the score effect when they are initialized/rendered.
     - To do this safely: inside the drawer's `editOption` render block, if `!scoreEffect && existingScoreKeys.length > 0`, render the score fields (Chave, Valor) but initialize them with `existingScoreKeys[0]` and value `1`, updating the option effects automatically (using `updateOptionEffects`) to persist the score. This makes it active by default!

- [ ] **Step 4: Run test to verify it passes**
      Run: `pnpm run test dashboardRoute`
      Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat: implement backdrop drawer close, auto-score activation, and key help hints"
  ```

---

### Task 5: Full Project Verification

- [ ] **Step 1: Run typechecks**
      Run: `pnpm run typecheck`
      Expected: Success without errors

- [ ] **Step 2: Run style lints**
      Run: `pnpm run lint`
      Expected: Success without errors

- [ ] **Step 3: Run all automated tests**
      Run: `pnpm run test`
      Expected: All 220+ tests pass

- [ ] **Step 4: Run flow validation scripts**
      Run: `pnpm run validate:flows`
      Expected: Success without errors

- [ ] **Step 5: Run production build check**
      Run: `pnpm run build`
      Expected: Build completes successfully

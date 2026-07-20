# Orientation Pre-Chat Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a welcoming pre-chat screen that always appears before the Orientacao chatbot, matching the current BemTeVi visual language and giving users safe starter messages.

**Architecture:** Gate the existing chatbot behind a local `hasStarted` state. The new intro view lives inside `OrientationScreen.tsx` and reuses the same page frame, colors, rounded panel, and typography. When the user chooses a starter, the component starts the current guided flow after the existing typing delay; non-"Outro" starters are inserted as the first user message so the conversation feels continuous.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tailwind CSS, lucide-react

---

## File Structure

| File                                                            | Action | Purpose                                                                                                |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `src/features/orientation/__tests__/OrientationScreen.test.tsx` | Modify | Update existing chat tests to pass through the intro gate and add coverage for the new pre-chat screen |
| `src/features/orientation/OrientationScreen.tsx`                | Modify | Add starter constants, intro state, intro screen component, and delayed flow startup behavior          |

---

### Task 1: Add failing tests for the pre-chat gate

**Files:**

- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add a helper that starts the chat from the intro screen**

Add this helper after `advanceInitialLoad()`:

```tsx
function startOrientationWithStarter(label = 'Me sinto um pouco cansado(a).') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  advanceInitialLoad();
}
```

- [ ] **Step 2: Add a test for the pre-chat screen content**

Add this test as the first `it(...)` inside `describe('OrientationScreen', ...)`:

```tsx
it('shows a welcoming pre-chat screen before the chatbot', () => {
  renderOrientation();

  expect(screen.getByRole('heading', { name: 'Antes de começar' })).toBeInTheDocument();
  expect(
    screen.getByText('Conte como você está chegando agora. Você pode escolher uma sugestão ou escrever do seu jeito.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Pode nos contar como está se sentindo hoje?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Me sinto um pouco cansado(a).' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tive um dia cheio.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quero organizar meus pensamentos.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preciso de um momento para respirar.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Outro' })).toBeInTheDocument();
  expect(screen.getByText('Este espaço é anônimo e não salva sua conversa.')).toBeInTheDocument();

  expect(screen.queryByRole('log', { name: 'Histórico da orientação guiada' })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Digite ou escolha uma opção')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Update existing chatbot tests to start from the intro**

In each existing test that expects chatbot content, call `startOrientationWithStarter()` immediately after `renderOrientation()` and remove the first direct `advanceInitialLoad()` call.

For example, change this:

```tsx
it('advances the flow immediately when the user clicks a bubble', () => {
  renderOrientation();
  advanceInitialLoad();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
  advanceInitialLoad();

  expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
  expect(
    screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).toBeInTheDocument();
});
```

To this:

```tsx
it('advances the flow immediately when the user clicks a bubble', () => {
  renderOrientation();
  startOrientationWithStarter();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
  advanceInitialLoad();

  expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
  expect(
    screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).toBeInTheDocument();
});
```

Apply the same pattern to these tests:

```tsx
it('exposes the conversation as an accessible log with sender context', () => {
  renderOrientation();
  startOrientationWithStarter();

  expect(screen.getByRole('log', { name: 'Histórico da orientação guiada' })).toBeInTheDocument();
  expect(screen.getAllByText('BemTeVi')).toHaveLength(2);
});

it('starts SRQ-20 through chatbot autocomplete from JSON flow content', () => {
  renderOrientation();
  startOrientationWithStarter();

  fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
    target: { value: 'SRQ-20' },
  });

  fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
  advanceInitialLoad();

  expect(screen.getByText(/Este é o SRQ-20/i)).toBeInTheDocument();
  expect(screen.getByText(/Antes de começar/i)).toBeInTheDocument();
});

it('only enables send when the input exactly matches an available option', () => {
  renderOrientation();
  startOrientationWithStarter();

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
  const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

  expect(sendButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'qualquer coisa' } });
  expect(sendButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
  expect(sendButton).toBeEnabled();
});
```

- [ ] **Step 4: Update tests that intentionally assert the intro-only state**

Keep these tests on the intro screen and update their expectations:

```tsx
it('renders guided orientation without free-text submission', () => {
  renderOrientation();

  expect(screen.queryByText('Orientação sem cadastro')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Orientação guiada' })).not.toBeInTheDocument();
  expect(screen.queryByText('Opções disponíveis')).not.toBeInTheDocument();
  expect(screen.queryByText('Sobrecarga na escola')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Digite ou escolha uma opção')).not.toBeInTheDocument();
});

it('keeps the composer fixed as a chat input above the page navigation after the intro', () => {
  renderOrientation();
  startOrientationWithStarter();

  expect(screen.getByTestId('orientation-composer')).toHaveClass('fixed');
  expect(screen.getByRole('button', { name: 'Enviar opção selecionada' })).toHaveAttribute('data-icon', 'send');
});
```

- [ ] **Step 5: Add a test that starter selection becomes the first user message**

Append this test near the typing indicator tests:

```tsx
it('starts the chatbot after a starter and records the starter as a user message', () => {
  renderOrientation();

  fireEvent.click(screen.getByRole('button', { name: 'Tive um dia cheio.' }));

  expect(screen.queryByRole('heading', { name: 'Antes de começar' })).not.toBeInTheDocument();
  expect(screen.queryByText('Tive um dia cheio.')).not.toBeInTheDocument();
  expect(screen.getByText('BemTeVi')).toBeInTheDocument();

  advanceInitialLoad();

  expect(screen.getByText('Tive um dia cheio.')).toBeInTheDocument();
  expect(screen.getByText(/Vamos olhar para essa sobrecarga com calma/)).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();
});
```

- [ ] **Step 6: Add a test that "Outro" starts without inserting a user message**

```tsx
it('starts the chatbot from Outro without adding Outro as a conversation message', () => {
  renderOrientation();

  fireEvent.click(screen.getByRole('button', { name: 'Outro' }));
  advanceInitialLoad();

  expect(screen.queryByText(/^Outro$/)).not.toBeInTheDocument();
  expect(screen.getByText(/Vamos olhar para essa sobrecarga com calma/)).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toBeInTheDocument();
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: FAIL because the current component still starts the chatbot automatically and does not render the "Antes de começar" screen.

- [ ] **Step 8: Commit**

```bash
git add src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "test: cover orientation pre-chat screen"
```

---

### Task 2: Add intro state and delayed flow startup

**Files:**

- Modify: `src/features/orientation/OrientationScreen.tsx`

- [ ] **Step 1: Update imports**

Replace the flow loader import:

```tsx
import { createInitialFlowStateFromRegistry } from '../../domain/flow-engine/loadFlows';
```

With:

```tsx
import { createInitialFlowStateFromRegistry, createMessage } from '../../domain/flow-engine/loadFlows';
```

- [ ] **Step 2: Add starter constants**

Add after `const flows = flowRegistry.flows;`:

```tsx
const INTRO_STARTERS = [
  { id: 'tired', label: 'Me sinto um pouco cansado(a).' },
  { id: 'full-day', label: 'Tive um dia cheio.' },
  { id: 'organize-thoughts', label: 'Quero organizar meus pensamentos.' },
  { id: 'breathe', label: 'Preciso de um momento para respirar.' },
  { id: 'other', label: 'Outro' },
] as const;

type IntroStarter = (typeof INTRO_STARTERS)[number];
```

- [ ] **Step 3: Add intro state to `OrientationScreen`**

Inside `OrientationScreen`, replace the current state declarations:

```tsx
const [inputValue, setInputValue] = useState('');
const [state, setState] = useState<FlowRuntimeState | null>(null);
const [visibleCount, setVisibleCount] = useState(0);
const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const isRevealing = state === null || visibleCount < state.transcript.length;
```

With:

```tsx
const [inputValue, setInputValue] = useState('');
const [hasStarted, setHasStarted] = useState(false);
const [selectedIntroStarter, setSelectedIntroStarter] = useState<string | null>(null);
const [state, setState] = useState<FlowRuntimeState | null>(null);
const [visibleCount, setVisibleCount] = useState(0);
const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const isRevealing = hasStarted && (state === null || visibleCount < state.transcript.length);
```

- [ ] **Step 4: Replace automatic initial load effect**

Replace the current initial load effect:

```tsx
useEffect(() => {
  typingTimerRef.current = setTimeout(() => {
    const initialState = createInitialFlowStateFromRegistry(flows, 'work-stress');
    setState(initialState);
    setVisibleCount(initialState.transcript.length);
  }, TYPING_DELAY_MS);
}, []);
```

With:

```tsx
useEffect(() => {
  if (!hasStarted || state) return;

  typingTimerRef.current = setTimeout(() => {
    const initialState = createInitialFlowStateFromRegistry(flows, 'work-stress');
    const introMessages =
      selectedIntroStarter === null
        ? []
        : [
            createMessage(
              'user',
              selectedIntroStarter,
              initialState.activeFlowId ?? 'work-stress',
              initialState.activeNodeId,
            ),
          ];
    const nextState = {
      ...initialState,
      transcript: [...introMessages, ...initialState.transcript],
    };

    setState(nextState);
    setVisibleCount(nextState.transcript.length);
  }, TYPING_DELAY_MS);
}, [hasStarted, selectedIntroStarter, state]);
```

- [ ] **Step 5: Add the intro start handler**

Add before `selectOption`:

```tsx
function startConversation(starter: IntroStarter) {
  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

  setSelectedIntroStarter(starter.id === 'other' ? null : starter.label);
  setInputValue('');
  setState(null);
  setVisibleCount(0);
  setHasStarted(true);
}
```

- [ ] **Step 6: Run tests to check the partial implementation**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: FAIL because the component now has intro state, but the intro screen UI is not rendered yet.

---

### Task 3: Render the pre-chat screen using the current theme

**Files:**

- Modify: `src/features/orientation/OrientationScreen.tsx`

- [ ] **Step 1: Add a conditional render before the chat section**

Inside the `return`, keep the existing `<main ...>` wrapper and add this before the existing chatbot `<section ...>`:

```tsx
{
  !hasStarted && <OrientationIntroScreen onSelectStarter={startConversation} />;
}
```

Then wrap the current chatbot `<section ...>` with:

```tsx
{
  hasStarted && (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
      {/* existing chatbot content stays here */}
    </section>
  );
}
```

The resulting return shape should be:

```tsx
return (
  <main className="mx-auto flex h-[calc(100dvh-160px)] w-full max-w-3xl flex-col overflow-hidden px-container-padding-mobile pt-3 md:h-[calc(100dvh-64px)] md:px-container-padding-desktop md:pt-stack-md">
    {!hasStarted && <OrientationIntroScreen onSelectStarter={startConversation} />}

    {hasStarted && (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
        {/* existing log and form */}
      </section>
    )}
  </main>
);
```

- [ ] **Step 2: Add the intro component**

Add this component before `MessageBubble`:

```tsx
function OrientationIntroScreen({ onSelectStarter }: { onSelectStarter: (starter: IntroStarter) => void }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"
              aria-hidden="true"
            >
              <MessageCircle size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="font-title-lg text-on-surface">Antes de começar</h1>
              <p className="mt-2 max-w-xl font-body-md text-on-surface-variant">
                Conte como você está chegando agora. Você pode escolher uma sugestão ou escrever do seu jeito.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-4">
            <p className="font-label-lg text-on-surface">Pode nos contar como está se sentindo hoje?</p>
          </div>

          <div className="grid gap-2" aria-label="Sugestões para começar a conversa">
            {INTRO_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => onSelectStarter(starter)}
                className="min-h-12 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left font-label-md text-on-surface shadow-sm transition-colors hover:border-primary hover:bg-primary-fixed/45 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-[#EEF8F3] px-4 py-3 font-body-sm text-on-surface-variant">
          Este espaço é anônimo e não salva sua conversa.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run the orientation tests**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: PASS for the orientation screen test file.

- [ ] **Step 4: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "feat: add orientation pre-chat starter screen"
```

---

### Task 4: Verify the full app and review in browser

**Files:**

- No source edits expected unless verification finds a defect

- [ ] **Step 1: Run the full test suite**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `pnpm run build`

Expected: PASS. Vite should complete without TypeScript or bundling errors.

- [ ] **Step 3: Open the Orientacao page in the in-app browser**

Navigate to:

```text
http://localhost:3000/SeCuida-Prototipo/orientacao
```

Expected visual result:

- Header remains the same BemTeVi app header.
- Bottom nav remains visible with "Orientação" active.
- The first visible screen is the "Antes de começar" intro panel.
- The intro panel uses the same white surface, green accent, soft border, and rounded-xl framing as the existing chatbot.
- The options fit on mobile without text overlap.
- Selecting a starter hides the intro, shows the typing indicator, then shows the selected starter message plus the existing chatbot options.

- [ ] **Step 4: Check mobile and desktop widths**

Use these viewport sizes:

```text
390x844
768x1024
1280x800
```

Expected:

- No text overlaps or clips.
- Starter buttons remain tap-friendly.
- The reassurance text remains visible at the bottom of the panel or reachable by scrolling on short screens.
- The composer still appears only after the intro is dismissed.

- [ ] **Step 5: Commit any verification fixes**

If visual verification requires small spacing or responsive fixes, commit them with:

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "fix: polish orientation pre-chat layout"
```

If no fixes are needed, do not create an empty commit.

---

## Self-Review

**Spec coverage:** The plan adds a screen that always appears before the chatbot, keeps the BemTeVi theme, includes title/subtitle/helpful starter messages, uses safe Portuguese copy, and keeps the existing chatbot as the next step.

**Placeholder scan:** No placeholder implementation steps remain. Each code change includes concrete snippets, and every verification command includes an expected result.

**Type consistency:** `IntroStarter`, `INTRO_STARTERS`, `startConversation`, and `OrientationIntroScreen` are defined before use. `selectedIntroStarter` is typed as `string | null`, matching the `createMessage` call and the "Outro" behavior.

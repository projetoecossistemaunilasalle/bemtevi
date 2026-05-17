# Chatbot Typing Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bouncing-dot typing indicator that shows for ~1.2s before bot messages appear, making the chatbot feel more conversational.

**Architecture:** Staged rendering — the flow engine runs immediately (unchanged), but the component controls message visibility via a `visibleCount` that trails the actual transcript. A `TypingIndicator` component renders while bot messages are hidden. Suggestions, input, and navigation are gated during the reveal delay.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react, Tailwind CSS

---

## File Structure

- **Modify:** `src/features/orientation/OrientationScreen.tsx` — all component logic, TypingIndicator, inline animation styles
- **Modify:** `src/features/orientation/__tests__/OrientationScreen.test.tsx` — update timing-sensitive tests, add typing-state coverage

---

### Task 1: Update existing tests for async initial load

The current component initializes state synchronously. After the change, `state` starts as `null` and messages appear after `TYPING_DELAY_MS`. Existing tests must advance past the initial timer.

**Files:**
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add fake timers setup to all tests**

Replace the entire test file with fake timers and a helper that advances past the initial load:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrientationScreen } from '../OrientationScreen';

const TYPING_DELAY_MS = 1200;

function renderOrientation() {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
  );
}

function advanceInitialLoad() {
  act(() => {
    vi.advanceTimersByTime(TYPING_DELAY_MS);
  });
}

describe('OrientationScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders guided orientation without free-text submission', () => {
    renderOrientation();

    expect(screen.queryByText('Orientação sem cadastro')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Orientação guiada' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toBeInTheDocument();
    expect(screen.queryByText('Opções disponíveis')).not.toBeInTheDocument();
    expect(screen.queryByText('Sobrecarga na escola')).not.toBeInTheDocument();
  });

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

  it('exposes the conversation as an accessible log with sender context', () => {
    renderOrientation();
    advanceInitialLoad();

    expect(screen.getByRole('log', { name: 'Histórico da orientação guiada' })).toBeInTheDocument();
    expect(screen.getAllByText('SeCuida')).toHaveLength(2);
  });

  it('starts SRQ-20 through chatbot autocomplete from JSON flow content', () => {
    renderOrientation();
    advanceInitialLoad();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'SRQ-20' },
    });

    fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
    advanceInitialLoad();

    expect(screen.getByText(/Este é o SRQ-20/i)).toBeInTheDocument();
    expect(screen.getByText(/Antes de começar/i)).toBeInTheDocument();
  });

  it('does not render a questionnaire-specific screen entry', () => {
    renderOrientation();

    expect(screen.queryByRole('link', { name: /SRQ-20/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Responder SRQ-20/i })).not.toBeInTheDocument();
  });

  it('keeps the composer fixed as a chat input above the page navigation', () => {
    renderOrientation();

    expect(screen.getByTestId('orientation-composer')).toHaveClass('fixed');
    expect(screen.getByRole('button', { name: 'Enviar opção selecionada' })).toHaveAttribute('data-icon', 'send');
  });

  it('only enables send when the input exactly matches an available option', () => {
    renderOrientation();
    advanceInitialLoad();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'qualquer coisa' } });
    expect(sendButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(sendButton).toBeEnabled();
  });

  it('shows matching options in an autocomplete overlay above the input', () => {
    renderOrientation();
    advanceInitialLoad();

    fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
      target: { value: 'descansar' },
    });

    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dificuldade para descansar' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).not.toBeInTheDocument();
  });

  it('hides suggestions when input exactly matches an option label', () => {
    renderOrientation();
    advanceInitialLoad();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

    // Initially, node_option pills are visible
    expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();

    // Type an exact match
    fireEvent.change(input, { target: { value: 'Muitas tarefas ao mesmo tempo' } });

    // Suggestions should be hidden
    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
  });

  it('shows suggestions when trailing space breaks strict match but send stays enabled', () => {
    renderOrientation();
    advanceInitialLoad();

    const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
    const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

    // Type exact match — suggestions hidden, send enabled
    fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
    expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
    expect(sendButton).toBeEnabled();

    // Add trailing space — strict match breaks, suggestions reappear, send stays enabled
    fireEvent.change(input, { target: { value: 'Dificuldade para descansar ' } });
    expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
    expect(sendButton).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: Tests fail because the component doesn't have fake timer support yet (options don't appear after advanceInitialLoad).

- [ ] **Step 3: Commit**

```bash
git add src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "test: update orientation tests for async initial load with fake timers"
```

---

### Task 2: Add TypingIndicator component and staged rendering for initial load

**Files:**
- Modify: `src/features/orientation/OrientationScreen.tsx`

- [ ] **Step 1: Add TypingIndicator component**

Add after the `MessageBubble` function (line 179):

```tsx
function TypingIndicator() {
  return (
    <article className="flex items-end gap-2 justify-start" aria-hidden="true">
      <style>{`
        @keyframes orientation-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .orientation-typing-dot {
          width: 8px;
          height: 8px;
          background: #6b7280;
          border-radius: 50%;
          display: inline-block;
          animation: orientation-typing-bounce 1.2s infinite ease-in-out;
        }
      `}</style>
      <div className="flex max-w-[84%] flex-col gap-1 items-start">
        <span className="flex items-center gap-2 font-label-md text-on-surface-variant">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <MessageCircle size={17} />
          </span>
          SeCuida
        </span>
        <div className="ml-10 rounded-2xl rounded-bl-sm border border-outline-variant/40 bg-[#EEF8F3] px-4 py-3 shadow-sm">
          <span className="orientation-typing-dot" style={{ animationDelay: '0s' }} />
          <span className="orientation-typing-dot" style={{ animationDelay: '0.15s', marginLeft: 4 }} />
          <span className="orientation-typing-dot" style={{ animationDelay: '0.3s', marginLeft: 4 }} />
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Add new state and constant**

Replace the `state` initialization (line 16) and add the constant and ref above it:

```tsx
const TYPING_DELAY_MS = 1200

const flows = flowRegistry.flows;

export function OrientationScreen() {
  const navigate = useNavigate();
  const logRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<FlowRuntimeState | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Add derived isRevealing flag**

After the `exactOption` memo (line 33):

```tsx
const isRevealing = state === null || visibleCount < state.transcript.length;
```

- [ ] **Step 4: Update options memo to gate during reveal**

Replace the options memo (lines 17-31):

```tsx
const options = useMemo(() => (state && !isRevealing ? resolveOptions(state, flows) : []), [state, isRevealing]);
```

- [ ] **Step 5: Update transcript rendering**

Replace the transcript `.map()` (lines 81-83):

```tsx
{state?.transcript.slice(0, visibleCount).map((message) => (
  <MessageBubble key={message.id} message={message} />
))}
{isRevealing && <TypingIndicator />}
```

- [ ] **Step 6: Add initial load useEffect**

Replace the current initial state (line 16) with a `useEffect` that delays the initial load. Remove the inline `useState(() => createInitialFlowStateFromRegistry(flows, 'work-stress'))` and add:

```tsx
useEffect(() => {
  typingTimerRef.current = setTimeout(() => {
    const initialState = createInitialFlowStateFromRegistry(flows, 'work-stress');
    setState(initialState);
    setVisibleCount(initialState.transcript.length);
  }, TYPING_DELAY_MS);
}, []);
```

- [ ] **Step 7: Add unmount cleanup useEffect**

Add after the initial load effect:

```tsx
useEffect(() => {
  return () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };
}, []);
```

- [ ] **Step 8: Add FlowRuntimeState import**

Update the import from flow-engine types (line 8):

```tsx
import type { ChatMessage, FlowRuntimeState, RuntimeOption } from '../../domain/flow-engine/types';
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: All existing tests pass with the fake timer setup.

- [ ] **Step 10: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx
git commit -m "feat: add TypingIndicator and staged rendering for initial load"
```

---

### Task 3: Implement staged rendering for user selections

**Files:**
- Modify: `src/features/orientation/OrientationScreen.tsx`

- [ ] **Step 1: Update submitOption with staged rendering**

Replace the `submitOption` function (lines 53-61):

```tsx
function submitOption(option: RuntimeOption) {
  if (!state) return;

  if (option.kind === 'global_action' && option.target !== 'end') {
    navigate(option.target);
    return;
  }

  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  setInputValue('');

  const preAdvanceCount = state.transcript.length;
  const newState = advanceFlow(state, flows, option.label);

  let immediateCount: number;
  if (option.kind === 'entry_phrase') {
    immediateCount = 0;
  } else if (option.kind === 'resume_flow') {
    immediateCount = newState.transcript.length;
  } else {
    immediateCount = preAdvanceCount + 1;
  }

  setState(newState);
  setVisibleCount(immediateCount);

  const totalMessages = newState.transcript.length;
  if (immediateCount < totalMessages) {
    typingTimerRef.current = setTimeout(() => {
      setVisibleCount(totalMessages);
    }, TYPING_DELAY_MS);
  }
}
```

- [ ] **Step 2: Disable input during reveal**

Add `disabled={isRevealing}` to the input element:

```tsx
<input
  id="orientation-choice-input"
  type="text"
  value={inputValue}
  onChange={(event) => setInputValue(event.target.value)}
  placeholder="Digite ou escolha uma opção"
  aria-autocomplete="list"
  aria-controls="orientation-suggestions"
  disabled={isRevealing}
  className="min-h-11 min-w-0 flex-1 bg-transparent font-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
/>
```

- [ ] **Step 3: Gate pendingNavigation**

Replace the pendingNavigation effect (lines 43-47):

```tsx
useEffect(() => {
  if (state && !isRevealing && state.pendingNavigation) {
    navigate(state.pendingNavigation);
  }
}, [navigate, state, isRevealing]);
```

- [ ] **Step 4: Update auto-scroll useEffect**

Replace the scroll effect (lines 35-41):

```tsx
useEffect(() => {
  const log = logRef.current;
  if (log) {
    log.scrollTop = log.scrollHeight;
  }
}, [state?.transcript, visibleOptions.length, visibleCount]);
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx
git commit -m "feat: stage bot message reveal with typing delay on user selections"
```

---

### Task 4: Add typing indicator test coverage

**Files:**
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add test for initial load typing indicator**

```tsx
it('shows typing indicator before initial greeting appears', () => {
  renderOrientation();

  // Typing indicator visible, no messages yet
  expect(screen.queryByText('Vamos olhar para essa sobrecarga com calma')).not.toBeInTheDocument();
  expect(screen.getByText('SeCuida')).toBeInTheDocument(); // avatar in typing indicator

  // After delay, messages appear
  advanceInitialLoad();

  expect(screen.getByText('Vamos olhar para essa sobrecarga com calma')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add test for node_option selection typing delay**

```tsx
it('shows user message immediately and bot response after delay when selecting a node option', () => {
  renderOrientation();
  advanceInitialLoad();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

  // User message visible immediately
  expect(screen.getByText('Muitas tarefas ao mesmo tempo')).toBeInTheDocument();

  // Bot response not yet visible, typing indicator shown
  expect(
    screen.queryByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).not.toBeInTheDocument();

  // Options hidden during reveal
  expect(screen.queryByRole('option')).not.toBeInTheDocument();

  // After delay, bot response and new options appear
  advanceInitialLoad();

  expect(
    screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Dificuldade para descansar' })).toBeInTheDocument();
});
```

- [ ] **Step 3: Add test for input disabled during reveal**

```tsx
it('disables input and send while revealing bot messages', () => {
  renderOrientation();
  advanceInitialLoad();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
  const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

  expect(input).toBeDisabled();
  expect(sendButton).toBeDisabled();

  advanceInitialLoad();

  expect(input).not.toBeDisabled();
  // send is disabled because no exact match typed, but input is enabled
  expect(sendButton).toBeDisabled();
});
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: All tests pass including new ones.

- [ ] **Step 5: Commit**

```bash
git add src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "test: add typing indicator behavior coverage"
```

---

### Task 5: Final verification and cleanup

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Run linter**

Run: `npx eslint src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: No lint errors.

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address lint/type issues in typing indicator implementation"
```

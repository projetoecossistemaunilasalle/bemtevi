# Hide Suggestions on Exact Match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the suggestion list when the input exactly matches an option label (strict, no trim), while keeping the send button's trimmed match behavior unchanged.

**Architecture:** Add a `strictExactOption` check (no `.trim()`) that returns `[]` from `visibleOptions` when truthy. The existing `exactOption` (with trim) continues controlling the send button.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `src/features/orientation/__tests__/OrientationScreen.test.tsx` | Modify | Add tests for strict match hiding and trailing space behavior |
| `src/features/orientation/OrientationScreen.tsx` | Modify | Add `strictExactOption`, gate `visibleOptions` on it |

---

### Task 1: Write failing tests for strict exact match behavior

**Files:**
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add test — suggestions hide when input exactly matches an option**

Append after the last `it(...)` block (before the closing `});`):

```tsx
it('hides suggestions when input exactly matches an option label', () => {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
  );

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

  // Initially, node_option pills are visible
  expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();

  // Type an exact match
  fireEvent.change(input, { target: { value: 'Muitas tarefas ao mesmo tempo' } });

  // Suggestions should be hidden
  expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add test — suggestions reappear when trailing space breaks strict match**

```tsx
it('shows suggestions when trailing space breaks strict match but send stays enabled', () => {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
  );

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: Two new tests FAIL — suggestions are still visible when exact match exists.

---

### Task 2: Implement strict exact match hiding

**Files:**
- Modify: `src/features/orientation/OrientationScreen.tsx:18-27`

- [ ] **Step 1: Add `strictExactOption` and gate `visibleOptions`**

Replace lines 18–27 with:

```ts
const visibleOptions = useMemo(() => {
  const normalizedInput = inputValue.trim().toLocaleLowerCase('pt-BR');
  const strictMatch = options.find(
    (option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.toLocaleLowerCase('pt-BR'),
  );

  if (strictMatch) return [];

  if (!normalizedInput) {
    return options.filter((option) => option.kind === 'node_option');
  }

  return options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(normalizedInput));
}, [inputValue, options]);

const exactOption = options.find((option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.trim().toLocaleLowerCase('pt-BR'));
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx`
Expected: All tests PASS, including the two new ones.

- [ ] **Step 3: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "feat: hide suggestions when input exactly matches an option label"
```

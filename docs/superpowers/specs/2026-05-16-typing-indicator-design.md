# Chatbot Typing Indicator Design

## Summary

Add a "..." typing indicator with bouncing-dot animation to the Orientação chatbot. Bot responses currently appear instantly after user selections; this adds a ~1.2s delay with a visual indicator to make the conversation feel more natural.

## Decisions

| Aspect        | Decision                                                                                |
| ------------- | --------------------------------------------------------------------------------------- |
| Approach      | Staged rendering — engine runs immediately, component controls message visibility       |
| Delay         | `TYPING_DELAY_MS = 1200` constant                                                       |
| Animation     | Bouncing dots (3 dots, sequential bounce)                                               |
| Batching      | One typing indicator per batch, all bot messages appear together                        |
| Initial load  | Typing indicator shows before first greeting                                            |
| User messages | Instant (no delay)                                                                      |
| Flow engine   | Unchanged                                                                               |
| Accessibility | `aria-hidden` on indicator, existing `aria-live="polite"` handles message announcements |
| Auto-scroll   | Scrolls on both transcript changes and `visibleCount` changes                           |

## Architecture

### Why staged rendering

The flow engine's `advanceFlow()` is a pure synchronous function that produces **both** user and bot messages in one call. We cannot add the user message separately without duplicating it or modifying the engine. Instead, the engine runs immediately (preserving its contract), and the component controls which messages are **visible** to the user.

### Core invariant

**While `visibleCount < state.transcript.length`, the user must not be able to interact with the next options.** The typing indicator represents a pending bot response; revealing options before the bot message explaining them would break the conversational flow.

### Current flow

```
User selects option → submitOption() → advanceFlow() → all messages appear instantly
```

### New flow

```
User selects option
  → advanceFlow() called immediately (adds user + bot messages to state)
  → visibleCount set to show user message only
  → typing indicator shown, suggestions/input gated
  → setTimeout(TYPING_DELAY_MS)
  → visibleCount updated to full transcript length
  → bot messages revealed, suggestions/input ungated
  → pendingNavigation (if any) fires now
```

### Initial load

```
Component mounts
  → state = null (no transcript), typing indicator shown, suggestions/input gated
  → setTimeout(TYPING_DELAY_MS)
  → createInitialFlowStateFromRegistry() called, state set → messages appear
```

## Component Changes (OrientationScreen.tsx)

### New constant

```ts
const TYPING_DELAY_MS = 1200;
```

### New state

```ts
const [state, setState] = useState<FlowRuntimeState | null>(null);
const [visibleCount, setVisibleCount] = useState(0);
const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

`state` starts as `null` until the initial typing delay completes. `visibleCount` tracks how many messages from `state.transcript` are currently visible.

### Derived blocking flag

```ts
const isRevealing = state === null || visibleCount < state.transcript.length;
```

When `isRevealing` is true:

- Typing indicator is shown
- Suggestions are hidden
- Input and send button are disabled
- `pendingNavigation` does not fire

### TypingIndicator component

A visual indicator rendered at the bottom of the transcript when `isRevealing` is true:

- Same bot avatar as regular bot messages (MessageCircle icon in primary-colored circle)
- Same green (`#EEF8F3`) bubble background and rounded shape
- Three dots with bouncing animation inside the bubble, using inline `<style>` for the keyframes
- `aria-hidden="true"` on the animated dots (decorative — actual messages announced via existing `aria-live="polite"`)

### Transcript rendering change

```ts
// Before:
{state.transcript.map((message) => (
  <MessageBubble key={message.id} message={message} />
))}

// After:
{state?.transcript.slice(0, visibleCount).map((message) => (
  <MessageBubble key={message.id} message={message} />
))}
{isRevealing && <TypingIndicator />}
```

### Options gating

```ts
// Before:
const options = useMemo(() => resolveOptions(state, flows), [state]);

// After:
const options = useMemo(() => (state && !isRevealing ? resolveOptions(state, flows) : []), [state, isRevealing]);
```

When `isRevealing` is true, `options` is empty — no suggestions render, `exactOption` is undefined, and the send button is disabled via `disabled={!exactOption}`.

### Input disabling

```ts
// Add disabled prop to input:
<input
  ...
  disabled={isRevealing}
/>
```

### pendingNavigation gating

```ts
// Before:
useEffect(() => {
  if (state.pendingNavigation) {
    navigate(state.pendingNavigation);
  }
}, [navigate, state.pendingNavigation]);

// After:
useEffect(() => {
  if (state && !isRevealing && state.pendingNavigation) {
    navigate(state.pendingNavigation);
  }
}, [navigate, state, isRevealing]);
```

Navigation only fires after all messages are revealed.

### Initial load useEffect

```ts
useEffect(() => {
  typingTimerRef.current = setTimeout(() => {
    const initialState = createInitialFlowStateFromRegistry(flows, 'work-stress');
    setState(initialState);
    setVisibleCount(initialState.transcript.length);
  }, TYPING_DELAY_MS);
}, []);
```

No cleanup return — the unmount effect handles clearing `typingTimerRef`.

State starts as `null`. Options resolve to `[]` (gated by `isRevealing`). Typing indicator shows. After the delay, state is set and all messages appear at once.

### submitOption changes

Different option kinds produce different state transitions. The `visibleCount` must be computed accordingly. **No side effects inside the `setState` updater** — React StrictMode may invoke it more than once.

```ts
function submitOption(option: RuntimeOption) {
  if (!state) return;

  if (option.kind === 'global_action' && option.target !== 'end') {
    navigate(option.target);
    return;
  }

  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  setInputValue('');

  // Capture pre-advance count from current render state
  const preAdvanceCount = state.transcript.length;

  // Run the engine — pure synchronous call
  const newState = advanceFlow(state, flows, option.label);

  // Determine how many messages to show immediately
  let immediateCount: number;
  if (option.kind === 'entry_phrase') {
    // New flow replaces transcript — show nothing until reveal (same as initial load)
    immediateCount = 0;
  } else if (option.kind === 'resume_flow') {
    // Suspended transcript is restored — show all old messages immediately
    // The suspended transcript was already visible before suspension
    immediateCount = newState.transcript.length;
  } else {
    // node_option: user message was appended, show it
    immediateCount = preAdvanceCount + 1;
  }

  // Update state
  setState(newState);
  setVisibleCount(immediateCount);

  // Schedule reveal if there are hidden messages
  const totalMessages = newState.transcript.length;
  if (immediateCount < totalMessages) {
    typingTimerRef.current = setTimeout(() => {
      setVisibleCount(totalMessages);
    }, TYPING_DELAY_MS);
  }
}
```

Key difference from previous version: `advanceFlow`, `setVisibleCount`, and `setTimeout` all run outside the `setState` updater. The updater is a pure state assignment. This avoids duplicate timers under React StrictMode.

For `resume_flow`: the suspended transcript was already visible before the user switched flows, so all restored messages show immediately — no typing delay.

For `entry_phrase`: the transcript is replaced with a new flow's greeting, which is a bot batch — same UX as initial load (typing indicator, then reveal).

### Unmount cleanup useEffect

Single cleanup effect — the initial-load effect does NOT return its own cleanup:

```ts
useEffect(() => {
  return () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };
}, []);
```

### Auto-scroll useEffect

Add `visibleCount` to the dependency array so the view scrolls down to show the typing indicator and newly revealed messages:

```ts
useEffect(() => {
  const log = logRef.current;
  if (log) log.scrollTop = log.scrollHeight;
}, [state?.transcript, visibleOptions.length, visibleCount]);
```

### Loading state for options resolve

Since `state` is now `null` on initial load, `resolveOptions` must handle this:

```ts
// options useMemo already gates on state being non-null via the isRevealing check
const options = useMemo(() => (state && !isRevealing ? resolveOptions(state, flows) : []), [state, isRevealing]);
```

## Animation

Uses inline `<style>` within the `TypingIndicator` component to avoid modifying global CSS files. The class/keyframe names are prefixed for this component to avoid collisions with global styles.

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
          BemTeVi
        </span>
        <div className="ml-10 rounded-2xl rounded-bl-sm border border-outline-variant/40 bg-[#EEF8F3] px-4 py-3 shadow-sm">
          <span className="orientation-typing-dot" style={{ animationDelay: '0s' }} />
          <span className="orientation-typing-dot" style={{ animationDelay: '0.15s', marginLeft: 4 }} />
          <span className="orientation-typing-dot" style={{ animationDelay: '0.3s', marginLeft: 4 }} />
        </div>
      </div>
    </article>
  );
}
```

## Test Updates

Existing orientation screen tests assume the initial transcript and options render synchronously. Update them to use fake timers or async waits around `TYPING_DELAY_MS`.

Recommended coverage:

- Initial load shows the typing indicator first, hides suggestions, disables input/send, then reveals the greeting and options after the timer.
- Selecting a normal node option shows the user message immediately, hides next options during the delay, then reveals the bot response and options.
- `entry_phrase` transitions hide the replaced transcript until the new flow greeting is revealed.
- `resume_flow` restores the suspended transcript immediately without a typing delay.
- A safety-interrupt/pending-navigation option waits until the bot message is revealed before navigating.

## Files Modified

- `src/features/orientation/OrientationScreen.tsx` — all component logic and inline animation styles
- `src/features/orientation/__tests__/OrientationScreen.test.tsx` — update timing-sensitive tests and add typing-state coverage

## Scope

- No changes to the flow engine (`src/domain/flow-engine/`)
- No changes to flow content (`src/content/flows/`)
- No changes to global CSS (`src/index.css`)
- No new dependencies (inline CSS animation only, `motion/react` not needed for this)

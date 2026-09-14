/**
 * Head polling for the canonical editor (dossier doc 16, "Polling"): while the
 * dashboard is visible, one head check every 15 seconds with no overlapping
 * reads; hidden stops polling; focus/online trigger an immediate check that
 * obeys the same serialization. No BroadcastChannel and no realtime
 * subscription. Deterministic and non-React: timers and visibility are
 * injected, so tests drive every tick explicitly.
 */

export interface SaveTimers {
  setTimeout(handler: () => void, timeoutMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface DraftPollingOptions {
  timers: SaveTimers;
  /** Injected visibility (e.g. document.visibilityState === 'visible'). */
  isVisible: () => boolean;
  /** One serialized head check; must never throw. */
  onPoll: () => Promise<void>;
  intervalMs?: number;
}

export interface DraftPolling {
  /** Window visibility change: true starts polling, false stops it. */
  setVisibility(visible: boolean): void;
  /** Immediate head check (focus/online), serialized like interval ticks. */
  poke(): void;
  dispose(): void;
}

export function createDraftPolling(options: DraftPollingOptions): DraftPolling {
  const timers = options.timers;
  const intervalMs = options.intervalMs ?? 15000;
  let handle: unknown = null;
  let disposed = false;
  let epoch = 0;
  let readInFlight = false;
  let pendingTick = false;
  let visible = false;

  function clearTimer(): void {
    if (handle !== null) {
      timers.clearTimeout(handle);
      handle = null;
    }
  }

  function schedule(): void {
    clearTimer();
    if (disposed || !visible) return;
    handle = timers.setTimeout(() => {
      handle = null;
      void runTick(false);
    }, intervalMs);
  }

  async function runTick(fromPoke: boolean): Promise<void> {
    if (disposed || readInFlight) {
      // No overlapping reads: queue exactly one follow-up run.
      pendingTick = true;
      if (fromPoke && !disposed && visible) schedule();
      return;
    }
    if (!fromPoke && !visible) return;
    readInFlight = true;
    const currentEpoch = epoch;
    try {
      await options.onPoll();
    } finally {
      readInFlight = false;
    }
    if (disposed || currentEpoch !== epoch) return;
    if (pendingTick) {
      pendingTick = false;
      if (visible) {
        void runTick(false);
        return;
      }
    }
    schedule();
  }

  return {
    setVisibility(next) {
      if (disposed || visible === next) return;
      visible = next;
      if (visible) {
        void runTick(false);
      } else {
        clearTimer();
      }
    },

    poke() {
      if (disposed || !visible) return;
      void runTick(true);
    },

    dispose() {
      disposed = true;
      epoch += 1;
      pendingTick = false;
      clearTimer();
    },
  };
}

/**
 * Autosave timer policy (doc 16 edit row): a 750 ms trailing debounce that
 * resets on every edit plus a 5 s maximum-wait deadline set once on the first
 * dirty edit that is never pushed forward by later edits. `suspend` stops all
 * autosave timers (offline/error/conflict/dispose); `clearDeadline` is used
 * when a save cycle actually starts.
 */
export interface AutosaveScheduler {
  arm(fromClean: boolean): void;
  /** Stops both timers; the maximum-wait deadline survives (edits re-arm it). */
  suspend(): void;
  /** Stops both timers and clears the maximum-wait deadline. */
  reset(): void;
}

export function createAutosaveScheduler(
  timers: SaveTimers,
  now: () => number,
  onExpire: () => void,
  debounceMs: number,
  maxWaitMs: number,
): AutosaveScheduler {
  let saveTimer: unknown = null;
  let maxWaitTimer: unknown = null;
  let deadline: number | null = null;
  return {
    arm(fromClean) {
      if (saveTimer === null) saveTimer = timers.setTimeout(onExpire, debounceMs);
      if (fromClean && deadline === null) deadline = now() + maxWaitMs;
      if (deadline !== null && maxWaitTimer === null)
        maxWaitTimer = timers.setTimeout(onExpire, Math.max(0, deadline - now()));
    },
    suspend() {
      for (const handle of [saveTimer, maxWaitTimer]) if (handle !== null) timers.clearTimeout(handle);
      saveTimer = null;
      maxWaitTimer = null;
    },
    reset() {
      this.suspend();
      deadline = null;
    },
  };
}

/** Single-slot trailing debounce used for the 250 ms recovery-cache write. */
export interface DebounceScheduler {
  schedule(): void;
  cancel(): void;
}

export function createDebounceScheduler(timers: SaveTimers, onFire: () => void, debounceMs: number): DebounceScheduler {
  let handle: unknown = null;
  return {
    schedule() {
      this.cancel();
      handle = timers.setTimeout(() => {
        handle = null;
        onFire();
      }, debounceMs);
    },
    cancel() {
      if (handle !== null) timers.clearTimeout(handle);
      handle = null;
    },
  };
}

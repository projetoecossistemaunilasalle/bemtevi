/**
 * Bounded call limits for the MCP tool surface (doc 04 "Cache, Limits And
 * Retries"). A sliding 60-second call log allows 60 calls maximum and counts
 * rejected calls too. Reads run at most four concurrently and mutations (and
 * later prepare/publish) at most one; excess is rejected immediately with
 * `rate_limited` — there is no unbounded queue. Read calls may be retried once
 * after 500 ms for transient transport failures; mutations have no
 * transport-level automatic retry. The clock and delay are injectable so tests
 * stay deterministic.
 */

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_CALLS = 60;
export const MAX_CONCURRENT_READS = 4;
export const MAX_CONCURRENT_MUTATIONS = 1;
export const READ_RETRY_DELAY_MS = 500;

export type ToolClock = () => number;
export type DelayFn = (ms: number) => Promise<void>;

export const systemClock: ToolClock = () => Date.now();

export const defaultDelay: DelayFn = (ms) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Sliding-window call limiter; every attempt (allowed or rejected) is logged. */
export class SlidingWindowRateLimiter {
  private readonly attempts: number[] = [];
  private readonly maxCalls: number;
  private readonly windowMs: number;
  private readonly now: ToolClock;

  constructor(options: { maxCalls?: number; windowMs?: number; now?: ToolClock } = {}) {
    this.maxCalls = options.maxCalls ?? RATE_LIMIT_MAX_CALLS;
    this.windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
    this.now = options.now ?? systemClock;
  }

  /** Records this call attempt and returns whether it is within the limit. */
  tryCall(): boolean {
    const timestamp = this.now();
    while (this.attempts.length > 0 && timestamp - (this.attempts[0] as number) >= this.windowMs) {
      this.attempts.shift();
    }
    this.attempts.push(timestamp);
    return this.attempts.length <= this.maxCalls;
  }
}

/** Immediate-reject concurrency gate; `tryAcquire` returns a release callback. */
export class ConcurrencyGate {
  private inFlight = 0;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  /** Returns a release function, or null when the gate is full (no queueing). */
  tryAcquire(): (() => void) | null {
    if (this.inFlight >= this.max) return null;
    this.inFlight += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight -= 1;
    };
  }
}

export type ToolKind = 'read' | 'mutation';

export interface ToolLimits {
  rateLimiter: SlidingWindowRateLimiter;
  readGate: ConcurrencyGate;
  mutationGate: ConcurrencyGate;
  delay: DelayFn;
}

/**
 * Runs one tool call under the shared limits: the rate limiter first (rejected
 * calls count), then the kind-specific concurrency gate. Excess is rejected
 * immediately with `rate_limited`.
 */
export async function runWithLimits<T>(
  limits: ToolLimits,
  kind: ToolKind,
  run: () => Promise<T>,
): Promise<{ allowed: true; value: T } | { allowed: false }> {
  if (!limits.rateLimiter.tryCall()) return { allowed: false };
  const gate = kind === 'mutation' ? limits.mutationGate : limits.readGate;
  const release = gate.tryAcquire();
  if (release === null) return { allowed: false };
  try {
    return { allowed: true, value: await run() };
  } finally {
    release();
  }
}

export function createToolLimits(options: { clock?: ToolClock; delay?: DelayFn } = {}): ToolLimits {
  return {
    rateLimiter: new SlidingWindowRateLimiter({ now: options.clock }),
    readGate: new ConcurrencyGate(MAX_CONCURRENT_READS),
    mutationGate: new ConcurrencyGate(MAX_CONCURRENT_MUTATIONS),
    delay: options.delay ?? defaultDelay,
  };
}

import { vi } from 'vitest';

export interface ScrollStubHandle {
  /** Recording stub installed on Element.prototype.scrollIntoView. */
  stub: ReturnType<typeof vi.fn>;
  /** Restores the original prototype value; call in finally. */
  restore: () => void;
}

/**
 * jsdom does not implement Element.scrollIntoView; swap in a recording stub so
 * panel/map scroll behavior can be asserted. Every suite that exercises
 * focus-request scrolling goes through this helper instead of patching the
 * prototype inline — the restore function guarantees no leakage across tests.
 */
export function installScrollStub(): ScrollStubHandle {
  const original = Element.prototype.scrollIntoView;
  const stub = vi.fn();
  Element.prototype.scrollIntoView = stub;
  return {
    stub,
    restore() {
      Element.prototype.scrollIntoView = original;
    },
  };
}

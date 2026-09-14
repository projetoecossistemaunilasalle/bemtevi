import { describe, expect, it, vi } from 'vitest';

import { createDraftPolling } from '../draftPolling';
import type { SaveTimers } from '../draftPolling';

class FakeTimers implements SaveTimers {
  private seq = 0;
  private tasks = new Map<number, { at: number; fn: () => void }>();
  nowMs = 0;

  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.set(id, { at: this.nowMs + ms, fn });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  pending(): number {
    return this.tasks.size;
  }

  advance(ms: number): void {
    const target = this.nowMs + ms;
    for (;;) {
      let next: { id: number; at: number; fn: () => void } | null = null;
      for (const [id, task] of this.tasks) {
        if (task.at <= target && (next === null || task.at < next.at)) next = { id, at: task.at, fn: task.fn };
      }
      if (next === null) break;
      this.tasks.delete(next.id);
      this.nowMs = next.at;
      next.fn();
    }
    this.nowMs = target;
  }
}

const flushAsync = (): Promise<void> => new Promise((resolveTick) => setTimeout(resolveTick, 0));

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(intervalMs?: number) {
  const timers = new FakeTimers();
  const isVisible = vi.fn(() => true);
  const onPoll = vi.fn(async () => undefined);
  const polling = createDraftPolling({
    timers,
    isVisible,
    onPoll,
    ...(intervalMs === undefined ? {} : { intervalMs }),
  });
  return { timers, isVisible, onPoll, polling };
}

describe('createDraftPolling', () => {
  it('checks immediately on visible and then every 15 seconds', async () => {
    const { timers, onPoll, polling } = setup();
    polling.setVisibility(true);
    await Promise.resolve();
    expect(onPoll).toHaveBeenCalledTimes(1);
    expect(timers.pending()).toBe(1);
    await timers.advance(15000);
    expect(onPoll).toHaveBeenCalledTimes(2);
    await timers.advance(15000);
    expect(onPoll).toHaveBeenCalledTimes(3);
    polling.dispose();
  });

  it('honours an injected interval', async () => {
    const { timers, onPoll, polling } = setup(15000);
    polling.setVisibility(true);
    await Promise.resolve();
    expect(onPoll).toHaveBeenCalledTimes(1);
    await timers.advance(14999);
    expect(onPoll).toHaveBeenCalledTimes(1);
    await timers.advance(1);
    expect(onPoll).toHaveBeenCalledTimes(2);
    polling.dispose();
  });

  it('stops polling while hidden and resumes on visibility', async () => {
    const { timers, onPoll, polling } = setup();
    polling.setVisibility(true);
    await Promise.resolve();
    expect(onPoll).toHaveBeenCalledTimes(1);
    polling.setVisibility(false);
    expect(timers.pending()).toBe(0);
    await timers.advance(60000);
    expect(onPoll).toHaveBeenCalledTimes(1);
    polling.setVisibility(true);
    await Promise.resolve();
    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(timers.pending()).toBe(1);
    await timers.advance(15000);
    expect(onPoll).toHaveBeenCalledTimes(3);
    polling.dispose();
  });

  it('never overlaps reads and queues exactly one follow-up', async () => {
    const { timers, onPoll, polling } = setup();
    const gate = deferred();
    onPoll.mockImplementation(async () => {
      await gate.promise;
    });
    polling.setVisibility(true);
    polling.poke(); // immediate focus check while the first read is in flight
    polling.poke(); // a second poke must not queue a second overlapping read
    polling.setVisibility(false); // hidden while in flight: pending follow-up is dropped
    gate.resolve();
    await timers.advance(1);
    expect(onPoll).toHaveBeenCalledTimes(1);
    polling.dispose();
  });

  it('runs the queued follow-up after the in-flight read finishes', async () => {
    const { timers, onPoll, polling } = setup();
    const gate = deferred();
    let first = true;
    onPoll.mockImplementation(async () => {
      if (first) {
        first = false;
        await gate.promise;
      }
    });
    polling.setVisibility(true);
    polling.poke();
    gate.resolve();
    await Promise.resolve();
    await timers.advance(0);
    expect(onPoll).toHaveBeenCalledTimes(2);
    polling.dispose();
  });

  it('ignores poke while hidden', () => {
    const { timers, onPoll, polling } = setup();
    polling.poke();
    expect(onPoll).not.toHaveBeenCalled();
    expect(timers.pending()).toBe(0);
    polling.dispose();
  });

  it('dispose cancels the timer and the epoch ignores a late completion', async () => {
    const { timers, onPoll, polling } = setup();
    const gate = deferred();
    onPoll.mockImplementation(async () => {
      await gate.promise;
    });
    polling.setVisibility(true);
    await Promise.resolve();
    expect(onPoll).toHaveBeenCalledTimes(1);
    gate.resolve();
    await flushAsync();
    expect(timers.pending()).toBe(1);
    const gate2 = deferred();
    onPoll.mockImplementation(async () => {
      await gate2.promise;
    });
    await timers.advance(15000);
    expect(onPoll).toHaveBeenCalledTimes(2);
    polling.dispose();
    gate2.resolve();
    await timers.advance(60000);
    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(timers.pending()).toBe(0);
  });
});

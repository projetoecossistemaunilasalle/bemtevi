import { beforeEach, describe, expect, it } from 'vitest';

describe('firstVisit', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exports isFirstVisit and markVisited functions', async () => {
    const { isFirstVisit, markVisited } = await import('../firstVisit');
    expect(typeof isFirstVisit).toBe('function');
    expect(typeof markVisited).toBe('function');
  });

  it('treats users as first-time visitors until onboarding is completed', async () => {
    const { isFirstVisit } = await import('../firstVisit');

    expect(isFirstVisit()).toBe(true);
  });

  it('persists onboarding completion in localStorage', async () => {
    const { isFirstVisit, markVisited } = await import('../firstVisit');

    markVisited();

    expect(isFirstVisit()).toBe(false);
    expect(window.localStorage.getItem('bemtevi:onboarding-seen')).toBe('true');
  });
});

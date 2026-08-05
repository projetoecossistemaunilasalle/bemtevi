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

  it('does not persist any onboarding content beyond the completion flag', async () => {
    const { markVisited } = await import('../firstVisit');

    markVisited();

    expect(window.localStorage).toHaveLength(1);
    expect(window.localStorage.getItem('bemtevi:onboarding-seen')).toBe('true');
    expect(window.localStorage.getItem('bemtevi:onboarding-answers')).toBeNull();
    expect(window.sessionStorage).toHaveLength(0);
  });
});

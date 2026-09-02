import { describe, expect, it } from 'vitest';
import { DASHBOARD_PUBLISH_MODE, getDashboardPublishMode } from '../publishMode';

describe('getDashboardPublishMode', () => {
  it('only permits database publication', () => {
    expect(getDashboardPublishMode()).toBe('database');
    expect(DASHBOARD_PUBLISH_MODE).toBe('database');
  });
});

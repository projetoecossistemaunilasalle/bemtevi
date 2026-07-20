import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDashboardPublishMode } from '../publishMode';

afterEach(() => vi.unstubAllEnvs());

describe('getDashboardPublishMode', () => {
  it('defaults to database publication', () => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', '');
    expect(getDashboardPublishMode()).toBe('database');
  });

  it('enables ZIP export only for the explicit export value', () => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', 'export');
    expect(getDashboardPublishMode()).toBe('export');
  });

  it.each(['DATABASE', 'true', 'zip'])('treats unsupported value %s as database mode', (value) => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', value);
    expect(getDashboardPublishMode()).toBe('database');
  });
});

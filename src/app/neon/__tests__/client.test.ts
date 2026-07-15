import { describe, expect, it, vi } from 'vitest';
import { createConfiguredNeonClient } from '../client';

describe('createConfiguredNeonClient', () => {
  it('returns null when either public endpoint is missing', () => {
    expect(createConfiguredNeonClient({ authUrl: '', dataApiUrl: '' }, vi.fn())).toBeNull();
  });

  it('enables anonymous Data API reads on the shared client', () => {
    const factory = vi.fn().mockReturnValue({ auth: {}, from: vi.fn() });
    createConfiguredNeonClient({ authUrl: 'https://auth.example', dataApiUrl: 'https://data.example' }, factory);
    expect(factory).toHaveBeenCalledWith({
      auth: { url: 'https://auth.example', allowAnonymous: true },
      dataApi: { url: 'https://data.example' },
    });
  });
});

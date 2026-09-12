import { defineConfig } from 'vitest/config';

/**
 * Live Neon Data API harness config (DB-04 owns provisioning and suites).
 * Excluded from the credential-free root `pnpm run test` suite on purpose.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});

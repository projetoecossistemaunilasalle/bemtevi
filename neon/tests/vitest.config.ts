import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Live Neon Data API harness config (DB-04 owns provisioning and suites).
 * Excluded from the credential-free root `pnpm run test` suite on purpose.
 * Test files run serially: fixtures reset shared branch state and the CAS
 * suites rely on real simultaneous HTTP requests inside a single file, never
 * on cross-file parallelism.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

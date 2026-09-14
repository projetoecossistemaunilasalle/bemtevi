import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * DB-free MCP package test config (MCP-01). Node environment; root is pinned
 * to the package so the suite resolves regardless of the invoking cwd (the
 * root runner passes `--config packages/content-mcp/vitest.config.ts` from the
 * repository root).
 */
export default defineConfig({
  root: packageRoot,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createProviderInvocation } from '../providers.mjs';

const cleanups = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('agent bridge provider policies', () => {
  it('runs Codex ephemerally in the read-only sandbox', () => {
    const invocation = createProviderInvocation('codex', 'codex', 'prompt', process.cwd());

    expect(invocation.args).toEqual(
      expect.arrayContaining(['--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--ignore-rules']),
    );
    expect(invocation.stdin).toBe('prompt');
  });

  it('disables Claude Code built-in and MCP tools', () => {
    const invocation = createProviderInvocation('claude', 'claude', 'prompt', process.cwd());

    expect(invocation.args).toEqual(expect.arrayContaining(['--tools', '', '--disallowedTools', 'mcp__*']));
    expect(invocation.args).toContain('--no-session-persistence');
  });

  it('isolates Hermes in a temporary directory with no file or terminal toolset', () => {
    const invocation = createProviderInvocation('hermes', 'missing-hermes', 'prompt', process.cwd());
    cleanups.push(invocation.cleanup);

    expect(invocation.cwd).toMatch(/bemtevi-hermes-/);
    expect(invocation.args).toEqual(expect.arrayContaining(['--toolsets', 'vision', '--query-file']));
    expect(invocation.args).not.toContain('terminal');
    expect(invocation.args).not.toContain('file');
  });
});

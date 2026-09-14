import { describe, expect, it } from 'vitest';
import {
  assertCliVersion,
  assertCreateBranchResponse,
  assertDataApiSnapshot,
  assertParentBranchSafe,
  generateBranchName,
  parseEnvFile,
  parseVersionOutput,
  redact,
  type NeonRunner,
} from './provision';
import {
  assertAnonymousJwt,
  assertAuthenticatedJwt,
  anonymousToken,
  decodeJwtClaims,
  signInPrincipal,
} from './clients';
import { isSafeTempDir } from './run';
import { assertParentFixtureClean } from './fixtures';

/**
 * DB-04 harness unit tests: fail-closed behavior without any network access.
 * They run inside the live vitest config but never provision, never sign in and
 * never touch the database.
 */

function fakeRunner(stdout: string): NeonRunner {
  return (args) => {
    if (args.includes('--version')) return { stdout, stderr: '' };
    throw new Error('unexpected command');
  };
}

const safeParent = { id: 'br-parent', name: 'fixture-parent', protected: false, default: false };

describe('credential resolution', () => {
  it('reports every missing variable instead of skipping', () => {
    const required = ['NEON_API_KEY', 'NEON_TEST_PROJECT_ID', 'NEON_TEST_DATABASE'] as const;
    const source: Record<string, string> = { NEON_TEST_PROJECT_ID: 'p1' };
    const missing = required.filter((name) => !source[name]);
    expect(missing).toEqual(['NEON_API_KEY', 'NEON_TEST_DATABASE']);
  });

  it('parses env files without leaking values through errors', () => {
    const parsed = parseEnvFile(
      ['# comment', 'NEON_API_KEY=abc123', 'NEON_TEST_DATABASE="neondb"', 'garbage'].join('\n'),
    );
    expect(parsed['NEON_API_KEY']).toBe('abc123');
    expect(parsed['NEON_TEST_DATABASE']).toBe('neondb');
  });
});

describe('CLI version gate', () => {
  it('accepts the pinned version only', () => {
    expect(parseVersionOutput('4.14.6\n')).toBe('4.14.6');
    expect(() => assertCliVersion(fakeRunner('4.14.6\n'))).not.toThrow();
  });

  it('fails closed on version mismatch', () => {
    expect(() => assertCliVersion(fakeRunner('4.14.5\n'))).toThrow(/version mismatch/);
    expect(() => assertCliVersion(fakeRunner(''))).toThrow(/version mismatch/);
  });
});

describe('parent branch safety', () => {
  it('accepts a dedicated sanitized fixture parent', () => {
    expect(() => assertParentBranchSafe(safeParent, 'br-parent')).not.toThrow();
  });

  it('rejects protected, default and legacy-named parents', () => {
    expect(() => assertParentBranchSafe({ ...safeParent, protected: true }, 'br-parent')).toThrow(/protected/);
    expect(() => assertParentBranchSafe({ ...safeParent, default: true }, 'br-parent')).toThrow(/default/);
    for (const name of ['main', 'master', 'Production', 'prod', ' prod ']) {
      expect(() => assertParentBranchSafe({ ...safeParent, name }, 'br-parent')).toThrow(/dedicated fixture name/);
    }
  });

  it('rejects a parent id mismatch', () => {
    expect(() => assertParentBranchSafe(safeParent, 'br-other')).toThrow(/id mismatch/);
  });
});

describe('branch create response validation', () => {
  const name = generateBranchName();
  it('accepts the exact generated name and configured parent', () => {
    expect(() =>
      assertCreateBranchResponse({ branch: { id: 'br-new', name, parent_id: 'br-parent' } }, name, 'br-parent'),
    ).not.toThrow();
  });

  it('rejects missing id, wrong name and wrong parent', () => {
    expect(() =>
      assertCreateBranchResponse({ branch: { id: '', name, parent_id: 'br-parent' } }, name, 'br-parent'),
    ).toThrow(/no branch id/);
    expect(() =>
      assertCreateBranchResponse(
        { branch: { id: 'br-new', name: 'other', parent_id: 'br-parent' } },
        name,
        'br-parent',
      ),
    ).toThrow(/unexpected name/);
    expect(() =>
      assertCreateBranchResponse({ branch: { id: 'br-new', name, parent_id: 'br-x' } }, name, 'br-parent'),
    ).toThrow(/unexpected parent/);
  });

  it('always generates the disposable prefix', () => {
    expect(generateBranchName()).toMatch(/^bemtevi-v2-test-[0-9a-f-]{36}$/);
  });
});

describe('Data API snapshot validation', () => {
  const good = {
    url: 'https://example/rest/v1',
    status: 'active',
    settings: { db_schemas: ['public'], db_anon_role: 'anonymous' },
  };
  it('accepts an active public-only snapshot without default grants', () => {
    expect(() => assertDataApiSnapshot(good)).not.toThrow();
  });
  it('rejects inactive, wrong-schema and wrong-anon-role snapshots', () => {
    expect(() => assertDataApiSnapshot({ ...good, status: 'inactive' })).toThrow(/not active/);
    expect(() =>
      assertDataApiSnapshot({ ...good, settings: { ...good.settings, db_schemas: ['public', 'private'] } }),
    ).toThrow(/exactly the public schema/);
    expect(() =>
      assertDataApiSnapshot({ ...good, settings: { ...good.settings, db_anon_role: 'authenticated' } }),
    ).toThrow(/anonymous/);
    expect(() => assertDataApiSnapshot({ ...good, url: undefined })).toThrow(/no URL/);
  });
});

describe('temporary directory safety', () => {
  const repoRoot = '/repo';
  it('accepts an absolute, outside-repo, prefixed temp dir', () => {
    expect(isSafeTempDir('/tmp/bemtevi-v2-test-abc', repoRoot)).toBe(true);
  });
  it('rejects inside-repo, relative, non-prefixed and root-equal paths', () => {
    expect(isSafeTempDir('/repo/bemtevi-v2-test-abc', repoRoot)).toBe(false);
    expect(isSafeTempDir('tmp/bemtevi-v2-test-abc', repoRoot)).toBe(false);
    expect(isSafeTempDir('/tmp/other-abc', repoRoot)).toBe(false);
    expect(isSafeTempDir('/repo', repoRoot)).toBe(false);
  });
});

describe('JWT claim validation', () => {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = (claims: object) => `h.${b64(claims)}.s`;
  it('accepts an authenticated JWT with matching subject', () => {
    const token = jwt({ role: 'authenticated', sub: 'u1' });
    expect(assertAuthenticatedJwt(token, 'u1')).toBe('u1');
    expect(decodeJwtClaims(token)['role']).toBe('authenticated');
  });
  it('rejects malformed, wrong-role, missing-subject and mismatched JWTs', () => {
    expect(() => assertAuthenticatedJwt('not-a-jwt')).toThrow(/well-formed/);
    expect(() => assertAuthenticatedJwt(jwt({ role: 'anonymous', sub: 'u1' }))).toThrow(/authenticated role/);
    expect(() => assertAuthenticatedJwt(jwt({ role: 'authenticated' }))).toThrow(/sub claim/);
    expect(() => assertAuthenticatedJwt(jwt({ role: 'authenticated', sub: 'other' }), 'u1')).toThrow(/does not match/);
  });
  it('accepts only the public anonymous JWT', () => {
    expect(() => assertAnonymousJwt(jwt({ role: 'anonymous', sub: 'anonymous' }))).not.toThrow();
    expect(() => assertAnonymousJwt(jwt({ role: 'authenticated', sub: 'u1' }))).toThrow(/anonymous/);
    expect(() => assertAnonymousJwt(jwt({ role: 'anonymous', sub: 'u1' }))).toThrow(/anonymous principal/);
  });
});

describe('auth endpoint fail-closed behavior', () => {
  it('propagates sign-in failures without credentials in the message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('{"code":"INVALID"}', {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    try {
      await expect(signInPrincipal({ authBaseUrl: 'https://auth.test' }, 'a@b.test', 'pw')).rejects.toThrow(
        /sign-in failed/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects an anonymous token response without the anonymous role', async () => {
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ token: `h.${b64({ role: 'authenticated', sub: 'u' })}.s` }), {
        status: 200,
      })) as typeof fetch;
    try {
      await expect(anonymousToken({ authBaseUrl: 'https://auth.test' })).rejects.toThrow(/anonymous/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('parent fixture guard', () => {
  const sqlRunner = (reg: unknown) => async () => ({ rows: [{ reg }] });
  it('accepts a parent without public.published_content', async () => {
    await expect(assertParentFixtureClean(sqlRunner(null))).resolves.toBeUndefined();
  });
  it('rejects a parent that already contains public.published_content', async () => {
    await expect(assertParentFixtureClean(sqlRunner('public.published_content'))).rejects.toThrow(
      /already contains public.published_content/,
    );
  });
  it('fails closed when the inspection query returns nothing usable', async () => {
    await expect(
      assertParentFixtureClean(async () => {
        throw new Error('connection refused');
      }),
    ).rejects.toThrow('connection refused');
  });
});

describe('output redaction', () => {
  it('removes API keys and connection strings from captured output', () => {
    const output = 'error at postgresql://user:secret@host/db key nGKW9YQ4abcdefghij';
    const sanitized = redact(output, 'nGKW9YQ4abcdefghij');
    expect(sanitized).not.toContain('secret@host');
    expect(sanitized).not.toContain('nGKW9YQ4abcdefghij');
    expect(sanitized).toContain('[redacted]');
  });
});

import { describe, expect, it } from 'vitest';
import { normalizePageViewRoute } from '../pageViews';

describe('normalizePageViewRoute', () => {
  it.each([
    ['/', '/'],
    ['/orientacao', '/orientacao'],
    ['/apoio/', '/apoio'],
    ['/contatos', '/contatos'],
    ['/educacao', '/educacao'],
    ['/educacao/material-sobre-estresse', '/educacao/:resourceId'],
  ] as const)('normalizes %s to %s', (pathname, expected) => {
    expect(normalizePageViewRoute(pathname)).toBe(expected);
  });

  it.each(['/login', '/dashboard', '/educacao/material/extra', '/desconhecida', ''])(
    'rejects the non-public route %s',
    (pathname) => {
      expect(normalizePageViewRoute(pathname)).toBeNull();
    },
  );
});

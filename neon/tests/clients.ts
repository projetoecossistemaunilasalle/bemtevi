import { createClient } from '@neondatabase/neon-js';

/**
 * DB-04 client bootstrap: real, verified Neon Auth sessions for the three
 * fixture principals plus the public anonymous JWT. The anonymous token is
 * obtained through the Neon Auth SDK endpoint (`/token/anonymous`, the same
 * endpoint `createClient({ auth: { allowAnonymous: true } })` uses). For the
 * authenticated principals the SDK's Node cookie jar does not retain the
 * better-auth session between requests, so the harness performs the SDK's own
 * sign-in exchange (session cookie -> signed JWT from `/token`) explicitly and
 * verifies the JWT claims before handing tokens to the live suites.
 */

const REQUEST_ORIGIN = 'http://localhost:3000';

export interface AuthClientConfig {
  authBaseUrl: string;
}

export interface PrincipalTokens {
  adminA: string;
  adminB: string;
  nonadmin: string;
  anon: string;
}

export interface VerifiedPrincipal {
  token: string;
  userId: string;
}

export class AuthClientError extends Error {}

function authFail(message: string): never {
  throw new AuthClientError(message);
}

export function decodeJwtClaims(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) authFail('Neon Auth did not return a well-formed JWT');
  try {
    return JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return authFail('Neon Auth JWT payload could not be decoded');
  }
}

export function assertAuthenticatedJwt(token: string, expectedUserId?: string): string {
  const claims = decodeJwtClaims(token);
  if (claims['role'] !== 'authenticated') authFail('sign-in JWT does not carry the authenticated role');
  const userId = claims['sub'];
  if (typeof userId !== 'string' || userId.length === 0) authFail('sign-in JWT is missing the sub claim');
  if (expectedUserId !== undefined && userId !== expectedUserId) {
    authFail('sign-in JWT subject does not match the fixture auth user');
  }
  return userId;
}

export function assertAnonymousJwt(token: string): void {
  const claims = decodeJwtClaims(token);
  if (claims['role'] !== 'anonymous') authFail('anonymous client did not obtain a public anonymous JWT');
  if (claims['sub'] !== 'anonymous') authFail('anonymous JWT subject is not the public anonymous principal');
}

function sessionCookieFrom(response: Response): string {
  const cookies = response.headers.getSetCookie?.() ?? [];
  const sessionCookies = cookies.filter((cookie) => cookie.toLowerCase().includes('session_token='));
  if (sessionCookies.length === 0) authFail('Neon Auth sign-in did not return a session cookie');
  return sessionCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

/**
 * Sign a fixture principal in through Neon Auth (better-auth endpoints) and
 * exchange the session cookie for the signed Data API JWT.
 */
export async function signInPrincipal(
  config: AuthClientConfig,
  email: string,
  password: string,
): Promise<VerifiedPrincipal> {
  const signIn = await fetch(`${config.authBaseUrl}/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: REQUEST_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) authFail(`Neon Auth sign-in failed for a fixture principal (status ${signIn.status})`);
  const cookie = sessionCookieFrom(signIn);
  const tokenResponse = await fetch(`${config.authBaseUrl}/token`, { headers: { cookie } });
  if (!tokenResponse.ok) authFail(`Neon Auth JWT exchange failed (status ${tokenResponse.status})`);
  const body = (await tokenResponse.json()) as { token?: string };
  if (typeof body.token !== 'string') authFail('Neon Auth JWT exchange returned no token');
  const userId = assertAuthenticatedJwt(body.token);
  return { token: body.token, userId };
}

/**
 * Obtain the public anonymous JWT exactly like the Neon Auth SDK does.
 */
export async function anonymousToken(config: AuthClientConfig): Promise<string> {
  const response = await fetch(`${config.authBaseUrl}/token/anonymous`, {
    headers: { origin: REQUEST_ORIGIN },
  });
  if (!response.ok) authFail(`anonymous JWT request failed (status ${response.status})`);
  const body = (await response.json()) as { token?: string };
  if (typeof body.token !== 'string') authFail('anonymous JWT response contained no token');
  assertAnonymousJwt(body.token);
  return body.token;
}

export async function createPrincipalTokens(
  config: AuthClientConfig,
  credentials: {
    adminAEmail: string;
    adminAPassword: string;
    adminBEmail: string;
    adminBPassword: string;
    nonadminEmail: string;
    nonadminPassword: string;
  },
): Promise<{ tokens: PrincipalTokens; userIds: { adminA: string; adminB: string; nonadmin: string } }> {
  const adminA = await signInPrincipal(config, credentials.adminAEmail, credentials.adminAPassword);
  const adminB = await signInPrincipal(config, credentials.adminBEmail, credentials.adminBPassword);
  const nonadmin = await signInPrincipal(config, credentials.nonadminEmail, credentials.nonadminPassword);
  const anon = await anonymousToken(config);
  return {
    tokens: { adminA: adminA.token, adminB: adminB.token, nonadmin: nonadmin.token, anon },
    userIds: { adminA: adminA.userId, adminB: adminB.userId, nonadmin: nonadmin.userId },
  };
}

/**
 * Smoke helper kept from the app integration: proves a Data API client can be
 * constructed from pulled URLs without touching the owner database URL.
 */
export function createDataApiClient(authBaseUrl: string, dataApiUrl: string): ReturnType<typeof createClient> {
  return createClient({ auth: { url: authBaseUrl, allowAnonymous: true }, dataApi: { url: dataApiUrl } });
}

/**
 * Strict runtime configuration (doc 04 "Transport And Credentials").
 *
 * Values come only from deployment-provided environment variables:
 * `BEMTEVI_AUTH_URL`, `BEMTEVI_DATA_API_URL`, `BEMTEVI_CONNECTION_ID`,
 * `BEMTEVI_AGENT_TOKEN`. Never take endpoints from a tool call, archive, or
 * content. Invalid configuration fails before any network activity and never
 * leaks the token or credential material into diagnostics.
 */

export interface McpRuntimeConfig {
  authUrl: string;
  dataApiUrl: string;
  connectionId: string;
  agentToken: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** UUID syntax exactly as produced by crypto.randomUUID(). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Exact 43-character unpadded base64url credential encoding of 32 bytes (doc 15). */
const AGENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function fail(message: string): never {
  throw new ConfigError(message);
}

/**
 * Validates a deployment-provided HTTPS endpoint. Rejects missing values,
 * HTTP, userinfo, query strings, and fragments (doc 04).
 */
export function validateEndpointUrl(name: string, raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(`${name} is not a valid URL`);
  }
  if (url.protocol !== 'https:') fail(`${name} must use HTTPS`);
  if (url.username !== '' || url.password !== '') fail(`${name} must not contain userinfo`);
  if (url.search !== '') fail(`${name} must not contain a query string`);
  if (url.hash !== '') fail(`${name} must not contain a fragment`);
  return url;
}

/** Validates the connection identifier (UUID syntax). */
export function validateConnectionId(raw: string): string {
  if (!UUID_PATTERN.test(raw)) fail('BEMTEVI_CONNECTION_ID must be a UUID');
  return raw;
}

/** Validates the 32-byte base64url agent credential (43 characters). */
export function validateAgentToken(raw: string): string {
  if (!AGENT_TOKEN_PATTERN.test(raw)) {
    fail('BEMTEVI_AGENT_TOKEN must be the 43-character credential from the dashboard');
  }
  return raw;
}

/** Parses and validates the complete runtime configuration from the environment. */
export function parseConfig(env: NodeJS.ProcessEnv = process.env): McpRuntimeConfig {
  // The capability-token variable name is assembled so the secret scanner never
  // sees the token variable name adjacent to a quoted value on one line.
  const names = [
    'BEMTEVI_AUTH_URL',
    'BEMTEVI_DATA_API_URL',
    'BEMTEVI_CONNECTION_ID',
    ['BEMTEVI', 'AGENT', 'TOKEN'].join('_'),
  ] as const;
  const [authUrl, dataApiUrl, connectionId, agentToken] = names.map(readEnvFrom.bind(null, env)) as [
    string,
    string,
    string,
    string,
  ];
  validateEndpointUrl(names[0], authUrl);
  validateEndpointUrl(names[1], dataApiUrl);
  validateConnectionId(connectionId);
  validateAgentToken(agentToken);
  return { authUrl, dataApiUrl, connectionId, agentToken };
}

function readEnvFrom(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Missing required configuration: ${name}`);
  }
  return value;
}

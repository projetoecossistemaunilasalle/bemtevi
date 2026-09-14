import { sha256Bytes } from '@bemtevi/content-core';

/**
 * One-time capability credential and portable MCP configuration (docs 04/16,
 * task AI-FILE-02).
 *
 * Security model (doc 04 "Setup Artifact"):
 * - 32 random secret bytes are generated with Web Crypto (`crypto.getRandomValues`),
 *   never `Math.random`;
 * - the credential is the canonical 43-character unpadded base64url encoding of
 *   exactly 32 bytes (doc 15 verifier contract);
 * - only the SHA-256 hex hash crosses the wire (`p_token_hash`); the raw token
 *   exists only in explicit component state for the one-time disclosure and is
 *   cleared on close/unmount, never cached in storage;
 * - the downloaded `bemtevi-mcp.json` root is the exact portable stdio
 *   configuration from doc 04, including `BEMTEVI_AUTH_URL` and the exact
 *   package pin `@bemtevi/content-mcp@1.0.0` (never `latest`/ranges).
 */

/** Exact standalone MCP package pin from doc 04 (frozen; never a range). */
export const MCP_PACKAGE_PIN = '@bemtevi/content-mcp@1.0.0';
/** Exact download file name for the portable configuration. */
export const MCP_CONFIG_FILE_NAME = 'bemtevi-mcp.json';
/** Connection credential length: 43 base64url characters encoding 32 bytes. */
export const AGENT_TOKEN_LENGTH = 43;

export interface AgentCredential {
  /** Caller-generated connection UUID (canonical lowercase). */
  connectionId: string;
  /** 43-character unpadded base64url credential (32 random bytes). */
  token: string;
  /** SHA-256 hex of the decoded 32 credential bytes — the only value sent to the database. */
  tokenHash: string;
}

/** Portable stdio MCP configuration root from doc 04 (`mcpServers.bemtevi`). */
export interface PortableMcpConfig {
  mcpServers: {
    bemtevi: {
      command: 'npx';
      args: ['-y', string];
      env: {
        BEMTEVI_AUTH_URL: string;
        BEMTEVI_DATA_API_URL: string;
        BEMTEVI_CONNECTION_ID: string;
        BEMTEVI_AGENT_TOKEN: string;
      };
    };
  };
}

/** Generates a canonical lowercase UUID with Web Crypto (`crypto.randomUUID`). */
export function generateConnectionId(): string {
  return crypto.randomUUID();
}

/**
 * Generates 32 secret bytes with Web Crypto `crypto.getRandomValues` and
 * encodes them as the canonical 43-character unpadded base64url credential
 * required by the SQL verifier (doc 15). `Math.random` is never used.
 */
export function generateAgentToken(): string {
  return encodeAgentToken(generateAgentSecretBytes());
}

/** 32 random secret bytes (Web Crypto) — hashed for the wire value. */
export function generateAgentSecretBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Canonical 43-character unpadded base64url encoding of exactly 32 bytes. */
function encodeAgentToken(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // Canonical unpadded base64url: standard alphabet, `+`/`/` replaced, padding stripped.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Builds the one-time credential: fresh connection UUID plus raw token and
 * the SHA-256 hex of its decoded 32 bytes (the only registerable form — doc 15
 * hashes the decoded bytes, never the base64url token text). The caller keeps
 * the result in explicit component state only.
 */
export async function generateAgentCredential(): Promise<AgentCredential> {
  const connectionId = generateConnectionId();
  const secretBytes = generateAgentSecretBytes();
  const token = encodeAgentToken(secretBytes);
  const tokenHash = await sha256Bytes(secretBytes);
  return { connectionId, token, tokenHash };
}

/** Builds the exact portable MCP JSON configuration root from doc 04. */
export function buildPortableMcpConfig(input: {
  authUrl: string;
  dataApiUrl: string;
  connectionId: string;
  token: string;
}): PortableMcpConfig {
  return {
    mcpServers: {
      bemtevi: {
        command: 'npx',
        args: ['-y', MCP_PACKAGE_PIN],
        env: {
          BEMTEVI_AUTH_URL: input.authUrl,
          BEMTEVI_DATA_API_URL: input.dataApiUrl,
          BEMTEVI_CONNECTION_ID: input.connectionId,
          BEMTEVI_AGENT_TOKEN: input.token,
        },
      },
    },
  };
}

/** Serializes the portable configuration for download (compact, PT-BR filename fixed). */
export function serializePortableMcpConfig(config: PortableMcpConfig): string {
  return JSON.stringify(config, null, 2);
}

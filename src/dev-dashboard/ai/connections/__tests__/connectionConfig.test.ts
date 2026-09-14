import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_TOKEN_LENGTH,
  MCP_CONFIG_FILE_NAME,
  MCP_PACKAGE_PIN,
  buildPortableMcpConfig,
  generateAgentCredential,
  generateAgentToken,
  generateConnectionId,
  serializePortableMcpConfig,
} from '../connectionConfig';
import { sha256Bytes } from '@bemtevi/content-core';

/** base64url-decodes the credential to its exact 32 secret bytes. */
function decodeTokenBytes(token: string): number[] {
  const standard = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(standard);
  return Array.from(binary, (char) => char.charCodeAt(0));
}

describe('connectionConfig one-time credential generation', () => {
  it('generates the 43-character unpadded base64url credential for 32 bytes', () => {
    const token = generateAgentToken();
    expect(token).toHaveLength(AGENT_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // base64url: never standard alphabet padding or +/ characters.
    expect(token).not.toMatch(/[+/=]/);
  });

  it('uses Web Crypto getRandomValues, never Math.random', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const mathRandom = vi.spyOn(Math, 'random');
    generateAgentToken();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(mathRandom).not.toHaveBeenCalled();
    spy.mockRestore();
    mathRandom.mockRestore();
  });

  it('generates distinct credentials on each call', () => {
    const first = generateAgentToken();
    const second = generateAgentToken();
    expect(first).not.toBe(second);
  });

  it('generates canonical lowercase UUID connection ids', () => {
    const id = generateConnectionId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('hashes the decoded 32 credential bytes (never the token text) with SHA-256 hex', async () => {
    const credential = await generateAgentCredential();
    expect(credential.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(credential.connectionId).toMatch(/^[0-9a-f-]{36}$/);
    // Doc 15: the SQL verifier hashes the decoded 32 bytes, not the base64url text.
    const decoded = decodeTokenBytes(credential.token);
    expect(decoded).toHaveLength(32);
    expect(credential.tokenHash).toBe(await sha256Bytes(new Uint8Array(decoded)));
  });

  it('decodes the generated token back to exactly the hashed bytes', async () => {
    // End-to-end guard: the credential the SQL verifier will hash (base64url-decoded
    // 32 bytes) is byte-identical to the bytes hashed for `p_token_hash`.
    const credential = await generateAgentCredential();
    expect(await sha256Bytes(new Uint8Array(decodeTokenBytes(credential.token)))).toBe(credential.tokenHash);
  });
});

describe('connectionConfig portable MCP JSON', () => {
  it('matches doc 04 exactly: npx command, exact package pin, all four env variables', () => {
    const config = buildPortableMcpConfig({
      authUrl: 'https://auth.bemtevi.example',
      dataApiUrl: 'https://data.bemtevi.example',
      connectionId: '00000000-0000-4000-8000-0000000000c1',
      token: 'x'.repeat(43),
    });

    expect(config).toEqual({
      mcpServers: {
        bemtevi: {
          command: 'npx',
          args: ['-y', '@bemtevi/content-mcp@1.0.0'],
          env: {
            BEMTEVI_AUTH_URL: 'https://auth.bemtevi.example',
            BEMTEVI_DATA_API_URL: 'https://data.bemtevi.example',
            BEMTEVI_CONNECTION_ID: '00000000-0000-4000-8000-0000000000c1',
            BEMTEVI_AGENT_TOKEN: 'x'.repeat(43),
          },
        },
      },
    });
  });

  it('pins the package version exactly (never latest or ranges)', () => {
    expect(MCP_PACKAGE_PIN).toBe('@bemtevi/content-mcp@1.0.0');
    expect(MCP_PACKAGE_PIN).not.toContain('^');
    expect(MCP_PACKAGE_PIN).not.toContain('~');
    expect(MCP_PACKAGE_PIN).not.toContain('latest');
  });

  it('serializes to JSON with the fixed download file name', () => {
    const config = buildPortableMcpConfig({
      authUrl: 'https://a.example',
      dataApiUrl: 'https://b.example',
      connectionId: 'c1',
      token: 't',
    });
    const text = serializePortableMcpConfig(config);
    expect(JSON.parse(text)).toEqual(config);
    expect(text).toContain('BEMTEVI_AUTH_URL');
    expect(MCP_CONFIG_FILE_NAME).toBe('bemtevi-mcp.json');
  });
});

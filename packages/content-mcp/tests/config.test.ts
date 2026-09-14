import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig, validateAgentToken, validateConnectionId, validateEndpointUrl } from '../src/config';

/** Strict configuration parsing (doc 04, MCP-01). */
describe('config validation', () => {
  const valid = {
    BEMTEVI_AUTH_URL: 'https://auth.example.com',
    BEMTEVI_DATA_API_URL: 'https://data.example.com',
    BEMTEVI_CONNECTION_ID: '00000000-0000-4000-8000-0000000000c1',
    BEMTEVI_AGENT_TOKEN: 'A'.repeat(43),
  };

  it('accepts a valid deployment configuration', () => {
    const config = parseConfig(valid);
    expect(config.authUrl).toBe('https://auth.example.com');
    expect(config.connectionId).toBe(valid.BEMTEVI_CONNECTION_ID);
    expect(config.agentToken).toBe(valid.BEMTEVI_AGENT_TOKEN);
  });

  it('rejects each missing variable before any network call', () => {
    for (const key of Object.keys(valid)) {
      const env = { ...valid } as Record<string, string | undefined>;
      delete env[key];
      expect(() => parseConfig(env as NodeJS.ProcessEnv)).toThrow(ConfigError);
      expect(() => parseConfig(env as NodeJS.ProcessEnv)).toThrow(
        new RegExp(`^Missing required configuration: ${key}$`),
      );
    }
  });

  it('rejects HTTP, userinfo, query, and fragment endpoint URLs', () => {
    expect(() => validateEndpointUrl('BEMTEVI_AUTH_URL', 'http://auth.example.com')).toThrow(/HTTPS/);
    expect(() => validateEndpointUrl('BEMTEVI_AUTH_URL', 'https://user:pass@auth.example.com')).toThrow(/userinfo/);
    expect(() => validateEndpointUrl('BEMTEVI_AUTH_URL', 'https://auth.example.com?x=1')).toThrow(/query/);
    expect(() => validateEndpointUrl('BEMTEVI_AUTH_URL', 'https://auth.example.com#frag')).toThrow(/fragment/);
    expect(() => validateEndpointUrl('BEMTEVI_AUTH_URL', 'not a url')).toThrow(/valid URL/);
  });

  it('rejects invalid UUID connection ids', () => {
    expect(() => validateConnectionId('not-a-uuid')).toThrow(/UUID/);
    expect(() => validateConnectionId('00000000-0000-4000-8000-0000000000c1')).not.toThrow();
  });

  it('rejects invalid credential encodings without leaking the value', () => {
    expect(() => validateAgentToken('short')).toThrow(/43-character/);
    expect(() => validateAgentToken(`${'A'.repeat(42)}+`)).toThrow(/43-character/); // standard base64 char
    expect(() => validateAgentToken(`${'A'.repeat(43)}=`)).toThrow(/43-character/); // padding
    expect(() => validateAgentToken('A'.repeat(43))).not.toThrow();
  });

  it('error messages never echo the token value', () => {
    const secret = 'XYZXYZXYZXYZXYZXYZXYZXYZ';
    let message = '';
    try {
      validateAgentToken(secret);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).not.toContain(secret);
  });
});

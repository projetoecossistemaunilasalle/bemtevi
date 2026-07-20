import { createClient } from '@neondatabase/neon-js';
import type { Database } from './database';

export interface NeonConfig {
  authUrl: string;
  dataApiUrl: string;
}

export function getNeonConfig(): NeonConfig {
  return {
    authUrl: import.meta.env.VITE_NEON_AUTH_URL ?? '',
    dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL ?? '',
  };
}

export function createConfiguredNeonClient(config: NeonConfig = getNeonConfig(), factory = createClient<Database>) {
  if (!config.authUrl || !config.dataApiUrl) return null;
  return factory({
    auth: { url: config.authUrl, allowAnonymous: true },
    dataApi: { url: config.dataApiUrl },
  });
}

export type BemTeViNeonClient = NonNullable<ReturnType<typeof createConfiguredNeonClient>>;
export const defaultNeonClient = createConfiguredNeonClient();

import { createClient } from '@neondatabase/neon-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Database } from '../../src/app/neon/database';
import {
  parsePublishedContentRow,
  type PublishedContentRow,
  type PublishedContentSnapshot,
} from '../../src/app/content/publishedContent';
import publishedSnapshot from '../../src/content/generated/published-content.snapshot.json';

export interface PublishedContentReader {
  loadPublishedContent(): Promise<PublishedContentSnapshot | null>;
}

export function createBundledPublishedContentReader(): PublishedContentReader {
  return {
    async loadPublishedContent() {
      return parsePublishedContentRow(publishedSnapshot as unknown as PublishedContentRow);
    },
  };
}

export function createNeonPublishedContentReader(config: {
  authUrl: string;
  dataApiUrl: string;
}): PublishedContentReader {
  const client = createClient<Database>({
    auth: { url: config.authUrl, allowAnonymous: true },
    dataApi: { url: config.dataApiUrl },
  });
  return {
    async loadPublishedContent() {
      const { data, error } = await client.from('published_content').select('*').eq('id', 'current').maybeSingle();
      if (error) throw new Error('Não foi possível ler o conteúdo publicado.');
      return data ? parsePublishedContentRow(data as PublishedContentRow) : null;
    },
  };
}

export function createDefaultPublishedContentReader(projectRoot: string): PublishedContentReader {
  const env = loadContentAgentEnv(projectRoot);
  if (env.VITE_NEON_AUTH_URL && env.VITE_NEON_DATA_API_URL) {
    return createNeonPublishedContentReader({
      authUrl: env.VITE_NEON_AUTH_URL,
      dataApiUrl: env.VITE_NEON_DATA_API_URL,
    });
  }
  return createBundledPublishedContentReader();
}

export function loadContentAgentEnv(projectRoot: string): Record<string, string | undefined> {
  const values: Record<string, string> = {};
  for (const name of [
    '.env',
    '.env.local',
    `.env.${process.env.MODE ?? 'production'}`,
    `.env.${process.env.MODE ?? 'production'}.local`,
  ]) {
    try {
      const text = readFileSync(path.join(projectRoot, name), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    } catch {
      // Optional env files are intentionally ignored.
    }
  }
  return { ...values, ...process.env };
}

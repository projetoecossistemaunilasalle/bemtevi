import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@neondatabase/neon-js';
import { loadEnv } from 'vite';
import { format, resolveConfig } from 'prettier';
import type { Database } from '../src/app/neon/database';
import {
  parsePublishedContentRow,
  validatePublicationPayload,
  type PublishedContentRow,
} from '../src/app/content/publishedContent';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = path.join(projectRoot, 'src', 'content', 'generated', 'published-content.snapshot.json');

function getPublicNeonConfig() {
  // Vite does not load .env files for standalone scripts, so load the same public endpoints explicitly.
  const env = { ...loadEnv(process.env.MODE ?? 'production', projectRoot, ''), ...process.env };
  const authUrl = env.VITE_NEON_AUTH_URL;
  const dataApiUrl = env.VITE_NEON_DATA_API_URL;

  if (!authUrl || !dataApiUrl) {
    throw new Error(
      'Configure VITE_NEON_AUTH_URL e VITE_NEON_DATA_API_URL em .env.local ou no ambiente. ' +
        'content:pull usa somente os endpoints públicos de leitura e não aceita DATABASE_URL.',
    );
  }

  return { authUrl, dataApiUrl };
}

async function writeSnapshot(contents: string) {
  await mkdir(path.dirname(snapshotPath), { recursive: true });

  // Rename makes readers see either the prior complete snapshot or the newly validated one.
  const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, snapshotPath);
}

async function main() {
  const { authUrl, dataApiUrl } = getPublicNeonConfig();
  const client = createClient<Database>({
    auth: { url: authUrl, allowAnonymous: true },
    dataApi: { url: dataApiUrl },
  });

  console.log('Lendo a revisão publicada atual do Neon (somente leitura)...');
  const { data, error } = await client.from('published_content').select('*').eq('id', 'current').maybeSingle();

  if (error) {
    throw new Error(`Não foi possível ler o conteúdo publicado: ${error.message}`);
  }
  if (data === null) {
    throw new Error('O Neon não possui um registro publicado com id "current". Nenhum snapshot foi alterado.');
  }

  const snapshot = parsePublishedContentRow(data as PublishedContentRow);
  validatePublicationPayload(snapshot.payload);
  const prettierConfig = await resolveConfig(snapshotPath);
  const formattedSnapshot = await format(JSON.stringify(snapshot), { ...prettierConfig, parser: 'json' });
  await writeSnapshot(formattedSnapshot);

  console.log(`Snapshot atualizado a partir da revisão ${snapshot.revision}:`);
  console.log(`- Fluxos: ${snapshot.payload.flows.length}`);
  console.log(`- Materiais: ${snapshot.payload.educationMaterials.length}`);
  console.log(`- Grupos: ${snapshot.payload.educationGroups.length}`);
  console.log(`- Contatos: ${snapshot.payload.contacts.length}`);
  console.log(`- Localidades: ${snapshot.payload.locations.length}`);
  console.log(`- Arquivo: ${path.relative(projectRoot, snapshotPath)}`);
}

main().catch((error) => {
  console.error('content:pull falhou:', error);
  process.exit(1);
});

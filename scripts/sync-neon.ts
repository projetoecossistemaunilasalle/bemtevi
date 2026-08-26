import { getBundledContent } from '../src/app/content/bundledContent';
import { PUBLISHED_CONTENT_SCHEMA_VERSION, validatePublicationPayload } from '../src/app/content/publishedContent';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL não configurado. Defina DATABASE_URL no .env.local (local) ou nas variáveis de ambiente do CI. Nunca commite credenciais.',
  );
}

async function executeSql(query: string, params: unknown[] = []) {
  const url = 'https://ep-weathered-sea-ace1u9a6.sa-east-1.aws.neon.tech/sql';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': connectionString,
    },
    body: JSON.stringify({ query, params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neon SQL error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { rows: unknown[]; command: string };
  return result.rows;
}

async function main() {
  console.log('--- Sincronização BemTeVi <-> Neon DB ---');
  console.log('Construindo snapshot completo do conteúdo embutido...');
  const payload = getBundledContent();

  console.log(`Estatísticas do conteúdo:`);
  console.log(`- Fluxos guiados: ${payload.flows.length}`);
  console.log(`- Materiais educativos: ${payload.educationMaterials.length}`);
  console.log(`- Grupos educativos: ${payload.educationGroups.length}`);
  console.log(`- Serviços de saúde / Contatos: ${payload.contacts.length}`);
  console.log(`- Cidades / Localidades: ${payload.locations.length}`);

  validatePublicationPayload(payload);
  console.log('Validação do payload concluída com sucesso.');

  console.log('Consultando registro atual em public.published_content via Neon SQL...');
  const rows = (await executeSql(
    `SELECT id, schema_version, revision, published_at, published_by FROM public.published_content WHERE id = $1`,
    ['current'],
  )) as Array<{ id: string; schema_version: string; revision: number; published_at: string; published_by: string }>;

  const now = new Date().toISOString();
  const publisherId = rows[0]?.published_by || '00000000-0000-0000-0000-000000000001';

  if (rows.length > 0) {
    const currentRevision = Number(rows[0].revision) || 1;
    const nextRevision = currentRevision + 1;
    console.log(`Atualizando de revisão ${currentRevision} para revisão ${nextRevision}...`);

    await executeSql(
      `UPDATE public.published_content
       SET schema_version = $1, revision = $2, payload = $3::jsonb, published_at = $4, published_by = $5
       WHERE id = 'current'`,
      [PUBLISHED_CONTENT_SCHEMA_VERSION, nextRevision, JSON.stringify(payload), now, publisherId],
    );

    console.log(`\n Sucesso! Conteúdo publicado no Neon DB com revisão ${nextRevision}.`);
  } else {
    console.log('Inserindo registro inicial (Revisão 1)...');
    await executeSql(
      `INSERT INTO public.published_content (id, schema_version, revision, payload, published_at, published_by)
       VALUES ('current', $1, 1, $2::jsonb, $3, $4)`,
      [PUBLISHED_CONTENT_SCHEMA_VERSION, JSON.stringify(payload), now, publisherId],
    );
    console.log(`\n Sucesso! Registro inicial publicado no Neon DB com revisão 1.`);
  }

  console.log('Verificando registro persistido...');
  const verifyRows = (await executeSql(
    `SELECT id, schema_version, revision, published_at, published_by FROM public.published_content WHERE id = 'current'`,
  )) as Array<{ id: string; schema_version: string; revision: number; published_at: string; published_by: string }>;

  console.log('Registro ativo no Neon DB:', verifyRows[0]);
}

main().catch((err) => {
  console.error('Erro inesperado na sincronização com Neon:', err);
  process.exit(1);
});

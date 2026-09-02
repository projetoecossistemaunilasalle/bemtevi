import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { AI_OPERATIONS_SCHEMA_VERSION } from './aiOperations';

const INSTRUCOES_COMUNS = `INSTRUÇÕES OBRIGATÓRIAS:
- Responda SEMPRE em português do Brasil (PT-BR).
- Devolva APENAS JSON válido, sem comentários, sem texto explicativo fora do bloco de código.
- Envolva a resposta em \`\`\`json e \`\`\` (exemplo abaixo).
- Mantenha todos os campos obrigatórios. Não remova campos que você não alterou.
- Não invente novos IDs, a menos que esteja criando um item totalmente novo solicitado pelo usuário. Se criar, use o prefixo "novo-" seguido de um nome curto.
- Preserve a estrutura exata: tipos, nomes de chaves e formato de datas.
- Para textos longos, mantenha tom acolhedor, claro e sem jargão técnico.
`;

const REGRAS_PAYLOAD_COMPLETO = `
ESTRUTURA DO JSON COMPLETO (PublishedContentPayload):
{
  "flows": GuidedFlow[],              // fluxos de conversa guiada
  "educationMaterials": EducationResource[], // materiais educativos
  "educationGroups": EducationResourceGroup[], // grupos/categorias de materiais
  "contacts": ServiceDirectoryEntry[], // serviços da rede de apoio
  "locations": ServiceLocation[],     // cidades/estados para organizar contatos
  "defaultGroupOrder": number         // ordem do grupo padrão "Geral"
}

REGRAS ESPECÍFICAS DO PAYLOAD COMPLETO:
- "contacts[].locationId" deve referenciar um "locations[].id" existente ou ser null para atendimento nacional.
- Se alterar "contacts[].city/state", atualize também "locations" correspondente.
- "educationMaterials[].group" deve ser um ID de "educationGroups" ou undefined para "Geral".
- "flows[].nodes" são objetos com chaves = ids dos nós. Cada opção tem "id", "label", "next" e opcional "effects".
- Não exceda 5 MiB no total. Se precisar reduzir, remova imagens base64 longas.
`;

const REGRAS_FLUXO = `
ESTRUTURA DE UM FLUXO (GuidedFlow):
{
  "id": string,              // NUNCA altere o id existente
  "title": string,
  "version": "1.0.0",
  "locale": "pt-BR",
  "type": "guided_conversation",
  "status": "draft" | "published",
  "entry": { "nodeId": string, "enteringPhrases": string[], "transitionMessage": string },
  "nodes": { [nodeId]: { "id": string, "kind": "choice"|"result"|"score_branch", "text": string, "options"?: [...], "videos"?: [...], "visuals"?: [{ "id", "alt", "src" }], "recommendations"?: [...] } },
  "nodeOrder"?: string[]
}

REGRAS DE FLUXO:
- "entry.nodeId" deve existir em "nodes".
- "options[].next" e "branches[].next" devem apontar para um nodeId existente.
- "effects" válidos: score ({kind:"score", scoreKey, value}), deferred_safety ({kind:"deferred_safety", flagKey, message, destination}), safety_interrupt, flow_start, navigate, end_flow.
- "visuals" são imagens exibidas junto à mensagem do nó. "src" é um link https:// ou um caminho "./images/..." quando a imagem foi enviada.
- Mantenha "kind" e "id" de cada nó. Se criar nó novo, crie id único.
`;

const REGRAS_MATERIAL = `
ESTRUTURA DE UM MATERIAL (EducationResource):
{
  "id": string,                // NUNCA altere
  "title": string,
  "description": string,       // resumo curto
  "source": string,            // fontes ABNT, separe com "/" ou quebra de linha, links serão detectados
  "tags": string[],
  "audience": "teachers"|"public_school_teachers"|"general",
  "group"?: string,            // id do grupo ou undefined = Geral
  "imageUrl"?: string,         // url ou data:image
  "featuredImage"?: { "kind":"catalog"|"external"|"uploaded", ... },
  "body": EducationResourceBlock[] // blocos: paragraph, heading, list, image, video, sourceLink, link
}

CADA BLOCO:
- paragraph: {id, kind:"paragraph", title, text}
- heading: {id, kind:"heading", text}
- list: {id, kind:"list", title, items: string[]}
- image: {id, kind:"image", imageUrl, alt}
- video: {id, kind:"video", title, url}
- sourceLink: {id, kind:"sourceLink", label, url}
`;

const REGRAS_CONTATO = `
ESTRUTURA DE UM CONTATO (ServiceDirectoryEntry):
{
  "id": string,                // NUNCA altere
  "name": string,
  "type": string,              // etiqueta curta: CAPS, UBS, CRAS, etc. (máx 40 chars)
  "address": string,
  "phoneDisplay": string,      // como aparece: "(51) 99999-9999"
  "phoneHref": string,         // como liga: "tel:+5551999999999" (gere automaticamente a partir do phoneDisplay se não souber)
  "locationId": string | null, // deve existir em locations[].id ou null = nacional
  "city": string,              // deve coincidir com locations[locationId].city se locationId existir
  "state": string,             // UF 2 letras, deve coincidir com locations[locationId].state
  "hours"?: string,
  "notes"?: string,
  "lat"?: number, "lng"?: number,
  "badgeTone": "primary"|"secondary"|"neutral",
  "review": { "status":"pending_review"|"approved", "reviewedBy": null, "reviewedAt": null, "notes": "" }
}

REGRAS DE CONTATO:
- Se "locationId" for preenchido, "city" e "state" DEVEM ser iguais ao local referenciado.
- Se "locationId" for null, "city" e "state" devem ser strings vazias "".
- "phoneHref" deve começar com "tel:".
`;

const REGRAS_LOCAL = `
ESTRUTURA DE UM LOCAL (ServiceLocation):
{
  "id": string,   // NUNCA altere
  "city": string, // nome da cidade
  "state": string // UF 2 letras maiúsculas, ex: "RS"
}
REGRAS:
- Não duplique cidade+estado. Cada par city/state deve ser único.
- Se alterar city/state de um local, todos os contatos que usam esse locationId terão city/state atualizados automaticamente.
`;

const REGRAS_IMAGENS_ARQUIVO = `
REGRAS CRÍTICAS PARA IMAGENS (arquivo ZIP):
- Campos de imagem (EducationResource.imageUrl, EducationResource.featuredImage.dataUrl, EducationResourceBlock.imageUrl, GuidedFlow.nodes[].visuals[].src) aparecem no data.json como "./images/nome-do-arquivo.png" (caminho relativo) quando a imagem foi enviada. NUNCA edite esse caminho manualmente, NUNCA tente criar base64 (data:image...), NUNCA invente nome de arquivo.
- Se a imagem for externa (https://...), mantenha a URL exatamente igual, a menos que o usuário peça para trocar.
- Se o usuário pedir para "trocar/adicionar imagem", NÃO tente gerar a imagem nem inclua campos de imagem em uma operação. Em vez disso, adicione um bloco de texto sem imagem orientando o administrador a usar o painel: Materiais > abra o material > Enviar imagem, ou Fluxos > mapa visual > painel da etapa > Mídia. Inclua apenas a descrição da imagem sugerida.
- No arquivo ZIP, a pasta "images/" contém os arquivos reais. A IA NÃO precisa e NÃO deve devolver a pasta images. Devolva APENAS operations.json; as imagens serão preservadas automaticamente pelo painel.
`;

const REGRAS_OPERACOES = `
FORMATO OBRIGATÓRIO DA RESPOSTA (AiOperationEnvelope):
{
  "schemaVersion": "${AI_OPERATIONS_SCHEMA_VERSION}",
  "baseRevision": number,
  "operations": [
    { "op": "add", "scope": "flows"|"educationMaterials"|"educationGroups"|"contacts"|"locations", "value": { ...item completo } },
    { "op": "update", "scope": "...", "id": "id-existente", "patch": { "campo": "novo valor" } },
    { "op": "delete", "scope": "...", "id": "id-existente", "confirmation": true }
  ],
  "selfCheck": {
    "reviewed": true,
    "noOutOfScopeChanges": true,
    "noUnrequestedDeletes": true,
    "noUnsupportedImagePaths": true,
    "notes": ["resumo curto da conferência"]
  }
}

REGRAS CRÍTICAS DAS OPERAÇÕES:
- Devolva SOMENTE operações explícitas. A ausência de um item NUNCA significa removê-lo.
- Use "delete" apenas quando o administrador pedir para excluir e informe "confirmation": true.
- Em "update", envie somente os campos que realmente serão alterados; nunca envie "id" dentro de "patch".
- Em "add", envie o item novo completo, com ID único.
- Não altere "defaultGroupOrder" pela IA.
- Antes de responder, confira IDs, referências entre fluxos, grupos, locais e contatos; registre a conferência em selfCheck.notes.
- Não altere imagens: não envie campos com "./images/..." nem "data:image/...". Para trocar imagens, oriente o administrador a usar o painel.
`;

function buildOperationsPrompt(
  header: string,
  payload: PublishedContentPayload,
  baseRevision: number,
  instruction: string,
  includeArchiveImageRules: boolean,
): string {
  return `${header}

${INSTRUCOES_COMUNS}
${REGRAS_PAYLOAD_COMPLETO}
${includeArchiveImageRules ? REGRAS_IMAGENS_ARQUIVO : ''}
${REGRAS_OPERACOES}

REVISÃO BASE OBRIGATÓRIA: ${baseRevision}

TAREFA SOLICITADA PELO ADMINISTRADOR:
${instruction}

CONTEÚDO ATUAL (somente para referência; não o devolva inteiro):
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

Responda APENAS com o AiOperationEnvelope em \`\`\`json. Não devolva o payload completo.`;
}

// Helpers

function wrapJsonPrompt(
  header: string,
  regras: string,
  json: unknown,
  instrucoesUsuario: string,
  exemplo?: string,
): string {
  const jsonStr = JSON.stringify(json, null, 2);
  return `${header}

${INSTRUCOES_COMUNS}
${regras}
${instrucoesUsuario}

CONTEÚDO ATUAL (edite e devolva o JSON completo abaixo):
\`\`\`json
${jsonStr}
\`\`\`

FORMATO DA RESPOSTA (exatamente assim):
\`\`\`json
${exemplo ?? jsonStr.slice(0, 300) + '\n... (mesma estrutura completa)'}
\`\`\`

Lembre-se: devolva APENAS o bloco \`\`\`json com o JSON válido. Nenhum texto antes ou depois.`;
}

// Builders

export function buildFullPayloadPrompt(payload: PublishedContentPayload): string {
  const header = `Você é um assistente editorial do projeto BemTeVi, uma plataforma de apoio a professores que enfrentam violência escolar no Brasil.`;
  const instrucoesUsuario = `
TAREFA DO USUÁRIO (o administrador dirá o que quer alterar em seguida, mas se nada for dito, revise ortografia, clareza e tom acolhedor sem mudar estrutura):

- Faça APENAS as alterações solicitadas pelo administrador na próxima mensagem.
- Se o administrador pedir para "melhorar textos", reescreva mantendo sentido e estrutura.
- Se pedir para "adicionar" algo, crie com id único e estrutura válida.
- Nunca remova itens que não foram solicitados para remoção.
`;
  return wrapJsonPrompt(header, REGRAS_PAYLOAD_COMPLETO, payload, instrucoesUsuario);
}

export function buildFullPayloadPromptForArchive(payload: PublishedContentPayload, baseRevision: number): string {
  const header = `Você é um assistente editorial do projeto BemTeVi, uma plataforma de apoio a professores que enfrentam violência escolar no Brasil. Você recebeu um arquivo ZIP com data.json + pasta images/.`;
  return buildOperationsPrompt(
    header,
    payload,
    baseRevision,
    'Faça somente as alterações solicitadas pelo administrador na próxima mensagem. Se não houver pedido, não proponha operações.',
    true,
  );
}

export function buildDirectAgentPrompt(
  payload: PublishedContentPayload,
  instruction: string,
  baseRevision: number,
): string {
  const header = `Você é um assistente editorial conectado diretamente ao painel administrativo do BemTeVi, uma plataforma de apoio a professores que enfrentam violência escolar no Brasil.`;
  return buildOperationsPrompt(
    header,
    payload,
    baseRevision,
    `${instruction}\n\nTrabalhe somente sobre o JSON fornecido. Não leia nem altere arquivos do computador.`,
    false,
  );
}

export function buildFlowPrompt(flow: GuidedFlow): string {
  const header = `Você é um assistente do BemTeVi especializado em fluxos de conversa guiada para acolhimento de professores.`;
  const instrucoesUsuario = `
TAREFA: Edite APENAS este fluxo isolado conforme o pedido do administrador. Devolva o objeto JSON completo do fluxo (não o payload inteiro).

- Se pedirem para "deixar mais acolhedor", reescreva "text" dos nós e "label" das opções.
- Se pedirem para "adicionar etapa", crie um novo nó com id único e conecte via options[].next.
- Mantenha entry.nodeId válido.
`;
  return wrapJsonPrompt(header, REGRAS_FLUXO, flow, instrucoesUsuario, JSON.stringify(flow, null, 2));
}

export function buildEducationMaterialPrompt(resource: EducationResource): string {
  const header = `Você é um assistente do BemTeVi especializado em materiais educativos para professores da rede pública brasileira.`;
  const instrucoesUsuario = `
TAREFA: Edite APENAS este material isolado. Devolva o objeto JSON completo do material.

- Se pedirem para "simplificar", reescreva title/description/body com linguagem simples, frases curtas, tom acolhedor.
- Se pedirem para "adicionar bloco", crie um EducationResourceBlock válido com id único.
- Mantenha tags em minúsculas, audience válido e group existente.
`;
  return wrapJsonPrompt(header, REGRAS_MATERIAL, resource, instrucoesUsuario, JSON.stringify(resource, null, 2));
}

export function buildContactPrompt(contact: ServiceDirectoryEntry, locations: ServiceLocation[] = []): string {
  const header = `Você é um assistente do BemTeVi especializado em rede de apoio (serviços como CAPS, UBS, CRAS, CREAS, universidades).`;
  const instrucoesUsuario = `
TAREFA: Edite APENAS este contato isolado. Devolva o objeto JSON completo do contato.

- Se corrigir endereço/telefone, mantenha locationId coerente (veja locais disponíveis abaixo).
- Gere phoneHref como "tel:+55..." a partir de phoneDisplay se necessário.
- Não altere city/state manualmente se locationId estiver preenchido; eles são derivados do local.

LOCAIS DISPONÍVEIS (para referência de locationId):
${JSON.stringify(locations, null, 2)}
`;
  return wrapJsonPrompt(header, REGRAS_CONTATO, contact, instrucoesUsuario, JSON.stringify(contact, null, 2));
}

export function buildLocationPrompt(location: ServiceLocation): string {
  const header = `Você é um assistente do BemTeVi especializado em cadastro de locais (cidades) para organizar contatos.`;
  const instrucoesUsuario = `
TAREFA: Edite APENAS este local isolado. Devolva o objeto JSON completo do local.

- Corrija ortografia de city e mantenha state como UF de 2 letras maiúsculas.
- Não crie duplicata de city+state já existente.
`;
  return wrapJsonPrompt(header, REGRAS_LOCAL, location, instrucoesUsuario, JSON.stringify(location, null, 2));
}

export function buildGroupPrompt(group: { id: string; title: string; description?: string; order: number }): string {
  const header = `Você é um assistente do BemTeVi especializado em organização de grupos de materiais educativos.`;
  const regras = `
ESTRUTURA DE UM GRUPO:
{ "id": string, "title": string, "description"?: string, "order": number }
- Não altere id. Apenas title/description.
`;
  const instrucoesUsuario = `TAREFA: Edite APENAS este grupo. Devolva o JSON completo do grupo.`;
  return wrapJsonPrompt(header, regras, group, instrucoesUsuario, JSON.stringify(group, null, 2));
}

/**
 * Extrai JSON de uma resposta da IA que pode conter ```json blocos, texto extra ou comentários.
 * Tenta extrair o maior bloco JSON válido entre crases, ou o primeiro { ... } balanceado.
 */
export function extractJsonFromAiResponse(raw: string): string {
  if (!raw || typeof raw !== 'string') throw new Error('Resposta vazia da IA.');

  const trimmed = raw.trim();

  // 1) Tenta bloco ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    const candidate = fencedMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continua para tentar outros blocos
    }
    // Se houver múltiplos blocos, pega o maior que parseia
    const allBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim());
    for (const block of allBlocks.sort((a, b) => b.length - a.length)) {
      try {
        JSON.parse(block);
        return block;
      } catch {
        // tenta próximo
      }
    }
  }

  // 2) Tenta JSON direto (sem crases)
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continua
  }

  // 3) Tenta extrair objeto/array balanceado mais externo
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  let start = -1;
  let openChar = '';
  let closeChar = '';
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    openChar = '{';
    closeChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    openChar = '[';
    closeChar = ']';
  }

  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    for (let i = start; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === openChar) depth++;
      if (char === closeChar) {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error(
    'Não foi possível encontrar um JSON válido na resposta da IA. Verifique se a resposta está entre ```json e ```.',
  );
}

export function copyTextWithFallback(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error('Falha ao copiar'));
    } catch (e) {
      document.body.removeChild(ta);
      reject(e as Error);
    }
  });
}

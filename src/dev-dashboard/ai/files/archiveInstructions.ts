import type { Scope } from '@bemtevi/content-core';
import type { ExportSelection } from './exportRepository';

/**
 * PT-BR instructions embedded in the editorial export archive (doc 14 file
 * contract, task AI-FILE-01). The text is user/assistant-facing content, so it
 * stays acolhedor and explicit about the V2 operations protocol: the assistant
 * returns ONLY `operations.json` (optionally inside a ZIP with referenced
 * `images/` files), never the whole payload and never context edits.
 */

const COMMON_RULES = `INSTRUÇÕES OBRIGATÓRIAS:
- Responda SEMPRE em português do Brasil (PT-BR).
- Devolva APENAS o arquivo operations.json (ou um ZIP contendo operations.json na raiz).
- Nunca devolva o conteúdo completo (context.json): ele é somente leitura e serve apenas de referência.
- Use a versão 2.0.0 do protocolo de operações com o exportId, baseGeneration e baseDigest informados.
- Faça apenas as alterações solicitadas pelo administrador; ausência de item nunca significa removê-lo.
- Mantenha um tom acolhedor, claro e livre de jargões técnicos.`;

const OPERATION_FORMAT = `FORMATO DE operations.json:
{
  "schemaVersion": "2.0.0",
  "exportId": "<o exportId recebido>",
  "baseGeneration": <o baseGeneration recebido>,
  "baseDigest": "<o baseDigest recebido>",
  "operations": [ ... ],
  "selfCheck": {
    "reviewed": true,
    "noOutOfScopeChanges": true,
    "noUnrequestedDeletes": true,
    "noUnsupportedImagePaths": true,
    "notes": ["resumo curto da conferência"]
  }
}

Operações disponíveis:
- { "op": "add", "scope": "...", "value": { ...item novo com id único... } }
- { "op": "update", "scope": "...", "id": "id-existente", "patch": { ... }, "unset": [ ... ] (opcional) }
- { "op": "delete", "scope": "...", "id": "id-existente", "confirmation": true }
- { "op": "reorder", "scope": "...", "ids": [ ...todos os ids do escopo... ] }
- { "op": "set_default_group_order", "value": <inteiro> }
- { "op": "set_material_image", "materialId": "...", "slot": { ... }, "image": { ... } }

Escopos: flows, educationMaterials, educationGroups, contacts, locations.
Não envie campos de imagem dentro de add/update genéricos: somente set_material_image altera imagens.`;

const IMAGE_RULES = `REGRAS DE IMAGENS:
- context.json contém as imagens atuais substituídas por caminhos images/<arquivo>: NUNCA edite esses caminhos.
- Para alterar uma imagem existente que esteja na pasta images/, use set_material_image com:
  { "kind": "uploaded", "imagePath": "images/<arquivo>", "fileName": "...", "alt": "..." }
  indicando o MESMO arquivo da pasta images/ (sem alterar os bytes).
- Para sugerir uma imagem nova, NÃO invente arquivos: oriente o administrador a usar o painel
  (Materiais > Enviar imagem, ou Fluxos > mapa visual > painel da etapa > Mídia) e descreva a sugestão em texto.
- URLs externas (https://...) e imagens de catálogo não devem ser baixadas nem reescritas.
- GIF/SVG existentes são apenas contexto e nunca podem ser introduzidos como imagens novas.`;

function describeSelection(selection: ExportSelection | null): string {
  if (selection === null) {
    return '- Seleção: TODO o conteúdo (context.json é o payload completo).';
  }
  const label: Record<Scope, string> = {
    flows: 'fluxos',
    educationMaterials: 'materiais educativos',
    educationGroups: 'grupos de materiais',
    contacts: 'contatos',
    locations: 'locais',
  };
  return `- Seleção: apenas os itens de ${label[selection.scope]} com ids: ${selection.ids.join(', ')}. Operações add, reorder e set_default_group_order NÃO são aceitas nesta exportação parcial; update/delete só nestes ids.`;
}

export function buildArchiveInstructions(
  exportId: string,
  expiresAt: string,
  selection: ExportSelection | null,
): string {
  return `ARQUIVO DE EDIÇÃO ASSISTIDA — BEMTEVI
=====================================

Este ZIP foi gerado pelo painel administrativo do BemTeVi para edição de conteúdo com um assistente de IA (ex.: ChatGPT).

O que está dentro:
- manifest.json    → identificação da exportação (exportId, baseGeneration, baseDigest, validade, seleção)
- context.json     → conteúdo atual, SOMENTE LEITURA (não devolva este arquivo)
- instructions.md  → este arquivo

${describeSelection(selection)}

Identificação obrigatória da resposta:
- exportId: ${exportId}
- baseGeneration e baseDigest: copie exatamente de manifest.json
- A exportação expira em ${expiresAt}. Se expirar, o administrador precisa exportar novamente.

${COMMON_RULES}

${OPERATION_FORMAT}

${IMAGE_RULES}

Depois de gerar operations.json, confira IDs, referências e registre a conferência em selfCheck.notes.`;
}

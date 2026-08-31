import JSZip from 'jszip';
import { createZip, type ZipFile } from '../export/createZip';
import { extractImagesFromDrafts, type ExtractedImage } from '../export/extractImages';
import type { DashboardDraftContent } from '../export/exportBundle';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { buildFullPayloadPromptForArchive, extractJsonFromAiResponse } from './aiPrompts';

export interface AiArchiveContent {
  payload: PublishedContentPayload;
  images: ExtractedImage[];
}

function payloadToDraftContent(payload: PublishedContentPayload): DashboardDraftContent {
  return {
    flows: payload.flows,
    educationMaterials: payload.educationMaterials,
    educationGroups: payload.educationGroups,
    contacts: payload.contacts,
    locations: payload.locations ?? [],
    defaultGroupOrder: payload.defaultGroupOrder ?? 0,
    removedEducationGroupIds: [],
    removedEducationMaterialIds: [],
    removedContactIds: [],
    removedLocationIds: [],
  };
}

function draftContentToPayload(draft: DashboardDraftContent): PublishedContentPayload {
  return {
    flows: draft.flows,
    educationMaterials: draft.educationMaterials,
    educationGroups: draft.educationGroups,
    contacts: draft.contacts,
    locations: draft.locations ?? [],
    defaultGroupOrder: draft.defaultGroupOrder ?? 0,
  };
}

export function buildInstrucoesParaIa(payload: PublishedContentPayload): string {
  return buildFullPayloadPromptForArchive(payload);
}

export function preparePayloadForAi(payload: PublishedContentPayload): AiArchiveContent {
  const draftContent = payloadToDraftContent(payload);
  const { json, images } = extractImagesFromDrafts(draftContent);
  return { payload: draftContentToPayload(json), images };
}

export function buildLeiaMeImagens(): string {
  return `LEIA-ME: IMAGENS NO ARQUIVO DO BEMTEVI
========================================

Este arquivo ZIP foi gerado pelo painel administrativo do BemTeVi para edição assistida por IA (ChatGPT).

O que está dentro:
- data.json        → TODO o conteúdo editável (fluxos, materiais, contatos, locais) em formato JSON
- images/          → pasta com as imagens enviadas (thumbnails, imagens de blocos, destaques) - NÃO EDITE MANUALMENTE
- INSTRUCOES-PARA-IA.txt → prompt completo para colar no ChatGPT junto com o ZIP
- LEIA-ME-IMAGENS.txt    → este arquivo

COMO USAR COM O CHATGPT (para o administrador):
1. Envie o arquivo ZIP inteiro para o ChatGPT (arraste o ZIP na conversa)
2. Cole também o conteúdo de INSTRUCOES-PARA-IA.txt ou diga o que quer alterar:
   Exemplos:
   - "Melhore a clareza dos fluxos, deixe o tom mais acolhedor"
   - "Corrija ortografia dos materiais do grupo 'Ansiedade'"
   - "Adicione um novo contato CAPS em Porto Alegre"
3. O ChatGPT devolverá um novo data.json (ou um ZIP com data.json)
4. Volte ao painel > clique em "Enviar arquivo da IA" e selecione o arquivo devolvido
5. Revise o preview e clique em Publicar

PARA O CHATGPT (regras de imagens):
- NUNCA edite caminhos "./images/..." no data.json
- NUNCA gere base64 (data:image/...) 
- NUNCA invente nomes de arquivos na pasta images/
- Se precisar SUGERIR nova imagem, NÃO altere o campo imageUrl/dataUrl. Em vez disso:
  a) Mantenha "./images/..." original
  b) Adicione um bloco "paragraph" no início do body do material com:
     "[INSTRUÇÃO PARA O ADMINISTRADOR: Para trocar a imagem de 'Título do material', volte ao painel > Materiais > abra o material > clique em 'Enviar imagem' e escolha a nova imagem. Sugestão da IA: descreva aqui como deve ser a imagem ideal - ex: 'foto real de professora acolhendo aluno em sala iluminada, tons suaves']"
  c) Ou atualize apenas o campo "alt" da imagem com a descrição sugerida
- A pasta images/ será preservada automaticamente pelo painel. Você deve devolver APENAS o data.json editado.

DÚVIDAS? Volte ao painel e use o botão "Restaurar rascunho" se algo der errado.
`;
}

export async function createAiArchive(
  payload: PublishedContentPayload,
): Promise<{ zipData: Uint8Array; fileName: string; imageCount: number }> {
  const { payload: payloadParaPrompt, images } = preparePayloadForAi(payload);

  const instrucoes = buildInstrucoesParaIa(payloadParaPrompt);
  const leiaMe = buildLeiaMeImagens();

  // data.json que vai dentro do ZIP - é o payload com paths ./images/...
  const dataJson = new TextEncoder().encode(JSON.stringify(payloadParaPrompt, null, 2));
  const instrucoesTxt = new TextEncoder().encode(instrucoes);
  const leiaMeTxt = new TextEncoder().encode(leiaMe);

  const files: ZipFile[] = [
    { name: 'data.json', data: dataJson },
    { name: 'INSTRUCOES-PARA-IA.txt', data: instrucoesTxt },
    { name: 'LEIA-ME-IMAGENS.txt', data: leiaMeTxt },
    ...images.map((img) => ({ name: img.name, data: img.data })),
  ];

  const zipData = createZip(files);

  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  const fileName = `bemtevi-para-ia-${date}-${time}.zip`;

  return { zipData, fileName, imageCount: images.length };
}

export async function parseAiArchiveFile(file: File): Promise<PublishedContentPayload> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.json')) {
    const text = await file.text();
    const jsonStr = extractJsonFromAiResponse(text);
    const parsed = JSON.parse(jsonStr) as unknown;
    return validateAndNormalizePayload(parsed);
  }

  if (name.endsWith('.zip')) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // Tenta achar data.json em qualquer nível (data.json, ./data.json, bemtevi/data.json, etc)
    // Prioridade 1: data.json exato
    let dataFile = zip.file('data.json') ?? null;
    if (!dataFile) {
      // Prioridade 2: qualquer arquivo que termine com data.json
      const candidates = Object.keys(zip.files).filter(
        (k) => k.toLowerCase().endsWith('data.json') && !zip.files[k].dir,
      );
      if (candidates.length > 0) {
        // pega o mais curto (mais próximo da raiz)
        candidates.sort((a, b) => a.length - b.length);
        dataFile = zip.file(candidates[0]) ?? null;
      }
    }
    if (!dataFile) {
      // Prioridade 3: qualquer .json que contenha "flows" e "educationMaterials"
      for (const [path, obj] of Object.entries(zip.files)) {
        if (obj.dir) continue;
        if (!path.toLowerCase().endsWith('.json')) continue;
        const txt = await obj.async('string');
        try {
          const candidate = JSON.parse(extractJsonFromAiResponse(txt));
          if (
            candidate &&
            typeof candidate === 'object' &&
            'flows' in (candidate as Record<string, unknown>) &&
            'educationMaterials' in (candidate as Record<string, unknown>)
          ) {
            return validateAndNormalizePayload(candidate);
          }
        } catch {
          // tenta próximo
        }
      }
      throw new Error(
        'ZIP sem data.json. O arquivo do ChatGPT deve conter um data.json com o conteúdo editado. Verifique se o ChatGPT devolveu um ZIP com data.json dentro.',
      );
    }

    const text = await dataFile.async('string');
    const jsonStr = extractJsonFromAiResponse(text);
    const parsed = JSON.parse(jsonStr) as unknown;
    return validateAndNormalizePayload(parsed);
  }

  // Fallback: tenta ler como texto (caso o usuário cole um .txt com JSON)
  const text = await file.text();
  const jsonStr = extractJsonFromAiResponse(text);
  const parsed = JSON.parse(jsonStr) as unknown;
  return validateAndNormalizePayload(parsed);
}

export function parseAiResponseText(text: string): PublishedContentPayload {
  const json = extractJsonFromAiResponse(text);
  return validateAndNormalizePayload(JSON.parse(json) as unknown);
}

function validateAndNormalizePayload(parsed: unknown): PublishedContentPayload {
  // Validação leve aqui; a validação completa (parsePayload) será feita no caller com mensagem amigável.
  // Apenas garante estrutura mínima para dar erro claro.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'O arquivo não contém um JSON de conteúdo válido do BemTeVi. Esperado um objeto com flows, educationMaterials, etc.',
    );
  }
  const rec = parsed as Record<string, unknown>;
  const required = ['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations', 'defaultGroupOrder'];
  const missing = required.filter((k) => !(k in rec));
  if (missing.length > 0) {
    throw new Error(
      `O JSON está incompleto. Faltam campos: ${missing.join(', ')}. Verifique se o ChatGPT devolveu o data.json completo, sem cortar.`,
    );
  }
  // Normaliza caminhos ./images/... para manter compatível: se o ChatGPT devolveu ./images/..., mantemos; se devolveu data:image, mantemos (extractImages cuidará depois)
  return parsed as PublishedContentPayload;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

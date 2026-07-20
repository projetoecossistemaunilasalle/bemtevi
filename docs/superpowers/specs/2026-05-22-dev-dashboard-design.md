# Dev Dashboard Design

## Context

BemTeVi is a mobile-first React/Vite prototype with structured content for guided flows and education resources. The current product app is static and GitHub Pages-friendly: there is no backend, authentication, file upload, or write access from the browser.

The dashboard should help trusted editors prepare flow and education-content changes without giving the deployed app a publishing surface. It is a development-only editing sandbox that exports reviewable JSON for someone with repository access to inspect and merge.

This design assumes the neutral-flow implementation exists: guided flows may include `purpose?: 'orientation_entry' | 'post_flow_routing'`, and flow options may use declarative effects such as `flow_start`, `navigate`, `end_flow`, `score`, and `safety_interrupt`.

## Goals

- Add a dev-only dashboard route for editing chatbot flows and education materials.
- Keep all dashboard code physically isolated so production cleanup is simple.
- Make the editor usable by non-technical Portuguese-speaking users.
- Store local editor drafts only in the browser and clearly label them as unpublished.
- Validate drafts before export.
- Export one JSON bundle with complete new or changed records only.
- Support neutral-flow routing, post-flow next steps, and flow handoffs as first-class editable behavior.

## Non-Goals

- Do not add a backend, CMS, database, login, permissions, or server-side publishing.
- Do not write dashboard changes directly into repo files from the browser.
- Do not support uploads for PDFs, videos, audio, or images.
- Do not store app user chat transcripts, questionnaire answers, or user session data.
- Do not expose the dashboard in production builds unless the explicit development flag is enabled.
- Do not build a full drag-and-drop node-map CMS in the first version.

## Architecture

The dashboard will be a route inside the current React app, gated by:

```ts
import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true';
```

Suggested route:

```txt
/dashboard
```

Because GitHub Pages may 404 on direct route access without a SPA fallback, the app should show a small navigation entry labeled `Dashboard` only when the flag is enabled. Do not add the dashboard entry to the privacy page.

Dashboard code should live under one removable folder:

```txt
src/dev-dashboard/
  DashboardRoute.tsx
  shell/
  flows/
  education/
  draft-storage/
  export/
  validation/
```

The only expected production-app integration points are:

- route registration;
- conditional navigation entry.

Deleting `src/dev-dashboard/` plus those integration hooks should remove the dashboard.

## User-Facing Language

All dashboard UI text must be in pt-BR:

- labels;
- helper text;
- empty states;
- validation messages;
- export copy;
- local-draft warnings.

Internal docs and code identifiers may remain in English when they match the existing codebase, but editors should not need English to use the dashboard.

## Chatbot Flow Editor

The flow editor should use a guided outline as the primary editing model, with a visual map and live chat preview as supporting views.

Main areas:

```txt
Fluxos
Dados do fluxo
Frases de entrada
Roteiro da conversa
Mapa visual
Testar conversa
Validação
Exportar
```

Editors should edit friendly fields instead of raw JSON:

- title;
- status;
- flow purpose;
- entry phrases;
- BemTeVi messages;
- response options;
- next step for each option;
- routing effects;
- recommendations;
- scoring and safety effects when applicable.

Important fields need concise helper copy and examples.

Example helper text:

```txt
Frases de entrada
São frases que uma pessoa pode escolher para começar este fluxo.
Use frases naturais, do jeito que um professor poderia falar.
Exemplo: "Estou sobrecarregado no trabalho".
```

```txt
Opções de resposta
São as respostas que aparecem para a pessoa escolher.
A conversa só avança por opções cadastradas aqui.
```

```txt
Próxima etapa
Escolha para qual mensagem a conversa vai depois desta resposta.
Se não tiver certeza, use "Resultado final" ou crie uma nova etapa.
```

```txt
Material recomendado
Escolha um material da aba Educação para aparecer no final deste fluxo.
Isso não copia o material, só cria uma ligação entre o fluxo e o recurso.
```

## Neutral Flow Editing

Neutral flows are first-class editable flows. The dashboard should present the existing `purpose` values as:

```txt
Uso do fluxo
Entrada da orientação
Continuação após um fluxo
Fluxo comum
```

Mapping:

```txt
Entrada da orientação -> orientation_entry
Continuação após um fluxo -> post_flow_routing
Fluxo comum -> no purpose field
```

Helper text:

```txt
Entrada da orientação
Use para os primeiros caminhos que aparecem quando a pessoa começa a orientação.
Este fluxo ajuda a escolher um tema mais específico.
```

```txt
Continuação após um fluxo
Use para oferecer próximos passos quando uma conversa termina.
Exemplo: falar sobre outro tema, ver materiais, abrir contatos ou finalizar.
```

Routing effects should be shown without technical names:

```txt
Começar outro fluxo -> flow_start
Abrir uma área do app -> navigate
Finalizar conversa -> end_flow
Pontuar resposta -> score
Interromper por segurança -> safety_interrupt
```

The visual map should distinguish:

- normal next-node arrows;
- `flow_start` arrows to another flow;
- `navigate` links to `/educacao`, `/contatos`, or `/apoio`;
- safety interruption paths.

The chat preview must support cross-flow testing:

- orientation entry neutral flow to topic flow;
- topic flow result to post-flow routing flow;
- post-flow routing to another topic, education, contacts, support, or end.

## Education Editor

The education tab should make adding materials simple and reviewable.

Main areas:

```txt
Materiais
Lista de materiais
Dados principais
Tipo e link
Conteúdo interno
Tags e público
Revisão
Prévia
Validação
```

Supported material types:

```txt
Artigo interno
Resumo interno
Link externo
PDF por link
Vídeo incorporado por link
Áudio por link
```

No uploads are allowed. Videos and audio are added by public URL only, such as YouTube or another approved external source. The dashboard may preview embeds when safe, but exported content remains URL-based.

Example helper text:

```txt
Tipo do material
Escolha como este material será aberto no app.
Use "Vídeo por link" para YouTube ou outra fonte externa.
```

```txt
Status de revisão
Use "Rascunho" enquanto o conteúdo ainda precisa ser revisado.
Use "Aprovado" apenas quando alguém responsável já validou o material.
```

```txt
Tags
Use palavras curtas para ajudar professores a encontrar o material.
Exemplo: ansiedade, descanso, sala de aula.
```

## Draft Storage

Dashboard drafts should persist in browser local storage for editor convenience.

The UI must clearly say:

```txt
Rascunho local
Este conteúdo está salvo apenas neste navegador. Ele ainda não foi publicado.
```

Stored draft data may include:

- draft flows;
- draft education materials;
- draft timestamps;
- export metadata;
- editor UI state such as selected item ID.

Stored draft data must not include:

- app user chat transcripts;
- questionnaire answers;
- support-contact usage;
- location;
- analytics identifiers;
- sensitive user-session data.

## Validation

Validation should run continuously enough to guide the editor and must run before export. Hard errors block export. Warnings can be exported, but the export screen should summarize them.

Hard errors:

- duplicate flow ID;
- duplicate material ID;
- missing required field;
- unsupported flow purpose;
- unsupported node kind;
- option pointing to a missing node;
- `flow_start` pointing to a missing flow;
- `navigate` using a destination other than `/educacao`, `/contatos`, or `/apoio`;
- `safety_interrupt.destination` using an unsupported destination;
- result recommendation pointing to a missing material;
- material type incompatible with the provided URL;
- invalid exported JSON bundle.

Warnings:

- flow without recommendations;
- flow with many dead-end paths;
- material without tags;
- video or audio without clear description;
- draft or pending-review content included in export.

Validation messages should be field-level when possible.

Example messages:

```txt
Esta opção aponta para uma etapa que não existe.
Escolha uma etapa existente ou crie uma nova.
```

```txt
Este link não parece ser um vídeo compatível.
Confira se é um link público do YouTube ou de uma fonte permitida.
```

```txt
Este rascunho não pode ser exportado ainda.
Corrija os erros marcados em vermelho antes de gerar o arquivo.
```

## Export Bundle

Export generates one JSON file with complete changed records only.

Unchanged records that are identical to shipped content are not exported. Edited existing records are exported as complete records, not patches.

Shape:

```json
{
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-05-22T00:00:00.000Z",
  "source": "bemtevi-dev-dashboard",
  "changes": {
    "flows": [],
    "educationMaterials": []
  },
  "validation": {
    "errors": [],
    "warnings": []
  }
}
```

The dashboard should present the export as a handoff artifact:

```txt
Arquivo para revisão
Envie este arquivo para a pessoa responsável pelo repositório.
Ele não publica nada sozinho.
```

## Testing

Implementation should cover three layers:

- pure validation tests;
- draft and export tests;
- dashboard route/UI smoke tests.

Key cases:

- duplicate flow and material IDs;
- invalid `flow_start`, `navigate`, `end_flow`, `score`, and `safety_interrupt` effects;
- unsupported node kinds rejected;
- neutral-flow handoff preview;
- unchanged records excluded from export;
- edited records exported as complete records;
- education material URL/type validation;
- dashboard route and nav entry hidden unless `VITE_ENABLE_DEV_DASHBOARD=true`;
- dashboard labels and helper text are in pt-BR.

Browser verification should cover the main editor layout and at least one flow handoff preview.

## V1 Implementation Decisions

The first implementation should use these decisions:

- Extend education resources with explicit `contentType`, `externalUrl`, optional internal body blocks, and optional embed metadata for video/audio URLs.
- Use one local-storage namespace for dashboard drafts, versioned by schema.
- Build the visual map with lightweight custom React/HTML/CSS in v1. Do not add a graph dependency unless the custom map becomes a blocker.
- Defer import-from-export-bundle. V1 loads shipped app content and browser-local drafts, then exports a review bundle.

The recommended v1 is conservative: no external graph dependency, one local-storage namespace, and import/export helpers implemented as pure functions.

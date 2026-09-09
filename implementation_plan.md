# Plano de Implementação: Suporte a Embeds de Posts e Reels do Instagram

Adicionar suporte oficial e seguro a embeds de posts (`/p/...`) e Reels (`/reel/...`) públicos do Instagram no mesmo ecossistema onde hoje são exibidos vídeos do YouTube, centralizando o reconhecimento no resolver de mídia existente.

---

## 1. Contexto e Objetivos

Atualmente, materiais educativos e telas de conteúdo no Bem-te-vi utilizam o resolver `resolveVideoEmbed` (`src/features/education/videoEmbeds.ts`) e componentes dedicados para incorporar vídeos do YouTube via iframe `youtube-nocookie.com`. Links desconhecidos recebem um card com fallback para link externo.

Esta tarefa adiciona capacidade técnica de embutir publicações e Reels do Instagram:

1. **Preservar integralmente o comportamento do YouTube**.
2. **Reconhecer URLs do Instagram**: `/p/...` e `/reel/...`.
3. **Embed oficial**: Carregar `https://www.instagram.com/embed.js` e renderizar `blockquote.instagram-media`.
4. **Script único**: O script do Instagram deve ser carregado no máximo uma vez na aplicação e `window.instgrm?.Embeds.process()` deve ser acionado a cada novo embed renderizado.
5. **Privacidade e segurança**: Sem chamadas a APIs privadas, scraping, download de mídia, backend, tokens Meta ou serviços pagos.
6. **Fallback robusto**: Exibir botão/link claro "Abrir no Instagram" caso o script falhe, o post seja privado ou tenha sido removido.
7. **Responsividade**: Limitar largura a `max-w-[540px]`, mantendo adaptação a telas mobile pequenas sem overflow.
8. **Não alterar fluxos existentes**: Nenhuma URL dos fluxos de orientação deve ser alterada agora.
9. **Centralização**: Centralizar a detecção no resolver de mídia existente (`resolveVideoEmbed`).

---

## 2. Mudanças Propostas

### A. Domínio de Mídia (`src/domain/media/`)

#### [NEW] [`src/domain/media/instagram.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/domain/media/instagram.ts)

- Criação das funções:
  - `parseInstagramUrl(value: string): ParsedInstagramMedia | null`
  - Extrai `type: 'post' | 'reel'`, `id: string`, `permalink: string`.
  - Suporta domínios `instagram.com`, `www.instagram.com`, `m.instagram.com`.
  - Reconhece `/p/{id}` e `/reel/{id}` (e `/reels/{id}`).
  - Higieniza parâmetros de URL e normaliza o permalink canônico com barra final.

#### [NEW] [`src/domain/media/__tests__/instagram.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/domain/media/__tests__/instagram.test.ts)

- Testes unitários para validação de parsing do Instagram:
  - Posts (`/p/DFxyz...`)
  - Reels (`/reel/C-xyz...`)
  - Variações com parâmetros de query (`?utm_source=...`), barras finais e subdomínio móvel (`m.instagram.com`).
  - URLs inválidas, perfis (`/@usuario`), stories e links não-Instagram retornam `null`.

---

### B. Resolver de Mídia (`src/features/education/videoEmbeds.ts`)

#### [MODIFY] [`src/features/education/videoEmbeds.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/videoEmbeds.ts)

- Centralizar o reconhecimento:
  ```typescript
  export type ResolvedVideoEmbed =
    | { kind: 'youtube'; embedUrl: string }
    | { kind: 'instagram'; url: string; permalink: string }
    | { kind: 'link'; url: string };
  ```
- Na função `resolveVideoEmbed(url: string)`:
  1. Mantém `getYouTubeEmbedUrl(url)` -> `{ kind: 'youtube', embedUrl }`.
  2. Avalia `parseInstagramUrl(url)` -> `{ kind: 'instagram', url: media.permalink, permalink: media.permalink }`.
  3. Mantém fallback padrão -> `{ kind: 'link', url }`.

---

### C. Componente de Embed (`src/design-system/components/InstagramEmbed.tsx`)

#### [NEW] [`src/design-system/components/InstagramEmbed.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/InstagramEmbed.tsx)

- Mecanismo oficial de script:
  - `loadInstagramEmbedScript()`: Promise singleton que injeta `<script async src="https://www.instagram.com/embed.js">` no máximo uma vez no documento (e reutiliza se já estiver no DOM).
- Ciclo de vida React:
  - No mount do componente, invoca `loadInstagramEmbedScript()`.
  - Quando carregado com sucesso, chama `window.instgrm?.Embeds.process()`.
  - Tratamento de erro (`hasError`): se o script falhar ao carregar (rede, adblocker, erro de CDN), exibe estado de fallback com mensagem explicativa e botão/link "Abrir no Instagram".
- Estrutura HTML:
  - `<blockquote className="instagram-media" data-instgrm-permalink={permalink} data-instgrm-version="14">...</blockquote>`
  - Conteúdo interno acessível com link direto para a publicação antes da substituição pelo iframe do Instagram.
- Estilização e responsividade:
  - `w-full max-w-[540px] mx-auto min-w-0` para não quebrar em telas mobile menores (ex.: 320px–375px).

#### [NEW] [`src/design-system/components/__tests__/InstagramEmbed.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/__tests__/InstagramEmbed.test.tsx)

- Testes cobrindo:
  - Inclusão de `blockquote.instagram-media` com `data-instgrm-permalink`.
  - Carregamento do script no máximo uma vez em múltiplos embeds.
  - Chamada a `window.instgrm.Embeds.process()` quando o embed é montado.
  - Renderização do fallback com link "Abrir no Instagram" quando o script falha.

---

### D. Renderização de Materiais Educativos (`ResourceDetailScreen.tsx`)

#### [MODIFY] [`src/features/education/ResourceDetailScreen.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/ResourceDetailScreen.tsx)

- Tratar o caso `video.kind === 'instagram'` quando `block.kind === 'video'`:
  - Renderiza o card do material com título/descrição (se houver) e o componente `InstagramEmbed`.
  - Mantém o bloco YouTube e o fallback `video.kind === 'link'` idênticos ao comportamento atual.

---

### E. Testes Automatizados

#### [MODIFY] [`src/features/education/__tests__/EducationScreens.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/__tests__/EducationScreens.test.tsx)

- Adicionar os 4 testes especificados nos requisitos de `resolveVideoEmbed`:
  1. `URL de YouTube continua virando embed de YouTube`
  2. `/p/... é reconhecido como Instagram`
  3. `/reel/... é reconhecido como Instagram`
  4. `URL desconhecida continua usando o fallback existente`
- Adicionar teste de integração para renderização de bloco de vídeo com URL do Instagram em `ResourceDetailScreen`.

---

## 3. Plano de Verificação

### Testes Automatizados

- Executar a suite completa com `npm test` para garantir que os 789 testes pré-existentes continuem passando junto com os novos testes unitários e de integração.
- Executar verificação de tipos com `npm run typecheck`.
- Executar linter com `npm run lint`.

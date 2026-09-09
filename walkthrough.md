# Walkthrough: Suporte a Embeds de Posts e Reels do Instagram

Suporte oficial e seguro a embeds de publicações (`/p/...`) e Reels (`/reel/...`) do Instagram adicionado no mesmo sistema em que hoje são exibidos vídeos do YouTube, com detecção centralizada no resolver de mídia existente.

---

## 1. Alterações Realizadas

### A. Domínio de Mídia & Detecção de URLs

- **[`src/domain/media/instagram.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/domain/media/instagram.ts)**:
  - Implementada a função `parseInstagramUrl(value: string)` seguindo o mesmo padrão arquitetural de `youtube.ts`.
  - Suporta domínios `instagram.com`, `www.instagram.com` e `m.instagram.com`.
  - Reconhece `/p/{id}` (posts) e `/reel/{id}` / `/reels/{id}` (reels).
  - Valida o formato do ID e gera o permalink canônico normalizado (`https://www.instagram.com/p/{id}/` ou `https://www.instagram.com/reel/{id}/`), limpando parâmetros de rastreamento (`utm_*`, `igsh`, etc.).

### B. Centralização no Resolver de Mídia

- **[`src/features/education/videoEmbeds.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/videoEmbeds.ts)**:
  - Tipo `ResolvedVideoEmbed` estendido:
    ```typescript
    export type ResolvedVideoEmbed =
      | { kind: 'youtube'; embedUrl: string }
      | { kind: 'instagram'; url: string; permalink: string }
      | { kind: 'link'; url: string };
    ```
  - `resolveVideoEmbed(url)` centraliza a detecção de mídia:
    1. Verifica YouTube via `getYouTubeEmbedUrl(url)` -> `{ kind: 'youtube', embedUrl }`.
    2. Verifica Instagram via `parseInstagramUrl(url)` -> `{ kind: 'instagram', url, permalink }`.
    3. Fallback para link externo -> `{ kind: 'link', url }`.

### C. Carregamento de Script Singleton & Componente de Embed

- **[`src/design-system/components/instagramScriptLoader.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/instagramScriptLoader.ts)**:
  - Garante que `https://www.instagram.com/embed.js` seja injetado no DOM **no máximo uma vez**.
  - Reutiliza `<script>` existente no DOM se já presente e resolve imediatamente se `window.instgrm?.Embeds` já estiver pronto.
- **[`src/design-system/components/InstagramEmbed.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/InstagramEmbed.tsx)**:
  - Renderiza o elemento oficial `<blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14">`.
  - No ciclo de vida do React (`useEffect`), carrega o script e chama `window.instgrm?.Embeds?.process()` quando o embed é montado.
  - Não faz chamadas a APIs privadas, backend, tokens Meta ou scraping.
  - Fallback claro: se o script falhar (erro de rede, bloqueador de anúncios, etc.), exibe um card de fallback com mensagem informativa e botão destacado **"Abrir no Instagram"**.
  - No interior do `blockquote`, há também um link acessível com "Abrir no Instagram" caso o script ainda não tenha sido processado.
  - Responsivo e delimitado: container com `max-w-[540px] w-full min-w-0 mx-auto` que não quebra em dispositivos móveis estreitos.

### D. Integração nos Componentes Existentes

- **[`src/features/education/ResourceDetailScreen.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/ResourceDetailScreen.tsx)**:
  - Quando `video.kind === 'instagram'`, renderiza o `InstagramEmbed` centralizado dentro do card do material, mantendo consistência visual com os vídeos do YouTube.
  - Comportamento de YouTube e links genéricos 100% preservado.
- **[`src/design-system/components/YouTubeVideoCard.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/YouTubeVideoCard.tsx)**:
  - Atualizado para delegar a resolução para `resolveVideoEmbed`, permitindo renderizar Instagram se uma URL do Instagram for fornecida, mantendo 100% de paridade com o comportamento de YouTube.

---

## 2. Testes Adicionados e Verificação

### A. Testes Unitários de Detecção e Resolver

- **`src/domain/media/__tests__/instagram.test.ts`** (10 testes):
  - Reconhecimento de posts `/p/...`.
  - Reconhecimento de reels `/reel/...` e variação `/reels/...`.
  - Remoção de query params e barras finais.
  - Suporte a `m.instagram.com` e domínios sem `www`.
  - Rejeição de perfis, stories, URLs inválidas e domínios não-Instagram.
- **`src/features/education/__tests__/EducationScreens.test.tsx`**:
  - `URL de YouTube continua virando embed de YouTube`: passa.
  - `/p/... é reconhecido como Instagram`: passa.
  - `/reel/... é reconhecido como Instagram`: passa.
  - `URL desconhecida continua usando o fallback existente`: passa.
  - Teste de integração de renderização do bloco de Instagram no `ResourceDetailScreen`: passa.

### B. Testes Unitários de Embed e Componente

- **`src/design-system/components/__tests__/InstagramEmbed.test.tsx`** (5 testes):
  - Renderiza `blockquote.instagram-media` com `data-instgrm-permalink` correto.
  - Renderiza reels com permalink apropriado.
  - Script `embed.js` carregado no máximo uma vez em múltiplos embeds.
  - Acionamento de `window.instgrm.Embeds.process()` na montagem.
  - Exibição de card de fallback com botão "Abrir no Instagram" quando o script falha.
- **`src/design-system/components/__tests__/YouTubeVideoCard.test.tsx`** (4 testes):
  - Preservação do iframe do YouTube.
  - Renderização de Instagram.
  - Fallback para URLs desconhecidas.

### C. Resultados dos Comandos

| Comando                                                                           | Resultado                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npx vitest run src/domain/media/__tests__/instagram.test.ts`                     | 10 passed (10)                                                      |
| `npx vitest run src/design-system/components/__tests__/InstagramEmbed.test.tsx`   | 5 passed (5)                                                        |
| `npx vitest run src/design-system/components/__tests__/YouTubeVideoCard.test.tsx` | 4 passed (4)                                                        |
| `npx vitest run src/features/education/__tests__/EducationScreens.test.tsx`       | 36 passed (36)                                                      |
| `npm run typecheck`                                                               | 0 erros                                                             |
| `npm run lint`                                                                    | 0 erros                                                             |
| `npm test`                                                                        | **68 arquivos de teste aprovados (68), 811 testes aprovados (811)** |
| `npm run build`                                                                   | Sucesso em 6.66s                                                    |

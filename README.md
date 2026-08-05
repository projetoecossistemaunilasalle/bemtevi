# BemTeVi

Aplicação web (mobile-first, PWA) de apoio à saúde mental de educadores, em português. O BemTeVi orienta, informa e conecta o usuário a recursos e contatos de apoio profissional — sem diagnóstico, sem substituir acompanhamento profissional e **sem coletar identificação pessoal por padrão**.

## O que é

- **Orientação guiada** (`/orientacao`): conversa determinística, dirigida por fluxos em JSON. Não é IA — por padrão só aceita opções predefinidas; apenas nós explicitamente configurados aceitam texto livre, que não é interpretado.
- **Apoio imediato** (`/apoio`): CVV 188, SAMU 192, Bombeiros 193, exercício de respiração e mensagens de ancoragem. Sempre acessível na navegação inferior.
- **Contatos** (`/contatos`): diretório de serviços de apoio com conteúdo publicado/versionado.
- **Educação** (`/educacao`): biblioteca de recursos de saúde mental, com detalhe por recurso.

## Arquitetura

- **Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router. PWA com `vite-plugin-pwa`, publicado no GitHub Pages sob `/bemtevi/`.
- **Organização:** `src/features` (telas por funcionalidade), `src/domain` (regras de negócio), `src/design-system` (primitivos de UI), `src/lib` (utilidades), `src/content` (dados).
- **Motor de fluxos:** `src/domain/flow-engine` interpreta fluxos JSON (`src/content/flows/*.json`) com nós, opções, regras de resultado e regras de segurança — sem IA.
- **Neon como fonte de conteúdo publicado:** o que o usuário vê (flows, recursos, grupos, contatos) é uma revisão completa e versionada no Postgres (Neon). O `PublishedContentProvider` inicia o app com o conteúdo embutido no bundle e, ao montar e a cada foco da janela, busca a revisão atual na tabela `published_content` via Neon Data API (`id='current'`, contador de revisão). Revisão válida → passa a servir o banco; ausente/erro → mantém o fallback do bundle. Não há push em tempo real.
- **Publicação:** o dashboard admin edita e valida o conteúdo; o publish grava a próxima revisão no Neon (revisão `1` na primeira publicação, incremento a cada publish). Conflito de revisão ou falha de validação mantém o rascunho local intacto.
- **Auth:** leitura pública via Neon Auth (token anônimo); escrita administrativa restrita a contas Neon Auth em `public.admin_users`, com políticas RLS (`public.is_admin()`) na Neon Data API.
- **Dashboard admin:** rotas `/login` e `/dashboard`, disponíveis apenas com `VITE_ENABLE_DEV_DASHBOARD=true` + conta autorizada em `public.admin_users`.

## Rodar rápido

Pré-requisitos: Node.js e pnpm.

```bash
# Windows (instala em node_modules.win)
pnpm run install:win

# Qualquer outro ambiente
pnpm install

# Desenvolvimento (porta 3000)
pnpm run dev

# Qualidade completa (mesmo gate do CI)
pnpm run check
```

> Em WSL, use as variantes `:wsl` (ex.: `pnpm run dev:wsl`). O dev server roda na porta `3000`.

Comandos disponíveis: `dev`, `build`, `preview`, `typecheck`, `lint`, `format` / `format:check`, `validate:flows`, `test`, `check`.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável                                        | Uso                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `VITE_ENABLE_DEV_DASHBOARD`                     | Habilita as rotas `/login` e `/dashboard`.                                 |
| `VITE_DISABLE_AUTH`                             | Bypass de autenticação com conta mock (só para teste local).               |
| `VITE_DASHBOARD_PUBLISH_MODE`                   | `database` (default, escreve no Neon) ou `export` (ZIP legado).            |
| `VITE_NEON_AUTH_URL` / `VITE_NEON_DATA_API_URL` | Endpoints públicos do projeto Neon (Auth e Data API).                      |
| `VITE_ENABLE_PAGE_ANALYTICS`                    | Contadores diários agregados, sem identificação (exige migração de banco). |

**Nunca** coloque connection string, API key do Neon ou senha em variáveis `VITE_*`.

## Coisas importantes

- **Privacidade em primeiro lugar:** nada de login, CPF, e-mail ou identificação. Respostas, scores e transcrições existem só em memória durante a sessão e são descartados. O único dado persistido é a preferência não sensível `bemtevi:onboarding-seen` (localStorage).
- **Não é IA:** a orientação é determinística. Nunca apresente o app como chatbot de IA.
- **Conteúdo embutido é só fallback:** editar JSON em `src/content` não muda o que os usuários veem — é preciso publicar uma nova revisão no Neon, salvo quando o banco está vazio ou indisponível.
- **Publish não sobrescreve:** conflito de revisão ou falha de validação mantém o rascunho local intacto.
- **Limites de payload:** 1 MiB por imagem, 5 MiB por requisição.

## Documentação

- Requisitos do produto: [`docs/PRD.md`](docs/PRD.md)
- Frentes e marcos: [`docs/fronts/README.md`](docs/fronts/README.md)
- Planos de implementação: [`docs/plans/README.md`](docs/plans/README.md)
- Contexto atual do repositório: [`docs/Project-Context.md`](docs/Project-Context.md)

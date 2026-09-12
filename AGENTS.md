# Diretrizes para Agentes de IA — BemTeVi

Este documento serve como contrato operacional e guia base para agentes de IA (Codex, Claude, Gemini, Hermes, etc.) que atuam no repositório **BemTeVi**.

---

## 1. Regra Fundamental: Verificação Obrigatória Pré-Push

> [!IMPORTANT]
> **É expressamente OBRIGATÓRIO rodar e aprovar todos os testes, linter, checagem de tipos e validações antes de realizar qualquer `git push`.**
> Nunca envie código para o repositório remoto sem ter executado e verificado o gate de qualidade local.

### Gate Completo de Qualidade

Antes de qualquer push (ou antes de finalizar tarefas com commits para envio), execute o comando de checagem completa:

```bash
# Windows
pnpm run check

# WSL
pnpm run check:wsl
```

O comando `check` executa sequencialmente e de forma idêntica ao pipeline de CI (`.github/workflows/ci.yml`):

1. **Typecheck (`pnpm run typecheck`):** Validação estrita de tipos com `tsc --noEmit`.
2. **Lint (`pnpm run lint`):** Verificação de regras de código com ESLint (`eslint .`).
3. **Format Check (`pnpm run format:check`):** Verificação de formatação com Prettier (`prettier --check .`).
4. **Validação de Fluxos (`pnpm run validate:flows`):** Validação de integridade e consistência dos fluxos JSON (`scripts/validate-flows.ts`).
5. **Testes Unitários e de Integração (`pnpm run test`):** Execução da suíte local determinística com Vitest (`vitest run`). Exclui `neon/tests/**` (suíte live) e o smoke de release do pacote MCP.
6. **Arquitetura (`pnpm run check:architecture`):** Orçamentos de tamanho, baseline de arquivos oversized, imports proibidos, pins de pacote e varredura de segredos.
7. **Build (`pnpm run build`):** Compilação de produção com Vite (`vite build`).

Quando os artefatos do pacote MCP existirem (MCP-01+), o `check` também roda `test:mcp` e, se houver `build.mjs`, `build:mcp`. Até lá esses comandos falham fechado (não skipam).

### Se qualquer verificação falhar:

- O push **NÃO** deve ser realizado.
- Corrija os erros reportados e rode novamente até que o resultado seja 100% verde (código de saída 0).
- Se a formatação acusar inconsistências, execute `pnpm run format` para aplicar as correções automáticas do Prettier e revalide com `pnpm run check`.

---

## 2. Visão Geral do Projeto

- **Produto:** **BemTeVi** — Aplicação web (mobile-first, PWA) voltada ao apoio à saúde mental de educadores em língua portuguesa (PT-BR).
- **Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router 7, Vitest, Testing Library.
- **Backend / Dados:** PostgreSQL gerenciado via Neon (Neon Auth para autenticação administrativa e Neon Data API para publicação de revisões de conteúdo).
- **Orientação Guiada:** O motor de orientação (`src/domain/flow-engine`) é **determinístico** e baseado em fluxos JSON estruturados. **Não é um chatbot de IA em tempo real para o usuário final**.
- **Privacidade por Design:** Não há coleta de dados pessoais (sem login de usuário comum, sem armazenamento de respostas ou histórico de orientação). O único dado local persistido é a flag `bemtevi:onboarding-seen`.

---

## 3. Comandos Úteis

| Ação                          | Windows                        | WSL / Linux                        |
| ----------------------------- | ------------------------------ | ---------------------------------- |
| **Gate completo (CI local)**  | `pnpm run check`               | `pnpm run check:wsl`               |
| Rodar testes                  | `pnpm run test`                | `pnpm run test:wsl`                |
| Testes em modo watch          | `pnpm run test:watch`          | `pnpm run test:watch:wsl`          |
| Verificação de tipos          | `pnpm run typecheck`           | `pnpm run typecheck:wsl`           |
| Linter                        | `pnpm run lint`                | `pnpm run lint:wsl`                |
| Checagem de formatação        | `pnpm run format:check`        | `pnpm run format:check:wsl`        |
| Formatação automática         | `pnpm run format`              | `pnpm run format:wsl`              |
| Validação de fluxos JSON      | `pnpm run validate:flows`      | `pnpm run validate:flows:wsl`      |
| Servidor de desenvolvimento   | `pnpm run dev`                 | `pnpm run dev:wsl`                 |
| Build de produção             | `pnpm run build`               | `pnpm run build:wsl`               |
| Gate de arquitetura           | `pnpm run check:architecture`  | `pnpm run check:architecture:wsl`  |
| Testes focados (unit)         | `pnpm run test:unit -- <path>` | `pnpm run test:unit:wsl -- <path>` |
| Gate live Neon (DB)           | `pnpm run check:db`            | `pnpm run check:db:wsl`            |
| Smoke do pacote MCP           | `pnpm run check:mcp-package`   | `pnpm run check:mcp-package:wsl`   |
| Espelho de conteúdo publicado | `pnpm run content:pull`        | `pnpm run content:pull:wsl`        |

---

## 3.1 Gates sem credencial vs. live

- **`pnpm run check`** é o gate local determinístico e **sem credenciais**. Inclui typecheck, lint, format, validate:flows, test, check:architecture e build. É o gate obrigatório pré-push.
- **`pnpm run check:db`** provisiona um branch descartável do Neon e exercita a Data API real (admin, anônimo e capability). **Requer credenciais** (`NEON_API_KEY`, contas de teste, etc.). Ausência de credencial **falha o comando** — nunca trate como skip ou como incerteza de arquitetura. O job protegido `v2-database` no CI espelha esse gate.
- **`pnpm run check:mcp-package`** é o smoke de tarball standalone do MCP (MCP-04). Também é gate de release, não substituto do check local.
- Trabalho que afeta banco só é mergeável quando **ambos** `pnpm run check` e o job `v2-database` (ou `check:db` local com credenciais) passam.

## 3.2 Fronteira editorial vs. código

- **GitHub é a fonte de verdade do software.** Código, testes, migrations, schemas e tooling vivem no repositório.
- **Neon é a fonte de verdade do conteúdo editorial.** Conteúdo publicado e o rascunho canônico editável vivem no Neon.
- Tarefas editoriais (título/texto de material, adicionar recurso, imagem, contato) usam o fluxo de drafts do dashboard / agentes — **não** editem arquivos de conteúdo do repo como se fossem a fonte canônica em produção.
- `src/content` no Git é fallback embutido / espelho via `content:pull`, não o armazenamento canônico de edição.
- Publicar no Neon continua sendo ação explícita no dashboard (ou protocolo V2 equivalente), nunca implícita ao salvar um rascunho.

---

## 4. Boas Práticas e Diretrizes de Código

1. **Idiomática e Localização:**
   - Todos os textos visíveis ao usuário e no painel administrativo devem ser mantidos em **Português do Brasil (PT-BR)**.
   - Mantenha tom acolhedor, empático, claro e livre de jargões técnicos nas mensagens voltadas aos educadores.

2. **Novos Recursos e Testes:**
   - Qualquer nova funcionalidade, componente ou correção de bug deve vir acompanhada dos devidos testes unitários/de integração no padrão Vitest + Testing Library (`*.test.tsx` ou `*.test.ts`).

3. **Cuidado com Worktree e Arquivos Existentes:**
   - Revise com `git status` e `git diff` antes de preparar commits.
   - Não reverta alterações locais não relacionadas deixadas pelo desenvolvedor.
   - Não adicione credenciais, chaves de API ou connection strings a variáveis públicas (`VITE_*`) nem comite arquivos `.env`.

4. **Publicação e Dados:**
   - Alterações em arquivos JSON sob `src/content` servem como fallback embutido no bundle. O conteúdo servido em produção é versionado no banco via Neon Data API através do Dashboard administrativo.
   - `content:pull` apenas lê e espelha a revisão atual do Neon no Git; não grava dados no banco.

## 5. Conexão com LLM e verificação

- O procedimento completo está em [`docs/ai-agent-connector.md`](docs/ai-agent-connector.md).
- O agente acessa a ponte local em `http://127.0.0.1:4318`; esse endereço não é a página para revisar mudanças.
- O link de verificação é o frontend servido pelo Vite: `http://localhost:<porta>/bemtevi/`. A porta padrão é `3000`; se ela estiver ocupada, use `pnpm run dev -- --port 3001` e abra `http://localhost:3001/bemtevi/`.
- O dashboard fica em `http://localhost:<porta>/bemtevi/dashboard`, após o login em `http://localhost:<porta>/bemtevi/login`.
- A conexão com o LLM gera um rascunho local. A publicação no Neon continua sendo explícita no dashboard, depois de revisar a prévia/diff.

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
5. **Testes Unitários e de Integração (`pnpm run test`):** Execução de todos os testes com Vitest (`vitest run`).
6. **Build (`pnpm run build`):** Compilação de produção com Vite (`vite build`).

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

| Ação                          | Windows                   | WSL / Linux                   |
| ----------------------------- | ------------------------- | ----------------------------- |
| **Gate completo (CI local)**  | `pnpm run check`          | `pnpm run check:wsl`          |
| Rodar testes                  | `pnpm run test`           | `pnpm run test:wsl`           |
| Testes em modo watch          | `pnpm run test:watch`     | `pnpm run test:watch:wsl`     |
| Verificação de tipos          | `pnpm run typecheck`      | `pnpm run typecheck:wsl`      |
| Linter                        | `pnpm run lint`           | `pnpm run lint:wsl`           |
| Checagem de formatação        | `pnpm run format:check`   | `pnpm run format:check:wsl`   |
| Formatação automática         | `pnpm run format`         | `pnpm run format:wsl`         |
| Validação de fluxos JSON      | `pnpm run validate:flows` | `pnpm run validate:flows:wsl` |
| Servidor de desenvolvimento   | `pnpm run dev`            | `pnpm run dev:wsl`            |
| Build de produção             | `pnpm run build`          | `pnpm run build:wsl`          |
| Espelho de conteúdo publicado | `pnpm run content:pull`   | `pnpm run content:pull:wsl`   |

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

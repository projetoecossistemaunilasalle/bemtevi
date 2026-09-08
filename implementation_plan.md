# Plano de Implementação: Suporte ao Antigravity na Conexão de Assistentes de IA

Adicionar o **Antigravity** (`agy`) como quarto provedor de assistente de IA na ponte local (`scripts/agent-bridge`) e no painel administrativo do BemTeVi (`src/dev-dashboard/ai`).

---

## Proposta de Alterações

### 1. Ponte Local de Agentes (`scripts/agent-bridge`)

#### [MODIFY] [`scripts/agent-bridge/providers.mjs`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/scripts/agent-bridge/providers.mjs)
- Adicionar o provedor `antigravity` à lista `providerDefinitions`:
  - `id: 'antigravity'`, `label: 'Antigravity'`, `command: 'agy'`, `envCommand: 'BEMTEVI_ANTIGRAVITY_COMMAND'`.
- Melhorar `resolveExecutable` com resolução resiliente (verificando também diretórios de instalação padrão do `agy` no Windows/Linux se não estiver diretamente no PATH).
- Implementar `createProviderInvocation` para `antigravity`:
  - Execução via `--input-format stream-json --output-format stream-json --sandbox --disable-slash-commands`.
  - Envio do prompt via stdin estruturado como NDJSON: `{"event":"user","message":{"content":prompt}}`.
  - Processamento de streaming de eventos (`event.step_update` emitindo progresso, `event.result` capturando o texto final ou erro).
- Tratar possíveis erros emitidos no evento `result` com status `ERROR`.

#### [MODIFY] [`scripts/agent-bridge/__tests__/providers.test.mjs`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/scripts/agent-bridge/__tests__/providers.test.mjs)
- Adicionar caso de teste cobrindo a invocação do Antigravity, garantindo os argumentos de sandbox, flags de isolamento e estrutura do evento stdin.

---

### 2. Frontend do Painel Administrativo (`src/dev-dashboard/ai`)

#### [MODIFY] [`src/dev-dashboard/ai/agentBridge.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/ai/agentBridge.ts)
- Atualizar a união de tipos `AgentProviderId` para incluir `'antigravity'`.

#### [MODIFY] [`src/dev-dashboard/ai/agentSetup.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/ai/agentSetup.ts)
- Adicionar o objeto de setup do `antigravity` na lista `agentSetups`, contendo:
  - Descrição amigável em português.
  - Comandos oficiais de instalação para Windows (`irm https://antigravity.google/cli/install.ps1 | iex`) e macOS/Linux (`curl -fsSL https://antigravity.google/cli/install.sh | bash`).
  - Instruções de login com a conta Google via comando `agy`.

#### [MODIFY] [`src/dev-dashboard/ai/DirectAgentSection.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/ai/DirectAgentSection.tsx)
- Atualizar a descrição da seção para mencionar o Antigravity.
- Ajustar a grade de seleção de assistentes para `grid gap-3 sm:grid-cols-2 xl:grid-cols-4` para acomodar os 4 assistentes harmoniosamente.

#### [MODIFY] [`src/dev-dashboard/ai/__tests__/DirectAgentSection.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/ai/__tests__/DirectAgentSection.test.tsx)
- Incluir o `antigravity` no mock de status da ponte.
- Adicionar verificação de alternância para o card do Antigravity e exibição dos comandos de instalação.

---

## Plano de Verificação

### Testes Automatizados
1. `pnpm exec vitest run scripts/agent-bridge src/dev-dashboard/ai`
2. `pnpm exec tsc --noEmit`
3. Executar suíte completa de testes para garantir nenhuma regressão: `pnpm exec vitest run`

### Verificação Prática
- Testar a chamada de detecção do executável via `listProviders()` com Node.js na linha de comando para confirmar que o `agy.exe` local é detectado como disponível (`available: true`).

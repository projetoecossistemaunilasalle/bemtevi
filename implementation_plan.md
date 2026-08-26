# Plano de Implementação: Blindagem do Salvamento Local e Sincronização de Rascunhos

Este plano endereça as vulnerabilidades identificadas na auditoria do sistema de rascunhos locais e sincronização com o banco de dados.

## Problemas Identificados e Soluções

1. **IndexedDB gravado mas ignorado na inicialização**:
   - _Problema_: `DashboardRoute.tsx` inicializa lendo apenas do `localStorage`. Se o `localStorage` for limpo pelo navegador ou estourar a cota, o backup salvo no `IndexedDB` ficava inacessível ao recarregar a página (`F5`).
   - _Solução_: Adicionar carregamento assíncrono com fallback para `IndexedDB` durante o ciclo de montagem inicial do `DashboardRoute`. Se o `localStorage` estiver vazio e o `IndexedDB` contiver um rascunho com alterações válidas, o rascunho é restaurado automaticamente.

2. **Concorrência entre múltiplas abas abertas no mesmo navegador**:
   - _Problema_: Duas abas abertas mantêm instâncias separadas em memória React. A última aba a salvar sobrescreve as edições da outra no `localStorage` sem aviso.
   - _Solução_: Adicionar um listener de evento `window.addEventListener('storage')` para monitorar alterações na chave do rascunho (`bemtevi:dev-dashboard:drafts:v1`). Ao detectar alteração externa mais recente, a aba atualiza seu estado em memória de forma transparente.

3. **Alerta prévio sobre o limite de 5 MiB do Payload (Imagens Base64)**:
   - _Problema_: O usuário pode adicionar múltiplas imagens pesadas e só descobrir o limite de 5 MiB ao tentar clicar em "Publicar", recebendo um erro genérico de payload inválido.
   - _Solução_: Calcular e expor o tamanho do payload na aba de Publicação/Exportação com indicador de capacidade e aviso preventivo caso o tamanho exceda 80% do limite de 5 MiB.

---

## Modificações Propostas

### 1. Camada de Armazenamento Local (`draft-storage`)

#### [MODIFY] [`src/dev-dashboard/draft-storage/dashboardStorage.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/draft-storage/dashboardStorage.ts)

- Adicionar função utilitária `restoreDraftFromIndexedDbFallback()` para orquestrar a leitura assíncrona do IndexedDB quando o `localStorage` estiver vazio ou desatualizado.

---

### 2. Painel Administrativo (`DashboardRoute.tsx`)

#### [MODIFY] [`src/dev-dashboard/DashboardRoute.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/DashboardRoute.tsx)

- No `useEffect` inicial, consultar o IndexedDB caso o estado inicial não tenha alterações. Se houver um rascunho mais recente salvo no IndexedDB, hidratar o estado React `draftState` e sincronizar o `localStorage`.
- Adicionar listener para o evento `'storage'` da janela, sincronizando o rascunho entre diferentes abas abertas no mesmo navegador quando uma nova gravação for detectada.

---

### 3. Interface de Publicação e Exportação (`PublishDashboard.tsx`)

#### [MODIFY] [`src/dev-dashboard/publishing/PublishDashboard.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/publishing/PublishDashboard.tsx)

- Exibir medidor/aviso visual de tamanho do payload (`getPublishedPayloadSize`) em relação ao teto de 5 MiB (`MAX_PUBLISHED_PAYLOAD_BYTES`), alertando o administrador caso o conteúdo esteja próximo ou exceda o limite.

---

## Plano de Verificação

### Testes Automatizados

- Executar `pnpm test` cobrindo toda a suíte existente de 729 testes.
- Adicionar testes em `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` e `src/dev-dashboard/__tests__/dashboardStorage.test.ts`:
  1. Teste de restauração do IndexedDB quando `localStorage` está vazio.
  2. Teste de sincronização de evento `storage` entre abas.
  3. Teste de aviso de limite de tamanho de payload no `PublishDashboard`.

### Verificação Manual

- Simular duas abas editando fluxos e contatos para confirmar que o rascunho não é sobrescrito.
- Simular `localStorage` vazio com IndexedDB preenchido e dar refresh para confirmar a restauração.

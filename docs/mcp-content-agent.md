# MCP de Conteúdo para o Assistente

**Status: Implemented.** O servidor MCP, o DraftStore, a sincronização do dashboard e a publicação condicional estão implementados em `scripts/content-agent`.

## Uso local

1. O servidor `bemtevi-content` já está registrado em `.mcp.json`, `.codex/config.toml` e `.cursor/mcp.json`. Reinicie o host depois de alterar a configuração.
2. Para revisar o mesmo rascunho no dashboard, execute `pnpm content-agent:sync`, abra **Assistente IA > Rascunhos do assistente** e use o código de pareamento exibido no terminal.
3. A publicação direta fica desabilitada por padrão. Para habilitá-la, configure `BEMTEVI_CONTENT_AGENT_PUBLISH_ENABLED=true`, execute `pnpm content-agent:login` e reinicie o servidor MCP.
4. `content-agent:login` valida a associação em `admin_users` e protege a sessão com DPAPI no perfil do usuário do Windows. `pnpm content-agent:logout` revoga e remove a sessão local.

Os rascunhos ficam em `.bemtevi/content-drafts`, diretório ignorado pelo Git. O transporte MCP usa `stdio`; somente a API de sincronização escuta em `127.0.0.1`.

## Decisão

Substituir o envio de conteúdo pelo painel `Assistente IA` por um servidor MCP local, conectado diretamente ao assistente que está trabalhando no repositório. O dashboard continua sendo uma superfície completa de edição, revisão, comparação e publicação, mas deixa de ser o transporte obrigatório de contexto para a IA.

O assistente pode criar, revisar e publicar uma revisão diretamente quando o usuário autorizar essa ação. Essa capacidade segue a mesma filosofia de comandos como `git commit` e `git push`: o agente pode executar a operação, enquanto autenticação, política de aprovação do host, validação e proteções contra conflito continuam obrigatórias.

O fluxo atual empacota o conteúdo completo no navegador, inicia um CLI e aguarda uma resposta de operações. Isso é inadequado para revisões de conteúdo grandes: aumenta latência, dificulta diagnóstico e cria uma segunda interface para uma tarefa que já está sendo conduzida pelo assistente.

## Fluxo Proposto

```text
assistente no Codex
        |
        | MCP local, autenticado e limitado
        v
leitura seletiva do Neon <----> validação do domínio
        |
        v
DraftStore local versionado <----> dashboard administrativo
        |
        | preparar publicação + diff imutável
        v
publicação condicional no Neon
```

O MCP deve ser registrado no host do Codex, não no navegador. Depois de registrado, o assistente consulta apenas os itens necessários, cria um rascunho compartilhado com o dashboard e pode publicar esse rascunho sem copiar o payload inteiro para um prompt.

## Componentes

### Leitura publicada

As leituras usam o endpoint público já utilizado por `content:pull`. O servidor aplica projeção, paginação e limites de resposta antes de devolver dados ao assistente.

`get_published_revision` retorna somente metadados: revisão, versão de schema, data, autor, digest e contagens por coleção. Listagens de coleções são paginadas e limitadas a 100 itens por chamada. Itens completos são obtidos explicitamente por ID.

### DraftStore local

O `DraftStore` é a fonte canônica dos rascunhos criados pelo MCP. Ele fica em um diretório local do projeto ignorado pelo Git e usa escrita atômica. O dashboard acessa a mesma store por uma API de sincronização em `127.0.0.1`, protegida pelo pareamento local já usado pela ponte atual.

O IndexedDB do dashboard continua sendo um checkpoint e fallback local. Para rascunhos originados no MCP, o dashboard preserva `draftId` e sincroniza alterações usando `expectedGeneration`; ele nunca substitui silenciosamente uma geração mais nova. Se a API local não estiver disponível, o rascunho pode ser exportado e importado manualmente sem perder sua identidade e revisão de base.

Cada rascunho usa este envelope lógico:

```ts
interface ContentDraft {
  schemaVersion: 1;
  draftId: string;
  generation: number;
  base: {
    revision: number | null;
    digest: string;
    payload: PublishedContentPayload;
  };
  candidate: PublishedContentPayload;
  candidateDigest: string;
  validation: {
    valid: boolean;
    issues: ContentValidationIssue[];
  };
  createdAt: string;
  updatedAt: string;
}
```

Rascunhos inválidos podem ser preservados para recuperação e correção, mas nunca podem avançar para `prepare_publish`. Toda criação ou atualização devolve o resultado completo da validação.

### Autenticação administrativa

A leitura continua anônima e pública. A escrita remota exige uma sessão administrativa própria do agente local, obtida por um comando interativo como `pnpm content-agent:login` e validada contra a associação administrativa existente.

Credenciais de login, tokens e connection strings nunca são argumentos de ferramentas MCP. A sessão renovável fica no cofre de credenciais do sistema operacional; se um cofre seguro não estiver disponível, a autenticação vale somente para o processo atual. O repositório, o DraftStore, logs e arquivos `.env` não armazenam esses segredos. `content-agent:logout` revoga e remove a sessão local.

O `publisherId` sempre é derivado da sessão autenticada. A ferramenta não aceita identidade de publicador informada pelo modelo.

### Publicação direta

A publicação usa duas etapas para tornar o candidato verificável e impedir alterações entre revisão e escrita:

1. `prepare_publish` recarrega a revisão publicada, rejeita conflitos, valida o candidato e produz um diff, um resumo e um `publishToken` opaco.
2. O token fica somente em memória, expira em cinco minutos e é vinculado a `draftId`, `generation`, `candidateDigest`, revisão remota e sessão administrativa.
3. `publish_draft` exige esse token e repete todas as verificações antes da escrita.
4. A escrita usa comparação por revisão; conflito encerra a tentativa sem sobrescrita forçada.
5. O servidor registra uma tentativa durável antes de enviar. Em resposta de rede ambígua, consulta a revisão remota pelo digest antes de permitir nova tentativa.
6. O token é consumido no sucesso, no conflito ou ao expirar. Alterar o rascunho invalida tokens anteriores.

`publish_draft` deve ser anunciada ao host MCP como ferramenta destrutiva e não idempotente. A autorização humana segue a política do host: uma instrução explícita do usuário para publicar já pode autorizar a chamada; caso contrário, o host deve solicitar aprovação antes da escrita remota. O servidor não tenta inferir aprovação a partir de texto e nunca reduz as garantias de autenticação, validação ou concorrência.

## Ferramentas Necessárias

| Ferramenta                  | Contrato principal                                                            | Permissão                 |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| `get_published_revision`    | Retornar somente metadados, digest e contagens da revisão atual.              | Somente leitura           |
| `list_published_items`      | Listar IDs e campos projetados com cursor e limite máximo de 100.             | Somente leitura           |
| `find_material_references`  | Localizar nós, grupos e materiais que referenciam um ID.                      | Somente leitura           |
| `get_flow` / `get_material` | Obter um item completo por ID e revisão.                                      | Somente leitura           |
| `validate_content_patch`    | Aplicar operações em memória e devolver candidato, digest, erros e diff.      | Sem persistência          |
| `create_draft`              | Criar um rascunho com revisão de base e chave de idempotência.                | Escrita local controlada  |
| `update_draft`              | Atualizar por `draftId` e `expectedGeneration`; rejeitar geração obsoleta.    | Escrita local controlada  |
| `get_draft`                 | Obter envelope e validação de uma geração específica.                         | Somente leitura           |
| `get_draft_diff`            | Comparar uma geração com sua base ou com a revisão publicada atual.           | Somente leitura           |
| `prepare_publish`           | Validar e congelar uma geração, retornando diff, resumo e token efêmero.      | Sem escrita remota        |
| `publish_draft`             | Publicar a geração preparada com escrita condicional e sessão administrativa. | Escrita remota destrutiva |

Todos os argumentos e resultados usam JSON Schema estrito. Operações de escrita aceitam uma chave de idempotência e devolvem `draftId`, `generation`, revisão de base, digest e status. Erros distinguem pelo menos `invalid_payload`, `unauthorized`, `stale_generation`, `revision_conflict`, `token_expired`, `uncertain_outcome` e `unavailable`.

## Regras de Segurança

- O transporte MCP roda somente em `127.0.0.1` ou via `stdio`; ele não expõe uma porta de rede pública.
- Quando o MCP usa `stdio`, somente a API separada de sincronização do dashboard escuta em `127.0.0.1`.
- A API local valida código de pareamento, origem, método e tamanho da requisição; não permite curingas de CORS.
- Consultas devolvem resultados mínimos, paginados e com limite de bytes; nenhuma leitura devolve todas as coleções por padrão.
- Escritas locais são atômicas e usam geração esperada. O servidor nunca resolve concorrência com last-write-wins silencioso.
- Nenhum rascunho inválido, conflito de revisão ou geração obsoleta pode ser publicado.
- Não existe publicação forçada nem opção de omitir `expectedRevision`.
- Segredos nunca aparecem em argumentos, resultados, logs, diffs ou arquivos do projeto.
- O MCP não acessa respostas de usuários finais, históricos de orientação ou dados de localização do dispositivo.

## Critérios de Aceite

1. O assistente localiza referências de um material sem abrir o dashboard nem receber o payload completo em um prompt.
2. Leituras paginadas respeitam projeção, quantidade máxima de itens e limite de bytes.
3. Uma alteração cria um rascunho versionado, com digest, validação e diff verificáveis.
4. O dashboard mostra o mesmo `draftId` e a mesma geração; edições concorrentes produzem conflito em vez de sobrescrita.
5. O assistente autenticado consegue publicar diretamente quando autorizado pelo usuário ou pela política de aprovação do host.
6. O dashboard também consegue revisar e publicar o mesmo rascunho, mas não é etapa obrigatória para a publicação pelo assistente.
7. A publicação só aceita exatamente a geração e o digest aprovados por `prepare_publish`.
8. Conflito de revisão, token expirado ou geração alterada interrompem a publicação sem escrita parcial.
9. Uma resposta de rede ambígua preserva a tentativa e permite confirmar o resultado remoto sem duplicar a publicação.
10. Leitura, validação, sincronização, autenticação, idempotência, concorrência, recuperação e publicação têm testes automatizados.

## Migração

1. Extrair validação, diff, digest e escrita condicional para módulos compartilhados entre dashboard e servidor MCP.
2. Implementar leitura seletiva e o DraftStore com testes de limite, escrita atômica, idempotência e concorrência.
3. Integrar o dashboard à API local e validar sincronização bidirecional e recuperação pelo IndexedDB.
4. Implementar login administrativo local, cofre de credenciais, `prepare_publish` e publicação direta atrás de uma feature flag.
5. Executar testes de conflito, expiração, falha de rede e resultado incerto contra um ambiente Neon isolado.
6. Quando o MCP estiver disponível e validado, remover o conector direto do painel ou mantê-lo temporariamente como alternativa legada.

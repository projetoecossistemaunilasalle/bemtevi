# Contexto Base: Tela de Diff do Dashboard

## Objetivo

Preparar uma especificacao tecnica para uma tela de diff que permita a uma pessoa administradora revisar, com seguranca e clareza, as alteracoes locais antes da publicacao. A experiencia tambem deve comunicar de forma explicita quando os detalhes do diff nao puderem ser calculados, sem confundir essa falha com um erro de publicacao ou de validacao de conteudo.

O produto e o BemTeVi, uma aplicacao em PT-BR de apoio a saude mental de educadores. O dashboard e administrativo; seus textos devem continuar claros, acolhedores e sem jargao tecnico desnecessario.

## Estado Atual

O ponto de entrada da publicacao esta em `src/dev-dashboard/publishing/PublishDashboard.tsx`. Ele recebe:

- `baseline`: conteudo publicado usado como referencia para comparacao.
- `draft`: conteudo atual do rascunho local.
- `validation`: erros e avisos de integridade que bloqueiam ou orientam a publicacao.
- `expectedRevision` e `basePayload`: informacoes para controlar concorrencia e tentar merge em caso de nova revisao remota.

O dominio do conteudo publicado e `PublishedContentPayload`, definido em `src/app/content/publishedContent.ts`. As colecoes comparadas sao:

- `flows`: fluxos de orientacao.
- `educationMaterials`: materiais educativos.
- `educationGroups`: grupos de materiais.
- `contacts`: contatos de servicos.
- `locations`: locais associados aos contatos.
- `defaultGroupOrder`: configuracao global de ordenacao.

O arquivo `src/dev-dashboard/publishing/changeSummary.ts` ja oferece dois niveis de comparacao:

- `computeChangeSummary`: totais de itens adicionados, editados e removidos por colecao.
- `computeDetailedChangeSummary`: os mesmos totais com detalhes por registro, incluindo identificador, rotulo, indice no baseline/rascunho e campos de primeiro nivel modificados.

A comparacao normaliza objetos por meio de `normalizeForComparison`, em `src/dev-dashboard/content/normalize.ts`: chaves de objetos sao ordenadas antes de `JSON.stringify`, enquanto a ordem de arrays e preservada. Portanto, reordenar itens dentro de um array e uma mudanca semantica para o mecanismo atual.

## Interface Ja Existente

Hoje, a aba de publicacao ja exibe:

- Cartoes resumidos com as contagens por area.
- Secao “Detalhes por item”, agrupada por Fluxos, Materiais, Grupos, Contatos e Locais.
- Subgrupos de itens adicionados, editados e removidos.
- Campos alterados em cada item editado.
- Acao “Abrir” para navegar ao item de fluxos, materiais ou contatos quando o item ainda existe no rascunho.
- Aviso especifico para alteracao de `defaultGroupOrder`.
- Validacoes impeditivas antes de publicar.
- Tratamento de conflito de revisao: mostra alteracoes locais e remotas e permite manter o rascunho ou descarta-lo em favor da versao do Neon.

Os testes relacionados estao em `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx` e `src/dev-dashboard/publishing/__tests__/changeSummary.test.ts`.

## Problema a Resolver

`PublishDashboard` calcula `computeDetailedChangeSummary(baseline, draft)` diretamente dentro de `useMemo`. Se a geracao do diff detalhado lancar uma excecao, a tela pode atingir o `ErrorBoundary` geral da aplicacao. Isso impede a pessoa administradora de entender que a falha ocorreu especificamente ao montar a revisao de alteracoes.

O comportamento desejado e explicitar esse caso na propria experiencia de publicacao. A interface deve distinguir claramente:

- Erro de diff: nao foi possivel montar uma revisao confiavel das mudancas.
- Erro de validacao: o conteudo possui inconsistencias que precisam ser corrigidas.
- Erro de publicacao: a tentativa de salvar no banco falhou.
- Conflito de revisao: outra pessoa publicou conteudo depois da revisao usada como base.

Uma falha de diff nao deve ser tratada como “nao ha alteracoes”. Isso poderia induzir uma publicacao sem revisao adequada. A acao de publicar deve permanecer bloqueada enquanto o diff necessario para revisao estiver indisponivel.

## Direcao de Arquitetura

Criar uma fronteira segura para o calculo de diff, idealmente proxima de `changeSummary.ts`, para que a representacao de sucesso e falha seja tipada e reutilizavel. Um formato possivel e:

```ts
type DiffComputationResult = { ok: true; summary: DetailedChangeSummary } | { ok: false; error: DiffComputationError };
```

O erro deve ser seguro para exibicao: nao revelar payloads, dados internos do Neon, stack traces ou mensagens originais inesperadas. O modelo que produzir o plano deve decidir se uma unica categoria segura basta inicialmente ou se categorias como `invalid_payload`, `comparison_failed` e `unsupported_data` trariam valor real.

`PublishDashboard` deve consumir esse resultado de modo que:

- O diff detalhado seja a fonte de verdade para a tela de revisao.
- A contagem usada para habilitar publicacao nao contradiga o estado do diff detalhado.
- Quando houver erro, seja exibido um alerta visivel, com texto em PT-BR e uma acao de recuperacao apropriada, como recarregar o conteudo publicado ou tentar gerar o diff novamente.
- O botao de publicar fique desabilitado enquanto houver erro de diff.
- O alerta tenha semantica acessivel, por exemplo `role="alert"`, sem anunciar repetidamente conteudo que nao mudou.
- O rascunho local nunca seja descartado automaticamente por uma falha de diff.

O mesmo mecanismo seguro deve ser considerado em `buildRevisionConflictDetails`, pois ele tambem calcula um diff detalhado do `mergeBase` contra a revisao remota mais recente. Caso esse diff remoto falhe, a tela precisa conservar a explicacao do conflito e declarar que os detalhes remotos nao puderam ser produzidos, em vez de mascarar o conflito ou derrubar a tela.

## Proposta de Experiencia da Tela

A tela de diff deve priorizar revisao, nao apenas auditoria tecnica.

1. Cabecalho: informar a revisao de referencia, a revisao atual e o numero total de alteracoes identificadas.
2. Resumo: mostrar contagens de adicionados, editados e removidos por area.
3. Filtros: permitir restringir por area e por tipo de alteracao. Em telas pequenas, filtros compactos e empilhados.
4. Lista de alteracoes: cada registro deve mostrar tipo da mudanca, nome amigavel, identificador secundario e campos afetados.
5. Inspecao: para itens editados, mostrar antes/depois por campo quando o valor puder ser apresentado com seguranca e legibilidade. Objetos ou arrays grandes devem ter resumo e expansao progressiva, nao um JSON bruto como padrao.
6. Navegacao: manter “Abrir” para ir ao editor no contexto correto. Itens removidos precisam de uma apresentacao de somente leitura, pois nao existe destino no rascunho para abrir.
7. Configuracoes globais: mudancas como `defaultGroupOrder` precisam aparecer fora da lista de registros, com uma descricao compreensivel e um atalho para a area correspondente.
8. Conflitos: apresentar as colunas local e publicada lado a lado em desktop e sequencialmente em mobile. Sinalizar sobreposicoes reais por campo, sem chamar toda alteracao paralela de conflito.
9. Falha de diff: ocupar local visivel antes da acao de publicacao, dizer que os detalhes nao foram gerados e bloquear a publicacao. A tela pode manter dados seguros ja disponiveis, mas nao deve alegar uma revisao completa.

## Cuidados de Dados e Comparacao

- O pareamento atual usa `id` e trata ids repetidos por ordem de ocorrencia. O plano deve avaliar se ids duplicados devem continuar sendo tolerados ou virar erro de diff/validacao, pois dificultam uma revisao inequivoca.
- `changedFields` atual identifica somente chaves de primeiro nivel. Para fluxos, uma mudanca em `nodes` aparece como “etapas”; uma tela compreensiva deve considerar um diff semantico de nos, escolhas e efeitos para evitar indicar que o fluxo inteiro mudou sem contexto.
- Arrays ordenados sao considerados diferentes se a ordem mudar. O plano deve definir, por tipo de campo, se ordem e significativa e como representar reordenacoes sem parecer remocao e adicao em massa.
- Rotulos atuais usam `title`, `name`, cidade/estado ou `id` como fallback. A mesma estrategia deve ser centralizada para que resumo, diff, conflito e navegacao usem nomes consistentes.
- Valores sensiveis ou extensos nao devem ser inseridos cegamente em atributos de acessibilidade, logs ou mensagens de erro.
- O conteudo publicado tem limite de 5 MiB. A tela de diff nao deve duplicar grandes estruturas em estado React desnecessariamente nem degradar a navegacao com muitos registros.

## Testes Esperados

O plano deve incluir testes Vitest e Testing Library para:

- Comparacao normal de adicao, edicao, remocao e configuracao global.
- Campos alterados e rotulos amigaveis por tipo de registro.
- Navegacao para itens existentes e tratamento de itens removidos.
- Falha intencional na computacao do diff: alerta explicito, publicacao bloqueada, rascunho preservado e ausencia de vazamento da mensagem interna.
- Recuperacao apos nova tentativa de computar o diff ou nova entrada valida, conforme a UX escolhida.
- Falha ao calcular detalhes remotos de um conflito de revisao, preservando a mensagem de conflito principal.
- Acessibilidade: semantica de alerta, nome acessivel dos botoes e navegacao por teclado.
- Layout responsivo manual ou automatizado, especialmente para listas e comparacoes lado a lado em telas pequenas.

Os comandos de verificacao do repositorio em Windows sao `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` e, para o gate completo, `pnpm run check`.

## Arquivos Relevantes

- `src/dev-dashboard/publishing/PublishDashboard.tsx`: tela, publicacao, conflitos e acoes de recuperacao.
- `src/dev-dashboard/publishing/changeSummary.ts`: modelos e algoritmos de resumo/detalhe do diff.
- `src/dev-dashboard/publishing/mergePublishedContent.ts`: merge de tres vias e conflitos por campo.
- `src/dev-dashboard/content/normalize.ts`: normalizacao usada nas comparacoes.
- `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx`: cobertura atual da interface e conflitos.
- `src/dev-dashboard/publishing/__tests__/changeSummary.test.ts`: cobertura atual do algoritmo de resumo.
- `src/app/content/publishedContent.ts`: contrato de `PublishedContentPayload` e revisoes publicadas.
- `src/dev-dashboard/DashboardRoute.tsx`: composicao entre conteudo publicado, rascunho e abas do dashboard.

## Decisoes que o Plano Deve Fechar

- O diff detalhado deve ser uma nova tela/aba dedicada, uma expansao da aba Publicar ou ambas as coisas?
- Qual e a granularidade inicial aceitavel para fluxos: campo de primeiro nivel ou diff semantico de nos e efeitos?
- Como a pessoa administradora deve recuperar-se do erro de diff: nova tentativa local, recarregamento da referencia remota, exportacao do rascunho ou combinacao dessas opcoes?
- Um diff indisponivel deve bloquear qualquer publicacao? A recomendacao e sim, para evitar publicar alteracoes sem revisao confiavel.
- Como lidar com ids duplicados ou payloads invalidos: erro de diff, erro de validacao ou ambos?
- Quais limites de itens/linhas justificam paginacao, virtualizacao ou expansao sob demanda?

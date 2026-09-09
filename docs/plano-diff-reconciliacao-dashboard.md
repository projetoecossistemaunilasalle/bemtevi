# Plano: diff real e reconciliacao segura do Dashboard

Status: nucleo funcional implementado no workspace; homologacao integral da matriz abaixo ainda pendente.
Base: `diff_dashboard_context.md` e leitura da implementacao atual do workspace.

## Registro da implementacao

- Workspace v7 com snapshots B/L, sessao de reconciliacao e tentativa de publicacao; IndexedDB transacional, geracoes, checkpoints, arquivo/restauracao e importacao em copia independente.
- Migracao preserva bytes legados; base ausente exige recuperacao assistida. Eventos de outra aba nao substituem o rascunho aberto.
- Motor compartilhado entre comparacao e merge: caminhos tipados, ausencia/null, identidades, conflitos de ordem, decisoes reversiveis e erro fechado.
- Aba Publicar com antes/depois, filtros, busca, paginacao de 50, resolucao por conflito, correcao JSON do candidato, revisao final e escrita condicional sem retry automatico.
- Novos IDs de fluxos, materiais, grupos, contatos, locais e blocos usam UUID. Geradores internos de etapas/escolhas ainda usam o contrato anterior; colisoes concorrentes sao conflitos, nao sobrescritas silenciosas.
- Medicao local sintetica: 4.836.887 bytes, 1.000 registros, comparacao em 51 ms e merge em 113 ms. Nao representa latencia em dispositivos moveis; worker e deduplicacao fisica de snapshots ainda nao foram implementados.
- A correcao integral de C e feita no editor JSON da aba Publicar, nao nos formularios especializados. Editar L nos formularios reinicia sua reconciliacao; checkpoints preservam a sessao anterior.
- Verificacao visual da aba em desktop e mobile realizada sem publicar conteudo real. Continuam pendentes homologacao multiadministrador contra o backend, zoom 200%, toda a matriz de falhas e refinamento da recuperacao assistida para valores individuais sem base.

Estas ressalvas impedem considerar todas as etapas e garantias deste plano integralmente homologadas.

## 1. Objetivo e garantia

Permitir revisar, resolver e publicar alteracoes concorrentes sem precisar descartar o trabalho local ou sobrescrever silenciosamente o trabalho publicado por outra pessoa.

Garantia verificavel: nenhum conflito, refresh, erro de diff, erro de rede ou cancelamento pode apagar o rascunho confirmado, alterar sua base silenciosamente ou obrigar a descarta-lo para continuar. Todo conflito deve ter um caminho de resolucao e exportacao. Publicacao pode continuar bloqueada por conteudo invalido, falta de permissao ou indisponibilidade; preservacao e capacidade de publicar sao garantias diferentes.

Nao prometer perda zero absoluta com armazenamento apenas no navegador: limpeza dos dados, falha do dispositivo e edicoes ainda nao persistidas continuam sendo limites. A interface deve distinguir "Salvando", "Salvo neste navegador" e "Nao foi possivel salvar". Recuperacao fora do dispositivo exige uma copia externa confirmada. Armazenamento administrativo remoto pode ser uma etapa separada; nao faz parte da garantia local desta entrega.

Escopo restrito ao Dashboard administrativo. Nao persistir respostas ou historico de orientacao dos educadores.

## 2. Diagnostico confirmado no codigo

- `DashboardRoute.tsx`: `mergedDrafts` aplica patches sobre `shipped`, que acompanha a publicacao remota, e nao necessariamente sobre `basePayload`. Um registro removido remotamente pode deixar de aparecer no resultado local; patches de estruturas inteiras podem encobrir mudancas remotas.
- `rebaseDraftAfterMergeConflict` substitui `baseRevision` e `basePayload` sem resolver o merge. A tentativa seguinte pode deixar de detectar a sobreposicao original.
- `PublishDashboard.tsx`: o merge sem conflitos e publicado automaticamente, sem uma nova revisao explicita do candidato combinado. Confirmacao e retry nao concentram todos os bloqueios em uma unica guarda.
- `mergePublishedContent.ts`: ja existe merge de tres vias recursivo, mas retorna `payload: null` quando ha conflitos. Falta uma sessao persistida de resolucao e um candidato explicitamente incompleto.
- `dashboardStorage.ts`: o fallback pode remover `basePayload` do localStorage; a recuperacao do IndexedDB nao complementa necessariamente um rascunho de mesma data. Importacao e eventos entre abas podem substituir o estado atual.
- `draftDb.ts`: a gravacao pode resolver no sucesso da requisicao antes do fechamento da transacao. Falha ao abrir o banco e silenciada. Logo, disparar a gravacao nao comprova que existe backup.
- Diff detalhado e resumo sao calculados separadamente, sem fronteira segura. A interface limita listas a 8 ou 12 itens sem acesso integral pela propria revisao.

Esses problemas exigem corrigir o ciclo de vida do rascunho, nao apenas acrescentar uma visualizacao antes/depois.

## 3. Modelo de trabalho

Separar explicitamente quatro versoes:

- B: base imutavel da sessao de edicao, com revisao e payload correspondentes.
- L: conteudo local editado a partir de B, independente de atualizacoes remotas.
- R: ultima publicacao remota carregada para reconciliacao.
- C: candidato resultante do merge e das decisoes da pessoa administradora.

O refresh altera R, nunca B ou L. O diff de autoria local e B -> L; o remoto e B -> R; a revisao final de publicacao e R -> C.

Proposta de envelope versionado:

```ts
type ValueSlot = { present: false } | { present: true; value: JsonValue };

type DraftWorkspace = {
  schemaVersion: 7;
  workspaceId: string;
  generation: number;
  base: { revision: number | null; payload: PublishedContentPayload };
  local: PublishedContentPayload;
  reconciliation?: ReconciliationSession;
  publicationAttempt?: PublicationAttempt;
};
```

`JsonValue`, `ReconciliationSession` e `PublicationAttempt` serao contratos do dominio. A sessao registra R, geracao local, decisoes e identidades das entradas. A tentativa registra identificador, revisao esperada e identidade do candidato enviado. Datas sao informativas; nao decidem precedencia entre gravacoes.

Preferir snapshots completos de B e L na primeira versao para eliminar dependencia de indices e de uma base mutavel. Persistir checkpoints em transacoes, com deduplicacao de snapshots iguais se necessario; nao copiar o payload inteiro para cada entrada do diff em React. Migrar os editores para atualizacoes imutaveis de L, reutilizando componentes e validacoes existentes.

## 4. Persistencia e recuperacao primeiro

1. Tornar IndexedDB a fonte autoritativa do workspace completo. localStorage fica apenas com metadados leves/compatibilidade, sem uma segunda verdade concorrente.
2. Confirmar salvamento apenas em `transaction.oncomplete`; tratar erro e abort, fechar conexoes e propagar resultado tipado. Serializar escritas por workspace e validar a geracao esperada dentro da transacao.
3. Salvar edicoes de forma ordenada; agrupar digitacao em janela curta, com indicador de pendencia. Antes de reconciliar, importar, substituir ou publicar, exigir checkpoint confirmado. Falha preserva memoria e oferece exportacao; nunca afirmar que existe backup sem confirmacao.
4. Salvar checkpoints antes de importacao, reconciliacao e substituicao. Guardar original e decisoes enquanto a sessao estiver ativa. Nao remover rascunhos nao publicados automaticamente para liberar espaco; em quota insuficiente, interromper a operacao de substituicao e oferecer exportacao/limpeza explicita de historico arquivado.
5. "Descartar" passa a arquivar o workspace com opcao de restaurar. Exclusao definitiva exige acao separada e confirmacao. Restaurar arquivo cria workspace separado antes de qualquer troca.
6. Duas abas nao compartilham um unico registro substituivel por timestamp. Cada sessao tem identificador; uma segunda aba retoma em leitura ou cria copia independente. Uma divergencia de geracao bloqueia sobrescrita, preservando ambas as versoes. Eventos de storage/BroadcastChannel apenas notificam, nao substituem trabalho.
7. Exportar envelope completo: base, local, revisao, versao de formato e decisoes. Validar estrutura e versao na importacao; arquivo desconhecido/corrompido e mantido para recuperacao, nunca convertido silenciosamente em rascunho vazio.

Migracao: preservar os bytes legados antes de converter. Quando houver base, reconstruir L sobre essa base e verificar equivalencia. Quando faltar base, tentar recuperar a copia completa correspondente no IndexedDB. Sem base confiavel, entrar em recuperacao assistida: mostrar o material recuperavel, permitir reconstruir um candidato com escolhas explicitas contra R e manter o original. Nao inventar uma ancestralidade usando a revisao atual e nao deixar o usuario preso sem alternativa de recuperacao.

## 5. Motor semantico compartilhado

Criar um modelo unico de mudancas para resumo, antes/depois, navegacao e merge. Manter adaptadores para consumidores antigos enquanto a migracao acontece.

- Colecoes com identidade: parear por ID unico, nunca por posicao. Novos IDs devem ser resistentes a colisao entre sessoes, em vez de contadores locais.
- Fluxos: comparar `nodes` por chave do mapa, validando consistencia com `node.id`; escolhas por ID; textos e destinos por campo. Materiais: blocos por ID quando o contrato oferece identidade.
- Ausencia e valor nulo sao distintos, inclusive no arquivo exportado. Usar `ValueSlot`, nao `undefined` como representacao serializada de exclusao.
- Caminhos sao segmentos tipados (campo/registro), nao strings de pontos e colchetes interpretadas com regex. IDs podem conter esses caracteres.
- Arrays sem identidade estavel, incluindo efeitos quando nao houver ID, sao atomicos no merge inicial. Mostrar detalhes visuais, mas pedir escolha quando ambos alterarem diferentemente. Nao inferir identidade por indice nem introduzir IDs artificiais no payload publicado.
- Preservar semantica de ordem existente por padrao. Declarar politica por campo; escolhas, blocos, efeitos e ordem de etapas nao podem ser tratados como conjuntos. Alteracoes de ordem aparecem como movimento, nao exclusao/adicao em massa.
- Para ordenacao concorrente, combinar somente restricoes inequivocas. Ordens incompatíveis, ciclos ou posicao ambigua de insercoes geram conflito de ordem explicito; nenhuma preferencia silenciosa pela ordem remota.
- IDs duplicados ou identidade inconsistente bloqueiam merge automatico e revisao confiavel da area, com erro de validacao identificavel. Oferecer correcao no editor, preservando os dados originais. Nao tolerar duplicatas por ordem de ocorrencia no novo motor.
- Textos: antes/depois com destaque de trechos; merge automatico de texto linha a linha fica fora da primeira entrega. O campo recebe escolha local, remota ou edicao manual.

Regras minimas: L = B aceita R; R = B aceita L; L = R aceita o valor comum. Alteracoes independentes combinam. Editar/excluir e adicionar valores diferentes com o mesmo ID exigem escolha. Exclusao convergente nao e conflito.

O resultado retorna mudancas automaticas, conflitos e candidato incompleto tipado. Nao permitir que um candidato com conflitos pendentes seja aceito pela API de publicacao. Preservar B/L/R sem mutacao e registrar as escolhas de forma reversivel.

Fronteira segura: resultado discriminado de sucesso/erro para todos os calculos, inclusive badges no DashboardRoute e detalhes remotos. Categorias iniciais: entrada invalida e falha de comparacao, sem mensagens internas, payloads ou stacks. Falha nunca equivale a zero alteracoes. Validacao de tamanho/serializacao tambem deve falhar fechada, nao retornar tamanho zero em erro.

## 6. Experiencia na aba existente

Expandir a aba Publicar, sem criar uma segunda tela com regras divergentes. Preservar design system e navegacao atuais.

1. Revisar: base do rascunho, revisao remota conhecida, estado do salvamento e contagens derivadas do mesmo diff. Filtros por area, tipo e pendencia; busca por nome/ID.
2. Comparar: antes/depois por campo, rotulos amigaveis centralizados e identificador secundario. Objetos extensos expandem progressivamente; imagens mostram preview/metadados, nao base64. Registros removidos podem ser inspecionados em modo somente leitura.
3. Resolver: "Sua versao", "Versao publicada" e "Resultado"; base consultavel. Acoes "Usar minha alteracao", "Usar alteracao publicada" e "Editar resultado" por conflito, com desfazer. Nao usar uma escolha global destrutiva como saida obrigatoria.
4. Validar: mostrar referencias quebradas e inconsistencias introduzidas pelo conjunto, mesmo que cada lado fosse valido isoladamente. Permitir corrigir C no editor sem descartar a sessao.
5. Confirmar: revisar R -> C e so entao publicar. Um merge automatico prepara o resultado, mas nao pula esta confirmacao.

Todos os itens devem ser acessiveis: pagina inicial de 50 registros, "Carregar mais" e expansao por campo. Contagem global nunca depende da pagina visivel. Adotar virtualizacao apenas se as medicoes demonstrarem necessidade; garantir acesso por teclado a todos os conflitos.

Desktop com comparacao em colunas; mobile empilhado com rotulos repetidos. Indicadores nao dependem somente de cor. Foco acompanha proximo conflito; status de progresso discreto, erros com `role="alert"` sem anuncio repetitivo. Nao inserir conteudo completo em aria-label ou logs.

Falha de diff: "Nao foi possivel comparar as alteracoes. Seu rascunho nao foi descartado." Oferecer tentar comparar, baixar copia e atualizar a versao publicada sem substituir o rascunho. Falha de detalhe remoto conserva a explicacao principal do conflito e bloqueia confirmacao ate haver revisao completa.

## 7. Orquestracao da publicacao

Extrair a logica de `PublishDashboard` para controlador/hook testavel com estados distintos: editando, salvando, comparando, resolvendo, pronto, publicando, resultado-incerto, concluido e falhas especificas.

1. Congelar B/L/geracao e salvar checkpoint. Buscar R sem alterar L.
2. Calcular merge, resolver e persistir escolhas. Se o remoto nao mudou, C corresponde a L.
3. Validar C com todas as validacoes de dominio, referencias e limite de 5 MiB. Calcular diff R -> C e registrar identidade da revisao apresentada.
4. Centralizar uma guarda para TODOS os caminhos de publicar/confirmar/retry: autenticacao, salvamento confirmado, diff valido, validacao aprovada, ausencia de conflitos, candidato revisado e nenhuma tentativa em andamento.
5. Persistir tentativa e enviar C com `expectedRevision = R.revision`, preservando a escrita condicional existente. Nunca oferecer force publish nem retry removendo a revisao esperada.
6. Se houver nova revisao R2, nao repetir cegamente nem apenas atualizar `baseRevision`. Com R e C preservados, reconciliar (R, C, R2); assim as escolhas anteriores viram a intencao local do novo ciclo. Exigir nova escolha apenas onde houver sobreposicao nova e nova revisao final. Se o primeiro ciclo ainda estava incompleto, recalcular B/L/R2 e reutilizar escolhas apenas quando entradas e dependencias correspondentes forem identicas.
7. Se a resposta falhar apos possivel gravacao, manter estado "resultado incerto" e todos os snapshots. Consultar a revisao atual: igualdade do payload permite informar que o conteudo esta publicado, nao provar a autoria daquela tentativa. Se o remoto ja avancou, reconciliar sem descartar. Identificacao inequivoca da tentativa exige suporte de idempotencia/historico no servidor, a especificar separadamente.
8. No sucesso confirmado, arquivar apenas a geracao enviada. Bloquear edicao do candidato durante o envio; se existir uma geracao posterior por evento assíncrono, preserva-la e abrir novo ciclo. Nunca executar limpeza global do rascunho por um callback atrasado.

Cancelamento, saida da aba, sessao expirada e recarregamento devem permitir retomar a sessao confirmada. Nao armazenar a reconciliacao apenas no estado efemero do componente de publicacao.

## 8. Sequencia de implementacao e aceite

### Etapa 1: testes de regressao e contencao

Adicionar cenarios que reproduzam troca prematura de base, refresh com exclusao remota, dupla aba e falha de persistencia. Impedir rebase silencioso e aplicar patches sobre base fixa enquanto houver rascunho. Introduzir guardas e diff seguro em todos os pontos de entrada, preservando exportacao independente da tela de diff.

Aceite: repetir publicacao apos conflito nao oculta sobreposicoes; refresh nao modifica L; erro de diff nao derruba a area de recuperacao.

### Etapa 2: workspace persistente e migracao

Implementar envelope, repositorio IndexedDB transacional, checkpoints, recuperacao, import/export e isolamento de sessoes. Migrar consumidores do formato de patches para L. Fazer a mudanca sem apagar o armazenamento antigo antes da confirmacao da migracao.

Aceite: recarregar retoma a ultima geracao confirmada, inclusive com conflito; quota/abort nunca resultam em falso "salvo"; arquivos legados sem base tem recuperacao assistida.

### Etapa 3: diff semantico e merge resolvivel

Extrair contratos, politicas por campo, caminhos tipados e rotulos. Implementar resultado parcial, decisoes reversiveis e validacao do candidato. Compartilhar semantica com resumo para nao divergir em ordem, identidade e exclusoes.

Aceite: cada mudanca local/remota aparece no resultado, como conflito pendente ou como decisao explicita; nenhuma mudanca desaparece sem explicacao.

### Etapa 4: interface e controlador

Integrar comparacao, filtros, resolucao, persistencia da sessao e revisao final. Substituir publicacao automatica pos-merge e callbacks de rebase/limpeza pelos contratos do controlador.

Aceite: duas pessoas editam o mesmo campo e campos diferentes, resolvem apenas a sobreposicao e publicam o resultado combinado sem descartar seus rascunhos originais.

### Etapa 5: concorrencia repetida e homologacao

Cobrir R2/R3 durante revisao, falha apos envio, mudanca de aba e limite de tamanho. Medir payloads proximos de 5 MiB com muitos registros e texto extenso. Indexar uma vez por snapshot, carregar detalhes sob demanda e impedir resultado assíncrono obsoleto de substituir calculo novo. Se calculo bloquear interacao, mover para worker preservando IDs de geracao e cancelamento.

Aceite: todos os cenarios de seguranca abaixo passam; executar `pnpm run check` com codigo 0 antes de finalizar commits para envio ou realizar push.

## 9. Matriz de testes obrigatoria

- Dominio: adicionar, editar, excluir, ausencia/null, mudanca identica nos dois lados e configuracao global.
- Estruturas: nos, escolhas, efeitos atomicos, blocos, referencias, IDs duplicados, IDs com pontuacao e colisoes de novas entidades.
- Ordenacao: movimento unilateral, bilateral compativel/incompativel, insercoes simultaneas e exclusao combinada com movimento.
- Invariantes: entradas imutaveis; merge(B,L,B)=L; merge(B,B,R)=R; merge(B,L,L)=L; resolucao e export/import deterministas.
- Concorrencia: editar/excluir nos dois sentidos, refresh sem alterar L, base inalterada enquanto pendente, R2/R3 e callback atrasado sem apagar nova geracao.
- Persistencia: requisicao bem-sucedida seguida de abort, indisponibilidade, quota, escritas fora de ordem, migracao interrompida, base ausente, arquivo corrompido e recuperacao de checkpoints.
- Multissessao: duas abas com alteracoes independentes, exclusao em outra aba e notificacao antiga sem substituir memoria ou armazenamento confirmado.
- Publicacao: nenhum caminho burla validacao/diff; resultado combinado invalido fica bloqueado; timeout apos possivel commit preserva tentativa; expiracao de autenticacao permite retomar.
- UI: resolver e desfazer por campo, corrigir resultado, acessar todos os itens, navegar para destino correto, inspecionar removidos, recarregar e retomar decisoes.
- Erros: falha local/remota de diff nao vira lista vazia nem expoe mensagem interna; exportacao permanece utilizavel.
- Acessibilidade/responsividade: teclado, foco, anuncios, textos longos, zoom 200%, mobile e desktop, usando Vitest/Testing Library onde aplicavel e teste em navegador para comportamento real.

## 10. Fora do escopo inicial

- Merge textual automatico, CRDT e edicao colaborativa em tempo real.
- Publicacao forcada ou escolha silenciosa de "ultima gravacao vence".
- Historico remoto e backup administrativo entre dispositivos: ampliam a recuperacao, mas exigem contrato proprio de acesso, retencao e exclusao. Nao usar a colecao publica de conteudo para guardar rascunhos privados.
- Redesenho visual geral: esta proposta aprimora a aba existente e preserva o sistema de design.

Recomendacao: entregar as etapas 1 e 2 primeiro como protecao estrutural, mas considerar a funcionalidade de diff/resolucao completa somente com as etapas 3 a 5. Uma tela antes/depois sem essas garantias nao resolve o problema original.

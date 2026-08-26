# Visualização de Fluxos — Mapa por Destino

## Status

Design detalhado para confirmação. Este documento não autoriza implementação.

> **Atualização (2026-08-25):** a fase de paridade descrita em
> `docs/plans/2026-08-25-map-first-flow-editing-design.md` foi implementada — a edição
> agora vive no mapa: o painel lateral (`NodeEditorPanel`) edita etapas, opções, efeitos,
> ramificações e mídia, e o cabeçalho do mapa ganhou o painel de configurações do fluxo.
> O editor de formulários permanece como fallback até a remoção planejada na fase 3.

## Contexto

O dashboard hoje oferece um mapa mental por fluxo. Ele ajuda a inspecionar relações locais entre etapas, mas não responde com clareza às perguntas principais de quem revisa o conteúdo:

1. Como o fluxo inteiro está organizado?
2. Onde cada escolha pode terminar?
3. Quais destinos encerram a conversa, abrem outra área ou iniciam outro fluxo?
4. Como os fluxos se conectam entre si?

As primeiras alternativas exploradas também não resolviam completamente o problema:

- Percorrer um caminho por vez escondia o restante da estrutura.
- Lanes com nomes como "autocuidado" exigiam interpretação que não existe no modelo.
- Ícones específicos por mensagem exigiam curadoria manual.
- Descrições como "abre espaço para..." criavam um novo trabalho editorial sem fonte confiável.

O redesenho precisa representar somente dados armazenados ou propriedades calculadas de forma determinística.

## Objetivo

Transformar `Mapa visual` em duas visualizações complementares:

- **Mapa por destino**, a visualização principal: mostra a estrutura completa do fluxo selecionado e mantém todos os finais e saídas explícitos.
- **Visão geral**, a visualização secundária: mostra os fluxos como unidades e somente as conexões entre eles e destinos externos.

O mapa por destino resolve a revisão detalhada. A visão geral responde onde um fluxo começa ou termina dentro do sistema, sem tentar mostrar todos os seus nós ao mesmo tempo.

## Público e modo de uso

O usuário é um administrador ou editor de conteúdo que está revisando fluxos determinísticos antes de publicar. Ele já conhece o conteúdo e precisa encontrar problemas estruturais, não receber interpretações sobre o significado das mensagens.

Esta é uma superfície de **operação**:

- leitura rápida da topologia;
- confirmação de destinos;
- localização de etapas;
- inspeção e navegação para edição;
- identificação de conexões quebradas ou etapas inalcançáveis.

## Decisões centrais

| Tema                            | Decisão                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| Visualização padrão             | `Mapa por destino` do fluxo selecionado                    |
| Visualização secundária         | `Visão geral` com um nó por fluxo                          |
| Fonte dos rótulos               | Dados existentes e rótulos genéricos do sistema            |
| Organização do mapa             | Profundidade calculada a partir da entrada                 |
| Finais e saídas                 | Última coluna do mapa e resumo persistente acima do canvas |
| Sequências longas               | Agrupamento estrutural automático, expansível              |
| Edição                          | Inspeção ao clicar; edição completa no editor existente    |
| Layout manual                   | Não haverá posicionamento salvo nem arraste persistente    |
| Inferência por IA               | Não haverá                                                 |
| Alteração do modelo de conteúdo | Não haverá                                                 |

## Princípio de integridade dos dados

Cada elemento visual precisa responder a uma fonte objetiva.

### Dados armazenados permitidos

| Elemento               | Fonte                                          |
| ---------------------- | ---------------------------------------------- |
| Nome do fluxo          | `GuidedFlow.title`                             |
| Identificador do fluxo | `GuidedFlow.id`                                |
| Status                 | `GuidedFlow.status`                            |
| Entrada                | `GuidedFlow.entry.nodeId`                      |
| Ordem editorial        | `GuidedFlow.nodeOrder`, quando presente        |
| Texto da etapa         | `FlowNode.text`                                |
| Tipo da etapa          | `FlowNode.kind`                                |
| Rótulo da opção        | `FlowOption.label`                             |
| Próxima etapa          | `FlowOption.next` ou `freeText.next`           |
| Faixa de pontuação     | `ScoreBranch.min`, `max` e `next`              |
| Pontuação aplicada     | efeito `score`                                 |
| Segurança              | efeitos `safety_interrupt` e `deferred_safety` |
| Outro fluxo            | efeito `flow_start`                            |
| Outra área             | efeito `navigate`                              |
| Encerramento           | efeito `end_flow` ou nó `result`               |

### Propriedades calculadas permitidas

- profundidade da etapa a partir da entrada;
- quantidade de conexões de entrada e saída;
- nós alcançáveis e inalcançáveis;
- ciclos e componentes fortemente conectados;
- resultados e saídas alcançáveis por uma etapa;
- conexões entre fluxos;
- sequências estruturalmente lineares;
- contagens de etapas, finais, ramificações e rotas de segurança.

### Conteúdo que não será criado

- nomes interpretativos para rotas;
- categorias como "autocuidado", "rota leve" ou "rota principal";
- resumos do significado de mensagens;
- explicações editoriais de efeitos;
- ícones escolhidos a partir do texto da mensagem;
- recomendações automáticas;
- novos campos para documentar cada etapa.

## Arquitetura da superfície

O fluxo continua sendo escolhido na barra lateral existente do dashboard. O mapa não duplica esse seletor.

Dentro da aba `Mapa visual`, a hierarquia será:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Mapa por destino                         [Por destino] [Visão geral] │
│ Veja todas as etapas e confirme onde cada escolha termina.          │
├────────────────────────────────────────────────────────────────────┤
│ 24 etapas · 3 finais · 1 saída externa · 1 conexão com outro fluxo │
│ Destinos: [Resultado 1] [Resultado 2] [/apoio] [Fluxo: Descanso]   │
├────────────────────────────────────────────────────────────────────┤
│ [Buscar etapa] [Rótulos ✓] [Expandir sequências] [Ajustar tudo]    │
├────────────────────────────────────────────────────────────────────┤
│ Entrada    Prof. 1       Prof. 2       ...       Finais e saídas   │
│                                                                    │
│ [Etapa] ── [Etapa] ───── [Grupo linear] ──────── [Resultado]       │
│       └─── [Etapa] ───── [Ramificação] ───────── [/apoio]          │
│                                      └─────────── [Outro fluxo]     │
└────────────────────────────────────────────────────────────────────┘
```

## Visualização principal: Mapa por destino

### Trabalho da tela

O mapa deve permitir que uma pessoa identifique, sem escolher uma rota:

- a etapa de entrada;
- todas as ramificações;
- todas as convergências;
- todas as sequências longas;
- todos os resultados;
- todas as navegações externas;
- todos os handoffs para outros fluxos;
- etapas que não podem ser alcançadas desde a entrada.

### Cabeçalho

O cabeçalho usa:

- título: **Mapa por destino**;
- descrição: **Veja todas as etapas e confirme onde cada escolha termina.**;
- seletor de modo: `Por destino` e `Visão geral`;
- nome do fluxo já permanece visível na barra lateral e não é repetido como um grande título.

### Resumo estrutural

Abaixo do cabeçalho, uma linha compacta mostra contagens derivadas:

- etapas;
- finais;
- saídas externas;
- conexões para outros fluxos;
- rotas de segurança.

Não são métricas de uso. Não haverá gráficos, percentuais, importância ou frequência.

### Índice de destinos

Uma faixa persistente mostra todos os destinos do fluxo antes do canvas.

Tipos de destino:

| Tipo               | Rótulo                           |
| ------------------ | -------------------------------- |
| Nó `result`        | `Etapa N · {trecho do texto}`    |
| `navigate`         | valor exato, como `/apoio`       |
| `safety_interrupt` | `Segurança imediata · /apoio`    |
| `deferred_safety`  | `Segurança ao concluir · /apoio` |
| `flow_start`       | `Fluxo · {GuidedFlow.title}`     |
| `end_flow`         | `Encerramento`                   |
| Destino inválido   | `Destino ausente · {id}`         |

Selecionar um destino destaca no canvas todas as etapas que conseguem alcançá-lo. Esse destaque é calculado por busca reversa no grafo; ele não interpreta o conteúdo.

### Toolbar

Controles previstos:

- **Buscar etapa**: busca por número, ID ou texto existente;
- **Mostrar rótulos das opções**: ligado por padrão; pode ser desligado em mapas densos;
- **Expandir sequências**: expande todos os grupos lineares;
- **Ajustar tudo**: enquadra a topologia completa;
- controles existentes de zoom e minimapa.

Não haverá alternância entre categorias semânticas de rota.

### Colunas de profundidade

As etapas são organizadas da esquerda para a direita pela menor distância estrutural desde a entrada:

- `Entrada` para profundidade zero;
- `Prof. 1`, `Prof. 2` e assim por diante;
- `Finais e saídas` como última região lógica.

A profundidade é uma propriedade de layout, não uma ordem editorial. O número `Etapa N` continua vindo de `nodeOrder` ou da ordem estável já usada pelo dashboard.

### Nós

Todos os nós compartilham a mesma estrutura base:

1. rótulo semântico do tipo;
2. `Etapa N`;
3. trecho do texto existente;
4. ID em segundo plano visual;
5. conectores individuais para cada opção ou faixa.

O trecho do texto tem limite visual, mas o texto completo permanece disponível no inspetor e em tooltip acessível.

#### Tipos visuais

| Tipo             | Forma e semântica                                             |
| ---------------- | ------------------------------------------------------------- |
| `choice`         | retângulo; ícone genérico de mensagem                         |
| `score_branch`   | losango ou retângulo chanfrado; ícone genérico de ramificação |
| `result`         | nó de destino; ícone genérico de bandeira                     |
| Destino externo  | nó de destino; ícone genérico de link externo                 |
| Destino inválido | nó de erro; ícone genérico de alerta                          |
| Sequência linear | contêiner de etapas; ícone genérico de lista                  |

Nenhum ícone é definido pelo assunto da mensagem.

### Conectores e rótulos

Cada opção recebe sua própria porta de saída. Isso impede que várias escolhas compartilhem uma linha indistinguível.

| Transição          | Aparência                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `next` normal      | linha sólida neutra                                                                            |
| `freeText.next`    | linha sólida com rótulo `Resposta livre`                                                       |
| efeito `score`     | mesma linha normal com badge exato, como `+1 · srq20`                                          |
| `score_branch`     | linha sólida com faixa exata, como `0–6`                                                       |
| `flow_start`       | linha azul tracejada até o fluxo de destino                                                    |
| `navigate`         | linha azul até o caminho exato                                                                 |
| `safety_interrupt` | linha de alerta até o destino imediato                                                         |
| `deferred_safety`  | linha normal para a próxima etapa e indicador secundário tracejado `ao concluir` até o destino |
| `end_flow`         | linha até `Encerramento`                                                                       |

O rótulo principal da linha é sempre o texto exato da opção ou da faixa. Badges adicionais usam somente valores do efeito.

### Resultados e saídas

Resultados não ficam espalhados entre as perguntas. Eles são alinhados na última região do grafo, permitindo comparar a disposição completa.

Quando vários caminhos chegam ao mesmo resultado, as linhas convergem para um único nó. O mapa não duplica o resultado por rota.

Destinos externos e outros fluxos aparecem na mesma região, mas com tipo visual diferente. Assim, a pessoa consegue distinguir:

- termina com mensagem;
- termina e navega;
- interrompe por segurança;
- continua em outro fluxo.

### Sequências longas

Fluxos como SRQ-20 possuem muitas etapas consecutivas cuja topologia é linear: várias opções diferentes levam ao mesmo próximo nó.

Para evitar 20 colunas minúsculas, o mapa agrupa automaticamente uma sequência quando:

1. existem quatro ou mais nós consecutivos;
2. cada nó tem exatamente um próximo nó local distinto, mesmo que várias opções levem a ele;
3. o nó não inicia outro fluxo nem encerra imediatamente;
4. não existe uma convergência ou ramificação estrutural no meio da sequência.

O agrupamento não remove etapas. O bloco mostra:

- intervalo, como `Etapas 3–22`;
- quantidade, como `20 etapas`;
- uma régua com todos os números das etapas;
- marcadores semânticos onde existem `score`, segurança ou vídeos;
- primeira e última etapa com trecho de texto.

Ao expandir, todas as etapas aparecem em uma lista interna ou como nós completos. O estado expandido é apenas de interface e não é salvo no conteúdo.

No SRQ-20, a visão compacta deve deixar visíveis, ao mesmo tempo:

- consentimento;
- instruções;
- sequência das 20 perguntas;
- marcador de segurança da Q17;
- ramificação por pontuação;
- dois resultados;
- destino adiado de segurança.

### Nós inalcançáveis

Nós que não são alcançados pela entrada não são misturados ao caminho principal. Eles aparecem em uma faixa inferior chamada **Fora do caminho de entrada**.

Cada nó mantém suas conexões, quando existirem. A faixa usa aviso visual e contagem, mas não bloqueia inspeção ou edição.

### Ciclos

Ciclos são suportados sem recursão infinita:

- nós do mesmo componente cíclico ficam na mesma região de profundidade;
- a aresta de retorno usa uma curva externa com rótulo exato;
- o grupo recebe o rótulo genérico `Ciclo`;
- o agrupamento linear nunca atravessa um ciclo.

## Visualização secundária: Visão geral

### Trabalho da tela

A visão geral responde somente:

- quais fluxos existem;
- quais fluxos iniciam outros fluxos;
- quais fluxos navegam para áreas externas;
- quais fluxos estão desconectados;
- quantas etapas e finais cada fluxo possui.

Ela não tenta mostrar os nós internos. Isso reduz a complexidade do antigo conceito de atlas e deixa clara a diferença entre visão do sistema e revisão de um fluxo.

### Estrutura

Cada fluxo é um nó com:

- título;
- status;
- quantidade de etapas;
- quantidade de finais;
- conexões de entrada;
- conexões de saída.

As arestas representam apenas:

- `flow_start` entre fluxos;
- `navigate` para destinos externos;
- `safety_interrupt` para destinos externos;
- `end_flow` para encerramento, quando útil para o contexto geral.

O rótulo da aresta é a opção exata que dispara a transição. Não existem cores de rota ou categorias inferidas.

### Interação

- clicar em um fluxo o seleciona na barra lateral e abre seu `Mapa por destino`;
- clicar em uma conexão mostra a etapa de origem, a opção exata, o tipo de efeito e o destino;
- fluxos sem conexões aparecem em uma região `Sem conexões com outros fluxos`;
- busca por título ou ID destaca o fluxo sem ocultar o restante do sistema;
- `Ajustar tudo` enquadra todos os fluxos.

## Inspetor

O inspetor existente continua sendo a camada de detalhe do mapa.

Ao selecionar um nó, ele mostra apenas dados existentes:

- tipo;
- ID;
- texto completo;
- opções;
- próximo nó por opção;
- efeitos tipados com seus valores;
- faixas de score;
- vídeos e recomendações, quando existirem;
- conexões de entrada calculadas;
- destinos alcançáveis calculados.

A ação principal é **Editar etapa**. Em um handoff, selecionar o destino e editar deve trocar para o fluxo correto antes de abrir o editor.

Não haverá edição direta de conexões pelo canvas na primeira versão.

## Estados da interface

### Carregamento

O mapa usa a estrutura já disponível em memória. Se o layout for calculado de forma assíncrona, mostra um skeleton da área do canvas com o texto `Organizando o mapa…`.

### Fluxo vazio

Mensagem: `Este fluxo ainda não possui etapas.`

Ação: `Adicionar primeira etapa`, reutilizando a ação existente.

### Somente resultado

O resultado aparece simultaneamente como entrada e destino, com a indicação `Entrada e final`.

### Destino ausente

A ligação termina em um nó de erro `Destino ausente · {id}`. Selecioná-lo abre orientação para editar a opção de origem.

### Fluxo de destino ausente

Um `flow_start` inválido termina em `Fluxo ausente · {flowId}`.

### Busca sem resultado

Mensagem acima do canvas: `Nenhuma etapa corresponde à busca.` O mapa permanece visível, sem esconder a topologia.

### Conteúdo extenso

Textos longos são truncados visualmente. Nunca aumentam indefinidamente o tamanho do nó nem são quebrados caractere por caractere.

## Responsividade

### Desktop amplo

- mapa e destinos ocupam toda a largura disponível;
- inspector abre à direita;
- sequência compacta é o padrão;
- pan horizontal é permitido sem reduzir os nós abaixo do tamanho de leitura.

### Desktop estreito e tablet

- resumo de destinos vira uma faixa horizontal rolável;
- inspector abre como painel sobreposto pela direita;
- canvas mantém escala de leitura e usa pan;
- controles de menor prioridade entram em menu `Mais opções`.

### Mobile

O dashboard não tenta encaixar o grafo inteiro na largura da tela.

- cabeçalho e toolbar empilham;
- destinos aparecem primeiro como lista horizontal;
- canvas usa pan em ambas as direções;
- minimapa permanece disponível;
- selecionar um nó abre um bottom sheet;
- `Ajustar tudo` continua disponível, mas não é o zoom inicial;
- a escala inicial foca entrada, primeira ramificação e destinos resumidos.

O mapa nunca reduz texto até ficar ilegível para afirmar que tudo está "visível".

## Acessibilidade

- seletor `Por destino` / `Visão geral` usa botões com `aria-pressed`;
- canvas possui nome acessível com o título do fluxo;
- nós são focáveis e descrevem tipo, etapa e trecho de texto;
- cada porta de opção possui nome acessível com opção e destino;
- arestas selecionáveis recebem equivalente no inspetor; informação não depende apenas de linha ou cor;
- ordem de tabulação segue entrada, profundidades e destinos;
- busca move foco para o nó encontrado;
- zoom não é requisito para acessar o texto completo;
- contraste mínimo de texto é 4.5:1;
- animações de foco respeitam `prefers-reduced-motion`;
- alertas de segurança usam ícone, texto e cor, nunca somente cor.

## Linguagem visual

O mapa preserva o sistema atual do BemTeVi:

- fundo claro;
- verde como ação e seleção;
- azul para transições entre fluxos e destinos externos;
- âmbar e vermelho somente para efeitos de segurança tipados;
- Nunito em títulos e Source Sans 3 em conteúdo;
- cantos entre 12 e 16 px em superfícies principais;
- linhas e divisores leves em vez de sombras decorativas.

A expressão visual fica concentrada na organização das linhas e destinos. Não haverá ilustrações, gradientes, glassmorphism ou ícones decorativos.

## Regras de cálculo

### Resolução de uma opção

A visualização segue a mesma precedência do runtime:

1. `safety_interrupt` encerra o fluxo ativo e navega para seu destino;
2. `navigate` encerra o fluxo ativo e navega para seu destino;
3. `end_flow` encerra o fluxo;
4. `flow_start` inicia a entrada do fluxo de destino;
5. sem efeito terminal, a opção segue para `option.next`;
6. `deferred_safety` acompanha o caminho normal e também registra a saída adiada;
7. `score` acompanha o caminho normal e anota a alteração exata.

Efeitos múltiplos precisam ser representados na mesma opção sem criar uma categoria composta inventada.

### Profundidade

- começa em zero no nó de entrada;
- usa menor distância por arestas locais;
- não atravessa `flow_start` para calcular a profundidade do fluxo atual;
- componentes cíclicos compartilham uma profundidade estável;
- nós inalcançáveis não recebem profundidade principal.

### Destinos alcançáveis

- busca todos os terminais alcançáveis por cada nó;
- memoriza resultados para evitar recomputação;
- interrompe busca em ciclos já visitados;
- preserva destinos distintos mesmo quando compartilham o mesmo caminho textual;
- inclui destinos diferidos como possibilidade separada, sem substituir o caminho normal.

### Ordem visual

Dentro da mesma profundidade:

1. `nodeOrder`, quando disponível;
2. ordem estável de `flow.nodes`;
3. ID como último desempate.

O layout não salva coordenadas e não altera `nodeOrder`.

## Faixas suportadas

Primeira versão deve permanecer utilizável com:

- 1 a 50 fluxos na visão geral;
- 1 a 100 nós por fluxo;
- 1 a 12 opções por etapa;
- 1 a 20 destinos por fluxo;
- sequências lineares de até 50 etapas;
- ciclos e nós desconectados.

O caso de referência para densidade é SRQ-20, não apenas os fluxos curtos de 3 a 7 nós.

## Consequências técnicas previstas

Sem implementar ainda, a separação de responsabilidades esperada é:

| Responsabilidade                            | Módulo previsto                     |
| ------------------------------------------- | ----------------------------------- |
| Resolver transições conforme runtime        | utilitário puro de topologia        |
| Calcular profundidade, ciclos e alcance     | utilitário puro de análise de grafo |
| Agrupar sequências lineares                 | utilitário puro de compactação      |
| Produzir nós e arestas da visão por destino | layout do mapa por destino          |
| Produzir conexões entre fluxos              | layout da visão geral               |
| Renderizar o mapa principal                 | componente `FlowDestinationMap`     |
| Renderizar a visão geral                    | componente `FlowOverviewMap`        |
| Inspecionar nó/aresta/destino               | evolução de `FlowMapInspector`      |

O domínio `GuidedFlow` não muda. O cálculo precisa ser testável sem React.

## Escopo

### Incluído

- mapa por destino completo para o fluxo selecionado;
- visão geral entre fluxos;
- layout automático;
- destinos persistentes;
- compactação de sequências;
- busca e destaque;
- inspeção;
- tratamento de ciclos, destinos inválidos e nós inalcançáveis;
- responsividade e teclado.

### Fora de escopo

- criar ou conectar nós arrastando no mapa;
- salvar posições manuais;
- reproduzir a conversa passo a passo;
- estimar frequência de rotas;
- usar analytics para espessura de linha;
- classificar rotas por significado;
- gerar descrições ou ícones com IA;
- adicionar campos de documentação ao fluxo;
- substituir o editor ou o teste de conversa existentes.

## Critérios de aceitação

1. Ao abrir `Mapa visual`, a pessoa vê todos os destinos do fluxo sem escolher uma rota.
2. A entrada, ramificações, convergências e destinos são identificáveis sem abrir o inspetor.
3. Cada opção pode ser seguida visualmente até sua próxima etapa por uma porta própria.
4. Resultados, navegações, segurança imediata, segurança adiada, encerramentos e outros fluxos têm semânticas distintas e derivadas do tipo.
5. O SRQ-20 cabe em uma visão estrutural compreensível usando agrupamento linear, sem ocultar a existência das 20 perguntas.
6. Expandir a sequência do SRQ-20 torna todas as perguntas individualmente acessíveis.
7. A Q17 mostra simultaneamente a continuação normal e o destino de segurança adiado.
8. Um `flow_start` aponta para a entrada correta do outro fluxo e não para o `option.next` local.
9. A visão geral mostra todos os fluxos e todas as conexões `flow_start` sem inferir categorias.
10. Nós inalcançáveis e destinos ausentes aparecem explicitamente.
11. Nenhum novo campo de conteúdo é necessário.
12. Nenhum rótulo depende de interpretação do texto.
13. O mapa permanece navegável por teclado e em viewport móvel.
14. Texto de nó nunca é reduzido abaixo do tamanho de leitura para encaixar o grafo inteiro.

## Plano de validação futuro

### Testes de topologia

- precedência de efeitos igual ao runtime;
- opção normal e `freeText`;
- score e score branch;
- segurança imediata e adiada;
- handoff entre fluxos;
- ciclo;
- convergência;
- nó inalcançável;
- destino ausente;
- sequência linear compactável e não compactável;
- alcance de múltiplos destinos.

### Testes de interface

- alternância entre as duas visualizações;
- busca e foco;
- seleção de destino e destaque reverso;
- expansão de sequência;
- seleção de nó e abertura do inspetor;
- edição de nó em outro fluxo;
- estados vazios e inválidos;
- semântica de teclado e leitor de tela.

### Verificação visual

- fluxo curto com ramificação;
- fluxo com convergência;
- fluxo com handoff;
- SRQ-20 compacto e expandido;
- desktop amplo, desktop estreito e mobile;
- alto contraste e movimento reduzido.

## Resultado esperado

O mapa deixa de ser uma representação genérica de nós e passa a responder duas perguntas concretas:

- **No fluxo selecionado:** onde cada escolha termina?
- **No sistema:** quais fluxos levam a quais outros fluxos ou áreas?

Ele faz isso sem exigir documentação adicional, categorização inteligente ou personalização por mensagem.

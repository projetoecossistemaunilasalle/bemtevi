# Design Doc: Melhorias de Layout na Aba "Materiais" do Dashboard

**Data:** 2026-07-21  
**Status:** Aprovado  
**Objetivo:** Melhorar a usabilidade e a experiência de edição na aba "Materiais" do Dashboard, introduzindo uma pré-visualização em tempo real da "Fonte do material" e reestruturando o "Conteúdo do material" em blocos sanfona (accordion) com ferramentas rápidas de reordenação.

---

## 1. Problema Atual

1. **"Fonte do material" sem pré-visualização no Dashboard:**  
   Os usuários inserem citações ABNT e links no campo de texto da fonte sem saber como as badges e os links extraídos serão renderizados nos cartões da Biblioteca de Estudos.

2. **"Conteúdo do material" poluído e com rolagem excessiva:**  
   Todos os blocos do conteúdo (parágrafos, imagens, vídeos, títulos, etc.) são renderizados permanentemente expandidos. Em materiais com múltiplos blocos, a página fica extremamente longa. Reordenar blocos exige clicar em "Mover para cima/baixo" em cartões gigantes, fazendo o usuário perder a referência visual e ter que rolar a tela repetidamente.

---

## 2. Soluções Projetadas

### 2.1. Pré-visualização em Tempo Real para "Fonte do material"

- **Localização:** Logo abaixo do campo de texto `Fonte do material` em `EducationDashboard.tsx`.
- **Lógica de Processamento:**
  - Invoca `parseSourceCitations(selectedResource.source)` para separar citações individuais (por quebra de linha ou `/`) e detectar URLs/DOIs automaticamente.
  - Invoca `formatCitationSourceLabel(citation.rawText)` para gerar o selo/badge resumido (ex: `IBGE`, `SILVA et al.`).
- **Interface:**
  - Renderiza uma caixa de pré-visualização (`bg-surface-container-low`, `border border-outline-variant/30`).
  - Exibe badges `<Badge tone="secondary">` idênticos aos exibidos nos cartões de `EducationLibraryScreen.tsx`.
  - Exibe uma lista com o texto original da citação e o link reconhecido.
  - Exibe mensagem sutil quando o campo estiver vazio.

---

### 2.2. Reorganização do "Conteúdo do material" (Accordion + Reordenação Rápida)

- **Estado dos Blocos:**
  - Gerenciamento de estado `expandedBlockIds` (`Set<string>` ou array de IDs expandidos).
  - Novos blocos adicionados são automaticamente expandidos.
  - Por padrão, o primeiro bloco inicia expandido (ou todos recolhidos para síntese limpa).
- **Barra de Ferramentas Superior:**
  - Exibe o número total de blocos (ex: *"4 blocos de conteúdo"*).
  - Botões para **"Expandir todos"** e **"Recolher todos"**.
- **Cartão de Bloco Expansível (`BlockItem`):**
  - **Modo Recolhido (Padrão):**
    - Cabeçalho clicável exibindo o número e tipo do bloco (ex: `Bloco 1 • Parágrafo`).
    - Trecho/resumo do conteúdo (título do parágrafo/cabeçalho, miniatura de imagem, título do vídeo, etc.).
    - Botões rápidos no cabeçalho: `▲ Mover para cima`, `▼ Mover para baixo`, `Remover` (com confirmação) e ícone de seta para expandir/recolher.
  - **Modo Expandido:**
    - Revela os campos de edição (`BlockFields`) envolvidos por uma borda sutil com destaque visual.

---

## 3. Arquivos Impactados

- `src/dev-dashboard/education/EducationDashboard.tsx`
  - Adição do componente de pré-visualização de fontes.
  - Adição do estado de expansão de blocos.
  - Refatoração da seção de "Conteúdo do material" com cabeçalho compacto, accordion e botões de ação.
- `src/dev-dashboard/education/__tests__/EducationDashboard.test.tsx` (ou testes de rota do dashboard se aplicável).

---

## 4. Plano de Verificação

1. **Testes Automatizados:**  
   Executar a suíte de testes do dashboard para garantir que adicionar, mover, editar e remover blocos continue funcionando sem regressões.
2. **Verificação Manual:**  
   Testar a digitação de fontes e a navegação/reordenação de blocos no ambiente de desenvolvimento (`pnpm run dev` ou testes unitários).

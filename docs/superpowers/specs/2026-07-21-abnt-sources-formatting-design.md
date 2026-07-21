# Design Spec: Suporte a Fontes Bibliográficas ABNT e Detecção Automática de Links

**Data:** 2026-07-21  
**Status:** Aprovado pelo usuário  

---

## 1. Visão Geral

Atualmente, o campo de fonte (`source`) no Dashboard e nos blocos de fonte (`sourceLink`) espera texto simples ou exige uma URL HTTP/HTTPS direta. No entanto, usuários precisam cadastrar referências bibliográficas completas no padrão ABNT (por exemplo, citações de artigos e livros acadêmicos com múltiplos autores e formatações específicas), separadas por barra (`/`) ou quebras de linha, podendo ou não conter links embutidos no texto.

Esta especificação define a reformulação do cadastro e exibição de fontes no Dashboard e no aplicativo BemTeVi, adicionando:
1. Suporte a citações ABNT em texto com múltiplos itens (separados por `/` ou novas linhas).
2. Detecção automática de links/URLs dentro do texto da citação ABNT com estilização interativa.
3. Apresentação visual limpa, elegante e acessível tanto no Dashboard quanto na Tela de Detalhes do Material e na Biblioteca de Estudos.

---

## 2. Requisitos Técnicos e Arquitetura

### 2.1. Utilitário de Parsing de Citações (`src/features/education/sourceFormatter.ts`)

Criar uma função utilitária pura `parseSourceCitations(sourceText: string)` que:
* Recebe a string de fontes armazenada em `resource.source` ou em blocos `sourceLink`.
* Divide a string em citações individuais utilizando `/` ou quebras de linha `\n` como delimitadores.
* Limpa espaços em branco nas extremidades (`trim()`) e filtra entradas vazias.
* Para cada citação individual, identifica trechos de texto e trechos de URL/link utilizando expressão regular (suportando `http://`, `https://`, `www.`, `doi.org`).
* Retorna uma estrutura de objetos formatados contendo:
  ```ts
  export interface CitationSegment {
    kind: 'text' | 'link';
    content: string;
    url?: string;
  }

  export interface ParsedCitation {
    id: string;
    rawText: string;
    segments: CitationSegment[];
  }
  ```

### 2.2. Componente de Exibição de Citações (`src/features/education/SourceCitationsView.tsx`)

Criar um componente React reutilizável `SourceCitationsView` que:
* Recebe `sourceText: string` (e opcionalmente classe CSS / variante visual).
* Renderiza cada citação ABNT formatada como um item em um card/lista de referências.
* Renderiza segmentos de link com o estilo de link clicável do sistema design (cor primária, hover com sublinhado suave, ícone `<ExternalLink />` e atributos de segurança `target="_blank" rel="noreferrer"`).

### 2.3. Dashboard (`src/dev-dashboard/education/EducationDashboard.tsx`)

* **Campo "Fonte do material"**:
  * Substituir o `<input>` de linha única por um `<textarea>` expansível com linhas suficientes (ex: 3 a 5 linhas).
  * Adicionar dica explicativa (`FieldHint`): *"Informe as fontes ou referências ABNT do material. Se houver mais de uma citação, separe-as com uma barra (/) ou quebra de linha. Links inseridos no texto serão detectados automaticamente."*
* **Bloco `sourceLink` (Conteúdo do Material)**:
  * Permitir que o campo de URL seja opcional quando o rótulo/texto da fonte contiver uma citação ABNT com ou sem link.

### 2.4. Validação (`src/dev-dashboard/education/educationValidation.ts`)

* Atualizar a validação para permitir citações ABNT no campo `source` e no bloco `sourceLink` sem exigir obrigatoriamente uma URL iniciada por `http://` no campo de URL isolado, caso o texto da citação contenha as informações da fonte.

### 2.5. Telas do Usuário (`ResourceDetailScreen.tsx` e `EducationLibraryScreen.tsx`)

* **`ResourceDetailScreen.tsx`**:
  * Substituir a exibição genérica de badge simples no cabeçalho e no bloco `sourceLink` por um card dedicado de **Fontes e Referências** utilizando `SourceCitationsView`.
* **`EducationLibraryScreen.tsx`**:
  * Exibir no cartão da biblioteca um resumo limpo da fonte principal/primeira citação ABNT parsed.

---

## 3. Plano de Testes e Verificação

1. **Testes Unitários (`sourceFormatter.test.ts`)**:
   * Testar divisão de strings por `/` e por `\n`.
   * Testar detecção de URLs HTTP, HTTPS e www dentro de texto ABNT.
   * Testar citações ABNT puras sem link.
2. **Testes de Validação (`educationValidation.test.ts`)**:
   * Verificar que fontes ABNT multi-linhas ou com barra não geram erros de validação no Dashboard.
3. **Verificação de Build e Lint**:
   * Executar `npm test` e `npx tsc --noEmit` para garantir ausência de regressões e tipos corretos.

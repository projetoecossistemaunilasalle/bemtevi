# Infográfico & Padronização: Respiração Consciente 4-2-6 para Educadores

**Contexto:** Harmonização de Práticas Respiratórias no Aplicativo BemTeVi  
**Repositório:** BemTeVi — Apoio à Saúde Mental de Educadores  
**Data:** Setembro de 2026  
**Arquivos Visuais:** `public/flow-visuals/infografico-respiracao-426.jpg` e `public/infografico-respiracao-426.jpg`

---

## 1. Contexto e Motivação da Harmonização

Antes da padronização, diferentes seções da aplicação e da documentação apresentavam referências desencontradas:

- Na tela de **Apoio** (`src/design-system/components/BreathingExercise.tsx`), o exercício interativo guiado já utilizava o padrão canônico:
  - **Inspire:** 4 segundos
  - **Segure:** 2 segundos
  - **Solte / Expire:** 6 segundos (ritmo 4-2-6 com som ambiente suave)
- Em documentos de apoio imediato (`docs/fronts/08-immediate-support.md`), havia menções a contagens 4-4-4 ("box breathing" quadrado).
- Em fluxos guiados e materiais externos, havia menções a vídeos de 1m50s ou referências desatualizadas.

**Decisão Editorial e Clínica:**  
Unificar **100% das referências** no padrão canônico **4-2-6**, alinhando a experiência do educador em qualquer ponto de contato do aplicativo com a ferramenta interativa de apoio imediato.

---

## 2. Fundamentação Neurofisiológica do Ritmo 4-2-6

A técnica de respiração com fase expiratória prolongada (proporção 1 : 0,5 : 1,5) apoia-se em sólidas evidências da neurociência e da psicologia clínica aplicada à regulação autonômica:

1. **Ativação do Sistema Nervoso Parassimpático (Via Vagal):**
   - A inspiração acelera sutilmente a frequência cardíaca (inibição vagal transitória).
   - A expiração lenta e prolongada (6 segundos) estimula o **nervo vago**, liberando acetilcolina no nodo sinoatrial e promovendo a desaceleração reflexa dos batimentos cardíacos (arritmia sinusal respiratória benéfica).
2. **Pausa Restauradora de 2 Segundos:**
   - A retenção breve de 2 segundos com pulmões confortavelmente cheios permite a troca gasosa alveolar adequada sem gerar sensação de sufocamento ou hipercapnia que pudesse disparar ansiedade em pessoas hipervigilantes.
3. **Descompressão Muscular:**
   - Ao soltar o ar durante 6 segundos contínuos, há relaxamento mecânico da musculatura acessória da respiração (trapézios, escalenos, ombros e mandíbula), frequentemente tensionada pelo estresse crônico de sala de aula.
4. **Segurança e Acessibilidade:**
   - Ao contrário de técnicas de hiperventilação ou retenções longas (como 4-7-8, que podem causar tontura em iniciantes), a proporção 4-2-6 é suave, segura e pode ser praticada discretamente em qualquer pausa entre aulas ou na sala dos professores.

---

## 3. Blueprint e Estrutura Visual do Infográfico

O infográfico gerado (`infografico-respiracao-426.jpg`) adota com rigor as diretrizes de identidade visual do BemTeVi:

### Paleta Cromática:

- **Verde Floresta Primário:** `#006A43` / `#004214` (transmite acolhimento, solidez e serenidade)
- **Verde Esmeralda Container:** `#188557` / `#009D45` (indica progresso e renovação)
- **Amarelo Âmbar de Acento:** `#FFB900` (luminosidade, acolhimento e calor humano)
- **Fundo Off-White Suave:** `#F9F9FF` (alto contraste sem fadiga ocular)

### Arquitetura de Informação:

1. **Cabeçalho Acolhedor:**
   - Título: _Pausa e Respiração: O Ciclo 4-2-6_
   - Subtítulo: _Uma técnica simples e comprovada para desacelerar o corpo e acalmar a mente_
2. **Ciclo Visual Central em 3 Fases:**
   - **Fase 1 — Inspire (4s):** Puxar o ar suavemente pelo nariz, sentindo o abdômen expandir.
   - **Fase 2 — Segure (2s):** Uma breve pausa confortável para reter a calma.
   - **Fase 3 — Solte (6s):** Liberar o ar lentamente pela boca ou nariz, soltando os ombros e a mandíbula.
3. **Dicas Práticas para Educadores:**
   - Apoie os dois pés firmes no chão.
   - Faça de 4 a 6 ciclos completos (cerca de 1 a 2 minutos).
   - Use entre aulas, antes de conversas difíceis ou ao chegar em casa para descompressão.
4. **Fechamento BemTeVi:**
   - Mensagem: _"Respeite seu ritmo. Cuidar de você é o primeiro passo para cuidar do outro."_
   - Assinatura: BemTeVi — Apoio à Saúde Mental de Educadores.

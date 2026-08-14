# Walkthrough: Mapa e Proximidade de Contatos na Rede de Apoio

Implementação concluída para visualização de proximidade e mapa de contatos na rede de apoio, seguindo estritamente as diretrizes de **privacidade (LGPD)**, **processamento on-device** e **consentimento explícito do usuário**.

---

## O Que Foi Implementado

### 1. Consentimento e Privacidade On-Device

- **Consentimento Explícito**: A localização só é lida quando o usuário clica no botão _"Usar minha localização"_.
- **Sem Envio ou Persistência**: As coordenadas nunca são salvas no `localStorage`, cookies ou enviadas para nenhum servidor do BemTeVi.
- **Arredondamento de Precisão**: As coordenadas do dispositivo continuam sendo aproximadas (~1 km) com `roundToApproximate`.

### 2. Modelo de Dados, Validação e Resolução Precisa de Coordenadas

- Adicionadas coordenadas opcionais `lat?: number; lng?: number;` em [`src/domain/services/types.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/domain/services/types.ts).
- Validação no payload publicado em [`src/app/content/publishedContent.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/app/content/publishedContent.ts) e validação do dashboard em [`src/dev-dashboard/contacts/contactsValidation.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/contactsValidation.ts).
- Coordenadas reais e precisas de todos os CAPS e serviços de Canoas em [`src/content/services/canoas-services.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas-services.ts):
  - **CAPS II Novos Tempos**: Rua São Caetano, 102 – Marechal Rondon (`-29.9073, -51.1712`)
  - **CAPS III Recanto dos Girassóis**: Rua Guilherme Morsch, 278 – Centro (`-29.9176, -51.1865`)
  - **CAPS AD III Travessia**: Av. Guilherme Schell, 6250 – Centro (`-29.9161, -51.1824`)
  - **CAPS AD III Amanhecer**: Rua XV de Novembro, 82 – N. Sra. das Graças (`-29.9234, -51.1751`)
  - **CAPS II Praça Brasil**: Av. Getúlio Vargas, 7071 – Centro (`-29.9145, -51.1812`)
  - **UBS Centro**: Rua Quinze de Janeiro, 123 – Centro (`-29.9192, -51.1795`)
  - **Clínica Escola Ulbra**: Av. Farroupilha, 8001 – São José (`-29.9011, -51.1578`)
- Motor inteligente em [`src/lib/geo/geo.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/lib/geo/geo.ts) com reconhecimento de padrões textuais por nome e endereço (`KNOWN_LOCATION_PATTERNS`) e dispersão determinística (`deterministicCityOffset`) para que contatos genéricos sem endereço nunca fiquem sobrepostos no mesmo ponto.

### 3. Ordenação por Proximidade e Badges de Distância

- Ao acionar a localização, a tela [`src/features/contacts/ContactsScreen.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/contacts/ContactsScreen.tsx) calcula em tempo real a distância (`haversineKm`) para cada serviço.
- Os contatos mais próximos são ordenados no topo da lista.
- Cada cartão de contato ([`src/design-system/components/ServiceCard.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/design-system/components/ServiceCard.tsx)) exibe uma etiqueta de distância aproximada (ex: `📍 a ~500 m de você` ou `📍 a ~1,2 km de você`).

### 4. Links de Navegação "Como Chegar"

- Cada cartão de serviço agora possui um botão **"Como chegar"** que abre o trajeto diretamente no aplicativo de mapas padrão do usuário (Google Maps, Apple Maps, etc.) em nova aba, sem enviar dados do usuário antes do clique.

### 5. Visualização em Mapa Interativo (OpenStreetMap)

- Adicionado controle de alternância `[ 📋 Lista | 🗺️ Mapa ]` no topo da tela de contatos.
- Criado o componente [`src/features/contacts/ContactsMap.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/contacts/ContactsMap.tsx) com mapa do OpenStreetMap (100% gratuito, sem rastreadores e sem necessidade de chaves de API), acompanhado de lista lateral dos pontos de atendimento com indicador de distância e ações rápidas ("Ligar" e "Como chegar").

---

## Validação e Testes

- **Testes Unitários e de Integração**:
  - `pnpm vitest run src/features/contacts/ src/lib/geo/` (27/27 passaram)
  - `pnpm test` (48 arquivos de teste, 535 testes passaram)
- **Validação de Código e Build**:
  - `pnpm check` (Prettier, Typecheck, ESLint e Vite Production Build com PWA passaram com código de saída 0).

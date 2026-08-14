# Plano de Implementação: Mapa e Proximidade de Contatos

## Objetivo

Permitir que o usuário compreenda com facilidade quais contatos da rede de apoio estão mais próximos da sua localização, com **zero vazamento de dados** e **consentimento prévio e explícito**, utilizando a abordagem mais direta e eficiente.

---

## Princípios de Privacidade (LGPD) e Consentimento

1. **Consentimento Explícito**: Nenhuma localização é solicitada automaticamente. Apenas quando o usuário clica explicitamente no botão _"Usar minha localização"_.
2. **Processamento 100% On-Device (Em Memória)**: As coordenadas do usuário nunca são gravadas no `localStorage`, em cookies, nem enviadas para qualquer servidor/backend do BemTeVi.
3. **Arredondamento de Precisão**: As coordenadas do usuário são aproximadas (~1 km) via `roundToApproximate` antes de qualquer cálculo de distância.
4. **Sem Rastreamento de Terceiros**: Links de mapa externos só são acionados pelo clique direto do usuário com destino público do serviço.

---

## Componentes e Mudanças Propostas

### 1. Modelo de Dados e Validação

- **`src/domain/services/types.ts`**: Adicionar campos opcionais `lat?: number; lng?: number;` à interface `ServiceDirectoryEntry`.
- **`src/app/content/publishedContent.ts`**: Atualizar a validação para aceitar `lat` e `lng` opcionais como números finitos válidos.
- **`src/dev-dashboard/contacts/contactsValidation.ts`**: Adicionar validação de intervalo (`-90 <= lat <= 90` e `-180 <= lng <= 180`).
- **`src/dev-dashboard/contacts/ContactsDashboard.tsx`**: Adicionar campos de latitude e longitude no formulário de edição de contatos.
- **`src/content/services/canoas-services.ts`**: Preencher coordenadas reais para os serviços padrão de Canoas.

### 2. Cálculo de Proximidade e Ordenação On-Device

- **`src/features/contacts/CityFilter.tsx`**: Ao obter a localização do dispositivo com consentimento do usuário, emitir as coordenadas aproximadas (`{ lat, lng }`) para o componente pai.
- **`src/features/contacts/ContactsScreen.tsx`**:
  - Calcular a distância em km para cada serviço com coordenadas utilizando `haversineKm`.
  - Ordenar os contatos por proximidade (mais próximos primeiro) quando a localização estiver ativa.
  - Adicionar controle de visualização `[ 📋 Lista | 🗺️ Mapa ]` para alternar entre lista de cards e visualização espacial em mapa.

### 3. Componente de Mapa e Card de Serviço

- **`src/features/contacts/ContactsMap.tsx`**: Componente leve e responsivo exibindo os pontos dos serviços no mapa com OpenStreetMap, com popups interativos e botão para ligar ou abrir rotas.
- **`src/design-system/components/ServiceCard.tsx`**:
  - Exibir badge de distância aproximada (ex: `📍 ~1,2 km de você`) quando a localização estiver ativa.
  - Adicionar botão _"Ver no mapa"_ / _"Como chegar"_ que abre a rota no aplicativo de mapas do dispositivo (Google Maps / Apple Maps / OSM).

---

## Plano de Verificação e Testes

1. **Testes Unitários e de Integração**:
   - `src/features/contacts/__tests__/ContactsScreen.test.tsx`: Testar ordenação por proximidade e alternância entre lista e mapa.
   - `src/features/contacts/__tests__/CityFilter.test.tsx`: Testar emissão de coordenadas aproximadas com consentimento.
   - `src/app/content/__tests__/publishedContent.test.ts`: Testar validação do payload com coordenadas.
   - `src/dev-dashboard/contacts/__tests__/contactsValidation.test.ts`: Testar validação de latitude/longitude.
2. **Execução de Checagem Geral**:
   - `pnpm test`
   - `pnpm typecheck`
   - `pnpm lint`

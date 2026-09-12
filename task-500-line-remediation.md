# Lista de Tarefas: Remediação Arquitetural do Limite de 500 Linhas

- [x] 1. Decompor `src/content/flows/documentFlows.ts` em fluxos modulares sob `src/content/flows/document/` <!-- id: task-1 -->
- [x] 2. Decompor `src/content/flows/neutral.ts` em fluxos modulares sob `src/content/flows/neutral/` <!-- id: task-2 -->
- [x] 3. Decompor `src/content/services/canoas-services.ts` por cidade/região mantendo ordenação idêntica <!-- id: task-3 -->
- [x] 4. Modularizar `src/dev-dashboard/contacts/ContactsDashboard.tsx` em submódulos de apresentação e navegação <!-- id: task-4 -->
- [x] 5. Modularizar `src/dev-dashboard/flows/FlowDestinationMap.tsx` com hooks e componentes desacoplados <!-- id: task-5 -->
- [x] 6. Dividir `src/dev-dashboard/__tests__/dashboardStorage.test.ts` em suítes focadas (lifecycle, migrations, merge) <!-- id: task-6 -->
- [x] 7. Dividir `src/dev-dashboard/flows/__tests__/FlowDestinationMap.test.tsx` em suítes focadas (navigation, mutations, focus) <!-- id: task-7 -->
- [x] 8. Dividir `src/features/education/__tests__/EducationScreens.test.tsx` em suítes focadas por responsabilidade <!-- id: task-8 -->
- [x] 9. Limpar as 8 exceções obsoletas em `scripts/architecture-baseline.json` <!-- id: task-9 -->
- [x] 10. Validar portão completo `pnpm run check` (typecheck, lint, format, tests, architecture, build) <!-- id: task-10 -->

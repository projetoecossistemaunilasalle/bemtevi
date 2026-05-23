# Dev Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dev-only dashboard route for editing SeCuida chatbot flows and education materials, saving local drafts, validating them, previewing them, and exporting one review bundle.

**Architecture:** The dashboard lives under `src/dev-dashboard/` and is exposed only when `VITE_ENABLE_DEV_DASHBOARD=true`. Most behavior is pure TypeScript: content adapters, validation, draft storage, and export. React components consume those helpers to provide a pt-BR editor, visual flow map, chat preview, and education-material form.

**Tech Stack:** React 19, React Router, TypeScript, Vite env flags, Vitest, Testing Library, existing flow-engine/domain content, localStorage.

---

## Prerequisite

Implement this plan on top of the neutral-flow work, or merge `feature/neutral-flows` into the working branch before Task 1.

The dashboard plan assumes these contracts exist:

```ts
export type FlowPurpose = 'orientation_entry' | 'post_flow_routing';

export interface FlowStartFlowEffect {
  kind: 'flow_start';
  flowId: string;
}

export interface NavigateFlowEffect {
  kind: 'navigate';
  destination: '/apoio' | '/contatos' | '/educacao';
}
```

If those types are missing, stop and merge the neutral-flow branch first.

## File Structure

Create the dashboard in one removable folder:

```txt
src/dev-dashboard/
  DashboardRoute.tsx
  components/
    DashboardShell.tsx
    DashboardNotice.tsx
    FieldHint.tsx
    ValidationSummary.tsx
  content/
    shippedContent.ts
    normalize.ts
  draft-storage/
    dashboardStorage.ts
  education/
    EducationDashboard.tsx
    educationTypes.ts
    educationValidation.ts
  export/
    exportBundle.ts
  flows/
    FlowDashboard.tsx
    FlowEditor.tsx
    FlowMap.tsx
    FlowPreview.tsx
    flowLabels.ts
    flowValidation.ts
  validation/
    validationTypes.ts
    duplicateIds.ts
  __tests__/
    dashboardRoute.test.tsx
    dashboardStorage.test.ts
    educationValidation.test.ts
    exportBundle.test.ts
    flowValidation.test.ts
```

Modify only these existing app files for integration:

```txt
src/app/routes.ts
src/app/router.tsx
src/app/shell/TopBar.tsx
src/app/__tests__/routes.test.tsx
src/domain/resources/types.ts
src/content/resources/resources.ts
```

Do not add dashboard links to the privacy page.

---

### Task 1: Add Dev Dashboard Route Gate

**Files:**

- Modify: `src/app/routes.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/app/shell/TopBar.tsx`
- Test: `src/app/__tests__/routes.test.tsx`
- Create: `src/dev-dashboard/DashboardRoute.tsx`

- [ ] **Step 1: Write failing route tests**

Add these imports to `src/app/__tests__/routes.test.tsx`:

```ts
import { vi } from 'vitest';
```

Add these tests inside `describe('Router', () => { ... })`:

```ts
it('does not render the dashboard route by default', () => {
  renderRoute('/dashboard');

  expect(screen.queryByRole('heading', { name: /dashboard/i })).not.toBeInTheDocument();
});

it('renders the dashboard route when the dev flag is enabled', () => {
  vi.stubEnv('VITE_ENABLE_DEV_DASHBOARD', 'true');

  renderRoute('/dashboard');

  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

  vi.unstubAllEnvs();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/app/__tests__/routes.test.tsx
```

Expected: FAIL because `/dashboard` is not registered and `DashboardRoute` does not exist.

- [ ] **Step 3: Add route constant**

Update `src/app/routes.ts`:

```ts
export const routes = {
  home: '/',
  orientation: '/orientacao',
  support: '/apoio',
  contacts: '/contatos',
  education: '/educacao',
  educationDetail: '/educacao/:resourceId',
  privacy: '/privacidade',
  dashboard: '/dashboard',
} as const;
```

- [ ] **Step 4: Create placeholder dashboard route**

Create `src/dev-dashboard/DashboardRoute.tsx`:

```tsx
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';

export function DashboardRoute() {
  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
    </Page>
  );
}
```

- [ ] **Step 5: Conditionally register dashboard route**

Update `src/app/router.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { AppShell } from './shell/AppShell';
import { ContactsScreen } from '../features/contacts/ContactsScreen';
import { EducationLibraryScreen } from '../features/education/EducationLibraryScreen';
import { ResourceDetailScreen } from '../features/education/ResourceDetailScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { OrientationScreen } from '../features/orientation/OrientationScreen';
import { PrivacyScreen } from '../features/privacy/PrivacyScreen';
import { SupportScreen } from '../features/support/SupportScreen';
import { DashboardRoute } from '../dev-dashboard/DashboardRoute';

function isDevDashboardEnabled() {
  return import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true';
}

export function Router() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={routes.home} element={<HomeScreen />} />
        <Route path={routes.orientation} element={<OrientationScreen />} />
        <Route path={routes.support} element={<SupportScreen />} />
        <Route path={routes.contacts} element={<ContactsScreen />} />
        <Route path={routes.education} element={<EducationLibraryScreen />} />
        <Route path={routes.educationDetail} element={<ResourceDetailScreen />} />
        <Route path={routes.privacy} element={<PrivacyScreen />} />
        {isDevDashboardEnabled() && <Route path={routes.dashboard} element={<DashboardRoute />} />}
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 6: Add top-bar Dashboard link behind env flag**

Update `src/app/shell/TopBar.tsx`:

```tsx
import { Brain, Compass, Gauge, GraduationCap, HeartHandshake, Home, Users } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '../routes';

function getNavItems() {
  return [
    { to: routes.home, label: 'Início', Icon: Home },
    { to: routes.orientation, label: 'Orientação', Icon: Compass },
    { to: routes.education, label: 'Estudos', Icon: GraduationCap },
    { to: routes.contacts, label: 'Contatos', Icon: Users },
    { to: routes.support, label: 'Apoio', Icon: HeartHandshake },
    ...(import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true'
      ? [{ to: routes.dashboard, label: 'Dashboard', Icon: Gauge }]
      : []),
  ];
}
```

In the rendered nav, replace `navItems.map(...)` with `getNavItems().map(...)`.

Leave `BottomNav.tsx` unchanged. The mobile bottom nav already has five primary user routes and should not become crowded by the dev-only dashboard.

- [ ] **Step 7: Run route tests**

Run:

```bash
pnpm run test -- src/app/__tests__/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/routes.ts src/app/router.tsx src/app/shell/TopBar.tsx src/app/__tests__/routes.test.tsx src/dev-dashboard/DashboardRoute.tsx
git commit -m "feat: gate dev dashboard route"
```

---

### Task 2: Add Dashboard Shell and Content Adapters

**Files:**

- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Create: `src/dev-dashboard/components/DashboardShell.tsx`
- Create: `src/dev-dashboard/components/DashboardNotice.tsx`
- Create: `src/dev-dashboard/components/FieldHint.tsx`
- Create: `src/dev-dashboard/content/shippedContent.ts`
- Create: `src/dev-dashboard/content/normalize.ts`
- Create: `src/dev-dashboard/validation/duplicateIds.ts`
- Create: `src/dev-dashboard/validation/validationTypes.ts`

- [ ] **Step 1: Create shared validation types**

Create `src/dev-dashboard/validation/validationTypes.ts`:

```ts
export type DashboardValidationLevel = 'error' | 'warning';
export type DashboardValidationArea = 'flows' | 'education' | 'export';

export interface DashboardValidationIssue {
  level: DashboardValidationLevel;
  area: DashboardValidationArea;
  id: string;
  message: string;
  path?: string;
}

export interface DashboardValidationResult {
  errors: DashboardValidationIssue[];
  warnings: DashboardValidationIssue[];
}

export function createValidationResult(issues: DashboardValidationIssue[]): DashboardValidationResult {
  return {
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}
```

- [ ] **Step 2: Add shared duplicate helper**

Create `src/dev-dashboard/validation/duplicateIds.ts`:

```ts
export function findDuplicateIds(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return [...duplicates];
}
```

- [ ] **Step 3: Add shipped content adapter**

Create `src/dev-dashboard/content/shippedContent.ts`:

```ts
import { flowRegistry } from '../../content/flows/registry';
import { resourcesContent } from '../../content/resources/resources';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';

export interface DashboardShippedContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
}

export function getShippedDashboardContent(): DashboardShippedContent {
  return {
    flows: flowRegistry.flows,
    educationMaterials: resourcesContent.resources,
  };
}
```

Because `flowRegistry` may be backed by `import.meta.glob` JSON loading, route/component tests should mock `getShippedDashboardContent` instead of depending on bundler registry behavior. The mock must provide at least one flow and one education resource so UI smoke tests never fail because a test environment returned an empty registry.

- [ ] **Step 4: Add stable normalization helper**

Create `src/dev-dashboard/content/normalize.ts`:

```ts
export function normalizeForComparison(value: unknown): string {
  return JSON.stringify(sortRecord(value));
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecord);

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortRecord(entryValue)]),
    );
  }

  return value;
}
```

- [ ] **Step 5: Add shell components**

Create `src/dev-dashboard/components/FieldHint.tsx`:

```tsx
import type { ReactNode } from 'react';

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="font-body-md text-on-surface-variant">{children}</p>;
}
```

Create `src/dev-dashboard/components/DashboardNotice.tsx`:

```tsx
import { Info } from 'lucide-react';

export function DashboardNotice() {
  return (
    <aside className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <Info className="mt-0.5 shrink-0 text-secondary" size={20} aria-hidden="true" />
      <div>
        <h2 className="font-headline-sm text-on-surface">Rascunho local</h2>
        <p className="mt-1 font-body-md text-on-surface-variant">
          Este conteúdo está salvo apenas neste navegador. Ele ainda não foi publicado.
        </p>
      </div>
    </aside>
  );
}
```

Create `src/dev-dashboard/components/DashboardShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { DashboardNotice } from './DashboardNotice';

export type DashboardTab = 'flows' | 'education' | 'export';

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'flows', label: 'Fluxos' },
  { id: 'education', label: 'Materiais' },
  { id: 'export', label: 'Exportar' },
];

export function DashboardShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: ReactNode;
}) {
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="flex flex-col gap-stack-md">
      <DashboardNotice />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas do dashboard">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`min-h-11 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section role="tabpanel" aria-label={activeTabLabel}>
        {children}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Wire placeholder shell**

Replace `src/dev-dashboard/DashboardRoute.tsx`:

```tsx
import { useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';

export function DashboardRoute() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('flows');

  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">
            {activeTab === 'flows' ? 'Fluxos' : activeTab === 'education' ? 'Materiais' : 'Exportar'}
          </h2>
        </section>
      </DashboardShell>
    </Page>
  );
}
```

- [ ] **Step 7: Run route smoke test**

Run:

```bash
pnpm run test -- src/app/__tests__/routes.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/dev-dashboard
git commit -m "feat: add dashboard shell"
```

---

### Task 3: Extend Education Resource Model

**Files:**

- Modify: `src/domain/resources/types.ts`
- Modify: `src/content/resources/resources.ts`
- Test: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Add content type assertions**

Update the resource test in `src/content/__tests__/content.test.ts`:

```ts
it('every resource has id, title, source, description, tags, and content type', () => {
  resourcesContent.resources.forEach((resource) => {
    expect(resource.id).toBeTruthy();
    expect(resource.title).toBeTruthy();
    expect(resource.source).toBeTruthy();
    expect(resource.description).toBeTruthy();
    expect(resource.contentType).toBeTruthy();
    expect(Array.isArray(resource.tags)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: FAIL because existing resources do not expose `contentType`.

- [ ] **Step 3: Extend resource types**

Replace `src/domain/resources/types.ts`:

```ts
import type { ContentMetadata, ReviewMetadata } from '../content/types';

export type EducationResourceContentType =
  | 'article'
  | 'summary'
  | 'external_link'
  | 'pdf_link'
  | 'video_link'
  | 'audio_link';
export type EducationResourceAudience = 'teachers' | 'public_school_teachers' | 'general';

export interface EducationResourceBlock {
  id: string;
  kind: 'paragraph' | 'heading' | 'list';
  text?: string;
  items?: string[];
}

export interface EducationResourceEmbed {
  provider: 'youtube' | 'external';
  url: string;
}

export interface EducationResource {
  id: string;
  title: string;
  source: string;
  description: string;
  imageUrl?: string;
  tags: string[];
  audience: EducationResourceAudience;
  contentType: EducationResourceContentType;
  body?: EducationResourceBlock[];
  externalUrl?: string;
  embed?: EducationResourceEmbed;
  href?: string;
  review: ReviewMetadata;
}

export interface ResourcesContent extends ContentMetadata {
  resources: EducationResource[];
}
```

- [ ] **Step 4: Update seed resource**

Update the resource in `src/content/resources/resources.ts` by adding:

```ts
audience: 'teachers',
contentType: 'summary',
body: [
  {
    id: 'overview',
    kind: 'paragraph',
    text: 'Material inicial para apoiar conversas sobre regulação emocional e sobrecarga no cotidiano escolar.',
  },
],
```

Keep the existing title, source, description, image, tags, and review metadata.

- [ ] **Step 5: Run content tests**

Run:

```bash
pnpm run test -- src/content/__tests__/content.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/resources/types.ts src/content/resources/resources.ts src/content/__tests__/content.test.ts
git commit -m "feat: extend education resource model"
```

---

### Task 4: Add Flow Validation Helpers

**Files:**

- Create: `src/dev-dashboard/flows/flowLabels.ts`
- Create: `src/dev-dashboard/flows/flowValidation.ts`
- Test: `src/dev-dashboard/__tests__/flowValidation.test.ts`

- [ ] **Step 1: Write failing flow validation tests**

Create `src/dev-dashboard/__tests__/flowValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { validateDashboardFlows } from '../flows/flowValidation';

const baseFlow: GuidedFlow = {
  id: 'base-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo base',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Começar fluxo base'],
    transitionMessage: 'Vamos começar.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'Escolha uma opção.',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Resultado final.',
      recommendations: ['known-resource'],
    },
  },
};

describe('validateDashboardFlows', () => {
  it('rejects duplicate flow IDs', () => {
    const result = validateDashboardFlows([baseFlow, { ...baseFlow }], ['known-resource']);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-flow-id:base-flow',
        message: 'Existe mais de um fluxo com o ID "base-flow".',
      }),
    );
  });

  it('rejects missing flow_start targets', () => {
    const result = validateDashboardFlows(
      [
        {
          ...baseFlow,
          nodes: {
            ...baseFlow.nodes,
            start: {
              id: 'start',
              kind: 'choice',
              text: 'Escolha uma opção.',
              options: [
                {
                  id: 'handoff',
                  label: 'Começar outro fluxo',
                  next: 'end',
                  effects: [{ kind: 'flow_start', flowId: 'missing-flow' }],
                },
              ],
            },
          },
        },
      ],
      ['known-resource'],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-flow-start:base-flow:start:handoff',
        message: 'Esta opção tenta começar um fluxo que não existe: missing-flow.',
      }),
    );
  });

  it('rejects missing recommendation resources', () => {
    const result = validateDashboardFlows([baseFlow], []);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-resource:base-flow:end:known-resource',
        message: 'Este resultado recomenda um material que não existe: known-resource.',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/flowValidation.test.ts
```

Expected: FAIL because `flowValidation.ts` does not exist.

- [ ] **Step 3: Add flow labels**

Create `src/dev-dashboard/flows/flowLabels.ts`:

```ts
import type { FlowPurpose } from '../../domain/flow-engine/types';

export const flowPurposeLabels: Record<'common' | FlowPurpose, string> = {
  common: 'Fluxo comum',
  orientation_entry: 'Entrada da orientação',
  post_flow_routing: 'Continuação após um fluxo',
};
```

- [ ] **Step 4: Implement flow dashboard validation**

Create `src/dev-dashboard/flows/flowValidation.ts`:

```ts
import { validateFlow } from '../../domain/flow-engine/validateFlow';
import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';

const allowedNavigateDestinations = new Set(['/apoio', '/contatos', '/educacao']);
const allowedNodeKinds = new Set(['choice', 'result', 'score_branch']);

export function validateDashboardFlows(flows: GuidedFlow[], resourceIds: string[]) {
  const issues: DashboardValidationIssue[] = [];
  const flowIds = new Set(flows.map((flow) => flow.id));
  const resourceSet = new Set(resourceIds);

  flows.forEach((flow) => {
    validateFlow(flow).errors.forEach((message, index) => {
      issues.push({
        level: 'error',
        area: 'flows',
        id: `structural:${flow.id}:${index}`,
        message,
      });
    });
  });

  findDuplicateIds(flows.map((flow) => flow.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'flows',
      id: `duplicate-flow-id:${id}`,
      message: `Existe mais de um fluxo com o ID "${id}".`,
    });
  });

  flows.forEach((flow) => {
    Object.values(flow.nodes).forEach((node) => {
      if (!allowedNodeKinds.has(node.kind)) {
        issues.push({
          level: 'error',
          area: 'flows',
          id: `unsupported-node-kind:${flow.id}:${node.id}`,
          message: `Esta etapa usa um tipo que o dashboard não entende: ${node.kind}.`,
          path: `${flow.id}.nodes.${node.id}.kind`,
        });
      }

      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          (option.effects ?? []).forEach((effect) => {
            issues.push(...validateEffect(flow.id, node.id, option.id, effect, flowIds));
          });
        });
      }

      if (node.kind === 'result') {
        (node.recommendations ?? []).forEach((recommendation) => {
          if (!resourceSet.has(recommendation)) {
            issues.push({
              level: 'error',
              area: 'flows',
              id: `missing-resource:${flow.id}:${node.id}:${recommendation}`,
              message: `Este resultado recomenda um material que não existe: ${recommendation}.`,
              path: `${flow.id}.nodes.${node.id}.recommendations`,
            });
          }
        });
      }
    });
  });

  return createValidationResult(issues);
}

function validateEffect(
  flowId: string,
  nodeId: string,
  optionId: string,
  effect: FlowEffect,
  flowIds: Set<string>,
): DashboardValidationIssue[] {
  if (effect.kind === 'flow_start' && !flowIds.has(effect.flowId)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `missing-flow-start:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta começar um fluxo que não existe: ${effect.flowId}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  if (effect.kind === 'navigate' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-navigate:${flowId}:${nodeId}:${optionId}`,
        message: `Esta opção tenta abrir um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  if (effect.kind === 'safety_interrupt' && !allowedNavigateDestinations.has(effect.destination)) {
    return [
      {
        level: 'error',
        area: 'flows',
        id: `invalid-safety-destination:${flowId}:${nodeId}:${optionId}`,
        message: `A interrupção de segurança usa um destino que não é permitido: ${effect.destination}.`,
        path: `${flowId}.nodes.${nodeId}.options.${optionId}.effects`,
      },
    ];
  }

  return [];
}
```

- [ ] **Step 5: Run flow validation tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/flowValidation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dev-dashboard/flows src/dev-dashboard/validation src/dev-dashboard/__tests__/flowValidation.test.ts
git commit -m "feat: validate dashboard flows"
```

---

### Task 5: Add Education Validation Helpers

**Files:**

- Create: `src/dev-dashboard/education/educationTypes.ts`
- Create: `src/dev-dashboard/education/educationValidation.ts`
- Test: `src/dev-dashboard/__tests__/educationValidation.test.ts`

- [ ] **Step 1: Write failing education validation tests**

Create `src/dev-dashboard/__tests__/educationValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { EducationResource } from '../../domain/resources/types';
import { validateDashboardEducation } from '../education/educationValidation';

const baseResource: EducationResource = {
  id: 'resource-one',
  title: 'Material de teste',
  source: 'Equipe SeCuida',
  description: 'Descrição clara do material.',
  tags: ['descanso'],
  audience: 'teachers',
  contentType: 'summary',
  review: {
    status: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    notes: '',
  },
};

describe('validateDashboardEducation', () => {
  it('rejects duplicate material IDs', () => {
    const result = validateDashboardEducation([baseResource, { ...baseResource }]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-material-id:resource-one',
        message: 'Existe mais de um material com o ID "resource-one".',
      }),
    );
  });

  it('rejects video materials without URL', () => {
    const result = validateDashboardEducation([{ ...baseResource, contentType: 'video_link' }]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-url:resource-one',
        message: 'Este tipo de material precisa de um link público.',
      }),
    );
  });

  it('warns when tags are empty', () => {
    const result = validateDashboardEducation([{ ...baseResource, tags: [] }]);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'empty-tags:resource-one',
        message: 'Este material ainda não tem tags.',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: FAIL because validation module does not exist.

- [ ] **Step 3: Add dashboard education type constants**

Create `src/dev-dashboard/education/educationTypes.ts`:

```ts
import type { EducationResourceContentType } from '../../domain/resources/types';

export const educationContentTypeLabels: Record<EducationResourceContentType, string> = {
  article: 'Artigo interno',
  summary: 'Resumo interno',
  external_link: 'Link externo',
  pdf_link: 'PDF por link',
  video_link: 'Vídeo incorporado por link',
  audio_link: 'Áudio por link',
};

export const educationTypesRequiringUrl: EducationResourceContentType[] = [
  'external_link',
  'pdf_link',
  'video_link',
  'audio_link',
];
```

- [ ] **Step 4: Implement education validation**

Create `src/dev-dashboard/education/educationValidation.ts`:

```ts
import type { EducationResource } from '../../domain/resources/types';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';
import { educationTypesRequiringUrl } from './educationTypes';

export function validateDashboardEducation(resources: EducationResource[]) {
  const issues: DashboardValidationIssue[] = [];

  findDuplicateIds(resources.map((resource) => resource.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'education',
      id: `duplicate-material-id:${id}`,
      message: `Existe mais de um material com o ID "${id}".`,
    });
  });

  resources.forEach((resource) => {
    if (!resource.title.trim()) pushMissing(issues, resource.id, 'title', 'O título é obrigatório.');
    if (!resource.source.trim()) pushMissing(issues, resource.id, 'source', 'A fonte é obrigatória.');
    if (!resource.description.trim()) pushMissing(issues, resource.id, 'description', 'A descrição é obrigatória.');

    if (resource.tags.length === 0) {
      issues.push({
        level: 'warning',
        area: 'education',
        id: `empty-tags:${resource.id}`,
        message: 'Este material ainda não tem tags.',
        path: `${resource.id}.tags`,
      });
    }

    if (educationTypesRequiringUrl.includes(resource.contentType) && !resource.externalUrl?.trim()) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `missing-url:${resource.id}`,
        message: 'Este tipo de material precisa de um link público.',
        path: `${resource.id}.externalUrl`,
      });
    }

    if (resource.contentType === 'video_link' && resource.externalUrl && !isHttpUrl(resource.externalUrl)) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `invalid-video-url:${resource.id}`,
        message: 'Este link não parece ser um vídeo compatível.',
        path: `${resource.id}.externalUrl`,
      });
    }
  });

  return createValidationResult(issues);
}

function pushMissing(issues: DashboardValidationIssue[], resourceId: string, field: string, message: string) {
  issues.push({
    level: 'error',
    area: 'education',
    id: `missing-${field}:${resourceId}`,
    message,
    path: `${resourceId}.${field}`,
  });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run education validation tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/educationValidation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dev-dashboard/education src/dev-dashboard/__tests__/educationValidation.test.ts
git commit -m "feat: validate dashboard education materials"
```

---

### Task 6: Add Draft Storage

**Files:**

- Create: `src/dev-dashboard/draft-storage/dashboardStorage.ts`
- Test: `src/dev-dashboard/__tests__/dashboardStorage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `src/dev-dashboard/__tests__/dashboardStorage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { DashboardDraftState } from '../draft-storage/dashboardStorage';
import {
  DASHBOARD_DRAFT_SCHEMA_VERSION,
  clearDashboardDrafts,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  saveDashboardDrafts,
} from '../draft-storage/dashboardStorage';

const emptyDraft: DashboardDraftState = {
  schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
  flowPatches: [],
  educationMaterialPatches: [],
  addedFlows: [],
  addedEducationMaterials: [],
  updatedAt: '2026-05-22T00:00:00.000Z',
};

describe('dashboardStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty draft when storage is empty', () => {
    expect(loadDashboardDrafts()).toEqual({
      schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
      flowPatches: [],
      educationMaterialPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: null,
    });
  });

  it('saves and loads dashboard drafts', () => {
    saveDashboardDrafts(emptyDraft);

    expect(loadDashboardDrafts()).toEqual(emptyDraft);
  });

  it('clears dashboard drafts', () => {
    saveDashboardDrafts(emptyDraft);
    clearDashboardDrafts();

    expect(loadDashboardDrafts().updatedAt).toBeNull();
  });

  it('merges sparse overrides onto current shipped content', () => {
    const shippedFlow = { id: 'flow-one', title: 'Shipped flow' } as never;
    const shippedMaterial = { id: 'material-one', title: 'Shipped material' } as never;
    const draft = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-one', patch: { title: 'Edited flow' } }],
    };

    expect(mergeDashboardDrafts({ flows: [shippedFlow], educationMaterials: [shippedMaterial] }, draft)).toEqual({
      flows: [{ ...shippedFlow, title: 'Edited flow' }],
      educationMaterials: [shippedMaterial],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardStorage.test.ts
```

Expected: FAIL because storage module does not exist.

- [ ] **Step 3: Implement draft storage**

Create `src/dev-dashboard/draft-storage/dashboardStorage.ts`:

```ts
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { DashboardShippedContent } from '../content/shippedContent';

const STORAGE_KEY = 'secuida:dev-dashboard:drafts:v1';
export const DASHBOARD_DRAFT_SCHEMA_VERSION = '1.0.0' as const;

export interface DashboardRecordPatch<T extends { id: string }> {
  id: string;
  patch: Partial<T>;
}

export interface DashboardDraftState {
  schemaVersion: typeof DASHBOARD_DRAFT_SCHEMA_VERSION;
  flowPatches: Array<DashboardRecordPatch<GuidedFlow>>;
  educationMaterialPatches: Array<DashboardRecordPatch<EducationResource>>;
  addedFlows: GuidedFlow[];
  addedEducationMaterials: EducationResource[];
  updatedAt: string | null;
}

export function createEmptyDashboardDraftState(): DashboardDraftState {
  return {
    schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
    flowPatches: [],
    educationMaterialPatches: [],
    addedFlows: [],
    addedEducationMaterials: [],
    updatedAt: null,
  };
}

export function loadDashboardDrafts(storage: Storage = localStorage): DashboardDraftState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyDashboardDraftState();

  try {
    const parsed = JSON.parse(raw) as DashboardDraftState;
    if (parsed.schemaVersion !== DASHBOARD_DRAFT_SCHEMA_VERSION) return createEmptyDashboardDraftState();
    return parsed;
  } catch {
    return createEmptyDashboardDraftState();
  }
}

export function saveDashboardDrafts(state: DashboardDraftState, storage: Storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearDashboardDrafts(storage: Storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function mergeDashboardDrafts(shipped: DashboardShippedContent, drafts: DashboardDraftState) {
  return {
    flows: mergeRecords(shipped.flows, drafts.flowPatches, drafts.addedFlows),
    educationMaterials: mergeRecords(
      shipped.educationMaterials,
      drafts.educationMaterialPatches,
      drafts.addedEducationMaterials,
    ),
  };
}

function mergeRecords<T extends { id: string }>(shipped: T[], patches: Array<DashboardRecordPatch<T>>, additions: T[]) {
  const patchesById = new Map(patches.map((record) => [record.id, record.patch]));
  return [...shipped.map((record) => ({ ...record, ...patchesById.get(record.id) })), ...additions];
}
```

This storage is intentionally sparse. Never write the complete shipped flow/resource arrays to localStorage. Store only explicitly edited fields in `flowPatches` and `educationMaterialPatches`, plus newly created full records in `addedFlows` and `addedEducationMaterials`, then merge those sparse drafts over the current codebase content at render time. This lets editors keep their local work while still receiving future shipped typo fixes, new materials, and code-level content updates to fields they did not edit.

- [ ] **Step 4: Run storage tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardStorage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev-dashboard/draft-storage src/dev-dashboard/__tests__/dashboardStorage.test.ts
git commit -m "feat: persist dashboard drafts locally"
```

---

### Task 7: Add Export Bundle Builder

**Files:**

- Create: `src/dev-dashboard/export/exportBundle.ts`
- Test: `src/dev-dashboard/__tests__/exportBundle.test.ts`

- [ ] **Step 1: Write failing export tests**

Create `src/dev-dashboard/__tests__/exportBundle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import { buildExportBundle } from '../export/exportBundle';

const flow: GuidedFlow = {
  id: 'flow-one',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo um',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'start', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
  nodes: { start: { id: 'start', kind: 'result', text: 'Resultado.' } },
};

const material: EducationResource = {
  id: 'material-one',
  title: 'Material um',
  source: 'Equipe SeCuida',
  description: 'Descrição.',
  tags: ['descanso'],
  audience: 'teachers',
  contentType: 'summary',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

describe('buildExportBundle', () => {
  it('excludes unchanged shipped records', () => {
    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material] },
      drafts: { flows: [flow], educationMaterials: [material] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([]);
    expect(bundle.changes.educationMaterials).toEqual([]);
  });

  it('exports complete changed records', () => {
    const changedFlow = { ...flow, title: 'Fluxo atualizado' };

    const bundle = buildExportBundle({
      shipped: { flows: [flow], educationMaterials: [material] },
      drafts: { flows: [changedFlow], educationMaterials: [] },
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-05-22T00:00:00.000Z',
    });

    expect(bundle.changes.flows).toEqual([changedFlow]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
```

Expected: FAIL because `exportBundle.ts` does not exist.

- [ ] **Step 3: Implement export builder**

Create `src/dev-dashboard/export/exportBundle.ts`:

```ts
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import { normalizeForComparison } from '../content/normalize';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';

export const DASHBOARD_EXPORT_SCHEMA_VERSION = '1.0.0' as const;

export interface DashboardDraftContent {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
}

export interface DashboardExportBundle {
  schemaVersion: typeof DASHBOARD_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  source: 'secuida-dev-dashboard';
  changes: DashboardDraftContent;
  validation: DashboardValidationResult;
}

export function buildExportBundle({
  shipped,
  drafts,
  validation,
  exportedAt,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
  exportedAt: string;
}): DashboardExportBundle {
  return {
    schemaVersion: DASHBOARD_EXPORT_SCHEMA_VERSION,
    exportedAt,
    source: 'secuida-dev-dashboard',
    changes: {
      flows: changedRecords(shipped.flows, drafts.flows),
      educationMaterials: changedRecords(shipped.educationMaterials, drafts.educationMaterials),
    },
    validation,
  };
}

function changedRecords<T extends { id: string }>(shipped: T[], drafts: T[]) {
  const shippedById = new Map(shipped.map((record) => [record.id, normalizeForComparison(record)]));

  return drafts.filter((draft) => shippedById.get(draft.id) !== normalizeForComparison(draft));
}
```

- [ ] **Step 4: Run export tests**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/exportBundle.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev-dashboard/export src/dev-dashboard/content/normalize.ts src/dev-dashboard/__tests__/exportBundle.test.ts
git commit -m "feat: build dashboard export bundles"
```

---

### Task 8: Build Flow Dashboard UI

**Files:**

- Create: `src/dev-dashboard/flows/FlowDashboard.tsx`
- Create: `src/dev-dashboard/flows/FlowEditor.tsx`
- Create: `src/dev-dashboard/flows/FlowMap.tsx`
- Create: `src/dev-dashboard/flows/FlowPreview.tsx`
- Create: `src/dev-dashboard/components/ValidationSummary.tsx`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write failing UI smoke test**

Create `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRoute } from '../DashboardRoute';

vi.mock('../content/shippedContent', () => ({
  getShippedDashboardContent: () => ({
    flows: [
      {
        id: 'mock-flow',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Fluxo de teste',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
        nodes: {
          start: {
            id: 'start',
            kind: 'choice',
            text: 'Como você quer continuar?',
            options: [
              { id: 'next', label: 'Continuar', next: 'done' },
              {
                id: 'handoff',
                label: 'Ir para outro fluxo',
                effects: [{ kind: 'flow_start', flowId: 'mock-flow-two' }],
              },
            ],
          },
          done: { id: 'done', kind: 'result', text: 'Finalizado.' },
        },
      },
      {
        id: 'mock-flow-two',
        version: '1.0.0',
        locale: 'pt-BR',
        title: 'Segundo fluxo',
        type: 'guided_conversation',
        status: 'draft',
        entry: { nodeId: 'start', enteringPhrases: ['Segundo'], transitionMessage: 'Entrando no segundo fluxo.' },
        nodes: {
          start: { id: 'start', kind: 'result', text: 'Este é outro fluxo.' },
        },
      },
    ],
    educationMaterials: [
      {
        id: 'mock-material',
        title: 'Material de teste',
        source: 'Equipe SeCuida',
        description: 'Descrição do material.',
        tags: ['teste'],
        audience: 'teachers',
        contentType: 'external_link',
        externalUrl: 'https://example.com',
        review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ],
  }),
}));

describe('DashboardRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders pt-BR flow editor helper text', () => {
    render(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fluxos' })).toBeInTheDocument();
    expect(screen.getByText('São frases que uma pessoa pode escolher para começar este fluxo.')).toBeInTheDocument();
    expect(screen.getByText('Mapa visual')).toBeInTheDocument();
    expect(screen.getByText('Testar conversa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para outro fluxo' }));
    expect(screen.getByText('Este é outro fluxo.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because the route still renders placeholders.

- [ ] **Step 3: Add validation summary**

Create `src/dev-dashboard/components/ValidationSummary.tsx`:

```tsx
import type { DashboardValidationResult } from '../validation/validationTypes';

export function ValidationSummary({ result }: { result: DashboardValidationResult }) {
  return (
    <section className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <h3 className="font-headline-sm text-on-surface">Validação</h3>
      {result.errors.length === 0 && result.warnings.length === 0 ? (
        <p className="mt-2 font-body-md text-on-surface-variant">Nenhum problema encontrado neste rascunho.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {[...result.errors, ...result.warnings].map((issue) => (
            <li key={issue.id} className="font-body-md text-on-surface-variant">
              <strong>{issue.level === 'error' ? 'Erro:' : 'Aviso:'}</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add flow editor**

Create `src/dev-dashboard/flows/FlowEditor.tsx`:

```tsx
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { FieldHint } from '../components/FieldHint';
import { flowPurposeLabels } from './flowLabels';

export function FlowEditor({ flow }: { flow: GuidedFlow }) {
  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Dados do fluxo</h2>

      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Título</span>
        <input
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={flow.title}
          readOnly
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Uso do fluxo</span>
        <select
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={flow.purpose ?? 'common'}
          disabled
        >
          <option value="common">{flowPurposeLabels.common}</option>
          <option value="orientation_entry">{flowPurposeLabels.orientation_entry}</option>
          <option value="post_flow_routing">{flowPurposeLabels.post_flow_routing}</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <h3 className="font-headline-sm text-on-surface">Frases de entrada</h3>
        <FieldHint>São frases que uma pessoa pode escolher para começar este fluxo.</FieldHint>
        <ul className="flex flex-wrap gap-2">
          {flow.entry.enteringPhrases.map((phrase) => (
            <li key={phrase} className="rounded-full bg-primary-fixed px-3 py-1 font-label-sm text-on-surface">
              {phrase}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add flow map**

Create `src/dev-dashboard/flows/FlowMap.tsx`:

```tsx
import type { GuidedFlow } from '../../domain/flow-engine/types';

export function FlowMap({ flow }: { flow: GuidedFlow }) {
  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Mapa visual</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.values(flow.nodes).map((node) => (
          <article key={node.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
            <p className="font-label-md text-on-surface">{node.id}</p>
            <p className="mt-1 font-body-md text-on-surface-variant">{node.text}</p>
            {node.kind === 'choice' && (
              <ul className="mt-2 flex flex-col gap-1">
                {node.options.map((option) => (
                  <li key={option.id} className="font-body-md text-on-surface-variant">
                    {option.label} -> {option.effects?.find((effect) => effect.kind === 'flow_start') ? 'começa fluxo' : option.next}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add chat preview placeholder**

Create `src/dev-dashboard/flows/FlowPreview.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { GuidedFlow } from '../../domain/flow-engine/types';

interface PreviewMessage {
  id: string;
  author: 'bot' | 'user';
  text: string;
}

interface PreviewOption {
  id: string;
  label: string;
  next?: string;
  effects?: Array<{ kind: string; flowId?: string }>;
}

export function FlowPreview({ flow, flows }: { flow: GuidedFlow; flows: GuidedFlow[] }) {
  const [activeFlowId, setActiveFlowId] = useState(flow.id);
  const [activeNodeId, setActiveNodeId] = useState(flow.entry.nodeId);
  const [messages, setMessages] = useState<PreviewMessage[]>(() => createInitialMessages(flow));

  const activeFlow = flows.find((item) => item.id === activeFlowId) ?? flow;
  const activeNode = activeFlow.nodes[activeNodeId];

  useEffect(() => {
    setActiveFlowId(flow.id);
    setActiveNodeId(flow.entry.nodeId);
    setMessages(createInitialMessages(flow));
  }, [flow]);

  function chooseOption(option: PreviewOption) {
    const flowStart = option.effects?.find((effect) => effect.kind === 'flow_start');
    const nextFlow = flowStart ? flows.find((item) => item.id === flowStart.flowId) : null;
    const nextNodeId = nextFlow?.entry.nodeId ?? option.next;
    const nextFlowForNode = nextFlow ?? activeFlow;
    const nextNode = nextNodeId ? nextFlowForNode.nodes[nextNodeId] : null;

    setMessages((current) => [
      ...current,
      { id: `user-${current.length}`, author: 'user', text: option.label },
      ...(nextFlow
        ? [{ id: `transition-${current.length}`, author: 'bot' as const, text: nextFlow.entry.transitionMessage }]
        : []),
      {
        id: `bot-${current.length}`,
        author: 'bot',
        text: nextNode?.text ?? 'Este caminho ainda precisa ser corrigido.',
      },
    ]);

    if (nextFlow) setActiveFlowId(nextFlow.id);
    if (nextNodeId) setActiveNodeId(nextNodeId);
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Testar conversa</h2>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl px-4 py-3 ${
              message.author === 'bot'
                ? 'self-start rounded-bl-sm bg-[#EEF8F3]'
                : 'self-end rounded-br-sm bg-primary text-on-primary'
            }`}
          >
            <p className="font-body-md">{message.text}</p>
          </div>
        ))}
      </div>
      {activeNode?.kind === 'choice' && (
        <div className="flex flex-wrap gap-2">
          {activeNode.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => chooseOption(option)}
              className="min-h-11 rounded-full bg-secondary-container px-4 font-label-md text-on-secondary-container"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function createInitialMessages(flow: GuidedFlow): PreviewMessage[] {
  const firstNode = flow.nodes[flow.entry.nodeId];

  return [
    { id: 'transition', author: 'bot', text: flow.entry.transitionMessage },
    {
      id: 'first-node',
      author: 'bot',
      text: firstNode?.text ?? 'A etapa inicial deste fluxo ainda precisa ser corrigida.',
    },
  ];
}
```

- [ ] **Step 7: Add flow dashboard**

Create `src/dev-dashboard/flows/FlowDashboard.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardFlows } from './flowValidation';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';

export function FlowDashboard({ flows, resources }: { flows: GuidedFlow[]; resources: EducationResource[] }) {
  const [selectedFlowId, setSelectedFlowId] = useState(flows[0]?.id);
  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? flows[0];
  const validation = useMemo(
    () =>
      validateDashboardFlows(
        flows,
        resources.map((resource) => resource.id),
      ),
    [flows, resources],
  );

  if (!selectedFlow) {
    return <p className="font-body-md text-on-surface-variant">Nenhum fluxo disponível.</p>;
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <h2 className="font-headline-sm text-on-surface">Fluxos</h2>
        <div className="mt-3 flex flex-col gap-2">
          {flows.map((flow) => (
            <button
              key={flow.id}
              type="button"
              onClick={() => setSelectedFlowId(flow.id)}
              className={`rounded-lg px-3 py-2 text-left font-label-md ${
                selectedFlow.id === flow.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'
              }`}
            >
              {flow.title}
            </button>
          ))}
        </div>
      </aside>
      <div className="flex flex-col gap-stack-md">
        <FlowEditor flow={selectedFlow} />
        <FlowMap flow={selectedFlow} />
        <FlowPreview flow={selectedFlow} flows={flows} />
        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Wire flow dashboard route**

Update `src/dev-dashboard/DashboardRoute.tsx` to load shipped content and render `FlowDashboard` when the tab is `flows`:

```tsx
import { useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import { getShippedDashboardContent } from './content/shippedContent';
import { FlowDashboard } from './flows/FlowDashboard';

export function DashboardRoute() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('flows');
  const shipped = useMemo(() => getShippedDashboardContent(), []);

  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'flows' && <FlowDashboard flows={shipped.flows} resources={shipped.educationMaterials} />}
        {activeTab === 'education' && (
          <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline-sm text-on-surface">Materiais</h2>
          </section>
        )}
        {activeTab === 'export' && (
          <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline-sm text-on-surface">Exportar</h2>
          </section>
        )}
      </DashboardShell>
    </Page>
  );
}
```

- [ ] **Step 9: Run dashboard UI test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/dev-dashboard
git commit -m "feat: add dashboard flow editor"
```

---

### Task 9: Build Education Dashboard UI

**Files:**

- Create: `src/dev-dashboard/education/EducationDashboard.tsx`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add education UI smoke assertion**

Append this test to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```tsx
it('renders pt-BR education helper text', async () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  screen.getByRole('tab', { name: 'Materiais' }).click();

  expect(screen.getByRole('heading', { name: 'Materiais' })).toBeInTheDocument();
  expect(screen.getByText('Escolha como este material será aberto no app.')).toBeInTheDocument();
  expect(screen.getByText('Use palavras curtas para ajudar professores a encontrar o material.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because the education tab has only a placeholder.

- [ ] **Step 3: Implement education dashboard**

Create `src/dev-dashboard/education/EducationDashboard.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import { FieldHint } from '../components/FieldHint';
import { ValidationSummary } from '../components/ValidationSummary';
import { educationContentTypeLabels, educationTypesRequiringUrl } from './educationTypes';
import { validateDashboardEducation } from './educationValidation';

export function EducationDashboard({ resources }: { resources: EducationResource[] }) {
  const [selectedResourceId, setSelectedResourceId] = useState(resources[0]?.id);
  const selectedResource = resources.find((resource) => resource.id === selectedResourceId) ?? resources[0];
  const validation = useMemo(() => validateDashboardEducation(resources), [resources]);

  if (!selectedResource) {
    return <p className="font-body-md text-on-surface-variant">Nenhum material disponível.</p>;
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <h2 className="font-headline-sm text-on-surface">Materiais</h2>
        <div className="mt-3 flex flex-col gap-2">
          {resources.map((resource) => (
            <button
              key={resource.id}
              type="button"
              onClick={() => setSelectedResourceId(resource.id)}
              className={`rounded-lg px-3 py-2 text-left font-label-md ${
                selectedResource.id === resource.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface'
              }`}
            >
              {resource.title}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-col gap-stack-md">
        <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">Dados principais</h2>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Título</span>
            <input
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.title}
              readOnly
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Descrição</span>
            <textarea
              className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
              value={selectedResource.description}
              readOnly
            />
            <FieldHint>Resumo curto que aparece na lista de materiais.</FieldHint>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Fonte</span>
            <input
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.source}
              readOnly
            />
            <FieldHint>Nome da organização, autora ou referência principal do material.</FieldHint>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Tipo do material</span>
            <select
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.contentType}
              readOnly
            >
              {Object.entries(educationContentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <FieldHint>Escolha como este material será aberto no app.</FieldHint>
          </label>
          {educationTypesRequiringUrl.includes(selectedResource.contentType) && (
            <label className="flex flex-col gap-2">
              <span className="font-label-md text-on-surface">Link público</span>
              <input
                className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
                value={selectedResource.externalUrl ?? ''}
                readOnly
              />
              <FieldHint>
                Use um link público de vídeo, áudio, PDF ou página externa. Uploads não são aceitos.
              </FieldHint>
            </label>
          )}
          <div>
            <h3 className="font-headline-sm text-on-surface">Tags</h3>
            <FieldHint>Use palavras curtas para ajudar professores a encontrar o material.</FieldHint>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedResource.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary-fixed px-3 py-1 font-label-sm text-on-surface">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>
        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire education dashboard**

Update `src/dev-dashboard/DashboardRoute.tsx` imports:

```tsx
import { EducationDashboard } from './education/EducationDashboard';
```

Replace the education placeholder:

```tsx
<>{activeTab === 'education' && <EducationDashboard resources={shipped.educationMaterials} />}</>
```

- [ ] **Step 5: Run dashboard UI test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dev-dashboard
git commit -m "feat: add dashboard education editor"
```

---

### Task 10: Add Export UI

**Files:**

- Create: `src/dev-dashboard/export/ExportDashboard.tsx`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add export UI smoke assertion**

Append this test to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```tsx
it('renders export handoff copy', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  screen.getByRole('tab', { name: 'Exportar' }).click();

  expect(screen.getByRole('heading', { name: 'Arquivo para revisão' })).toBeInTheDocument();
  expect(screen.getByText('Ele não publica nada sozinho.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because export dashboard does not exist.

- [ ] **Step 3: Implement export UI**

Create `src/dev-dashboard/export/ExportDashboard.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { DashboardDraftContent } from './exportBundle';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { buildExportBundle } from './exportBundle';

export function ExportDashboard({
  shipped,
  drafts,
  validation,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
}) {
  const [exportedAt] = useState(() => new Date().toISOString());
  const bundle = useMemo(
    () =>
      buildExportBundle({
        shipped,
        drafts,
        validation,
        exportedAt,
      }),
    [drafts, exportedAt, shipped, validation],
  );
  const hasErrors = validation.errors.length > 0;

  function downloadBundle() {
    if (hasErrors) return;

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secuida-dashboard-export-${bundle.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div>
        <h2 className="font-headline-sm text-on-surface">Arquivo para revisão</h2>
        <p className="mt-2 font-body-md text-on-surface-variant">
          Envie este arquivo para a pessoa responsável pelo repositório.
        </p>
        <p className="font-body-md text-on-surface-variant">Ele não publica nada sozinho.</p>
      </div>
      <div className="rounded-lg bg-surface-container-low p-4">
        <p className="font-body-md text-on-surface-variant">
          Fluxos no arquivo: {bundle.changes.flows.length}. Materiais no arquivo:{' '}
          {bundle.changes.educationMaterials.length}.
        </p>
      </div>
      <button
        type="button"
        disabled={hasErrors}
        onClick={downloadBundle}
        className="min-h-11 w-fit rounded-full bg-primary px-5 font-label-md text-on-primary disabled:bg-secondary-container disabled:text-on-secondary-container"
      >
        Gerar arquivo JSON
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Wire export tab**

Update `src/dev-dashboard/DashboardRoute.tsx` imports:

```tsx
import { ExportDashboard } from './export/ExportDashboard';
import { validateDashboardEducation } from './education/educationValidation';
import { validateDashboardFlows } from './flows/flowValidation';
```

Inside `DashboardRoute`, after `shipped`:

```tsx
const validation = useMemo(() => {
  const flowValidation = validateDashboardFlows(
    shipped.flows,
    shipped.educationMaterials.map((resource) => resource.id),
  );
  const educationValidation = validateDashboardEducation(shipped.educationMaterials);

  return {
    errors: [...flowValidation.errors, ...educationValidation.errors],
    warnings: [...flowValidation.warnings, ...educationValidation.warnings],
  };
}, [shipped]);
const drafts = {
  flows: shipped.flows,
  educationMaterials: shipped.educationMaterials,
};
```

At this point Task 10 still has no editable draft state, so `drafts` intentionally mirrors `shipped` and the export count remains zero. Task 11 replaces this with `mergedDrafts` after local sparse drafts are introduced; do not treat the Task 10 placeholder as final export wiring.

Replace the export placeholder:

```tsx
<>{activeTab === 'export' && <ExportDashboard shipped={shipped} drafts={drafts} validation={validation} />}</>
```

- [ ] **Step 5: Run dashboard UI test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dev-dashboard
git commit -m "feat: add dashboard export UI"
```

---

### Task 11: Add Editable Draft Mutations

**Files:**

- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`
- Modify: `src/dev-dashboard/flows/FlowDashboard.tsx`
- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`
- Modify: `src/dev-dashboard/export/ExportDashboard.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Add edit smoke test**

Append this test:

```tsx
it('updates a local flow title draft', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  const titleInput = screen.getByLabelText('Título do fluxo');
  fireEvent.change(titleInput, { target: { value: 'Fluxo editado localmente' } });

  expect(screen.getByDisplayValue('Fluxo editado localmente')).toBeInTheDocument();
});

it('updates a local education title draft', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  screen.getByRole('tab', { name: 'Materiais' }).click();

  const titleInput = screen.getByLabelText('Título do material');
  fireEvent.change(titleInput, { target: { value: 'Material editado localmente' } });

  expect(screen.getByDisplayValue('Material editado localmente')).toBeInTheDocument();
});

it('updates required education metadata drafts', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  screen.getByRole('tab', { name: 'Materiais' }).click();

  fireEvent.change(screen.getByLabelText('Descrição do material'), {
    target: { value: 'Descrição editada localmente' },
  });
  fireEvent.change(screen.getByLabelText('Fonte do material'), {
    target: { value: 'Fonte editada localmente' },
  });

  expect(screen.getByDisplayValue('Descrição editada localmente')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Fonte editada localmente')).toBeInTheDocument();
});

it('updates a link-based education URL draft', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  screen.getByRole('tab', { name: 'Materiais' }).click();

  fireEvent.change(screen.getByLabelText('Link público do material'), {
    target: { value: 'https://example.com/material.pdf' },
  });

  expect(screen.getByDisplayValue('https://example.com/material.pdf')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: FAIL because flow and education inputs are read-only and not labeled for editing.

- [ ] **Step 3: Load and save local drafts in route**

Update `DashboardRoute.tsx` to use draft storage:

```tsx
import { useMemo, useState } from 'react';
import {
  createEmptyDashboardDraftState,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  saveDashboardDrafts,
} from './draft-storage/dashboardStorage';
```

Inside component:

```tsx
const shipped = useMemo(() => getShippedDashboardContent(), []);
const [draftState, setDraftState] = useState(() => loadDashboardDrafts());
const mergedDrafts = useMemo(() => mergeDashboardDrafts(shipped, draftState), [draftState, shipped]);

function updateDraftState(updater: (current: typeof draftState) => typeof draftState) {
  setDraftState((current) => {
    const next = {
      ...updater(current),
      updatedAt: new Date().toISOString(),
    };

    saveDashboardDrafts(next);
    return next;
  });
}
```

Use `mergedDrafts.flows` and `mergedDrafts.educationMaterials` instead of `shipped` records for dashboard tabs, export drafts, and the existing memoized validation block. Do not seed localStorage with shipped content and do not call `saveDashboardDrafts` from a mount-time `useEffect`; either approach would lock the browser to stale copies of future code-level content changes.

- [ ] **Step 4: Make flow editor editable**

Change `FlowEditor` props:

```tsx
export function FlowEditor({ flow, onChange }: { flow: GuidedFlow; onChange: (patch: Partial<GuidedFlow>) => void }) {
```

Change title field:

```tsx
<label className="flex flex-col gap-2">
  <span className="font-label-md text-on-surface">Título do fluxo</span>
  <input
    aria-label="Título do fluxo"
    className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
    value={flow.title}
    onChange={(event) => onChange({ title: event.target.value })}
  />
</label>
```

Change purpose select:

```tsx
<select
  className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
  value={flow.purpose ?? 'common'}
  onChange={(event) =>
    onChange({
      purpose: event.target.value === 'common' ? undefined : (event.target.value as GuidedFlow['purpose']),
    })
  }
>
```

- [ ] **Step 5: Pass flow mutations through dashboard**

Update `FlowDashboard` props:

```tsx
export function FlowDashboard({
  flows,
  resources,
  onFlowChange,
}: {
  flows: GuidedFlow[];
  resources: EducationResource[];
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
}) {
```

Change the selection state to use array indexes, not flow IDs. Duplicate IDs are invalid, but the editor must still avoid destroying data while the user fixes them:

```tsx
const [selectedFlowIndex, setSelectedFlowIndex] = useState(0);
const selectedFlow = flows[selectedFlowIndex] ?? flows[0];
```

Change each sidebar button handler to use the mapped index:

```tsx
<>
  {flows.map((flow, flowIndex) => (
    <button key={`${flow.id}-${flowIndex}`} type="button" onClick={() => setSelectedFlowIndex(flowIndex)}>
      {flow.title}
    </button>
  ))}
</>
```

Pass to editor:

```tsx
<FlowEditor flow={selectedFlow} onChange={(patch) => onFlowChange(selectedFlowIndex, selectedFlow.id, patch)} />
```

In `DashboardRoute`, pass:

```tsx
<FlowDashboard
  flows={mergedDrafts.flows}
  resources={mergedDrafts.educationMaterials}
  onFlowChange={(flowIndex, flowId, patch) =>
    updateDraftState((current) => ({
      ...current,
      flowPatches: upsertPatchById(current.flowPatches, flowId, patch),
    }))
  }
/>
```

If the edited flow is a newly added local-only flow, update `addedFlows` with the complete merged record instead of `flowPatches`. For the first implementation, shipped rows can be detected with `shipped.flows.some((item) => item.id === flowId)`.

- [ ] **Step 6: Make education editor editable**

Change `EducationDashboard` props:

```tsx
export function EducationDashboard({
  resources,
  onResourceChange,
}: {
  resources: EducationResource[];
  onResourceChange: (resourceIndex: number, resourceId: string, patch: Partial<EducationResource>) => void;
}) {
```

Change the selection state to use array indexes for the same duplicate-ID safety:

```tsx
const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
const selectedResource = resources[selectedResourceIndex] ?? resources[0];
```

Change each sidebar button handler to use the mapped index:

```tsx
<>
  {resources.map((resource, resourceIndex) => (
    <button
      key={`${resource.id}-${resourceIndex}`}
      type="button"
      onClick={() => setSelectedResourceIndex(resourceIndex)}
    >
      {resource.title}
    </button>
  ))}
</>
```

Change the title field:

```tsx
<label className="flex flex-col gap-2">
  <span className="font-label-md text-on-surface">Título do material</span>
  <input
    aria-label="Título do material"
    className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
    value={selectedResource.title}
    onChange={(event) => onResourceChange(selectedResourceIndex, selectedResource.id, { title: event.target.value })}
  />
</label>
```

Add editable required fields for the properties enforced by validation:

```tsx
<label className="flex flex-col gap-2">
  <span className="font-label-md text-on-surface">Descrição</span>
  <textarea
    aria-label="Descrição do material"
    className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
    value={selectedResource.description}
    onChange={(event) =>
      onResourceChange(selectedResourceIndex, selectedResource.id, { description: event.target.value })
    }
  />
  <FieldHint>Resumo curto que aparece na lista de materiais.</FieldHint>
</label>

<label className="flex flex-col gap-2">
  <span className="font-label-md text-on-surface">Fonte</span>
  <input
    aria-label="Fonte do material"
    className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
    value={selectedResource.source}
    onChange={(event) => onResourceChange(selectedResourceIndex, selectedResource.id, { source: event.target.value })}
  />
  <FieldHint>Nome da organização, autora ou referência principal do material.</FieldHint>
</label>
```

Add an editable URL field for link-based material types:

```tsx
<>
  {educationTypesRequiringUrl.includes(selectedResource.contentType) && (
    <label className="flex flex-col gap-2">
      <span className="font-label-md text-on-surface">Link público</span>
      <input
        aria-label="Link público do material"
        className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
        value={selectedResource.externalUrl ?? ''}
        onChange={(event) =>
          onResourceChange(selectedResourceIndex, selectedResource.id, { externalUrl: event.target.value })
        }
      />
      <FieldHint>Use um link público de vídeo, áudio, PDF ou página externa. Uploads não são aceitos.</FieldHint>
    </label>
  )}
</>
```

Change the content-type select from `readOnly` to an editable `onChange` handler:

```tsx
<select
  className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
  value={selectedResource.contentType}
  onChange={(event) =>
    onResourceChange(selectedResourceIndex, selectedResource.id, {
      contentType: event.target.value as EducationResource['contentType'],
    })
  }
>
```

In `DashboardRoute`, pass:

```tsx
<EducationDashboard
  resources={mergedDrafts.educationMaterials}
  onResourceChange={(resourceIndex, resourceId, patch) =>
    updateDraftState((current) => ({
      ...current,
      educationMaterialPatches: upsertPatchById(current.educationMaterialPatches, resourceId, patch),
    }))
  }
/>
```

If the edited material is newly added locally, update `addedEducationMaterials` with the complete merged record instead of `educationMaterialPatches`. Use the same shipped-record check as flows.

Add a small helper near `DashboardRoute`:

```tsx
function upsertPatchById<T extends { id: string }>(
  records: Array<{ id: string; patch: Partial<T> }>,
  id: string,
  patch: Partial<T>,
) {
  const existingIndex = records.findIndex((record) => record.id === id);
  if (existingIndex === -1) return [...records, { id, patch }];

  return records.map((record, index) =>
    index === existingIndex ? { id, patch: { ...record.patch, ...patch } } : record,
  );
}
```

- [ ] **Step 7: Run edit smoke test**

Run:

```bash
pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/dev-dashboard
git commit -m "feat: edit dashboard local drafts"
```

---

### Task 12: Final Verification

**Files:**

- Modify as needed from failures only.

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 2: Run flow/content validation**

Run:

```bash
pnpm run validate:flows
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and lint**

Run:

```bash
pnpm run typecheck
pnpm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build without dashboard flag**

Run:

```bash
pnpm run build
```

Expected: PASS. Confirm the dashboard route is not reachable through normal UI.

- [ ] **Step 5: Run build with dashboard flag**

Run:

```bash
$env:VITE_ENABLE_DEV_DASHBOARD='true'; pnpm run build
```

Expected: PASS. Reset the env var in the shell if needed:

```bash
Remove-Item Env:VITE_ENABLE_DEV_DASHBOARD
```

- [ ] **Step 6: Browser verify dashboard**

Start dev server:

```bash
$env:VITE_ENABLE_DEV_DASHBOARD='true'; pnpm run dev
```

Open the app in the browser at the dev-server URL. Verify:

- top navigation shows `Dashboard`;
- dashboard route opens from the UI button;
- flow tab shows `Frases de entrada`, `Mapa visual`, and `Testar conversa`;
- education tab shows pt-BR helper text;
- export tab shows `Arquivo para revisão`;
- generated JSON contains `schemaVersion`, `changes.flows`, and `changes.educationMaterials`.

- [ ] **Step 7: Commit final fixes**

If Step 1-6 required any fixes:

```bash
git add <changed-files>
git commit -m "chore: verify dev dashboard"
```

If no fixes were needed, do not create an empty commit.

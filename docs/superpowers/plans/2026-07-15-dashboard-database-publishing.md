# Dashboard Database Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's primary ZIP export with explicit, revision-safe Neon publication that becomes the runtime content source for public users, while retaining local drafts and an environment-controlled ZIP fallback.

**Architecture:** Store one complete validated content snapshot in a singleton `public.published_content` row. A shared Neon client feeds a repository and an application-level content provider; public screens consume that provider, while the dashboard continues merging local sparse drafts and publishes the full merged snapshot only after confirmation. Bundled TypeScript content remains the empty-database and outage fallback.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest, Testing Library, Neon Auth, Neon Data API/PostgREST, PostgreSQL JSONB and RLS

---

## Execution Baseline

The current working tree contains uncommitted admin-authentication work in `src/app/auth/`, `src/features/admin-login/`, `src/app/providers.tsx`, routing/navigation files, Neon migration files, and documentation. This plan depends on that work.

Before executing Task 1:

1. Run `git status --short`.
2. Preserve all existing changes; do not reset or check them out.
3. Verify or commit the admin-authentication work as its own logical change before creating an isolated worktree.
4. If the auth work must remain uncommitted, execute in the current worktree and stage only the files named by each task after reviewing `git diff --cached`.

Do not start this plan from commit `f2856b9` in a clean worktree unless the pending auth implementation has first been committed or copied into that baseline.

## File Map

New application content files:

- `src/app/content/publishedContent.ts`: snapshot and payload types, structural parsing, publication validation, and payload-size checks.
- `src/app/content/bundledContent.ts`: adapts current TypeScript content modules into a complete fallback payload.
- `src/app/content/publishedContentRepository.ts`: repository contract, domain errors, and Neon implementation over a small gateway.
- `src/app/content/PublishedContentContext.ts`: React context contract and hook.
- `src/app/content/PublishedContentProvider.tsx`: startup load, focus refresh, fallback behavior, and in-memory replacement after publish.
- `src/app/neon/database.ts`: generated-style TypeScript shape for the two public tables used by the browser.
- `src/app/neon/client.ts`: shared configured Neon client with anonymous Data API reads enabled.

New dashboard files:

- `src/dev-dashboard/publishing/publishMode.ts`: parses `VITE_DASHBOARD_PUBLISH_MODE`.
- `src/dev-dashboard/publishing/changeSummary.ts`: shared complete-snapshot change counts for export and publish UIs.
- `src/dev-dashboard/publishing/PublishDashboard.tsx`: publication confirmation, state, and error UI.

New tests:

- `src/app/content/__tests__/publishedContent.test.ts`
- `src/app/content/__tests__/publishedContentRepository.test.ts`
- `src/app/content/__tests__/PublishedContentProvider.test.tsx`
- `src/app/neon/__tests__/client.test.ts`
- `src/dev-dashboard/publishing/__tests__/publishMode.test.ts`
- `src/dev-dashboard/publishing/__tests__/changeSummary.test.ts`
- `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx`
- `src/dev-dashboard/components/__tests__/fileUpload.test.ts`

Database:

- `neon/migrations/20260715000000_published_content.sql`: singleton snapshot table, grants, and RLS policies.

Existing files modified by the plan:

- `src/app/auth/neonClient.ts` and its test: consume the shared Neon client rather than creating a private instance.
- `src/app/providers.tsx`: install the content provider under the auth provider.
- `src/dev-dashboard/content/shippedContent.ts`: delegate bundled content construction to the application content module.
- `src/features/orientation/OrientationScreen.tsx`: use provider flows and freeze the selected flow set for an active conversation.
- `src/features/contacts/ContactsScreen.tsx`: render provider contacts.
- `src/features/education/educationResourcePreview.ts`, `EducationLibraryScreen.tsx`, and `ResourceDetailScreen.tsx`: merge local previews over the provider baseline.
- `src/dev-dashboard/components/fileUpload.ts`: enforce the 1 MiB source image limit.
- `src/dev-dashboard/components/DashboardShell.tsx`: label the final tab `Publicar` or `Exportar` without changing its stored tab ID.
- `src/dev-dashboard/export/ExportDashboard.tsx`: consume the shared change summary.
- `src/dev-dashboard/DashboardRoute.tsx`: use the provider baseline and clear local drafts only after a confirmed publish.
- `.env.example`, `.github/workflows/deploy.yml`, and `README.md`: document and configure publication mode and rollout.

### Task 1: Add the Publication Mode Boundary

**Files:**

- Create: `src/dev-dashboard/publishing/publishMode.ts`
- Create: `src/dev-dashboard/publishing/__tests__/publishMode.test.ts`

- [ ] **Step 1: Write the failing mode tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDashboardPublishMode } from '../publishMode';

afterEach(() => vi.unstubAllEnvs());

describe('getDashboardPublishMode', () => {
  it('defaults to database publication', () => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', '');
    expect(getDashboardPublishMode()).toBe('database');
  });

  it('enables ZIP export only for the explicit export value', () => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', 'export');
    expect(getDashboardPublishMode()).toBe('export');
  });

  it.each(['DATABASE', 'true', 'zip'])('treats unsupported value %s as database mode', (value) => {
    vi.stubEnv('VITE_DASHBOARD_PUBLISH_MODE', value);
    expect(getDashboardPublishMode()).toBe('database');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm run test -- src/dev-dashboard/publishing/__tests__/publishMode.test.ts`

Expected: FAIL because `publishMode.ts` does not exist.

- [ ] **Step 3: Implement the mode parser**

```ts
export type DashboardPublishMode = 'database' | 'export';

export function getDashboardPublishMode(
  value: string | undefined = import.meta.env.VITE_DASHBOARD_PUBLISH_MODE,
): DashboardPublishMode {
  return value === 'export' ? 'export' : 'database';
}
```

Do not read `VITE_DISABLE_AUTH` here. That flag remains owned by `AdminAuthProvider`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm run test -- src/dev-dashboard/publishing/__tests__/publishMode.test.ts`

Expected: PASS, 3 test cases.

- [ ] **Step 5: Commit the mode boundary**

```bash
git add src/dev-dashboard/publishing/publishMode.ts src/dev-dashboard/publishing/__tests__/publishMode.test.ts
git commit -m "feat: add dashboard publish mode"
```

### Task 2: Define and Validate Complete Published Snapshots

**Files:**

- Create: `src/app/content/publishedContent.ts`
- Create: `src/app/content/bundledContent.ts`
- Create: `src/app/content/__tests__/publishedContent.test.ts`
- Modify: `src/dev-dashboard/content/shippedContent.ts`

- [ ] **Step 1: Write failing payload and row parser tests**

Build a small valid fixture with one valid guided flow, one education resource, one group, and one contact. Cover these exact cases:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
  parsePublishedContentRow,
  validatePublicationPayload,
} from '../publishedContent';
import { getBundledContent } from '../bundledContent';

describe('published content validation', () => {
  it('parses a valid database row', () => {
    const payload = getBundledContent();
    expect(
      parsePublishedContentRow({
        id: 'current',
        schema_version: '1.0.0',
        revision: 3,
        payload,
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toMatchObject({ revision: 3, payload });
  });

  it('rejects a row with a malformed payload instead of exposing it to screens', () => {
    expect(() =>
      parsePublishedContentRow({
        id: 'current',
        schema_version: '1.0.0',
        revision: 1,
        payload: { flows: 'not-an-array' },
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow(PublishedContentValidationError);
  });

  it('rejects unsupported schema versions', () => {
    const payload = getBundledContent();
    expect(() =>
      parsePublishedContentRow({
        id: 'current',
        schema_version: '2.0.0',
        revision: 1,
        payload,
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow(/schema/i);
  });

  it('rejects publication payloads larger than 5 MiB', () => {
    const payload = getBundledContent();
    payload.educationMaterials[0] = {
      ...payload.educationMaterials[0],
      description: 'x'.repeat(MAX_PUBLISHED_PAYLOAD_BYTES),
    };
    expect(() => validatePublicationPayload(payload)).toThrow(/5 MiB/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm run test -- src/app/content/__tests__/publishedContent.test.ts`

Expected: FAIL because the content modules do not exist.

- [ ] **Step 3: Implement the shared payload and snapshot types**

Use these public contracts in `publishedContent.ts`:

```ts
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';

export const PUBLISHED_CONTENT_SCHEMA_VERSION = '1.0.0' as const;
export const MAX_PUBLISHED_PAYLOAD_BYTES = 5 * 1024 * 1024;

export interface PublishedContentPayload {
  flows: GuidedFlow[];
  educationMaterials: EducationResource[];
  educationGroups: EducationResourceGroup[];
  contacts: ServiceDirectoryEntry[];
  defaultGroupOrder: number;
}

export interface PublishedContentSnapshot {
  schemaVersion: typeof PUBLISHED_CONTENT_SCHEMA_VERSION;
  revision: number;
  payload: PublishedContentPayload;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedContentRow {
  id: 'current';
  schema_version: string;
  revision: number;
  payload: unknown;
  published_at: string;
  published_by: string;
}

export class PublishedContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishedContentValidationError';
  }
}
```

Implement `parsePublishedContentRow(row: PublishedContentRow)` with explicit checks before any type assertion:

- `id` equals `current`;
- schema version equals `1.0.0`;
- revision is a positive safe integer;
- timestamps and publisher ID are non-empty strings;
- payload is a non-array object;
- the four collections are arrays and `defaultGroupOrder` is finite;
- each flow can be parsed by `parseGuidedFlow` and passes `validateFlow`;
- each education resource has non-empty `id`, `title`, `source`, and `description`, string `tags`, a supported audience, an object `review`, and an optional array `body`;
- each group has string `id`/`title` and finite numeric `order`;
- each contact has the string fields consumed by `ContactsScreen`/`ServiceCard`, a supported `badgeTone`, and an object `review`.

The returned object must use parsed flow values rather than the original unknown array.

Implement the size guard exactly as bytes, not JavaScript character count:

```ts
export function getPublishedPayloadSize(payload: PublishedContentPayload) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function validatePublicationPayload(payload: PublishedContentPayload) {
  const parsed = parsePayload(payload);
  if (getPublishedPayloadSize(parsed) > MAX_PUBLISHED_PAYLOAD_BYTES) {
    throw new PublishedContentValidationError('O conteúdo publicado não pode exceder 5 MiB.');
  }
  return parsed;
}
```

`parsePayload` is the shared structural validator used by both row parsing and publication validation. It must throw `PublishedContentValidationError` with the failing collection/field in the message; it must never leak a raw `TypeError` from `.trim()`, `.map()`, or a dashboard validator.

- [ ] **Step 4: Implement the bundled fallback adapter**

```ts
import { flowRegistry } from '../../content/flows/registry';
import { educationResourceGroups } from '../../content/resources/groups';
import { resourcesContent } from '../../content/resources/resources';
import { canoasServices } from '../../content/services/canoas-services';
import type { PublishedContentPayload } from './publishedContent';

export function getBundledContent(): PublishedContentPayload {
  return {
    flows: [...flowRegistry.flows],
    educationMaterials: [...resourcesContent.resources],
    educationGroups: [...educationResourceGroups],
    contacts: [...canoasServices.services],
    defaultGroupOrder: 0,
  };
}
```

Change `src/dev-dashboard/content/shippedContent.ts` into a compatibility adapter so dashboard storage tests keep their existing imports:

```ts
import { getBundledContent } from '../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../app/content/publishedContent';

export type DashboardShippedContent = Omit<PublishedContentPayload, 'defaultGroupOrder'> & {
  defaultGroupOrder?: number;
};

export function getShippedDashboardContent(): DashboardShippedContent {
  return getBundledContent();
}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm run test -- src/app/content/__tests__/publishedContent.test.ts src/dev-dashboard/__tests__/dashboardStorage.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the content contracts**

```bash
git add src/app/content/publishedContent.ts src/app/content/bundledContent.ts src/app/content/__tests__/publishedContent.test.ts src/dev-dashboard/content/shippedContent.ts
git commit -m "feat: define published content snapshots"
```

### Task 3: Enforce Image and Snapshot Size Limits

**Files:**

- Modify: `src/dev-dashboard/components/fileUpload.ts`
- Create: `src/dev-dashboard/components/__tests__/fileUpload.test.ts`
- Modify: `src/dev-dashboard/education/EducationDashboard.tsx`

- [ ] **Step 1: Write failing file-size tests**

```ts
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_UPLOAD_BYTES, readFileAsDataUrl } from '../fileUpload';

describe('readFileAsDataUrl', () => {
  it('rejects image files larger than 1 MiB before FileReader work starts', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).rejects.toThrow('1 MiB');
  });

  it('reads a valid small image as a data URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'small.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm run test -- src/dev-dashboard/components/__tests__/fileUpload.test.ts`

Expected: FAIL because oversized files are currently read.

- [ ] **Step 3: Add the source image limit**

```ts
export const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return Promise.reject(new Error('A imagem não pode exceder 1 MiB.'));
  }
  // Keep the existing FileReader implementation below this guard.
}
```

In each of the three `readFileAsDataUrl` call sites in `EducationDashboard.tsx`, catch this error and place its Portuguese message in one shared component state rendered with `role="alert"`. Clear the alert before starting another read and after a successful read. Do not allow an unhandled rejected promise from an input change handler.

- [ ] **Step 4: Add a dashboard UI regression test for an oversized upload**

Add this focused case to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`, using the first file input in the selected education material as the thumbnail upload:

```ts
it('rejects an oversized education thumbnail without replacing the current value', async () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Materiais' }));

  const currentUrl = screen.getByLabelText('URL da miniatura da biblioteca');
  const originalValue = currentUrl.getAttribute('value') ?? (currentUrl as HTMLInputElement).value;
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();

  const oversized = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.png', {
    type: 'image/png',
  });
  fireEvent.change(fileInput!, { target: { files: [oversized] } });

  expect(await screen.findByRole('alert')).toHaveTextContent('A imagem não pode exceder 1 MiB.');
  expect(currentUrl).toHaveValue(originalValue);
});
```

Import `MAX_IMAGE_UPLOAD_BYTES` from `../components/fileUpload` in the test file.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm run test -- src/dev-dashboard/components/__tests__/fileUpload.test.ts src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "image|imagem|upload"`

Expected: PASS.

- [ ] **Step 6: Commit upload limits**

```bash
git add src/dev-dashboard/components/fileUpload.ts src/dev-dashboard/components/__tests__/fileUpload.test.ts src/dev-dashboard/education/EducationDashboard.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: limit dashboard image uploads"
```

### Task 4: Add the Published Content Table and RLS Policies

**Files:**

- Create: `neon/migrations/20260715000000_published_content.sql`

- [ ] **Step 1: Create the migration with the exact table and grants**

```sql
create table if not exists public.published_content (
  id text primary key check (id = 'current'),
  schema_version text not null,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references neon_auth."user" (id)
);

alter table public.published_content enable row level security;

revoke all on table public.published_content from anonymous, authenticated;
grant select on table public.published_content to anonymous, authenticated;
grant insert, update on table public.published_content to authenticated;

create policy "Anyone can read current published content"
on public.published_content
for select
to anonymous, authenticated
using (id = 'current');

create policy "Administrators can create published content"
on public.published_content
for insert
to authenticated
with check (
  public.is_admin()
  and published_by::text = (select auth.user_id())
);

create policy "Administrators can update published content"
on public.published_content
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and published_by::text = (select auth.user_id())
);

comment on table public.published_content is
  'Singleton live SeCuida content snapshot read by the public application.';
comment on column public.published_content.revision is
  'Optimistic concurrency revision incremented by each successful publication.';
```

Do not add a delete grant or policy. This migration intentionally depends on `20260709000000_admin_accounts.sql` for `public.is_admin()`.

- [ ] **Step 2: Review the migration statically**

Run: `rg -n "grant|create policy|is_admin|published_by|delete" neon/migrations/20260715000000_published_content.sql`

Expected: public select grants; authenticated insert/update grants; admin checks on both write policies; no delete grant or delete policy.

- [ ] **Step 3: Apply in a disposable Neon branch when credentials are available**

Apply `20260709000000_admin_accounts.sql` first, then this migration. Verify with an anonymous Data API request that `select` succeeds, with a non-admin authenticated request that insert/update fails, and with an allowlisted admin request that insert succeeds.

If no disposable Neon branch or credentials are available, record this as an external verification gap; do not claim the live migration was tested.

- [ ] **Step 4: Commit the migration**

```bash
git add neon/migrations/20260715000000_published_content.sql
git commit -m "feat: add published content schema"
```

### Task 5: Share the Neon Client and Implement the Repository

**Files:**

- Create: `src/app/neon/database.ts`
- Create: `src/app/neon/client.ts`
- Create: `src/app/neon/__tests__/client.test.ts`
- Modify: `src/app/auth/neonClient.ts`
- Modify: `src/app/auth/__tests__/neonClient.test.ts`
- Create: `src/app/content/publishedContentRepository.ts`
- Create: `src/app/content/__tests__/publishedContentRepository.test.ts`

- [ ] **Step 1: Write failing shared-client tests**

Cover incomplete configuration and anonymous-read configuration:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createConfiguredNeonClient } from '../client';

describe('createConfiguredNeonClient', () => {
  it('returns null when either public endpoint is missing', () => {
    expect(createConfiguredNeonClient({ authUrl: '', dataApiUrl: '' }, vi.fn())).toBeNull();
  });

  it('enables anonymous Data API reads on the shared client', () => {
    const factory = vi.fn().mockReturnValue({ auth: {}, from: vi.fn() });
    createConfiguredNeonClient({ authUrl: 'https://auth.example', dataApiUrl: 'https://data.example' }, factory);
    expect(factory).toHaveBeenCalledWith({
      auth: { url: 'https://auth.example', allowAnonymous: true },
      dataApi: { url: 'https://data.example' },
    });
  });
});
```

- [ ] **Step 2: Write failing repository tests**

Use an injected gateway, not a mocked global Neon module. Cover:

```ts
it('returns null when the current row does not exist');
it('parses and returns the current row');
it('inserts revision 1 when expectedRevision is null');
it('updates revision N to N + 1 using the expected revision');
it('maps an empty conditional update to conflict');
it('maps PostgreSQL 23505 on first insert to conflict');
it('maps 42501 and missing auth token errors to unauthorized');
it('maps invalid rows to invalid_payload');
it('rejects oversized payloads before calling the gateway');
```

The successful update expectation must include the full payload, the supplied `publisherId`, and `revision: expectedRevision + 1`.

- [ ] **Step 3: Run both test files and verify RED**

Run: `pnpm run test -- src/app/neon/__tests__/client.test.ts src/app/content/__tests__/publishedContentRepository.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Add the typed database shape and shared client**

In `database.ts`, define the `public.admin_users` and `public.published_content` `Row`, `Insert`, and `Update` shapes expected by `createClient<Database>()`. Include `public.is_admin` under `Functions`. Keep `Views`, `Enums`, and `CompositeTypes` as empty records.

In `client.ts`, export:

```ts
import { createClient } from '@neondatabase/neon-js';
import type { Database } from './database';

export interface NeonConfig {
  authUrl: string;
  dataApiUrl: string;
}

export function getNeonConfig(): NeonConfig {
  return {
    authUrl: import.meta.env.VITE_NEON_AUTH_URL ?? '',
    dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL ?? '',
  };
}

export function createConfiguredNeonClient(config: NeonConfig = getNeonConfig(), factory = createClient<Database>) {
  if (!config.authUrl || !config.dataApiUrl) return null;
  return factory({
    auth: { url: config.authUrl, allowAnonymous: true },
    dataApi: { url: config.dataApiUrl },
  });
}

export type SeCuidaNeonClient = NonNullable<ReturnType<typeof createConfiguredNeonClient>>;
export const defaultNeonClient = createConfiguredNeonClient();
```

Refactor `src/app/auth/neonClient.ts` so `createNeonAdminAuthBackend` accepts a `NeonAuthClient | null` with `defaultNeonClient` as its default. Preserve all existing auth/session mapping behavior. Update its tests to inject `createClient()` directly rather than passing config plus a factory. The shared-client tests now own configuration coverage.

- [ ] **Step 5: Implement the repository contract and gateway**

Use these contracts:

```ts
export type PublishedContentRepositoryErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'conflict'
  | 'invalid_payload'
  | 'unavailable';

export class PublishedContentRepositoryError extends Error {
  constructor(
    public readonly code: PublishedContentRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PublishedContentRepositoryError';
  }
}

export interface PublishContentInput {
  payload: PublishedContentPayload;
  expectedRevision: number | null;
  publisherId: string;
}

export interface PublishedContentRepository {
  loadPublishedContent(): Promise<PublishedContentSnapshot | null>;
  publishContent(input: PublishContentInput): Promise<PublishedContentSnapshot>;
}

interface DataApiError {
  code?: string;
  message: string;
}

type PublishedContentInsert = Database['public']['Tables']['published_content']['Insert'];
type PublishedContentUpdate = Database['public']['Tables']['published_content']['Update'];

interface PublishedContentGateway {
  readCurrent(): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  insertCurrent(row: PublishedContentInsert): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
  updateCurrent(
    expectedRevision: number,
    row: PublishedContentUpdate,
  ): Promise<{ data: PublishedContentRow | null; error: DataApiError | null }>;
}
```

The Neon gateway must issue these PostgREST operations:

```ts
client.from('published_content').select('*').eq('id', 'current').maybeSingle();
client.from('published_content').insert(insert).select('*').single();
client
  .from('published_content')
  .update(update)
  .eq('id', 'current')
  .eq('revision', expectedRevision)
  .select('*')
  .maybeSingle();
```

Repository publication rules:

```ts
const payload = validatePublicationPayload(input.payload);
const nextRevision = input.expectedRevision === null ? 1 : input.expectedRevision + 1;
const write = {
  schema_version: PUBLISHED_CONTENT_SCHEMA_VERSION,
  revision: nextRevision,
  payload,
  published_at: new Date().toISOString(),
  published_by: input.publisherId,
};
```

For an initial insert, include `id: 'current'`. For updates, do not update `id`. Treat a successful response with `data: null` as a conflict. Map `23505` to conflict and `42501`, `PGRST301`, or `AuthRequiredError` to unauthorized. Parse every returned row with `parsePublishedContentRow`; map parser failures to `invalid_payload`. Map all remaining Data API/network failures to `unavailable` without exposing raw server messages to the UI.

Export `defaultPublishedContentRepository` built from `defaultNeonClient`; when the client is null, both methods throw `not_configured`.

- [ ] **Step 6: Run repository, auth, and type tests**

Run: `pnpm run test -- src/app/neon/__tests__/client.test.ts src/app/content/__tests__/publishedContentRepository.test.ts src/app/auth/__tests__/neonClient.test.ts`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS with the installed `@neondatabase/neon-js` 0.6.2-beta types.

- [ ] **Step 7: Commit the client and repository**

```bash
git add src/app/neon src/app/auth/neonClient.ts src/app/auth/__tests__/neonClient.test.ts src/app/content/publishedContentRepository.ts src/app/content/__tests__/publishedContentRepository.test.ts
git commit -m "feat: add Neon published content repository"
```

### Task 6: Add the Runtime Content Provider

**Files:**

- Create: `src/app/content/PublishedContentContext.ts`
- Create: `src/app/content/PublishedContentProvider.tsx`
- Create: `src/app/content/__tests__/PublishedContentProvider.test.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Write failing provider tests**

Use a probe component that prints `source`, `status`, `revision`, and the first contact name. Cover:

```ts
it('starts with bundled content and replaces it with a valid database snapshot');
it('keeps bundled content when the table is empty');
it('keeps bundled content and exposes fallback status when loading fails');
it('refreshes published content when the window regains focus');
it('publishes with the current revision and replaces content in memory');
it('does not replace content when publication fails');
```

For the publish test, assert the repository call exactly:

```ts
expect(repository.publishContent).toHaveBeenCalledWith({
  payload: nextPayload,
  expectedRevision: 4,
  publisherId: 'admin-id',
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `pnpm run test -- src/app/content/__tests__/PublishedContentProvider.test.tsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Define the context contract**

```ts
export type PublishedContentSource = 'bundled' | 'database';
export type PublishedContentStatus = 'loading' | 'ready' | 'fallback';

export interface PublishedContentContextValue {
  content: PublishedContentPayload;
  snapshot: PublishedContentSnapshot | null;
  source: PublishedContentSource;
  status: PublishedContentStatus;
  loadError: PublishedContentRepositoryError | PublishedContentValidationError | null;
  refresh(): Promise<void>;
  publish(payload: PublishedContentPayload, publisherId: string): Promise<PublishedContentSnapshot>;
}
```

Export `PublishedContentContext` for focused tests and `usePublishedContent()`, which throws if called outside the provider.

- [ ] **Step 4: Implement provider state transitions**

Initialize `content` with `getBundledContent()`, `snapshot` with `null`, `source` with `bundled`, and `status` with `loading`.

`refresh()` rules:

```ts
const next = await repository.loadPublishedContent();
if (next) {
  setContent(next.payload);
  setSnapshot(next);
  setSource('database');
}
setStatus('ready');
setLoadError(null);
```

On error, retain the current content and snapshot, set `status` to `fallback`, and store the mapped error. Protect startup promises with an `active` flag so an unmounted provider is not updated.

Register one `window.focus` listener that calls `refresh()`, remove it on cleanup, and do not blank content while a focus refresh is pending.

`publish(payload, publisherId)` calls the repository with `expectedRevision: snapshot?.revision ?? null`. Only after the repository resolves, replace `content`, `snapshot`, `source`, `status`, and `loadError`, then return the snapshot. Let errors propagate without mutating the current content.

- [ ] **Step 5: Install the provider**

```tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <PublishedContentProvider>{children}</PublishedContentProvider>
    </AdminAuthProvider>
  );
}
```

Keep the content provider under `AdminAuthProvider`; publication receives the current admin ID from dashboard UI, while public startup reads remain anonymous-capable.

- [ ] **Step 6: Run provider tests and typecheck**

Run: `pnpm run test -- src/app/content/__tests__/PublishedContentProvider.test.tsx`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS. Route tests are updated together with their public-screen consumers in Task 7, so this task does not create a checkpoint with a known failing test command.

- [ ] **Step 7: Commit the provider**

```bash
git add src/app/content/PublishedContentContext.ts src/app/content/PublishedContentProvider.tsx src/app/content/__tests__/PublishedContentProvider.test.tsx src/app/providers.tsx
git commit -m "feat: add published content provider"
```

### Task 7: Move Public Screens to the Live Content Provider

**Files:**

- Modify: `src/features/orientation/OrientationScreen.tsx`
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`
- Modify: `src/features/contacts/ContactsScreen.tsx`
- Modify: `src/features/contacts/__tests__/ContactsScreen.test.tsx`
- Modify: `src/features/education/educationResourcePreview.ts`
- Modify: `src/features/education/EducationLibraryScreen.tsx`
- Modify: `src/features/education/ResourceDetailScreen.tsx`
- Modify: `src/features/education/__tests__/EducationScreens.test.tsx`
- Modify: `src/app/__tests__/routes.test.tsx`

- [ ] **Step 1: Add failing provider-content tests to each public area**

Create a local `renderWithContent(ui, payload)` helper in each test file using `PublishedContentContext.Provider`. Supply no-op async `refresh`/`publish` methods and a database snapshot at revision `1`.

Add these assertions:

```ts
it('uses database flows for a newly started orientation conversation');
it('keeps an already-started orientation on its original flow snapshot after provider refresh');
it('renders contacts from published content instead of bundled services');
it('renders published education resources and groups');
it('resolves published resource details by route id');
```

The orientation database fixture must change a visible first bot message so the test proves the engine received provider flows rather than merely rendering static intro text.

- [ ] **Step 2: Run public screen tests and verify RED**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx src/features/contacts/__tests__/ContactsScreen.test.tsx src/features/education/__tests__/EducationScreens.test.tsx`

Expected: new database-content cases FAIL because screens still import bundled modules.

- [ ] **Step 3: Switch contacts and education to provider content**

In `ContactsScreen`, replace the service array import with:

```ts
const { content } = usePublishedContent();
const services = content.contacts;
```

Keep the existing static Canoas page title and description because those fields are not dashboard-editable or part of `PublishedContentPayload`.

Change education preview resolution to accept a baseline:

```ts
export function resolveEducationResourcesForPreview(baseline: PublishedContentPayload): EducationResourcePreviewState {
  const drafts = safeLoadDrafts();
  // Use baseline.educationMaterials/groups/defaultGroupOrder in the existing merge logic.
}
```

Both education screens call `usePublishedContent()` and pass `content` into this resolver. Preserve the existing local-draft warning behavior and changed-resource calculation, but compare local drafts against the database baseline rather than bundled modules.

- [ ] **Step 4: Switch orientation to provider flows without mutating active sessions**

At component entry:

```ts
const { content } = usePublishedContent();
const [conversationFlows, setConversationFlows] = useState<GuidedFlow[] | null>(null);
const flows = conversationFlows ?? content.flows;
```

At the start of `startConversation`, before setting `hasStarted`, call:

```ts
setConversationFlows(content.flows);
```

All engine calls continue using the local `flows` value. A focus refresh can therefore affect the next conversation or page load but cannot replace nodes underneath an active transcript.

- [ ] **Step 5: Update route-test wrappers**

`src/app/__tests__/routes.test.tsx` currently renders `Router` under only `AdminAuthProvider`. Add `PublishedContentContext.Provider` with bundled content around `Router` so the test remains deterministic and does not make Data API calls.

Do the same for any screen test that intentionally tests bundled behavior. Do not make `usePublishedContent()` silently fall back outside a provider.

- [ ] **Step 6: Run all public screen and route tests**

Run: `pnpm run test -- src/features/orientation src/features/contacts src/features/education src/app/__tests__/routes.test.tsx`

Expected: PASS, including existing local education preview cases.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit public runtime content consumption**

```bash
git add src/features/orientation src/features/contacts src/features/education src/app/__tests__/routes.test.tsx
git commit -m "feat: load public content from published snapshot"
```

### Task 8: Extract a Shared Change Summary

**Files:**

- Create: `src/dev-dashboard/publishing/changeSummary.ts`
- Create: `src/dev-dashboard/publishing/__tests__/changeSummary.test.ts`
- Modify: `src/dev-dashboard/export/ExportDashboard.tsx`

- [ ] **Step 1: Write failing complete-snapshot summary tests**

Cover added, edited, removed, unchanged, and duplicate-ID occurrences in all four collections. Include a removed flow case because full snapshot publication must not inherit the old export bundle's missing flow tombstone.

```ts
const summary = computeChangeSummary(baseline, draft);
expect(summary.flows).toEqual({ added: 0, edited: 0, removed: 1 });
expect(summary.total).toBe(1);
```

For duplicate IDs, compare records by occurrence using `normalizeForComparison`, matching the current export behavior.

- [ ] **Step 2: Run the summary test and verify RED**

Run: `pnpm run test -- src/dev-dashboard/publishing/__tests__/changeSummary.test.ts`

Expected: FAIL because `changeSummary.ts` does not exist.

- [ ] **Step 3: Implement one reusable summary function**

```ts
export interface RecordChangeCount {
  added: number;
  edited: number;
  removed: number;
}

export interface DashboardChangeSummary {
  flows: RecordChangeCount;
  materials: RecordChangeCount;
  groups: RecordChangeCount;
  contacts: RecordChangeCount;
  defaultGroupOrderChanged: boolean;
  total: number;
}

export function computeChangeSummary(
  baseline: PublishedContentPayload,
  draft: PublishedContentPayload,
): DashboardChangeSummary;
```

Implement `countRecordChanges<T extends { id: string }>()` by pairing baseline/draft normalized records by ID occurrence, not by a single `Map<string, T>`. Count unmatched draft occurrences as additions, unmatched baseline occurrences as removals, and paired unequal values as edits. Include a default group order difference as one change in `total`.

- [ ] **Step 4: Make ExportDashboard consume the shared function**

Remove its private `computeChangeCounts`. Adapt labels from `edited` to the current Portuguese `editado` wording. Build a `PublishedContentPayload` baseline/draft view for summary purposes; keep ZIP generation and `buildExportBundle` unchanged in export mode.

- [ ] **Step 5: Run summary and export regressions**

Run: `pnpm run test -- src/dev-dashboard/publishing/__tests__/changeSummary.test.ts src/dev-dashboard/__tests__/exportBundle.test.ts src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "export|Export|ZIP|Contatos"`

Expected: PASS.

- [ ] **Step 6: Commit the shared summary**

```bash
git add src/dev-dashboard/publishing/changeSummary.ts src/dev-dashboard/publishing/__tests__/changeSummary.test.ts src/dev-dashboard/export/ExportDashboard.tsx
git commit -m "refactor: share dashboard change summary"
```

### Task 9: Add Explicit Database Publication UI

**Files:**

- Create: `src/dev-dashboard/publishing/PublishDashboard.tsx`
- Create: `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx`
- Modify: `src/dev-dashboard/components/DashboardShell.tsx`
- Modify: `src/dev-dashboard/DashboardRoute.tsx`
- Modify: `src/dev-dashboard/draft-storage/dashboardStorage.ts`
- Modify: `src/dev-dashboard/__tests__/dashboardStorage.test.ts`
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Migrate draft default-order semantics and add a reset helper test**

Bump `DASHBOARD_DRAFT_SCHEMA_VERSION` from `3.0.0` to `4.0.0`. Keep `defaultGroupOrder?: number`, but omit it from `createEmptyDashboardDraftState()` so an empty local draft cannot overwrite a non-zero database baseline.

Migration rules are exact:

- v1/v2 drafts receive all existing group/contact defaults and preserve a non-zero `defaultGroupOrder`;
- v3 drafts preserve a non-zero `defaultGroupOrder` and convert `0` to `undefined`, because zero was the old shipped baseline and was written into every empty draft;
- v4 drafts preserve an absent or numeric `defaultGroupOrder`;
- unknown versions reset to an empty v4 draft.

Update storage fixtures that mean "no local default-order edit" to omit the field. Fixtures testing a real order edit keep a numeric value.

Add `resetDashboardDrafts(storage?)` to the storage contract. Its test must save a non-empty draft, call reset, and assert both storage and returned state equal `createEmptyDashboardDraftState()`.

The helper implementation is:

```ts
export function resetDashboardDrafts(storage: Storage = localStorage) {
  const empty = createEmptyDashboardDraftState();
  storage.removeItem(STORAGE_KEY);
  return empty;
}
```

Keep `clearDashboardDrafts` as a compatibility alias if existing code/tests use it.

- [ ] **Step 2: Write failing PublishDashboard component tests**

Use context providers with mocked `publish` and an authenticated admin account. Cover:

```ts
it('shows the complete change summary and current revision');
it('disables publication for validation errors or no changes');
it('requires an explicit second confirmation action');
it('publishes the full merged payload with the admin id');
it('shows pending state and prevents duplicate publication');
it('reports conflict without calling onPublished');
it('reports real-auth requirement for unauthorized publication');
it('reports configuration and generic failures safely');
it('calls onPublished only after repository success');
```

Use `PublishedContentRepositoryError` instances with `conflict`, `unauthorized`, `not_configured`, and `unavailable` codes. Assert Portuguese user messages and `role="alert"` for errors.

- [ ] **Step 3: Run publication tests and verify RED**

Run: `pnpm run test -- src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx src/dev-dashboard/__tests__/dashboardStorage.test.ts`

Expected: FAIL because the UI and reset helper do not exist.

- [ ] **Step 4: Implement the publication component**

Props:

```ts
interface PublishDashboardProps {
  baseline: PublishedContentPayload;
  draft: PublishedContentPayload;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  onPublished(snapshot: PublishedContentSnapshot): void;
}
```

Consume `usePublishedContent()` for `snapshot`/`publish` and `useAdminAuth()` for `account`. Compute the summary with `computeChangeSummary`.

Required state:

```ts
type PublishState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'pending' }
  | { kind: 'success'; publishedAt: string; revision: number }
  | { kind: 'error'; message: string };
```

The first `Publicar alteracoes` click enters `confirming`. Render `Confirmar publicacao` and `Cancelar` buttons. Only the confirmation button calls:

```ts
if (!account) {
  setState({ kind: 'error', message: 'Entre com uma conta administrativa real para publicar.' });
  return;
}
setState({ kind: 'pending' });
try {
  const next = await publish(draft, account.id);
  setState({ kind: 'success', publishedAt: next.publishedAt, revision: next.revision });
  onPublished(next);
} catch (error) {
  setState({ kind: 'error', message: messageForPublishError(error) });
}
```

Map conflict to a message that instructs the admin to reload the published baseline; unauthorized to real-auth required; not configured to missing Neon setup; invalid payload to `Revise o conteúdo e confirme que o total não excede 5 MiB.`; unavailable/unknown to retry later. Never include `error.message` from Neon in the rendered text.

```ts
function messageForPublishError(error: unknown) {
  if (!(error instanceof PublishedContentRepositoryError)) {
    return 'Não foi possível publicar agora. Tente novamente.';
  }

  switch (error.code) {
    case 'conflict':
      return 'Outra publicação foi salva antes desta. Recarregue o conteúdo publicado antes de tentar novamente.';
    case 'unauthorized':
      return 'Entre com uma conta administrativa real para publicar.';
    case 'not_configured':
      return 'A conexão pública com o Neon não está configurada.';
    case 'invalid_payload':
      return 'Revise o conteúdo e confirme que o total não excede 5 MiB.';
    default:
      return 'Não foi possível publicar agora. Tente novamente.';
  }
}
```

- [ ] **Step 5: Make the final tab mode-aware**

Keep the persisted `DashboardTab` ID as `export`. Add `publishMode: DashboardPublishMode` to `DashboardShell` and derive the final label:

```ts
const finalTabLabel = publishMode === 'database' ? 'Publicar' : 'Exportar';
```

This avoids a localStorage tab migration.

- [ ] **Step 6: Integrate provider baseline and post-success reset in DashboardRoute**

At route entry:

```ts
const { content: baseline } = usePublishedContent();
const publishMode = getDashboardPublishMode();
const shipped = baseline;
```

Use `baseline.defaultGroupOrder` when an empty local draft has not overridden group order. Update `mergeDashboardDrafts` so its default order comes from an optional baseline `defaultGroupOrder` rather than hardcoded zero; add a storage test proving a database baseline order survives an empty draft.

The merge expression must be:

```ts
defaultGroupOrder: drafts.defaultGroupOrder ?? shipped.defaultGroupOrder ?? 0,
```

When group-move handlers need the current default order, derive it from `mergeDashboardDrafts(shipped, current).defaultGroupOrder`; do not reintroduce `current.defaultGroupOrder ?? 0`, which would discard a database baseline.

Build one complete `PublishedContentPayload` from `mergedDrafts` for publication. In the final tab:

```tsx
{
  publishMode === 'database' ? (
    <PublishDashboard
      baseline={baseline}
      draft={publishedDraft}
      validation={validation}
      draftUpdatedAt={draftState.updatedAt}
      onPublished={() => setDraftState(resetDashboardDrafts())}
    />
  ) : (
    <ExportDashboard {...existingExportProps} />
  );
}
```

Reset local drafts only in `onPublished`. Failed and conflicting publications must leave both React state and `localStorage` unchanged.

- [ ] **Step 7: Add route integration cases**

Mock `usePublishedContent` at the top of `dashboardRoute.test.tsx` with a mutable baseline, revision, and `publish` function. Add tests that prove:

- database mode labels the tab `Publicar` and does not render `Gerar arquivo ZIP`;
- export mode labels the tab `Exportar` and retains ZIP behavior;
- successful publication receives flows, materials, groups, contacts, and default order as a complete snapshot;
- successful publication clears local draft storage;
- rejected publication retains the exact stored local draft;
- a database baseline, rather than code-shipped content, is edited and summarized.

- [ ] **Step 8: Run all dashboard tests and typecheck**

Run: `pnpm run test -- src/dev-dashboard`

Expected: PASS.

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit database publication UI**

```bash
git add src/dev-dashboard/publishing/PublishDashboard.tsx src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx src/dev-dashboard/components/DashboardShell.tsx src/dev-dashboard/DashboardRoute.tsx src/dev-dashboard/draft-storage/dashboardStorage.ts src/dev-dashboard/__tests__/dashboardStorage.test.ts src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: publish dashboard content to Neon"
```

### Task 10: Document and Configure the Rollout

**Files:**

- Modify: `.env.example`
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Add the environment example**

Add immediately after `VITE_DISABLE_AUTH`:

```text
# Publish valid dashboard drafts directly to Neon by default.
# Set to export only for the legacy ZIP recovery/development workflow.
VITE_DASHBOARD_PUBLISH_MODE=database
```

State that `VITE_DISABLE_AUTH=true` does not authorize database writes and should normally be paired with `VITE_DASHBOARD_PUBLISH_MODE=export` for local mock-auth work.

- [ ] **Step 2: Make production deployment explicit**

Add to the build environment in `.github/workflows/deploy.yml`:

```yaml
VITE_DASHBOARD_PUBLISH_MODE: database
```

Do not add secrets or connection strings.

- [ ] **Step 3: Update README operations**

Document:

1. migration order (`admin_accounts`, then `published_content`);
2. empty-table fallback to bundled content;
3. first publication creates revision `1`;
4. public routes use the current database snapshot without redeploy;
5. open clients refresh on page load/window focus, not via realtime push;
6. 1 MiB per image and 5 MiB total payload limits;
7. export recovery mode and its required env value;
8. conflict behavior and the fact that local drafts are retained on failure.

Remove the stale `Current Caution` sentence that says the app has no backend/login if the pending auth documentation has not already removed it.

- [ ] **Step 4: Check documentation and formatting**

Run: `pnpm run format:check`

Expected: PASS.

Run: `rg -n "VITE_DASHBOARD_PUBLISH_MODE|published_content|1 MiB|5 MiB" .env.example README.md .github/workflows/deploy.yml`

Expected: all rollout settings and limits are discoverable.

- [ ] **Step 5: Commit rollout documentation**

Review `git diff` carefully because these files already contain pending auth edits. Stage only after confirming those edits are intentional and belong in the same finalized auth/publishing baseline.

```bash
git add .env.example .github/workflows/deploy.yml README.md
git commit -m "docs: document database publishing rollout"
```

### Task 11: Run the Full Verification Gate

**Files:**

- Modify only files surfaced by verification failures, and add a regression test before each behavior fix.

- [ ] **Step 1: Run focused persistence tests**

Run:

```bash
pnpm run test -- src/app/content src/app/neon src/app/auth src/dev-dashboard
```

Expected: PASS.

- [ ] **Step 2: Run all public feature tests**

Run:

```bash
pnpm run test -- src/features/orientation src/features/education src/features/contacts src/app
```

Expected: PASS.

- [ ] **Step 3: Run the complete local quality gate**

Run: `pnpm run check`

Expected: typecheck, lint, format check, flow validation, full Vitest suite, and build all PASS.

- [ ] **Step 4: Build both persistence modes explicitly**

PowerShell database build:

```powershell
$env:VITE_ENABLE_DEV_DASHBOARD='true'
$env:VITE_DASHBOARD_PUBLISH_MODE='database'
pnpm run build
```

PowerShell export build:

```powershell
$env:VITE_DASHBOARD_PUBLISH_MODE='export'
pnpm run build
Remove-Item Env:VITE_DASHBOARD_PUBLISH_MODE
Remove-Item Env:VITE_ENABLE_DEV_DASHBOARD
```

Expected: both builds PASS.

- [ ] **Step 5: Perform browser smoke tests**

With a migrated disposable Neon branch and real allowlisted admin:

1. Load public routes with an empty table and confirm bundled content renders.
2. Log in, edit one item in each content area, and confirm local drafts survive reload.
3. Publish and confirm revision `1` is displayed.
4. Open a separate anonymous window and confirm the published flow, education item/group, and contact render without a redeploy.
5. Change one item in two admin sessions; publish one, then confirm the other receives a conflict and retains its local draft.
6. Simulate an offline/network failure and confirm public fallback plus retained admin drafts.
7. Rebuild in export mode and confirm ZIP generation still works.

If browser access or Neon credentials are unavailable, report exactly which smoke-test steps were not run.

- [ ] **Step 6: Review final scope and history**

Run:

```bash
git status --short
git log --oneline -12
```

Expected: no accidental generated files, credentials, or unrelated reversions; commits correspond to the tasks above. Do not create a cleanup commit unless verification required a tested code change.

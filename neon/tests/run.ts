import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  BRANCH_NAME_PREFIX,
  ProvisionError,
  type HarnessConfig,
  type Provisioned,
  makeNeonRunner,
  parseEnvFile,
  provisionNeon,
  redact,
} from './provision';
import { anonymousToken, createPrincipalTokens } from './clients';
import {
  applyCutoverArtifact,
  applyMigrations,
  assertParentFixtureClean,
  connectOwner,
  seedOwnerFixture,
  warmupDataApi,
  waitForAuthUsers,
} from './fixtures';

const SUITE_TIMEOUT_MS = 10 * 60 * 1000;
const PROVISION_TIMEOUT_MS = 120 * 1000;
const CUTOVER_FILE = '20260910004000_content_draft_revoke_direct_publish.sql';
const REQUIRED_ENV = [
  'NEON_API_KEY',
  'NEON_TEST_PROJECT_ID',
  'NEON_TEST_PARENT_BRANCH_ID',
  'NEON_TEST_DATABASE',
  'NEON_TEST_ADMIN_A_EMAIL',
  'NEON_TEST_ADMIN_A_PASSWORD',
  'NEON_TEST_ADMIN_B_EMAIL',
  'NEON_TEST_ADMIN_B_PASSWORD',
  'NEON_TEST_NONADMIN_EMAIL',
  'NEON_TEST_NONADMIN_PASSWORD',
] as const;

function log(message: string): void {
  console.log(`[check:db] ${message}`);
}

function fail(message: string): never {
  console.error(`[check:db] ${message}`);
  process.exit(1);
}

export function isSafeTempDir(candidate: string, repoRoot: string): boolean {
  if (!path.isAbsolute(candidate)) return false;
  const dir = path.resolve(candidate);
  const root = path.resolve(repoRoot);
  if (dir === root || dir.startsWith(root + path.sep) || root.startsWith(dir + path.sep)) return false;
  return path.basename(dir).startsWith('bemtevi-v2-test-');
}

function loadEnvFile(filePath: string): void {
  const parsed = parseEnvFile(readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadCredentials(_rootDir: string): void {
  const explicit = process.env['BEMTEVI_DB04_ENV_FILE'];
  const candidates = [explicit, path.join(homedir(), '.config', 'bemtevi-db04', 'neon-test.env')].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  );
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadEnvFile(candidate);
      log(`loaded credentials from an outside-repo env file (${path.basename(path.dirname(candidate))})`);
      return;
    }
  }
  log('no outside-repo env file found; relying on exported environment variables');
}

function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return typeof value !== 'string' || value.length === 0;
  });
}

function resolveModulesBin(rootDir: string, name: string, entry: string): string {
  for (const modulesDir of ['node_modules.win', 'node_modules.wsl', 'node_modules']) {
    const candidate = path.join(rootDir, modulesDir, name, entry);
    if (existsSync(candidate)) return candidate;
  }
  return fail(`missing ${name} package under node_modules; run the project install first`);
}

function runVitest(rootDir: string, bin: string, env: NodeJS.ProcessEnv, filter?: string): Promise<number> {
  return new Promise((resolve) => {
    const args = ['run', '--config', 'neon/tests/vitest.config.ts'];
    if (filter !== undefined) args.push(filter);
    const child = spawn(process.execPath, [bin, ...args], { cwd: rootDir, env, stdio: 'inherit', shell: false });
    const timer = setTimeout(() => child.kill('SIGKILL'), SUITE_TIMEOUT_MS);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (signal !== null) resolve(124);
      else resolve(code ?? 1);
    });
  });
}

function cleanup(provisioned: Provisioned, apiKey: string): void {
  try {
    const runner = makeNeonRunner(
      {
        apiKey,
        projectId: provisioned.projectId,
        parentBranchId: provisioned.parentBranchId,
        database: provisioned.database,
      },
      process.cwd(),
    );
    const current = JSON.parse(
      runner(['branches', 'get', provisioned.branchId, '--project-id', provisioned.projectId, '--output', 'json'])
        .stdout,
    ) as { name?: string; parent_id?: string };
    if (current.name !== provisioned.branchName || current.parent_id !== provisioned.parentBranchId) {
      throw new Error(`branch ${provisioned.branchId} no longer matches the retained fixture metadata; not deleting`);
    }
    if (!current.name?.startsWith(BRANCH_NAME_PREFIX)) {
      throw new Error(`branch name ${String(current.name)} lacks the disposable prefix; not deleting`);
    }
    runner(['branches', 'delete', provisioned.branchId, '--project-id', provisioned.projectId]);
    log(`deleted disposable branch ${provisioned.branchId}`);
  } catch (error) {
    throw new Error(
      `cleanup failed (project ${provisioned.projectId}, branch ${provisioned.branchId}): ${redact(
        (error as Error).message,
        apiKey,
      )}`,
      { cause: error },
    );
  } finally {
    if (isSafeTempDir(provisioned.tempDir, process.cwd()))
      rmSync(provisioned.tempDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  loadCredentials(rootDir);
  const missing = missingEnv();
  if (missing.length > 0) fail(`missing required environment variables (no skip): ${missing.join(', ')}`);

  const config: HarnessConfig = {
    apiKey: process.env['NEON_API_KEY'] as string,
    projectId: process.env['NEON_TEST_PROJECT_ID'] as string,
    parentBranchId: process.env['NEON_TEST_PARENT_BRANCH_ID'] as string,
    database: process.env['NEON_TEST_DATABASE'] as string,
  };
  const tempDir = mkdtempSync(path.join(tmpdir(), 'bemtevi-v2-test-'));
  if (!isSafeTempDir(tempDir, rootDir)) fail(`unsafe temp directory for the harness: ${path.basename(tempDir)}`);

  let provisioned: Provisioned | null = null;
  const provisionTimer = setTimeout(
    () => fail(`provisioning exceeded ${PROVISION_TIMEOUT_MS / 1000}s; disposable branch expiry is the backup`),
    PROVISION_TIMEOUT_MS,
  );
  try {
    provisioned = await provisionNeon(config, tempDir, async (parentOwnerUrl) => {
      const parent = await connectOwner(parentOwnerUrl);
      try {
        await assertParentFixtureClean((sql) => parent.query(sql));
      } finally {
        await parent.end();
      }
    });
    clearTimeout(provisionTimer);
    log(`provisioned disposable branch ${provisioned.branchId} (${provisioned.branchName})`);

    let owner = await connectOwner(provisioned.ownerDatabaseUrl);
    await applyMigrations(owner, path.join(rootDir, 'neon', 'migrations'));
    await waitForAuthUsers(owner, [
      process.env['NEON_TEST_ADMIN_A_EMAIL'] as string,
      process.env['NEON_TEST_ADMIN_B_EMAIL'] as string,
      process.env['NEON_TEST_NONADMIN_EMAIL'] as string,
    ]);
    const fixture = await seedOwnerFixture(owner, {
      adminA: process.env['NEON_TEST_ADMIN_A_EMAIL'] as string,
      adminB: process.env['NEON_TEST_ADMIN_B_EMAIL'] as string,
      nonadmin: process.env['NEON_TEST_NONADMIN_EMAIL'] as string,
    });
    await owner.end();

    const principals = await createPrincipalTokens(
      { authBaseUrl: provisioned.authBaseUrl },
      {
        adminAEmail: process.env['NEON_TEST_ADMIN_A_EMAIL'] as string,
        adminAPassword: process.env['NEON_TEST_ADMIN_A_PASSWORD'] as string,
        adminBEmail: process.env['NEON_TEST_ADMIN_B_EMAIL'] as string,
        adminBPassword: process.env['NEON_TEST_ADMIN_B_PASSWORD'] as string,
        nonadminEmail: process.env['NEON_TEST_NONADMIN_EMAIL'] as string,
        nonadminPassword: process.env['NEON_TEST_NONADMIN_PASSWORD'] as string,
      },
    );
    for (const key of ['adminA', 'adminB', 'nonadmin'] as const) {
      if (principals.userIds[key] !== fixture.adminUserIds[key])
        throw new Error(`sign-in identity mismatch for ${key}`);
    }
    const anon = await anonymousToken({ authBaseUrl: provisioned.authBaseUrl });

    const runner = makeNeonRunner(config, process.cwd());
    runner([
      'data-api',
      'refresh-schema',
      '--project-id',
      config.projectId,
      '--branch',
      provisioned.branchId,
      '--database',
      config.database,
    ]);
    await warmupDataApi(provisioned.dataApiUrl, principals.tokens.adminA);

    const suiteEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NEON_TEST_OWNER_DATABASE_URL: provisioned.ownerDatabaseUrl,
      NEON_TEST_AUTH_URL: provisioned.authBaseUrl,
      NEON_TEST_DATA_API_URL: provisioned.dataApiUrl,
      NEON_TEST_ADMIN_A_TOKEN: principals.tokens.adminA,
      NEON_TEST_ADMIN_B_TOKEN: principals.tokens.adminB,
      NEON_TEST_NONADMIN_TOKEN: principals.tokens.nonadmin,
      NEON_TEST_ANON_TOKEN: anon,
      NEON_TEST_ADMIN_A_USER_ID: fixture.adminUserIds.adminA,
      NEON_TEST_ADMIN_B_USER_ID: fixture.adminUserIds.adminB,
      NEON_TEST_NONADMIN_USER_ID: fixture.adminUserIds.nonadmin,
    };
    delete suiteEnv['NEON_TEST_CUTOVER_APPLIED'];

    const vitestBin = resolveModulesBin(rootDir, 'vitest', 'vitest.mjs');
    log('running DB-01..03 live suites (coexistence phase)');
    const phaseOne = await runVitest(rootDir, vitestBin, suiteEnv);
    if (phaseOne !== 0) throw new Error(`live suites failed in the coexistence phase (vitest exit ${phaseOne})`);

    log('applying the direct-write cutover artifact');
    owner = await connectOwner(provisioned.ownerDatabaseUrl);
    await applyCutoverArtifact(owner, path.join(rootDir, 'neon', 'cutover'), CUTOVER_FILE);
    await owner.end();
    runner([
      'data-api',
      'refresh-schema',
      '--project-id',
      config.projectId,
      '--branch',
      provisioned.branchId,
      '--database',
      config.database,
    ]);

    log('running grants cutover phase');
    const phaseTwo = await runVitest(
      rootDir,
      vitestBin,
      { ...suiteEnv, NEON_TEST_CUTOVER_APPLIED: 'true' },
      'grants.test.ts',
    );
    if (phaseTwo !== 0) throw new Error(`grants cutover phase failed (vitest exit ${phaseTwo})`);

    log('all live suites passed; cleaning up');
    clearTimeout(provisionTimer);
  } catch (error) {
    if (provisioned !== null) {
      try {
        cleanup(provisioned, config.apiKey);
      } catch (cleanupError) {
        console.error(`[check:db] ${(cleanupError as Error).message}`);
      }
    }
    clearTimeout(provisionTimer);
    fail(
      `check:db failed: ${redact((error as Error).message, config.apiKey)}${error instanceof ProvisionError ? ' (provisioning)' : ''}`,
    );
  }
  try {
    cleanup(provisioned, config.apiKey);
  } catch (cleanupError) {
    clearTimeout(provisionTimer);
    fail((cleanupError as Error).message);
  }
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) main().catch((error: unknown) => fail((error as Error).message));

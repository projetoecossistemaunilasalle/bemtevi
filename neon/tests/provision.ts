import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * DB-04 provisioning against the pinned `neon@4.14.6` development CLI: argument
 * arrays, `shell: false`, captured/redacted output. Command shapes are frozen by
 * the revision-8 dossier (tasks/DB.md, DB-04); `--add-default-grants` is never passed.
 */

export const REQUIRED_CLI_VERSION = '4.14.6';
export const BRANCH_NAME_PREFIX = 'bemtevi-v2-test-';
const PROVISION_TIMEOUT_MS = 120_000;

export interface NeonRunner {
  (args: string[]): { stdout: string; stderr: string };
}

export interface HarnessConfig {
  apiKey: string;
  projectId: string;
  parentBranchId: string;
  database: string;
}

export interface Provisioned {
  projectId: string;
  parentBranchId: string;
  database: string;
  branchId: string;
  branchName: string;
  tempDir: string;
  ownerDatabaseUrl: string;
  authBaseUrl: string;
  dataApiUrl: string;
}

export class ProvisionError extends Error {}

function fail(message: string): never {
  throw new ProvisionError(message);
}

export function redact(text: string, ...secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, 'postgresql://[redacted]')
    .replace(/(password|api[_-]?key)=([^&\s"']+)/gi, '$1=[redacted]');
}

export function resolveNeonBin(rootDir: string): string {
  for (const modulesDir of ['node_modules.win', 'node_modules.wsl', 'node_modules']) {
    const pkgPath = path.join(rootDir, modulesDir, 'neon', 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: string;
      bin?: string | Record<string, string>;
    };
    if (pkg.version !== REQUIRED_CLI_VERSION) continue;
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['neon'];
    if (typeof bin !== 'string') continue;
    return path.join(rootDir, modulesDir, 'neon', bin);
  }
  return fail(`pinned neon@${REQUIRED_CLI_VERSION} package not found under node_modules; run the install first`);
}

export function parseVersionOutput(stdout: string): string {
  return stdout.trim().split(/\s+/).pop() ?? '';
}

export function assertCliVersion(runner: NeonRunner): void {
  const { stdout } = runner(['--version']);
  const version = parseVersionOutput(stdout);
  if (version !== REQUIRED_CLI_VERSION) {
    fail(`neon CLI version mismatch: expected ${REQUIRED_CLI_VERSION}, got ${version || '(empty)'}`);
  }
}

const UNSAFE_PARENT_NAMES = new Set(['main', 'master', 'production', 'prod']);

export interface ParentBranchSnapshot {
  id: string;
  name: string;
  protected?: boolean;
  default?: boolean;
}

export function assertParentBranchSafe(parent: ParentBranchSnapshot, configuredParentId: string): void {
  if (parent.id !== configuredParentId)
    fail(`parent branch id mismatch: returned ${parent.id}, configured ${configuredParentId}`);
  if (parent.protected === true) fail('parent branch is protected; refusing to use it as fixture parent');
  if (parent.default === true) fail('parent branch is the project default/primary branch; refusing fixture parent');
  const normalized = parent.name.trim().toLowerCase();
  if (UNSAFE_PARENT_NAMES.has(normalized)) fail(`parent branch name '${parent.name}' is not a dedicated fixture name`);
}

export interface CreatedBranch {
  branch: { id: string; name: string; parent_id?: string | null };
}

export function assertCreateBranchResponse(
  response: CreatedBranch,
  expectedName: string,
  expectedParentId: string,
): void {
  const branch = response.branch;
  if (!branch || typeof branch.id !== 'string' || branch.id.length === 0)
    fail(`branch create returned no branch id: ${JSON.stringify(response).slice(0, 200)}`);
  if (branch.name !== expectedName)
    fail(`branch create returned unexpected name ${branch.name} (expected ${expectedName})`);
  if (branch.parent_id !== expectedParentId) {
    fail(`branch create returned unexpected parent ${String(branch.parent_id)} (expected ${expectedParentId})`);
  }
}

export interface DataApiSnapshot {
  url?: string;
  status?: string;
  settings?: { db_schemas?: string[]; db_anon_role?: string };
}

export function assertDataApiSnapshot(snapshot: DataApiSnapshot): void {
  if (snapshot.status !== 'active') fail(`Data API is not active (status: ${String(snapshot.status)})`);
  if (typeof snapshot.url !== 'string' || snapshot.url.length === 0) fail('Data API snapshot has no URL');
  const schemas = snapshot.settings?.db_schemas;
  if (JSON.stringify(schemas) !== JSON.stringify(['public'])) {
    fail(`Data API must expose exactly the public schema (got ${JSON.stringify(schemas)})`);
  }
  if (snapshot.settings?.db_anon_role !== 'anonymous') fail('Data API anonymous role must be "anonymous"');
}

export function parseEnvFile(contents: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    vars[key] = value;
  }
  return vars;
}

export function generateBranchName(): string {
  return `${BRANCH_NAME_PREFIX}${randomUUID()}`;
}

/** Splits a single-line CLI spec into an execFile argument array (shell:false). */
export function cliArgs(spec: string): string[] {
  const parts = spec.split(' ').filter((part) => part.length > 0);
  if (parts.some((part) => part.includes('"') || part.includes("'"))) fail('unsafe CLI argument token');
  return parts;
}

export function makeNeonRunner(config: HarnessConfig, rootDir: string): NeonRunner {
  const bin = resolveNeonBin(rootDir);
  return (args: string[]) => {
    try {
      const stdout = execFileSync(process.execPath, [bin, ...args], {
        shell: false,
        encoding: 'utf8',
        timeout: PROVISION_TIMEOUT_MS,
        env: { ...process.env, NEON_API_KEY: config.apiKey, NO_COLOR: '1' },
      });
      return { stdout, stderr: '' };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const detail = redact(`${err.stdout ?? ''} ${err.stderr ?? ''} ${err.message ?? ''}`, config.apiKey);
      fail(`neon CLI command failed (args redacted): ${detail.slice(0, 400)}`);
    }
  };
}

function readJson(runner: NeonRunner, args: string[], secrets: string[]): unknown {
  const { stdout } = runner(args);
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return fail(`neon CLI returned non-JSON output for a read command: ${redact(stdout, ...secrets).slice(0, 200)}`);
  }
}

export function pulledVar(vars: Record<string, string>, key: string): string {
  const value = vars[key];
  if (typeof value !== 'string' || value.length === 0) fail(`pulled environment is missing ${key}`);
  return value;
}

export async function provisionNeon(
  config: HarnessConfig,
  tempDir: string,
  parentGuard?: (ownerUrl: string) => Promise<void>,
): Promise<Provisioned> {
  const runner = makeNeonRunner(config, process.cwd());
  assertCliVersion(runner);

  const project = readJson(runner, ['projects', 'get', config.projectId, '--output', 'json'], [config.apiKey]) as {
    id?: string;
  } | null;
  if (!project || project.id !== config.projectId) fail('configured project id does not match the returned project');

  const parent = readJson(
    runner,
    ['branches', 'get', config.parentBranchId, '--project-id', config.projectId, '--output', 'json'],
    [config.apiKey],
  ) as ParentBranchSnapshot | null;
  if (!parent) fail('parent branch could not be read');
  assertParentBranchSafe(parent, config.parentBranchId);

  // Step 1 owner inspection of the parent: refuse a parent that already
  // carries the editorial tables, before any disposable branch is created.
  if (parentGuard !== undefined) {
    const spec = `connection-string ${config.parentBranchId} --project-id ${config.projectId} --database-name ${config.database} --role-name neondb_owner --output json`;
    const ownerUrl = runner(cliArgs(spec)).stdout.trim().replace(/^"|"$/g, '');
    if (!ownerUrl.startsWith('postgres')) fail('could not read the parent branch owner connection string');
    await parentGuard(ownerUrl);
  }

  const branchName = generateBranchName();
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const created = readJson(
    runner,
    cliArgs(
      `branches create --project-id ${config.projectId} --parent ${config.parentBranchId} --name ${branchName}` +
        ` --expires-at ${expiry} --no-secrets --output json`,
    ),
    [config.apiKey],
  ) as CreatedBranch | null;
  if (!created) fail('branch create returned no response');
  assertCreateBranchResponse(created, branchName, config.parentBranchId);
  const branchId = created.branch.id;

  const dataApiScope = `data-api --project-id ${config.projectId} --branch ${branchId}`;
  const dataApi = readJson(runner, cliArgs(`${dataApiScope} get --database ${config.database} --output json`), [
    config.apiKey,
  ]) as DataApiSnapshot | null;
  if (dataApi && dataApi.url && dataApi.status) {
    assertDataApiSnapshot(dataApi);
  } else {
    // Absence of --add-default-grants is normative: never grant broad default permissions.
    const createArgs = cliArgs(
      `${dataApiScope} create --database ${config.database} --auth-provider neon_auth --db-schemas public --output json`,
    );
    const made = readJson(runner, createArgs, [config.apiKey]) as { url?: string } | null;
    if (!made || typeof made.url !== 'string') fail('data-api create did not return a URL');
  }

  runner(
    cliArgs(
      `env pull --project-id ${config.projectId} --branch ${branchId} --service postgres --service auth --service data-api --file ${tempDir}/.env`,
    ),
  );
  runner([
    'env',
    'pull',
    '--project-id',
    config.projectId,
    '--branch',
    branchId,
    '--service',
    'postgres',
    '--service',
    'auth',
    '--service',
    'data-api',
    '--file',
    `${tempDir}/.env`,
  ]);
  const pulled = parseEnvFile(readFileSync(path.join(tempDir, '.env'), 'utf8'));
  if (pulled.NEON_BRANCH !== branchName)
    fail(`pulled NEON_BRANCH does not identify the created branch (${branchName})`);
  const ownerDatabaseUrl = pulledVar(pulled, 'DATABASE_URL_UNPOOLED') ?? pulled.DATABASE_URL ?? '';
  if (ownerDatabaseUrl.length === 0) fail('pulled environment is missing the owner database URL');

  return {
    projectId: config.projectId,
    parentBranchId: config.parentBranchId,
    database: config.database,
    branchId,
    branchName,
    tempDir,
    ownerDatabaseUrl,
    authBaseUrl: pulledVar(pulled, 'NEON_AUTH_BASE_URL'),
    dataApiUrl: pulledVar(pulled, 'NEON_DATA_API_URL'),
  };
}

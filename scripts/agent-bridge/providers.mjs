import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;
const SAFE_ENVIRONMENT_KEYS = [
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

const providerDefinitions = [
  { id: 'codex', label: 'Codex', command: 'codex', envCommand: 'BEMTEVI_CODEX_COMMAND' },
  { id: 'claude', label: 'Claude Code', command: 'claude', envCommand: 'BEMTEVI_CLAUDE_COMMAND' },
  { id: 'hermes', label: 'Hermes Agent', command: 'hermes', envCommand: 'BEMTEVI_HERMES_COMMAND' },
  { id: 'antigravity', label: 'Antigravity', command: 'agy', envCommand: 'BEMTEVI_ANTIGRAVITY_COMMAND' },
];

function commandCandidates(command) {
  if (process.platform !== 'win32') {
    const result = spawnSync('which', [command], { encoding: 'utf8', windowsHide: true });
    return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
  }

  const result = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .sort((left, right) => {
      const score = (value) =>
        value.toLowerCase().endsWith('.exe') ? 0 : value.toLowerCase().endsWith('.cmd') ? 1 : 2;
      return score(left) - score(right);
    });
}

function resolveExecutable(definition) {
  const configured = process.env[definition.envCommand];
  if (configured) return existsSync(configured) ? configured : null;
  const fromPath = commandCandidates(definition.command)[0] ?? null;
  if (fromPath) return fromPath;
  if (definition.id === 'antigravity') {
    const defaultWin = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe') : null;
    if (defaultWin && existsSync(defaultWin)) return defaultWin;
    const defaultNix = process.env.HOME ? path.join(process.env.HOME, '.local', 'bin', 'agy') : null;
    if (defaultNix && existsSync(defaultNix)) return defaultNix;
  }
  return null;
}

export function listProviders() {
  return providerDefinitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    available: resolveExecutable(definition) !== null,
  }));
}

function createSafeAgentEnvironment() {
  // Content agents receive their task through stdin. Do not inherit project or
  // database credentials that could be read from the spawned process.
  return Object.fromEntries(
    SAFE_ENVIRONMENT_KEYS.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])),
  );
}

export function createProviderInvocation(providerId, executable, prompt, workspaceRoot) {
  const schemaPath = path.join(workspaceRoot, 'scripts', 'agent-bridge', 'content-payload.schema.json');

  if (providerId === 'codex') {
    return {
      command: executable,
      args: [
        'exec',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--ignore-user-config',
        '--ignore-rules',
        '--skip-git-repo-check',
        '--output-schema',
        schemaPath,
        '--json',
        '-',
      ],
      stdin: prompt,
      parseLine(line, state, emit) {
        const event = safeParseJson(line);
        if (!event) return;
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
          state.result = event.item.text ?? '';
        } else if (event.type === 'item.started') {
          emit({ type: 'progress', message: describeCodexItem(event.item) });
        }
      },
    };
  }

  if (providerId === 'claude') {
    return {
      command: executable,
      args: [
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--tools',
        '',
        '--disallowedTools',
        'mcp__*',
        '--permission-mode',
        'plan',
        '--no-session-persistence',
        '--json-schema',
        JSON.stringify(JSON.parse(readFileSync(schemaPath, 'utf8'))),
      ],
      stdin: prompt,
      parseLine(line, state, emit) {
        const event = safeParseJson(line);
        if (!event) return;
        if (event.type === 'result') {
          state.result = event.structured_output ? JSON.stringify(event.structured_output) : (event.result ?? '');
        } else if (event.type === 'assistant') {
          const text = event.message?.content?.find((part) => part.type === 'text')?.text;
          if (text) emit({ type: 'progress', message: 'Claude Code está preparando a resposta.' });
        }
      },
    };
  }

  if (providerId === 'hermes') {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), 'bemtevi-hermes-'));
    const promptPath = path.join(tempDirectory, 'prompt.txt');
    writeFileSync(promptPath, prompt, 'utf8');

    const pythonName = process.platform === 'win32' ? 'python.exe' : 'python';
    const siblingPython = path.join(path.dirname(executable), pythonName);
    const canUsePythonEntrypoint = existsSync(siblingPython);
    const pythonScript = [
      'import sys',
      'from pathlib import Path',
      'from hermes_cli.oneshot import run_oneshot',
      "prompt = Path(sys.argv[1]).read_text(encoding='utf-8')",
      "raise SystemExit(run_oneshot(prompt, toolsets=['vision']))",
    ].join('; ');

    return {
      command: canUsePythonEntrypoint ? siblingPython : executable,
      args: canUsePythonEntrypoint
        ? ['-c', pythonScript, promptPath]
        : [
            'chat',
            '--quiet',
            '--safe-mode',
            '--toolsets',
            'vision',
            '--max-turns',
            '1',
            '--source',
            'bemtevi',
            '--query-file',
            promptPath,
          ],
      cwd: tempDirectory,
      stdin: null,
      parseLine(line, state, emit) {
        state.plainOutput.push(line);
        if (line.trim()) emit({ type: 'progress', message: 'Hermes está preparando a resposta.' });
      },
      cleanup() {
        rmSync(tempDirectory, { recursive: true, force: true });
      },
    };
  }

  if (providerId === 'antigravity') {
    return {
      command: executable,
      args: [
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        '--sandbox',
        '--disable-slash-commands',
      ],
      stdin:
        JSON.stringify({
          event: 'user',
          message: { content: prompt },
        }) + '\n',
      parseLine(line, state, emit) {
        const event = safeParseJson(line);
        if (!event) return;
        if (event.event === 'result') {
          if (event.result?.status === 'ERROR') {
            state.errorMessage = event.result.error || 'Falha na execução do Antigravity.';
          } else {
            state.result = event.result?.response ?? '';
          }
        } else if (event.event === 'step_update') {
          const update = event.step_update;
          if (update?.step_type === 'agent_response' && update.text_delta) {
            emit({ type: 'progress', message: 'Antigravity está preparando a resposta.' });
          }
        }
      },
    };
  }

  throw new Error('Provedor de agente desconhecido.');
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function describeCodexItem(item) {
  if (!item) return 'Codex iniciou o processamento.';
  if (item.type === 'reasoning') return 'Codex está analisando o conteúdo.';
  if (item.type === 'command_execution') return 'Codex está verificando a resposta.';
  return 'Codex está preparando a resposta.';
}

function readLines(stream, onLine, onBytes) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    onBytes(Buffer.byteLength(chunk));
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) onLine(line);
  });
  stream.on('end', () => {
    if (pending) onLine(pending);
  });
}

export function runProvider({ providerId, prompt, workspaceRoot, emit, signal }) {
  const definition = providerDefinitions.find((candidate) => candidate.id === providerId);
  if (!definition) throw new Error('Agente não reconhecido.');
  const executable = resolveExecutable(definition);
  if (!executable) throw new Error(`${definition.label} não foi encontrado neste computador.`);

  const invocation = createProviderInvocation(providerId, executable, prompt, workspaceRoot);
  const isolatedDirectory = mkdtempSync(path.join(tmpdir(), 'bemtevi-content-agent-'));
  const existingCleanup = invocation.cleanup;
  invocation.cwd ??= isolatedDirectory;
  invocation.cleanup = () => {
    existingCleanup?.();
    rmSync(isolatedDirectory, { recursive: true, force: true });
  };
  const state = { result: '', plainOutput: [], stderr: [], outputBytes: 0 };

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd ?? workspaceRoot,
      env: createSafeAgentEnvironment(),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      invocation.cleanup?.();
      callback();
    };
    const abort = () => {
      child.kill();
      finish(() => reject(new Error('Execução cancelada.')));
    };
    const countBytes = (bytes) => {
      state.outputBytes += bytes;
      if (state.outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(() => reject(new Error('A resposta do agente ultrapassou o limite permitido.')));
      }
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error('O agente excedeu o tempo máximo de 10 minutos.')));
    }, RUN_TIMEOUT_MS);

    signal?.addEventListener('abort', abort, { once: true });
    readLines(child.stdout, (line) => invocation.parseLine(line, state, emit), countBytes);
    readLines(child.stderr, (line) => state.stderr.push(line), countBytes);

    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      finish(() => {
        if (code !== 0 || state.errorMessage) {
          const details = state.errorMessage || state.stderr.filter(Boolean).slice(-8).join('\n');
          reject(new Error(details || `${definition.label} encerrou com código ${code}.`));
          return;
        }
        const result = state.result || state.plainOutput.join('\n').trim();
        if (!result) {
          reject(new Error(`${definition.label} terminou sem devolver conteúdo.`));
          return;
        }
        resolve(result);
      });
    });

    if (invocation.stdin !== null) child.stdin.end(invocation.stdin, 'utf8');
    else child.stdin.end();
  });
}

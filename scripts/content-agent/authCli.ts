import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentAgentError } from './server';
import { loginAdmin, logoutAdmin } from './neonPublisher';
import { loadContentAgentEnv } from './publishedReader';

async function main() {
  const command = process.argv[2];
  if (command === 'logout') {
    await logoutAdmin();
    process.stdout.write('Sessão administrativa local removida.\n');
    return;
  }
  if (command !== 'login') throw new Error('Use login ou logout.');

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = loadContentAgentEnv(projectRoot);
  const authUrl = env.VITE_NEON_AUTH_URL;
  const dataApiUrl = env.VITE_NEON_DATA_API_URL;
  if (!authUrl || !dataApiUrl) {
    throw new ContentAgentError(
      'unavailable',
      'Configure VITE_NEON_AUTH_URL e VITE_NEON_DATA_API_URL antes de entrar.',
    );
  }

  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  const email = (await prompt.question('E-mail administrativo: ')).trim();
  prompt.close();
  const password = readPassword();
  const account = await loginAdmin({ authUrl, dataApiUrl }, email, password);
  process.stdout.write(`Sessão administrativa ativa para ${account.email}.\n`);
}

function readPassword(): string {
  if (process.platform !== 'win32') {
    throw new ContentAgentError(
      'unavailable',
      'O login interativo seguro está disponível apenas no Windows nesta versão.',
    );
  }
  const script =
    "$s=Read-Host 'Senha' -AsSecureString;$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
    windowsHide: false,
  });
  const password = result.stdout?.trim() ?? '';
  if (result.status !== 0 || !password) throw new ContentAgentError('unauthorized', 'A senha não foi informada.');
  return password;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha na autenticação administrativa.'}\n`);
  process.exitCode = 1;
});

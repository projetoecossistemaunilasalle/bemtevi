import { createServer } from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProviders, runProvider } from './providers.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(directory, '..', '..');
const host = '127.0.0.1';
const port = Number(process.env.BEMTEVI_AGENT_BRIDGE_PORT || 4318);
const pairCode = process.env.BEMTEVI_AGENT_BRIDGE_CODE || String(randomInt(100000, 1000000));
const accessToken = randomBytes(32).toString('base64url');
const failedPairAttempts = [];
const MAX_BODY_BYTES = 7 * 1024 * 1024;

function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > limit) {
        reject(new Error('A solicitação ultrapassou o limite permitido.'));
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(new Error('Solicitação JSON inválida.'));
      }
    });
    request.on('error', reject);
  });
}

function isAuthorized(request) {
  const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(provided);
  const right = Buffer.from(accessToken);
  return left.length === right.length && timingSafeEqual(left, right);
}

function canAttemptPairing() {
  const cutoff = Date.now() - 60_000;
  while (failedPairAttempts[0] && failedPairAttempts[0] < cutoff) failedPairAttempts.shift();
  return failedPairAttempts.length < 5;
}

function writeEvent(response, event) {
  response.write(`${JSON.stringify(event)}\n`);
}

const server = createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  try {
    if (request.method === 'POST' && url.pathname === '/v1/pair') {
      if (!canAttemptPairing()) {
        sendJson(response, 429, { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
        return;
      }
      const body = await readJson(request, 2048);
      if (String(body.code ?? '') !== pairCode) {
        failedPairAttempts.push(Date.now());
        sendJson(response, 401, { error: 'Código de conexão incorreto.' });
        return;
      }
      sendJson(response, 200, { token: accessToken });
      return;
    }

    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: 'Conecte novamente usando o código exibido no terminal.' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/status') {
      sendJson(response, 200, {
        connected: true,
        workspace: path.basename(workspaceRoot),
        providers: listProviders(),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/runs') {
      const body = await readJson(request);
      if (typeof body.provider !== 'string' || typeof body.prompt !== 'string' || body.prompt.trim().length < 1) {
        sendJson(response, 400, { error: 'Informe o agente e a tarefa antes de iniciar.' });
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      });
      const controller = new AbortController();
      response.on('close', () => {
        if (!response.writableEnded) controller.abort();
      });
      writeEvent(response, { type: 'started', provider: body.provider });

      try {
        const output = await runProvider({
          providerId: body.provider,
          prompt: body.prompt,
          workspaceRoot,
          emit: (event) => writeEvent(response, event),
          signal: controller.signal,
        });
        writeEvent(response, { type: 'result', output });
      } catch (error) {
        writeEvent(response, {
          type: 'error',
          message: error instanceof Error ? error.message : 'Falha ao executar o agente.',
        });
      }
      response.end();
      return;
    }

    sendJson(response, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Solicitação inválida.' });
    } else {
      writeEvent(response, { type: 'error', message: 'A conexão foi interrompida.' });
      response.end();
    }
  }
});

server.listen(port, host, () => {
  console.log('Ponte local de agentes do BemTeVi');
  console.log(`Endereço: http://${host}:${port}`);
  console.log(`Código de conexão: ${pairCode}`);
  console.log('Mantenha este terminal aberto enquanto usar a conexão direta.');
});

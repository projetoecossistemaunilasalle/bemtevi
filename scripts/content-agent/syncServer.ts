import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublishedContentPayload } from '../../src/app/content/publishedContent';
import { compareContent } from '../../src/dev-dashboard/publishing/semanticDiff';
import { DraftStore, DraftStoreError } from './draftStore';

const HOST = '127.0.0.1';
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 6 * 1024 * 1024;
const DEFAULT_PORT = 4319;

export interface DraftSyncServerOptions {
  store: DraftStore;
  port?: number;
  pairCode?: string;
  allowedOrigins?: string[];
}

function json(response: ServerResponse, status: number, body: unknown) {
  const contents = JSON.stringify(body);
  if (Buffer.byteLength(contents) > MAX_RESPONSE_BYTES) {
    response.writeHead(413, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(
      JSON.stringify({ error: { code: 'invalid_payload', message: 'A resposta excede o limite permitido.' } }),
    );
    return;
  }
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(contents);
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let text = '';
    let bytes = 0;
    let exceeded = false;
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) {
        exceeded = true;
        return;
      }
      text += chunk;
    });
    request.on('end', () => {
      if (exceeded) {
        reject(new DraftStoreError('invalid_payload', 'A solicitação ultrapassou o limite permitido.'));
        return;
      }
      try {
        const value = JSON.parse(text || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object');
        resolve(value as Record<string, unknown>);
      } catch {
        reject(new DraftStoreError('invalid_payload', 'Solicitação JSON inválida.'));
      }
    });
    request.on('error', reject);
  });
}

function authorized(request: IncomingMessage, token: string): boolean {
  const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(provided);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendError(response: ServerResponse, error: unknown) {
  const code = error instanceof DraftStoreError ? error.code : 'unavailable';
  const status = code === 'stale_generation' ? 409 : code === 'invalid_payload' ? 400 : 500;
  json(response, status, { error: { code, message: error instanceof Error ? error.message : 'Falha na API local.' } });
}

export function createDraftSyncServer(options: DraftSyncServerOptions) {
  const token = randomBytes(32).toString('base64url');
  const pairCode = options.pairCode ?? String(randomInt(100000, 1000000));
  const failedAttempts: number[] = [];
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const port = options.port ?? DEFAULT_PORT;

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      response.setHeader('Vary', 'Origin');
    } else if (origin) {
      json(response, 403, { error: { code: 'unauthorized', message: 'Origem não autorizada.' } });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', `http://${HOST}:${port}`);
    try {
      if (request.method === 'POST' && url.pathname === '/v1/pair') {
        const cutoff = Date.now() - 60_000;
        while (failedAttempts[0] && failedAttempts[0] < cutoff) failedAttempts.shift();
        if (failedAttempts.length >= 5) {
          json(response, 429, { error: { code: 'unavailable', message: 'Muitas tentativas. Aguarde um minuto.' } });
          return;
        }
        const body = await readJson(request);
        assertAllowedKeys(body, ['code']);
        if (body.code !== pairCode) {
          failedAttempts.push(Date.now());
          json(response, 401, { error: { code: 'unauthorized', message: 'Código de pareamento incorreto.' } });
          return;
        }
        json(response, 200, { token });
        return;
      }
      if (!authorized(request, token)) {
        json(response, 401, { error: { code: 'unauthorized', message: 'API local não pareada.' } });
        return;
      }

      const draftMatch = /^\/v1\/drafts\/([^/]+)$/.exec(url.pathname);
      if (request.method === 'GET' && url.pathname === '/v1/drafts') {
        const limit = parseBoundedInteger(url.searchParams.get('limit'), 20, 1, 100, 'limit');
        const cursor = parseBoundedInteger(url.searchParams.get('cursor'), 0, 0, Number.MAX_SAFE_INTEGER, 'cursor');
        json(response, 200, await options.store.list(cursor, limit));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/drafts') {
        const body = await readJson(request);
        assertAllowedKeys(body, ['baseRevision', 'basePayload', 'candidate', 'idempotencyKey']);
        if (!Object.hasOwn(body, 'basePayload') || !Object.hasOwn(body, 'candidate')) {
          throw new DraftStoreError('invalid_payload', 'basePayload e candidate são obrigatórios.');
        }
        const baseRevision = parseNullableRevision(body.baseRevision);
        const draft = await options.store.create({
          baseRevision,
          basePayload: body.basePayload as PublishedContentPayload,
          candidate: body.candidate,
          idempotencyKey: parseIdempotencyKey(body.idempotencyKey),
        });
        json(response, 201, draft);
        return;
      }
      if (request.method === 'GET' && draftMatch) {
        const generationValue = url.searchParams.get('generation');
        const generation =
          generationValue === null
            ? undefined
            : parseBoundedInteger(generationValue, 0, 1, Number.MAX_SAFE_INTEGER, 'generation');
        const draft = await options.store.get(decodeURIComponent(draftMatch[1]), generation);
        json(response, 200, draft);
        return;
      }
      if (request.method === 'PUT' && draftMatch) {
        const body = await readJson(request);
        assertAllowedKeys(body, ['expectedGeneration', 'candidate', 'idempotencyKey']);
        const draft = await options.store.get(decodeURIComponent(draftMatch[1]));
        const expectedGeneration = body.expectedGeneration;
        if (
          typeof expectedGeneration !== 'number' ||
          !Number.isSafeInteger(expectedGeneration) ||
          expectedGeneration < 1
        ) {
          throw new DraftStoreError('invalid_payload', 'expectedGeneration inválida.');
        }
        if (!Object.hasOwn(body, 'candidate')) {
          throw new DraftStoreError('invalid_payload', 'candidate é obrigatório.');
        }
        const updated = await options.store.update({
          draftId: draft.draftId,
          expectedGeneration,
          candidate: body.candidate,
          idempotencyKey: parseIdempotencyKey(body.idempotencyKey),
        });
        json(response, 200, updated);
        return;
      }
      const diffMatch = /^\/v1\/drafts\/([^/]+)\/diff$/.exec(url.pathname);
      if (request.method === 'GET' && diffMatch) {
        const generationValue = url.searchParams.get('generation');
        const generation =
          generationValue === null
            ? undefined
            : parseBoundedInteger(generationValue, 0, 1, Number.MAX_SAFE_INTEGER, 'generation');
        const draft = await options.store.get(decodeURIComponent(diffMatch[1]), generation);
        const compared = compareContent(draft.base.payload, draft.candidate);
        if (!compared.ok) throw new DraftStoreError('invalid_payload', 'Não foi possível comparar o rascunho.');
        const summary = compared.value.reduce<Record<string, number>>((result, change) => {
          result[change.kind] = (result[change.kind] ?? 0) + 1;
          return result;
        }, {});
        json(response, 200, {
          draftId: draft.draftId,
          generation: draft.generation,
          candidateDigest: draft.candidateDigest,
          baseDigest: draft.base.digest,
          changes: compared.value,
          summary,
        });
        return;
      }
      json(response, 404, { error: { code: 'unavailable', message: 'Rota não encontrada.' } });
    } catch (error) {
      if (!response.headersSent) sendError(response, error);
    }
  });

  return { server, token, pairCode, host: HOST, port };
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new DraftStoreError('invalid_payload', `${label} inválido.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new DraftStoreError('invalid_payload', `${label} inválido.`);
  }
  return parsed;
}

function parseNullableRevision(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new DraftStoreError('invalid_payload', 'baseRevision inválida.');
  }
  return value;
}

function assertAllowedKeys(body: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new DraftStoreError('invalid_payload', `Campos desconhecidos: ${unknown.join(', ')}.`);
  }
}

function parseIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 200) {
    throw new DraftStoreError('invalid_payload', 'idempotencyKey inválida.');
  }
  return value;
}

export function runDefaultDraftSyncServer() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const sync = createDraftSyncServer({
    store: new DraftStore(path.join(projectRoot, '.bemtevi', 'content-drafts')),
    port: Number(process.env.BEMTEVI_CONTENT_AGENT_SYNC_PORT || DEFAULT_PORT),
    pairCode: process.env.BEMTEVI_CONTENT_AGENT_SYNC_CODE,
    allowedOrigins: (process.env.BEMTEVI_DASHBOARD_ORIGINS || 'http://localhost:3000,http://localhost:3001')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
  sync.server.listen(sync.port, sync.host, () => {
    console.log('API local de sincronização do BemTeVi');
    console.log(`Endereço: http://${sync.host}:${sync.port}`);
    console.log(`Código de pareamento: ${sync.pairCode}`);
  });
  return sync.server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runDefaultDraftSyncServer();

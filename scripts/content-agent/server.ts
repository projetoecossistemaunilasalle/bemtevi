import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PublishedContentReader } from './publishedReader';
import {
  ContentAgentError,
  isRecord,
  mapContentAgentError,
  requiredString,
  validateToolArguments,
  type JsonRecord,
} from './contentAgentErrors';
import { ContentReadTools } from './contentReadTools';
import { ContentDraftTools } from './contentDraftTools';
import { ContentPublishTools, type ContentPublisher } from './contentPublishTools';
import { DraftStore } from './draftStore';
import { createDefaultPublishedContentReader, loadContentAgentEnv } from './publishedReader';
import { createVaultContentPublisher } from './neonPublisher';
import { announcedTools } from './protocolOutput';

export { ContentAgentError } from './contentAgentErrors';
export type { ContentAgentErrorCode } from './contentAgentErrors';
export type { ContentAgentSession, ContentPublisher } from './contentPublishTools';

export interface McpServerOptions {
  reader: PublishedContentReader;
  store: DraftStore;
  publisher?: ContentPublisher;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: JsonRecord;
}

export class ContentMcpServer {
  private readonly reads: ContentReadTools;
  private readonly drafts: ContentDraftTools;
  private readonly publishes: ContentPublishTools;

  constructor(options: McpServerOptions) {
    this.reads = new ContentReadTools(options.reader);
    this.publishes = new ContentPublishTools(options);
    this.drafts = new ContentDraftTools({
      store: options.store,
      loadSnapshot: () => this.reads.loadSnapshot(),
      invalidatePreparedTokens: (draftId) => this.publishes.invalidateDraft(draftId),
    });
  }

  async handle(request: JsonRpcRequest): Promise<JsonRecord | null> {
    if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      return this.errorResponse(request.id ?? null, -32600, 'Solicitação JSON-RPC inválida.');
    }
    if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') return null;
    try {
      if (request.method === 'initialize')
        return this.response(request.id, {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'bemtevi-content', version: '1.0.0' },
        });
      if (request.method === 'ping') return this.response(request.id, {});
      if (request.method === 'tools/list') return this.response(request.id, { tools: announcedTools });
      if (request.method === 'tools/call') {
        const params = isRecord(request.params) ? request.params : {};
        const name = requiredString(params.name, 'name');
        return this.toolResponse(request.id, name, params.arguments ?? {});
      }
      return this.errorResponse(request.id ?? null, -32601, 'Método não encontrado.');
    } catch (_error) {
      return this.errorResponse(request.id ?? null, -32603, 'Falha interna no servidor MCP.');
    }
  }

  private async toolResponse(
    id: string | number | null | undefined,
    name: string,
    rawArgs: unknown,
  ): Promise<JsonRecord> {
    try {
      if (!isRecord(rawArgs)) throw new ContentAgentError('invalid_payload', 'arguments precisa ser um objeto.');
      validateToolArguments(name, rawArgs);
      const value = await this.callTool(name, rawArgs);
      const serialized = JSON.stringify(value);
      const maximum = name === 'get_draft' ? 12 * 1024 * 1024 : 7 * 1024 * 1024;
      if (Buffer.byteLength(serialized, 'utf8') > maximum) {
        throw new ContentAgentError('unavailable', 'O resultado excede o limite permitido para esta ferramenta.');
      }
      return this.response(id, {
        content: [{ type: 'text', text: serialized }],
        structuredContent: value,
        isError: false,
      });
    } catch (error) {
      const mapped = mapContentAgentError(error);
      const value = { error: { code: mapped.code, message: mapped.message } };
      return this.response(id, {
        content: [{ type: 'text', text: JSON.stringify(value) }],
        structuredContent: value,
        isError: true,
      });
    }
  }

  private async callTool(name: string, args: JsonRecord): Promise<unknown> {
    switch (name) {
      case 'get_published_revision':
        return this.reads.getPublishedRevision();
      case 'list_published_items':
        return this.reads.listPublishedItems(args);
      case 'find_material_references':
        return this.reads.findMaterialReferences(args);
      case 'get_flow':
        return this.reads.getItem(args, 'flows');
      case 'get_material':
        return this.reads.getItem(args, 'educationMaterials');
      case 'validate_content_patch':
        return this.drafts.validateContentPatch(args);
      case 'create_draft':
        return this.drafts.createDraft(args);
      case 'update_draft':
        return this.drafts.updateDraft(args);
      case 'get_draft':
        return this.drafts.getDraft(args);
      case 'get_draft_diff':
        return this.drafts.getDraftDiff(args);
      case 'prepare_publish':
        return this.publishes.preparePublish(args);
      case 'publish_draft':
        return this.publishes.publishDraft(args);
      default:
        throw new ContentAgentError('invalid_payload', `Ferramenta desconhecida: ${name}.`);
    }
  }

  private response(id: string | number | null | undefined, result: unknown): JsonRecord {
    return { jsonrpc: '2.0', id: id ?? null, result };
  }

  private errorResponse(id: string | number | null, code: number, message: string): JsonRecord {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}

export function createDefaultContentMcpServer(): ContentMcpServer {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = loadContentAgentEnv(projectRoot);
  return new ContentMcpServer({
    reader: createDefaultPublishedContentReader(projectRoot),
    store: new DraftStore(path.join(projectRoot, '.bemtevi', 'content-drafts')),
    ...(env.BEMTEVI_CONTENT_AGENT_PUBLISH_ENABLED === 'true' ? { publisher: createVaultContentPublisher() } : {}),
  });
}

export async function runStdioServer(server = createDefaultContentMcpServer()) {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } })}\n`,
      );
      continue;
    }
    const response = await server.handle(request);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStdioServer().catch(() => (process.exitCode = 1));
}

/**
 * Tool catalog for the read/edit/image surface plus the MCP-03 guarded
 * publication tools (doc 04 "Tool Input And Output Catalog"). Descriptions are
 * the exact shipped text. Every tool is registered through the MCP-01 dispatch
 * seam and wrapped by the shared limits: one sliding-window rate limiter and
 * the read/mutation concurrency gates; excess is rejected immediately with
 * `rate_limited`.
 */

import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { DataApiClient } from '../client/dataApiClient';
import { READ_TOOL_ANNOTATIONS, type RegisteredServerTool } from '../server/createServer';
import { type ToolDispatch, type ToolHandler } from '../server/dispatch';
import { BaseSnapshotCache } from '../session/baseSnapshotCache';
import {
  createToolLimits,
  defaultDelay,
  runWithLimits,
  type DelayFn,
  type ToolClock,
  type ToolKind,
  type ToolLimits,
} from '../session/limits';
import { toolFail } from './shared';
import type { ToolRuntime } from './rpc';
import {
  APPLY_OPERATIONS_SCHEMA,
  FIND_REFERENCES_SCHEMA,
  GET_DIFF_SCHEMA,
  GET_EDITOR_CONTEXT_SCHEMA,
  GET_ITEM_SCHEMA,
  LIST_ITEMS_SCHEMA,
  SET_MATERIAL_IMAGE_SCHEMA,
} from './schemas';
import { createGetEditorContextHandler } from './getEditorContext';
import { createListItemsHandler } from './listItems';
import { createGetItemHandler } from './getItem';
import { createFindReferencesHandler } from './findReferences';
import { createGetDiffHandler } from './getDiff';
import { createApplyOperationsHandler } from './applyOperations';
import { createSetMaterialImageHandler } from './setMaterialImage';
import { PREPARE_PUBLISH_ANNOTATIONS, PREPARE_PUBLISH_SCHEMA, createPreparePublishHandler } from './preparePublish';
import { PUBLISH_DRAFT_ANNOTATIONS, PUBLISH_DRAFT_SCHEMA, createPublishDraftHandler } from './publishDraft';

export const READ_KIND: ToolKind = 'read';
export const MUTATION_KIND: ToolKind = 'mutation';

export const MUTATION_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

export const CONTENT_TOOL_NAMES = [
  'get_editor_context',
  'list_items',
  'get_item',
  'find_references',
  'apply_operations',
  'set_material_image',
  'get_diff',
  'prepare_publish',
  'publish_draft',
] as const;

export type ContentToolName = (typeof CONTENT_TOOL_NAMES)[number];

interface ContentToolDefinition {
  name: ContentToolName;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  kind: ToolKind;
  annotations: ToolAnnotations;
}

const CATALOG: readonly ContentToolDefinition[] = [
  {
    name: 'get_editor_context',
    title: 'Contexto editorial do rascunho',
    description:
      'Read the current shared draft generation and editorial rules. This caches a base for 15 minutes. It does not edit or publish.',
    schema: GET_EDITOR_CONTEXT_SCHEMA,
    kind: READ_KIND,
    annotations: READ_TOOL_ANNOTATIONS,
  },
  {
    name: 'list_items',
    title: 'Listar itens do rascunho',
    description:
      'List draft item IDs and labels at a cached generation, up to 100 per page. Call get_editor_context again if the base has expired.',
    schema: LIST_ITEMS_SCHEMA,
    kind: READ_KIND,
    annotations: READ_TOOL_ANNOTATIONS,
  },
  {
    name: 'get_item',
    title: 'Ler item do rascunho',
    description:
      'Read a draft item or one top-level field as paged JSON text, without embedded image bytes. Concatenate pages before parsing. It does not edit.',
    schema: GET_ITEM_SCHEMA,
    kind: READ_KIND,
    annotations: READ_TOOL_ANNOTATIONS,
  },
  {
    name: 'find_references',
    title: 'Buscar referências a um ID',
    description:
      'Find exact string references to an ID in the cached draft. Results are advisory and may include non-reference text. They do not authorize deletion.',
    schema: FIND_REFERENCES_SCHEMA,
    kind: READ_KIND,
    annotations: READ_TOOL_ANNOTATIONS,
  },
  {
    name: 'apply_operations',
    title: 'Aplicar operações ao rascunho',
    description:
      'Apply 1 to 200 explicit operations atomically to the shared draft. Uses generation checks and one safe semantic-merge retry. Invalid structure is rejected; semantic issues are reported. This never publishes.',
    schema: APPLY_OPERATIONS_SCHEMA,
    kind: MUTATION_KIND,
    annotations: MUTATION_TOOL_ANNOTATIONS,
  },
  {
    name: 'set_material_image',
    title: 'Definir imagem de material',
    description:
      'Set or remove one material image with generation checks. Upload PNG, JPEG or WebP bytes up to 1 MiB, at most 4096 per dimension and 16 megapixels. No local path or URL fetching. This never publishes.',
    schema: SET_MATERIAL_IMAGE_SCHEMA,
    kind: MUTATION_KIND,
    annotations: MUTATION_TOOL_ANNOTATIONS,
  },
  {
    name: 'get_diff',
    title: 'Comparar rascunho com a publicação',
    description:
      'Compare the cached draft with the current live publication. Read all pages before deciding to publish. No content is changed.',
    schema: GET_DIFF_SCHEMA,
    kind: READ_KIND,
    annotations: READ_TOOL_ANNOTATIONS,
  },
  {
    name: 'prepare_publish',
    title: 'Preparar publicação do rascunho',
    description:
      'Validate and pin the exact current canonical draft for publication for 10 minutes. This does not publish. Obtain explicit user publication intent before publishing.',
    schema: PREPARE_PUBLISH_SCHEMA,
    kind: MUTATION_KIND,
    annotations: PREPARE_PUBLISH_ANNOTATIONS,
  },
  {
    name: 'publish_draft',
    title: 'Publicar rascunho preparado',
    description:
      'Publish only when the user explicitly asks to publish. Editing, rewriting, improving, reviewing, importing, generating, or saving does not imply permission. Publishes the entire pinned shared draft, never arbitrary content. This changes live content and is destructive.',
    schema: PUBLISH_DRAFT_SCHEMA,
    kind: MUTATION_KIND,
    annotations: PUBLISH_DRAFT_ANNOTATIONS,
  },
];

export interface RegisterContentToolsOptions {
  client: DataApiClient;
  connectionId: string;
  agentToken: string;
  clock?: ToolClock;
  delay?: DelayFn;
  cache?: BaseSnapshotCache;
}

/** Server-visible specs (raw strict JSON schemas; the factory adapts them). */
export function contentToolSpecs(): RegisteredServerTool[] {
  return CATALOG.map((definition) => ({
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.schema,
    annotations: definition.annotations,
  }));
}

/** Registers the read/edit/image and publication handlers under the shared limits (doc 04). */
export function registerContentTools(options: RegisterContentToolsOptions, dispatch: ToolDispatch): void {
  const cache = options.cache ?? new BaseSnapshotCache({ clock: options.clock });
  const runtime: ToolRuntime = {
    client: options.client,
    connectionId: options.connectionId,
    agentToken: options.agentToken,
    cache,
    delay: options.delay ?? defaultDelay,
  };
  const limits: ToolLimits = createToolLimits({ clock: options.clock, delay: runtime.delay });
  const handlers: Record<ContentToolName, ToolHandler> = {
    get_editor_context: createGetEditorContextHandler(runtime),
    list_items: createListItemsHandler(runtime),
    get_item: createGetItemHandler(runtime),
    find_references: createFindReferencesHandler(runtime),
    get_diff: createGetDiffHandler(runtime),
    apply_operations: createApplyOperationsHandler(runtime),
    set_material_image: createSetMaterialImageHandler(runtime),
    prepare_publish: createPreparePublishHandler(runtime),
    publish_draft: createPublishDraftHandler(runtime),
  };
  for (const definition of CATALOG) {
    const kind = definition.kind;
    const handler = handlers[definition.name];
    dispatch.register({
      name: definition.name,
      description: definition.description,
      handler: async (args) => {
        const outcome = await runWithLimits(limits, kind, () => handler(args ?? {}));
        if (outcome.allowed === false) return toolFail('rate_limited');
        return outcome.value;
      },
    });
  }
}

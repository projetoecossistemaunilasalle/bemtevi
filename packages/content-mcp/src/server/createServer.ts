/**
 * MCP server factory (doc 04 "Package And Bootstrap").
 *
 * `McpServer` from `@modelcontextprotocol/server` with name `bemtevi-content`,
 * version `1.0.0`, and the shipped instructions delivered through the
 * `instructions` field (served in modern discovery and legacy initialize).
 * The SDK's default modern/legacy handling is never disabled. Tools are
 * registered once per server instance from the dispatch table; each tool
 * returns `{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:!result.ok}`.
 */

import { fromJsonSchema, McpServer, type JsonSchemaType, type ToolAnnotations } from '@modelcontextprotocol/server';
import { type ToolDispatch, type ToolHandlerArgs, type ToolResult } from './dispatch';
import { SERVER_INSTRUCTIONS } from './instructions';

export const SERVER_NAME = 'bemtevi-content';
export const SERVER_VERSION = '1.0.0';

/** Annotations per doc 04 (read tools; mutation tools override in MCP-02/03). */
export const READ_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export interface RegisteredServerTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

/** JSON schemas for the tools the dispatch table exposes. */
export function toolInputSchemas(names: readonly string[]): Map<string, Record<string, unknown>> {
  const schemas = new Map<string, Record<string, unknown>>();
  for (const name of names) {
    // MCP-01: strict empty-object schema for context-free tools; MCP-02/03
    // register real input schemas through the same seam.
    schemas.set(name, { type: 'object', properties: {}, additionalProperties: false, required: [] });
  }
  return schemas;
}

/** Creates a server with instructions and registers every dispatch tool. */
export function createServer(dispatch: ToolDispatch, toolSpecs: readonly RegisteredServerTool[]): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });
  for (const spec of toolSpecs) {
    const handler = buildHandler(dispatch, spec.name);
    // MCP-02: each spec carries a strict JSON schema (additionalProperties:false
    // + required); the SDK fromJsonSchema adapter validates tool arguments
    // before the dispatch handler runs.
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: fromJsonSchema<ToolHandlerArgs>(spec.inputSchema as JsonSchemaType),
        annotations: spec.annotations ?? READ_TOOL_ANNOTATIONS,
      },
      handler,
    );
  }
  return server;
}

type ServerToolCallback = (args: ToolHandlerArgs) => Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: unknown;
  isError: boolean;
}>;

function buildHandler(dispatch: ToolDispatch, name: string): ServerToolCallback {
  return async (args) => {
    const result: ToolResult = await dispatch.dispatch(name, args ?? {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: !result.ok,
    };
  };
}

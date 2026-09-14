/**
 * Tool dispatch (doc 04 tool catalog). MCP-01 registers the dispatch seam;
 * the read/edit/image tools arrive in MCP-02 and publication in MCP-03
 * (add-only). Unknown tools are rejected with a fixed error; no tool argument
 * can reach an arbitrary RPC name — handlers receive only validated args and
 * call the fixed client allowlist.
 */

import type { EditorialError } from '../client/errors';

export interface ToolHandlerArgs {
  [key: string]: unknown;
}

export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: EditorialError;
}

export type ToolHandler = (args: ToolHandlerArgs) => Promise<ToolResult>;

export interface RegisteredToolSpec {
  name: string;
  description: string;
  handler: ToolHandler;
}

export class ToolDispatch {
  private readonly tools = new Map<string, RegisteredToolSpec>();

  register(spec: RegisteredToolSpec): void {
    this.tools.set(spec.name, spec);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  spec(name: string): RegisteredToolSpec | undefined {
    return this.tools.get(name);
  }

  async dispatch(name: string, args: ToolHandlerArgs): Promise<ToolResult> {
    const spec = this.tools.get(name);
    if (!spec) {
      return {
        ok: false,
        error: { code: 'invalid_input', message: `Ferramenta desconhecida: ${name}.` },
      };
    }
    try {
      return await spec.handler(args);
    } catch (error) {
      return {
        ok: false,
        error: { code: 'unavailable', message: error instanceof Error ? error.message : 'Falha inesperada.' },
      };
    }
  }
}

/** MCP-01 dispatch seam: no tools registered yet (MCP-02/03 add them). */
export function createToolDispatch(): ToolDispatch {
  return new ToolDispatch();
}

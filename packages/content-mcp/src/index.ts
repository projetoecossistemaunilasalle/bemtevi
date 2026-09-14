/**
 * Bin entrypoint (doc 04 "Package And Bootstrap"). Reads the environment,
 * validates configuration strictly before any network activity, creates the
 * server from the dispatch seam, and serves MCP over stdio via `serveStdio`.
 * Diagnostics go to stderr; stdout carries protocol only. No credential is
 * ever printed; config failures exit before the SDK performs any network call.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parseConfig } from './config';
import { createAnonymousDataApiClient, type DataApiClient } from './client/dataApiClient';
import { createServer, type RegisteredServerTool } from './server/createServer';
import { createToolDispatch, type ToolDispatch } from './server/dispatch';
import { contentToolSpecs, registerContentTools } from './tools/definitions';

export interface ComposedRuntime {
  config: ReturnType<typeof parseConfig>;
  client: DataApiClient;
  dispatch: ToolDispatch;
}

/** Composes client + dispatch and registers the doc-04 tool surface (MCP-02). */
export function composeRuntime(env: NodeJS.ProcessEnv): ComposedRuntime {
  const config = parseConfig(env);
  const client = createAnonymousDataApiClient(config);
  const dispatch = createToolDispatch();
  registerContentTools({ client, connectionId: config.connectionId, agentToken: config.agentToken }, dispatch);
  return { config, client, dispatch };
}

/** Tool specs wired into each server instance (read/edit/image; MCP-03 adds publication). */
export function registeredTools(): RegisteredServerTool[] {
  return contentToolSpecs();
}

/** Serves MCP over stdio; the SDK owns the era decision (modern/legacy). */
export function serve(env: NodeJS.ProcessEnv = process.env, stdio?: { write(line: string): void }): void {
  let runtime: ComposedRuntime;
  try {
    runtime = composeRuntime(env);
  } catch (error) {
    writeDiagnostic(
      stdio ?? process.stderr,
      `configuration failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    process.exitCode = 1;
    return;
  }
  const tools = registeredTools();
  serveStdio(() => createServer(runtime.dispatch, tools), {
    onerror: (error) => {
      writeDiagnostic(stdio ?? process.stderr, error instanceof Error ? error.message : String(error));
    },
  });
}

function writeDiagnostic(stream: { write(line: string): void }, message: string): void {
  stream.write(`${message}\n`);
}

// Bin execution guard: serve only when this module is the process entrypoint.
// Direct imports (tests) never auto-serve. The comparison uses file URLs only:
// doc 04 forbids filesystem operations in the runtime, and the architecture
// gate forbids `node:fs` in MCP runtime sources. POSIX `.bin` symlink
// invocation is exercised by the packed-artifact smoke (MCP-04), which invokes
// the installed bin entry file directly.
const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
const moduleUrl = import.meta.url;
const modulePath = fileURLToPath(moduleUrl);
if (entryUrl !== null && (entryUrl === moduleUrl || process.argv[1] === modulePath)) {
  serve();
}

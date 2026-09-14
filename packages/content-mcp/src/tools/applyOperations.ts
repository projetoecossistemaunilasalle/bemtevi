/**
 * apply_operations (doc 04). Applies 1 to 200 explicit operations atomically
 * through the shared mutation pipeline. Invalid envelope shape is rejected
 * locally (invalid_input) and invalid operation structure by content-core
 * (invalid_operations / invalid_image), in both cases without any RPC call;
 * semantic issues are reported in the validation result. This never publishes.
 */

import { parseOperationBatch, runMutation } from './mutation';
import { isPositiveSafeInteger, toolFail } from './shared';
import type { ToolRuntime } from './rpc';
import type { ToolHandlerArgs, ToolResult } from '../server/dispatch';

export function createApplyOperationsHandler(rt: ToolRuntime) {
  return async (args: ToolHandlerArgs): Promise<ToolResult> => {
    const expectedGeneration = args['expectedGeneration'];
    if (!isPositiveSafeInteger(expectedGeneration)) return toolFail('invalid_input');
    const operations = parseOperationBatch(args['operations']);
    if (!operations.ok) return operations;
    return runMutation(rt, expectedGeneration, operations.data);
  };
}

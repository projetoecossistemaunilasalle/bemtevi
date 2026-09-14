// Compatibility adapter: the canonical implementation lives in
// @bemtevi/content-core (validation/flowValidation). The structural pass is fed
// through this package's validateFlow seam so existing module-mock based tests
// keep intercepting it unchanged.
import { validateFlow } from '../../domain/flow-engine/validateFlow';
import { validateDashboardFlows as validateDashboardFlowsCore } from '@bemtevi/content-core';
import type { DashboardValidationResult, GuidedFlow } from '@bemtevi/content-core';

export function validateDashboardFlows(flows: GuidedFlow[], resourceIds: string[]): DashboardValidationResult {
  return validateDashboardFlowsCore(flows, resourceIds, { validateFlowImpl: validateFlow });
}

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { translateStructuralChoiceIssue } from './flowStructuralChoiceIssues';
import { translateStructuralCoreIssue } from './flowStructuralCoreIssues';
import {
  countPreviousOccurrences,
  createFlowValidationContext,
  type StructuralIssueDetails,
} from './flowStructuralValidationContext';

/** Adds an actionable PT-BR editor path to one domain-validator message. */
export function toStructuralIssue(
  flow: GuidedFlow,
  rawMessage: string,
  errorIndex: number,
  allErrors: string[],
): StructuralIssueDetails {
  const context = createFlowValidationContext(flow);
  const occurrence = countPreviousOccurrences(allErrors, rawMessage, errorIndex);
  const flowLabel = context.flowId || 'este fluxo';
  const input = { context, rawMessage, occurrence, flowLabel };

  return (
    translateStructuralCoreIssue(input) ??
    translateStructuralChoiceIssue(input) ?? {
      message: `O fluxo "${flowLabel}" contém um erro estrutural. Revise a configuração no editor antes de publicar.`,
      path: `${context.pathRoot}.validation`,
    }
  );
}

import type { DashboardValidationResult, DashboardValidationIssue } from './validationTypes';

export interface FieldIssues {
  errors: DashboardValidationIssue[];
  warnings: DashboardValidationIssue[];
}

/**
 * Returns the validation issues whose dotted `path` starts with `pathPrefix`.
 *
 * Used to pin errors/warnings inline next to the offending form field. Issues
 * without a `path` (duplicate ids, structural flow errors) are intentionally
 * excluded here — they belong only in the summary, since they cannot be
 * attached to a single field.
 */
export function issuesForPath(result: DashboardValidationResult, pathPrefix: string): FieldIssues {
  const prefix = pathPrefix.endsWith('.') ? pathPrefix : `${pathPrefix}.`;
  const matches = (issue: DashboardValidationIssue) =>
    Boolean(issue.path) && (issue.path === pathPrefix || issue.path.startsWith(prefix));

  return {
    errors: result.errors.filter(matches),
    warnings: result.warnings.filter(matches),
  };
}

/** True when a field has at least one matching error. */
export function fieldHasError(issues: FieldIssues) {
  return issues.errors.length > 0;
}

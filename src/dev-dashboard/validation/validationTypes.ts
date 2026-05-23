export type DashboardValidationLevel = 'error' | 'warning';
export type DashboardValidationArea = 'flows' | 'education' | 'export';

export interface DashboardValidationIssue {
  level: DashboardValidationLevel;
  area: DashboardValidationArea;
  id: string;
  message: string;
  path?: string;
}

export interface DashboardValidationResult {
  errors: DashboardValidationIssue[];
  warnings: DashboardValidationIssue[];
}

export function createValidationResult(issues: DashboardValidationIssue[]): DashboardValidationResult {
  return {
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}

import { inputClass, inputInvalidClass } from '../components/fieldStyles';
import { fieldHasError, type FieldIssues } from '../validation/fieldIssues';

export function fieldClass(issues: FieldIssues, base = inputClass): string {
  return fieldHasError(issues) ? `${base} ${inputInvalidClass}` : base;
}

export function mergeFieldIssues(...issueGroups: FieldIssues[]): FieldIssues {
  return {
    errors: issueGroups.flatMap(({ errors }) => errors),
    warnings: issueGroups.flatMap(({ warnings }) => warnings),
  };
}

export function normalizeContactValidationPath(path: string): string {
  if (path.endsWith('.phoneHref')) return path.replace(/\.phoneHref$/, '.phoneDisplay');
  if (/^contacts\.\d+\.(?:city|state)$/.test(path)) return path.replace(/\.(?:city|state)$/, '.locationId');
  return path;
}

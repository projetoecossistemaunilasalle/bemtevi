import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DashboardValidationIssue, DashboardValidationResult } from '../validation/validationTypes';

export interface ValidationIssueAction {
  /** Label for the control that takes the person to the offending value. */
  label: string;
  /** Short instruction shown beside the control so the next step is explicit. */
  description: string;
  onClick: () => void;
}

export type ValidationIssueActionResolver = (issue: DashboardValidationIssue) => ValidationIssueAction | null;

/**
 * Renders validation results split into visually distinct error and warning
 * groups so blocking errors read differently from advisory warnings. Errors
 * use the error container palette; warnings use the amber warning container.
 * An all-clear state confirms the draft is clean.
 */
export function ValidationSummary({
  result,
  getIssueAction,
}: {
  result: DashboardValidationResult;
  getIssueAction?: ValidationIssueActionResolver;
}) {
  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;
  const isEmpty = errorCount === 0 && warningCount === 0;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <h3 className="font-headline-sm text-on-surface">Validação</h3>
      {isEmpty ? (
        <p className="flex items-center gap-2 font-body-md text-on-surface-variant">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" size={20} />
          Nenhum problema encontrado neste rascunho.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {errorCount > 0 ? (
            <ValidationGroup level="error" count={errorCount} issues={result.errors} getIssueAction={getIssueAction} />
          ) : null}
          {warningCount > 0 ? (
            <ValidationGroup
              level="warning"
              count={warningCount}
              issues={result.warnings}
              getIssueAction={getIssueAction}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function ValidationGroup({
  level,
  count,
  issues,
  getIssueAction,
}: {
  level: 'error' | 'warning';
  count: number;
  issues: DashboardValidationIssue[];
  getIssueAction?: ValidationIssueActionResolver;
}) {
  const isError = level === 'error';
  const Icon = isError ? AlertCircle : AlertTriangle;
  const heading = isError
    ? `${count} ${count === 1 ? 'erro' : 'erros'} ${count === 1 ? 'impeditivo' : 'impeditivos'}`
    : `${count} ${count === 1 ? 'aviso' : 'avisos'}`;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex flex-col gap-2 rounded-lg p-3 ${isError ? 'bg-error-container/60' : 'bg-warning-container/40'}`}
    >
      <p
        className={`flex items-center gap-2 font-label-md ${isError ? 'text-on-error-container' : 'text-on-warning-container'}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" size={16} />
        {heading}
      </p>
      <ul className="flex flex-col gap-1">
        {issues.map((issue) => {
          const action = getIssueAction?.(issue);

          return (
            <li
              key={issue.id}
              className={`flex flex-col gap-1 font-body-md ${isError ? 'text-on-error-container' : 'text-on-warning-container'}`}
            >
              <span>{issue.message}</span>
              {action ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <button
                    type="button"
                    onClick={action.onClick}
                    className="w-fit rounded-md font-label-sm underline decoration-current underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {action.label}
                  </button>
                  <span className="font-body-sm opacity-90">Próximo passo: {action.description}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

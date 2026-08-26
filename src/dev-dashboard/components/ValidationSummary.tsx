import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
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
    <section
      id="validation-summary"
      data-validation-summary="true"
      tabIndex={-1}
      className="dashboard-validation-target flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4 outline-none"
    >
      <div>
        <h3 className="font-headline-sm text-on-surface">Verificação do conteúdo</h3>
        {!isEmpty ? (
          <p className="mt-1 font-body-sm text-on-surface-variant">
            Abra cada item para encontrar o campo exato e veja como corrigir o problema.
          </p>
        ) : null}
      </div>
      {isEmpty ? (
        <p className="flex items-center gap-2 font-body-md text-on-surface-variant">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" size={20} />
          Tudo certo. Nenhum problema encontrado neste rascunho.
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
      id={isError ? 'validation-summary-errors' : undefined}
      data-validation-errors={isError ? 'true' : undefined}
      className={`flex flex-col gap-2 rounded-lg p-3 ${isError ? 'bg-error-container/60' : 'bg-warning-container/40'}`}
    >
      <p
        className={`flex items-center gap-2 font-label-md ${isError ? 'text-on-error-container' : 'text-on-warning-container'}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" size={16} />
        {heading}
      </p>
      <ul className="flex flex-col divide-y divide-current/15">
        {issues.map((issue) => {
          const action = getIssueAction?.(issue);

          return (
            <li
              key={issue.id}
              className={`flex flex-col gap-1.5 py-2 first:pt-1 last:pb-1 font-body-md ${isError ? 'text-on-error-container' : 'text-on-warning-container'}`}
            >
              <span>{issue.message}</span>
              {action ? (
                <span className="flex flex-col items-start gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
                  <button
                    type="button"
                    onClick={action.onClick}
                    className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-current/30 px-3 py-1 font-label-sm transition-colors hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {action.label}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-body-sm opacity-90">Como corrigir: {action.description}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

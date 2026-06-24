import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DashboardValidationIssue, DashboardValidationResult } from '../validation/validationTypes';

/**
 * Renders validation results split into visually distinct error and warning
 * groups so blocking errors read differently from advisory warnings. Errors
 * use the error container palette; warnings use the amber warning container.
 * An all-clear state confirms the draft is clean.
 */
export function ValidationSummary({ result }: { result: DashboardValidationResult }) {
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
          {errorCount > 0 ? <ValidationGroup level="error" count={errorCount} issues={result.errors} /> : null}
          {warningCount > 0 ? <ValidationGroup level="warning" count={warningCount} issues={result.warnings} /> : null}
        </div>
      )}
    </section>
  );
}

function ValidationGroup({
  level,
  count,
  issues,
}: {
  level: 'error' | 'warning';
  count: number;
  issues: DashboardValidationIssue[];
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
        {issues.map((issue) => (
          <li
            key={issue.id}
            className={`font-body-md ${isError ? 'text-on-error-container' : 'text-on-warning-container'}`}
          >
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

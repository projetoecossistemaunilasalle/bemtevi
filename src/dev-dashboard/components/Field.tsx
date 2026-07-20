import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { fieldHasError, type FieldIssues } from '../validation/fieldIssues';

/**
 * Label + control + hint + inline error wrapper for dashboard form fields.
 *
 * Centralizes the label/error markup so the editors stay readable and gives
 * every field consistent a11y wiring. The actual input is passed as `children`
 * (a single input/textarea/select element); this component clones it to attach
 * `aria-invalid` / `aria-describedby` automatically. Callers that want the
 * invalid visual style combine `inputClass` with `inputInvalidClass` on their
 * control — see `useInvalidInputClass`.
 */
export function Field({
  label,
  htmlFor,
  hint,
  issues,
  children,
  className = '',
}: {
  label?: ReactNode;
  /** id of the input element this label wraps, for `htmlFor`. */
  htmlFor?: string;
  hint?: ReactNode;
  issues?: FieldIssues;
  children: ReactNode;
  className?: string;
}) {
  const hintId = useId();
  const errorId = useId();
  const hasError = issues ? fieldHasError(issues) : false;
  const errorMessages = hasError ? issues.errors.map((issue) => issue.message) : [];

  const describedBy = [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="font-label-md text-on-surface">
          {label}
        </label>
      ) : null}
      {cloneControl(children, hasError, describedBy)}
      {hint ? (
        <p id={hintId} className="font-label-sm text-on-surface-variant/90">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <ul id={errorId} className="flex flex-col gap-1" role="alert">
          {errorMessages.map((message, index) => (
            <li key={`${message}-${index}`} className="flex items-start gap-1.5 font-label-sm text-on-error-container">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Clone a single control element to inject a11y props for invalid fields. */
function cloneControl(children: ReactNode, invalid: boolean, describedBy?: string) {
  const props: Record<string, unknown> = {};
  if (describedBy) props['aria-describedby'] = describedBy;
  if (invalid) {
    props['aria-invalid'] = true;
    props['data-invalid'] = true;
  }

  if (isValidElement(children) && Object.keys(props).length > 0) {
    return cloneElement(children as ReactElement, props);
  }
  return <>{children}</>;
}

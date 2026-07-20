import { Button } from '../../design-system/components/Button';
import { useEffect, useRef, useState } from 'react';

/**
 * A two-click inline confirm button. The first click arms the button (label
 * flips to the confirmation prompt and gains a `Cancelar` reset); the second
 * click fires `onConfirm`. Avoids the need for a modal/dialog in a codebase
 * that has none, while still gating genuinely destructive actions.
 *
 * Resets to the idle state automatically if it loses focus while armed, so a
 * stray first click can't linger as a footgun.
 */
export function ConfirmButton({
  prompt,
  cancelLabel = 'Cancelar',
  confirmLabel,
  onConfirm,
  onCancel,
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
}: {
  /** Label shown in the armed (awaiting second click) state. */
  prompt: string;
  /** Optional custom label for the confirm action; defaults to `prompt`. */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [armed, setArmed] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (armed) confirmButtonRef.current?.focus();
  }, [armed]);

  if (armed) {
    return (
      <span
        className="inline-flex items-center gap-2"
        onBlur={(event) => {
          const nextFocus = event.relatedTarget;
          if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
          setArmed(false);
        }}
      >
        <button
          ref={confirmButtonRef}
          type="button"
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          // The danger styling makes the second click visually distinct.
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-error px-4 py-2 font-label-md text-on-error shadow-sm transition-colors hover:bg-error/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          aria-label={ariaLabel ? `Confirmar: ${ariaLabel}` : prompt}
        >
          {confirmLabel ?? prompt}
        </button>
        <button
          type="button"
          onClick={() => {
            setArmed(false);
            onCancel?.();
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface-container-low px-3 py-2 font-label-md text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {cancelLabel}
        </button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="danger"
      disabled={disabled}
      onClick={() => setArmed(true)}
      className={className}
      aria-label={ariaLabel}
    >
      {prompt}
    </Button>
  );
}

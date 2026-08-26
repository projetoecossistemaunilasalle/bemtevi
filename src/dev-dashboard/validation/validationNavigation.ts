const ACTIVE_TARGET_ATTRIBUTE = 'data-validation-active';

/**
 * Reveals, highlights and focuses the control associated with a validation path.
 * The timeout lets React render a newly selected record or expanded section first.
 */
export function scheduleValidationFocus(path: string) {
  window.setTimeout(() => focusValidationPath(path), 0);
}

export function focusValidationPath(path: string) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-validation-path]')).filter((element) => {
    const candidatePath = element.dataset.validationPath;
    return candidatePath === path || Boolean(candidatePath && path.startsWith(`${candidatePath}.`));
  });
  const target = candidates.sort(
    (left, right) => (right.dataset.validationPath?.length ?? 0) - (left.dataset.validationPath?.length ?? 0),
  )[0];

  if (!target) return false;

  document.querySelectorAll<HTMLElement>(`[${ACTIVE_TARGET_ATTRIBUTE}="true"]`).forEach((element) => {
    element.removeAttribute(ACTIVE_TARGET_ATTRIBUTE);
  });
  target.setAttribute(ACTIVE_TARGET_ATTRIBUTE, 'true');
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });

  const focusTarget = isFocusable(target)
    ? target
    : target.querySelector<HTMLElement>(
        '[aria-invalid="true"], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
  focusTarget?.focus({ preventScroll: true });

  window.setTimeout(() => target.removeAttribute(ACTIVE_TARGET_ATTRIBUTE), 2400);
  return true;
}

/**
 * Reveals, highlights and focuses the validation summary / error section.
 * The timeout lets React switch tabs, uncollapse sections, or mount the new dashboard view first.
 */
export function scheduleValidationSummaryScroll() {
  window.setTimeout(() => {
    if (!scrollToValidationSummary()) {
      window.setTimeout(() => {
        scrollToValidationSummary();
      }, 50);
    }
  }, 0);
}

export function scrollToValidationSummary(): boolean {
  const target =
    document.querySelector<HTMLElement>('[data-validation-errors="true"]') ??
    document.querySelector<HTMLElement>('[data-validation-summary="true"]') ??
    document.getElementById('validation-summary') ??
    document.querySelector<HTMLElement>('[role="alert"]');

  if (!target) return false;

  document.querySelectorAll<HTMLElement>(`[${ACTIVE_TARGET_ATTRIBUTE}="true"]`).forEach((element) => {
    element.removeAttribute(ACTIVE_TARGET_ATTRIBUTE);
  });
  target.setAttribute(ACTIVE_TARGET_ATTRIBUTE, 'true');
  target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });

  const focusTarget =
    target.querySelector<HTMLElement>(
      'button:not([disabled]), [aria-invalid="true"], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? (isFocusable(target) ? target : null);

  focusTarget?.focus({ preventScroll: true });

  window.setTimeout(() => target.removeAttribute(ACTIVE_TARGET_ATTRIBUTE), 2400);
  return true;
}

function isFocusable(element: HTMLElement) {
  return element.matches(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
}

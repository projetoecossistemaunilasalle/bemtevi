/**
 * Shared input styling for dashboard form controls.
 *
 * Adds a focus ring (border + soft primary halo) so tabbing through the dense
 * editor forms gives clear visual feedback. Matches the primary focus color
 * used by buttons and tabs in this app.
 */
export const inputClass =
  'min-h-11 rounded-lg border border-outline-variant bg-surface px-3 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export const inputClassSm =
  'min-h-10 rounded-lg border border-outline-variant bg-surface px-3 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export const textareaClass =
  'min-h-20 rounded-lg border border-outline-variant bg-surface px-3 py-2 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export const textareaClassTall =
  'min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

/** Extra classes appended to an input/textarea/select when it has an error. */
export const inputInvalidClass = 'border-error focus:border-error focus:ring-error/30';

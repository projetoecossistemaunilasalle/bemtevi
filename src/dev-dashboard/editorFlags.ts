/**
 * Editor feature flags (dossier doc 16 "Editor Feature Flags And Coexistence
 * Selection", task INTEGRATION-02).
 *
 * Literal Vite-flag parsing: a flag is enabled ONLY by the exact string
 * `'true'`. Missing values, `'false'`, `'TRUE'`, `'1'`, empty strings and
 * booleans are all disabled. There is no localStorage, query-string or runtime
 * override — the build-time `import.meta.env` values are the single source.
 */

export interface EditorFlags {
  /** Selects the V2 canonical editor when true; legacy editor when false. */
  v2Enabled: boolean;
  /** Emergency UI kill flag: blocks browser-side editorial mutations. */
  readOnly: boolean;
}

/** Returns true ONLY for the exact string `'true'` (doc 16). */
export function parseEditorFlag(value: unknown): boolean {
  return value === 'true';
}

/** Reads only the two frozen VITE_ variables; no runtime override exists. */
export function getEditorFlags(): EditorFlags {
  return {
    v2Enabled: parseEditorFlag(import.meta.env.VITE_EDITOR_V2_ENABLED),
    readOnly: parseEditorFlag(import.meta.env.VITE_EDITOR_READ_ONLY),
  };
}

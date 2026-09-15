/**
 * Editor feature flags (dossier doc 16 "Editor Feature Flags And Coexistence
 * Selection", task INTEGRATION-02).
 *
 * Literal Vite-flag parsing: a flag is enabled ONLY by the exact string
 * `'true'`. Missing values, `'false'`, `'TRUE'`, `'1'`, empty strings and
 * booleans are all disabled. There is no localStorage, query-string or runtime
 * override — the build-time `import.meta.env` value is the single source.
 */

export interface EditorFlags {
  /** Emergency UI kill flag: blocks browser-side editorial mutations. */
  readOnly: boolean;
}

/** Returns true ONLY for the exact string `'true'` (doc 16). */
export function parseEditorFlag(value: unknown): boolean {
  return value === 'true';
}

/** Reads only the frozen read-only flag; no runtime override exists. */
export function getEditorFlags(): EditorFlags {
  return {
    readOnly: parseEditorFlag(import.meta.env.VITE_EDITOR_READ_ONLY),
  };
}

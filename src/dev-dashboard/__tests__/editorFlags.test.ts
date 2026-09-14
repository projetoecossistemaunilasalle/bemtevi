import { describe, expect, it } from 'vitest';
import { getEditorFlags, parseEditorFlag, type EditorFlags } from '../editorFlags';

/**
 * Flag-parsing proof (doc 16 / task INTEGRATION-02): only the exact string
 * `'true'` enables a flag. Every other observed value — including the boolean
 * `true` — must keep the flag disabled.
 */
const NON_ENABLING_VALUES: Array<{ label: string; value: unknown }> = [
  { label: 'undefined', value: undefined },
  { label: "'false'", value: 'false' },
  { label: "'TRUE'", value: 'TRUE' },
  { label: "'1'", value: '1' },
  { label: 'empty string', value: '' },
  { label: 'boolean true', value: true },
  { label: 'boolean false', value: false },
];

describe('parseEditorFlag', () => {
  it('enables only the exact string "true"', () => {
    expect(parseEditorFlag('true')).toBe(true);
  });

  it.each(NON_ENABLING_VALUES)('does not enable for %s', ({ value }) => {
    expect(parseEditorFlag(value)).toBe(false);
  });
});

describe('getEditorFlags', () => {
  it('returns disabled flags when the environment is absent', () => {
    // The test environment defines neither variable, which is itself the
    // "missing value" case of the frozen parsing rule.
    const flags: EditorFlags = getEditorFlags();
    expect(flags.v2Enabled).toBe(false);
    expect(flags.readOnly).toBe(false);
  });
});

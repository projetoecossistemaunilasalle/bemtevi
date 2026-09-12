import { useState } from 'react';

/** Shared styling for small text fields in flow editor surfaces. */
export const textFieldClassName =
  'rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary';

export interface DraftTextFieldProps {
  ariaLabel: string;
  value: string;
  /** Invoked at most once per blur and only when the draft differs from `value`. */
  onCommit: (next: string) => void;
}

/** Single-line text field with a per-field draft sentinel and blur commit. */
export function DraftTextField({ ariaLabel, value, onCommit }: DraftTextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={ariaLabel}
      className={textFieldClassName}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        if (draft !== null && draft !== value) onCommit(draft);
      }}
    />
  );
}

/** Multiline twin of DraftTextField with the same blur-commit contract. */
export function DraftTextAreaField({ ariaLabel, value, onCommit }: DraftTextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <textarea
      aria-label={ariaLabel}
      className={`min-h-[64px] ${textFieldClassName}`}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        if (draft !== null && draft !== value) onCommit(draft);
      }}
    />
  );
}

export interface DraftNumberFieldProps {
  ariaLabel: string;
  value: number;
  /** Empty or non-numeric drafts are ignored on blur, never producing NaN. */
  onCommit: (next: number) => void;
}

/** Number input for row-scoped fields that never emits NaN. */
export function DraftNumberField({ ariaLabel, value, onCommit }: DraftNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      className={textFieldClassName}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        const trimmed = draft?.trim() ?? '';
        if (trimmed === '') return;
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed === value) return;
        onCommit(parsed);
      }}
    />
  );
}

export interface BranchNameFieldProps {
  ariaLabel: string;
  committedId: string;
  /** IDs of the node's other branches; a rename must not collide with these. */
  siblingIds: string[];
  /** Invoked on blur with a trimmed, valid draft. */
  onCommit: (committed: string) => void;
}

/** Branch ID field with duplicate and empty-name validation. */
export function BranchNameField({ ariaLabel, committedId, siblingIds, onCommit }: BranchNameFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? committedId;
  const trimmed = displayed.trim();
  const duplicate = siblingIds.includes(trimmed);
  const invalid = draft !== null && (trimmed === '' || duplicate);

  return (
    <div>
      <input
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={textFieldClassName}
        value={displayed}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setDraft(null);
          const nextId = draft?.trim() ?? '';
          if (draft === null || nextId === '' || siblingIds.includes(nextId) || nextId === committedId) return;
          onCommit(nextId);
        }}
      />
      {invalid && (
        <p className="mt-1 font-body-md text-xs text-on-surface-variant" role="status">
          {duplicate ? 'Nome já usado nesta etapa.' : 'O nome da faixa não pode ficar vazio.'}
        </p>
      )}
    </div>
  );
}

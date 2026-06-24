import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import { inputClassSm } from './fieldStyles';

/**
 * Compact chip input for short, repeatable string values (e.g. tags).
 *
 * Enter or comma commits the current draft as a new chip; Backspace on an
 * empty input removes the last chip. Each chip has its own × button. Empty
 * strings and exact duplicates of an existing chip are ignored on commit.
 *
 * Unlike the previous per-tag labeled inputs, this renders a single input with
 * inline pills, which suits short words far better than full sentences — so it
 * is intentionally used for tags only, not entering phrases.
 */
export function ChipInput({
  values,
  onChange,
  'aria-label': ariaLabel,
  placeholder,
  addLabel = 'Adicionar',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  'aria-label': string;
  placeholder?: string;
  /** Visible text for the add button (kept off-by-default accessible). */
  addLabel?: string;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      event.preventDefault();
      remove(values.length - 1);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={`${ariaLabel} adicionados`}>
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary-container py-1 pl-3 pr-1 font-label-md text-on-secondary-container"
            >
              <span>{value}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remover ${value}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-on-secondary-container transition-colors hover:bg-on-secondary-container/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label={ariaLabel}
          className={`${inputClassSm} min-w-[12rem] flex-1`}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={commit}
          disabled={!draft.trim()}
          className="self-start"
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

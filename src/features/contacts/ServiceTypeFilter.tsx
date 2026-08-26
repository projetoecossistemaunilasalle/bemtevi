import { ChevronDown, Hospital, Check } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SERVICE_TYPE_OPTIONS, type ServiceTypeFilterKey } from './serviceTypeFilterTypes';

export function ServiceTypeFilter({
  value,
  onChange,
}: {
  value: ServiceTypeFilterKey;
  onChange: (key: ServiceTypeFilterKey) => void;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const currentOption = SERVICE_TYPE_OPTIONS.find((opt) => opt.key === value) ?? SERVICE_TYPE_OPTIONS[0];

  function selectOption(key: ServiceTypeFilterKey) {
    onChange(key);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-56 max-w-sm flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-left font-body-md text-on-surface transition-colors hover:border-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <Hospital className="shrink-0 text-on-surface-variant" size={18} />
        <span className="truncate">{currentOption.label}</span>
        <ChevronDown
          className={`ml-auto shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Filtrar por tipo de serviço"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 flex flex-col gap-0.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
        >
          {SERVICE_TYPE_OPTIONS.map((option) => {
            const isSelected = option.key === value;
            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(option.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-body-md text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  isSelected ? 'bg-surface-container-low font-semibold' : ''
                }`}
              >
                <span className="truncate">{option.label}</span>
                <Check className={`ml-auto shrink-0 text-primary ${isSelected ? 'visible' : 'invisible'}`} size={16} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

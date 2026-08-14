import { ChevronDown, Locate, MapPin, Search, Check } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { localCityCatalog } from '../../lib/geo/cities';
import { nearestCity, roundToApproximate } from '../../lib/geo/geo';
import { requestBrowserLocation } from '../../lib/geo/location';
import type { GeoCoordinates } from '../../lib/geo/geo';
import { Button } from '../../design-system/components/Button';

export type CityFilterValue = string | null;

type LocationStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

const ALL_CITIES_LABEL = 'Todas as cidades';

export function CityFilter({
  cities,
  value,
  onChange,
  onUserCoordinatesChange,
}: {
  cities: string[];
  value: CityFilterValue;
  onChange: (city: CityFilterValue) => void;
  onUserCoordinatesChange?: (coords: GeoCoordinates | null) => void;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [status, setStatus] = useState<LocationStatus>({ kind: 'idle' });

  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return [ALL_CITIES_LABEL, ...cities].filter((city) => city.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [cities, query]);

  function selectCity(option: string) {
    onChange(option === ALL_CITIES_LABEL ? null : option);
    onUserCoordinatesChange?.(null);
    setStatus({ kind: 'idle' });
    setOpen(false);
  }

  function openPanel() {
    setQuery('');
    setHighlightedIndex(0);
    setOpen(true);
  }

  function highlightNext(offset: number) {
    setHighlightedIndex((current) => Math.max(0, Math.min(current + offset, options.length - 1)));
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  async function useMyLocation() {
    setStatus({ kind: 'loading' });
    // Coordinates are held in a local variable only: never persisted, never
    // transmitted, discarded as soon as this function finishes.
    const coordinates = await requestBrowserLocation();
    if (coordinates === null) {
      onUserCoordinatesChange?.(null);
      setStatus({
        kind: 'error',
        message: 'Não foi possível obter sua localização. Escolha uma cidade manualmente.',
      });
      return;
    }
    const approximate = roundToApproximate(coordinates);
    onUserCoordinatesChange?.(approximate);
    const { city: match, distanceKm } = nearestCity(approximate, localCityCatalog);
    const cityLabel = `${match.city} - ${match.state}`;
    if (cities.includes(cityLabel)) {
      onChange(cityLabel);
      setStatus({
        kind: 'ok',
        message: `Localização aproximada: ${match.city} · a ~${distanceKm} km. Filtramos a rede para essa cidade.`,
      });
    } else {
      setStatus({
        kind: 'ok',
        message: `Localização aproximada: ${match.city} · a ~${distanceKm} km. Essa cidade ainda não está no catálogo — mostrando todos os contatos.`,
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start gap-2">
        <div ref={containerRef} className="relative min-w-64 max-w-sm flex-1">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => (open ? setOpen(false) : openPanel())}
            className="flex w-full items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-left font-body-md text-on-surface transition-colors hover:border-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <MapPin className="shrink-0 text-on-surface-variant" size={18} />
            <span className="truncate">{value ?? ALL_CITIES_LABEL}</span>
            <ChevronDown
              className={`ml-auto shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
              size={18}
            />
          </button>

          {open ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Escolher cidade"
              className="absolute left-0 right-0 top-full z-10 mt-1.5 flex flex-col gap-0.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
            >
              <div className="relative mb-0.5">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  size={16}
                />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listboxId}
                  placeholder="Buscar cidade..."
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-9 pr-3 font-body-md text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      highlightNext(1);
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      highlightNext(-1);
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      const option = options[highlightedIndex];
                      if (option) selectCity(option);
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      setOpen(false);
                    }
                  }}
                />
              </div>
              {options.length === 0 ? (
                <p className="px-2.5 py-2 font-body-md text-on-surface-variant">Nenhuma cidade encontrada.</p>
              ) : (
                options.map((option, index) => {
                  const isSelected = option === (value ?? ALL_CITIES_LABEL);
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectCity(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-body-md text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                        index === highlightedIndex ? 'bg-surface-container-low' : ''
                      }`}
                    >
                      {option === ALL_CITIES_LABEL ? null : (
                        <MapPin className="shrink-0 text-on-surface-variant" size={16} />
                      )}
                      <span className="truncate">{option}</span>
                      <Check
                        className={`ml-auto shrink-0 text-primary ${isSelected ? 'visible' : 'invisible'}`}
                        size={16}
                      />
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        <Button type="button" variant="secondary" onClick={useMyLocation} disabled={status.kind === 'loading'}>
          <Locate size={18} aria-hidden="true" />
          Usar minha localização
        </Button>
      </div>

      {status.kind === 'ok' || status.kind === 'error' ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${status.kind === 'ok' ? 'text-primary' : 'text-error'}`}
        >
          {status.message}
        </p>
      ) : null}
      {status.kind === 'loading' ? (
        <p role="status" aria-live="polite" className="text-sm text-on-surface-variant">
          Obtendo localização...
        </p>
      ) : null}
    </div>
  );
}

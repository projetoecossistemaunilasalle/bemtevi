import type { RefObject } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { Button } from '../../design-system/components/Button';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { groupContactsByLocation, locationLabel } from './contactDrafts';

export interface ContactDirectoryListProps {
  services: ServiceDirectoryEntry[];
  locations: ServiceLocation[];
  effectiveIndex: number;
  fieldId: string;
  validation: DashboardValidationResult;
  addActionRef: RefObject<HTMLDivElement | null>;
  serviceButtonRefs: RefObject<Array<HTMLButtonElement | null>>;
  onAddService: () => void;
  onSelectService: (index: number, id: string) => void;
}

export function ContactDirectoryList({
  services,
  locations,
  effectiveIndex,
  fieldId,
  validation,
  addActionRef,
  serviceButtonRefs,
  onAddService,
  onSelectService,
}: ContactDirectoryListProps) {
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      <div ref={addActionRef}>
        <Button type="button" className="w-full" onClick={onAddService}>
          <Plus aria-hidden="true" className="h-5 w-5" />
          Novo contato
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low p-3 font-body-md text-on-surface-variant">
          Nenhum contato cadastrado ainda.
        </p>
      ) : null}

      <ul aria-label="Contatos disponíveis" className="flex flex-col gap-3">
        {groupContactsByLocation(services, locations).map((group, groupIndex) => {
          const headingId = `${fieldId}-contact-group-${groupIndex}`;
          const label = group.location ? locationLabel(group.location) : 'Sem local';

          return (
            <li key={group.location?.id ?? 'unassigned'} role="group" aria-labelledby={headingId}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <span id={headingId} className="font-label-sm text-on-surface-variant">
                  {label}
                </span>
                <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-label-sm text-on-surface-variant">
                  {group.entries.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {group.entries.map(({ service, index: serviceIndex }) => {
                  const isSelected = serviceIndex === effectiveIndex;
                  const buttonTextId = `${fieldId}-contact-${serviceIndex}`;

                  return (
                    <li key={`${service.id}-${serviceIndex}`}>
                      <button
                        ref={(button) => {
                          serviceButtonRefs.current[serviceIndex] = button;
                        }}
                        type="button"
                        aria-pressed={isSelected}
                        aria-labelledby={`${headingId} ${buttonTextId}`}
                        onClick={() => onSelectService(serviceIndex, service.id)}
                        className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                          isSelected
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        <span id={buttonTextId} className="flex flex-col">
                          <span className="font-label-md">{service.name || 'Contato sem nome'}</span>
                          <span
                            className={`font-label-sm ${isSelected ? 'text-on-primary/85' : 'text-on-surface-variant'}`}
                          >
                            {service.type || 'Sem tipo'} · {service.city || 'Sem cidade'}
                          </span>
                          {validation.errors.some((issue) => issue.path?.startsWith(`contacts.${serviceIndex}`)) ? (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 font-label-sm ${isSelected ? 'text-on-primary' : 'text-error'}`}
                            >
                              <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                              Precisa de correção
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

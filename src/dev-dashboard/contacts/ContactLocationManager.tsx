import { Plus } from 'lucide-react';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { Button } from '../../design-system/components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { issuesForPath } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { locationLabel } from './contactDrafts';
import { fieldClass } from './contactValidationNavigation';

export interface ContactLocationManagerProps {
  locations: ServiceLocation[];
  services: ServiceDirectoryEntry[];
  validation: DashboardValidationResult;
  fieldId: string;
  open: boolean;
  onToggleOpen: () => void;
  onLocationChange: (index: number, id: string, patch: Partial<ServiceLocation>) => void;
  onLocationAdd: () => void;
  onLocationRemove: (index: number, id: string) => void;
}

export function ContactLocationManager({
  locations,
  services,
  validation,
  fieldId,
  open,
  onToggleOpen,
  onLocationChange,
  onLocationAdd,
  onLocationRemove,
}: ContactLocationManagerProps) {
  return (
    <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-on-surface">Locais</h3>
          <p className="font-body-md text-on-surface-variant">Cadastre as cidades usadas para organizar os contatos.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={open}
          aria-controls="contacts-location-management-content"
          onClick={onToggleOpen}
        >
          {open ? 'Ocultar' : 'Gerenciar locais'}
        </Button>
      </div>

      {open ? (
        <div
          id="contacts-location-management-content"
          data-validation-path="locations"
          className="dashboard-validation-target mt-4 flex flex-col gap-3"
        >
          {locations.map((location, locationIndex) => {
            const contactCount = services.filter((service) => service.locationId === location.id).length;
            const cityIssues = issuesForPath(validation, `locations.${locationIndex}.city`);
            const stateIssues = issuesForPath(validation, `locations.${locationIndex}.state`);
            const locationFieldId = `${fieldId}-location-${locationIndex}`;

            return (
              <div
                key={`${location.id}-${locationIndex}`}
                className="grid items-end gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 md:grid-cols-[minmax(0,1fr)_96px_auto_auto]"
              >
                <Field
                  label="Cidade"
                  htmlFor={`${locationFieldId}-city`}
                  issues={cityIssues}
                  validationPath={`locations.${locationIndex}.city`}
                >
                  <input
                    id={`${locationFieldId}-city`}
                    className={fieldClass(cityIssues)}
                    value={location.city}
                    onChange={(event) => onLocationChange(locationIndex, location.id, { city: event.target.value })}
                  />
                </Field>
                <Field
                  label="Estado"
                  htmlFor={`${locationFieldId}-state`}
                  issues={stateIssues}
                  validationPath={`locations.${locationIndex}.state`}
                >
                  <input
                    id={`${locationFieldId}-state`}
                    maxLength={2}
                    className={fieldClass(stateIssues)}
                    value={location.state}
                    onChange={(event) =>
                      onLocationChange(locationIndex, location.id, {
                        state: event.target.value.toLocaleUpperCase('pt-BR').slice(0, 2),
                      })
                    }
                  />
                </Field>
                <span className="pb-2 font-label-sm text-on-surface-variant">
                  {contactCount} {contactCount === 1 ? 'contato' : 'contatos'}
                </span>
                <div className="flex flex-col items-start gap-1">
                  <ConfirmButton
                    prompt="Remover local"
                    disabled={contactCount > 0}
                    onConfirm={() => onLocationRemove(locationIndex, location.id)}
                    aria-label={`Remover local ${locationLabel(location)}`}
                  />
                  {contactCount > 0 ? (
                    <span className="font-label-sm text-on-surface-variant">
                      Realocar os contatos antes de remover.
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div>
            <Button type="button" variant="secondary" onClick={onLocationAdd}>
              <Plus aria-hidden="true" className="h-5 w-5" />
              Novo local
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { Button } from '../../design-system/components/Button';
import { ServiceCard } from '../../design-system/components/ServiceCard';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { inputClass, inputInvalidClass, textareaClass } from '../components/fieldStyles';
import { ValidationSummary } from '../components/ValidationSummary';
import { fieldHasError, issuesForPath, type FieldIssues } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';
import {
  applyLocationSelection,
  badgeToneForServiceType,
  groupContactsByLocation,
  locationLabel,
  normalizePhoneHref,
} from './contactDrafts';
import { MAX_SERVICE_TYPE_LENGTH } from './contactsValidation';

const serviceTypeSuggestions = ['CAPS', 'UBS', 'CRAS', 'CREAS', 'Universidade', 'Outro'];

interface ServiceSelection {
  index: number;
  id: string;
}

export function ContactsDashboard({
  services,
  locations = [],
  validation,
  onServiceChange,
  onServiceAdd,
  onServiceRemove,
  onLocationChange = () => {},
  onLocationAdd = () => '',
  onLocationRemove = () => {},
}: {
  services: ServiceDirectoryEntry[];
  locations?: ServiceLocation[];
  validation: DashboardValidationResult;
  onServiceChange: (index: number, id: string, patch: Partial<ServiceDirectoryEntry>) => void;
  onServiceAdd: () => string;
  onServiceRemove: (index: number, id: string) => void;
  onLocationChange?: (index: number, id: string, patch: Partial<ServiceLocation>) => void;
  onLocationAdd?: () => string;
  onLocationRemove?: (index: number, id: string) => void;
}) {
  const fieldId = useId();
  const addActionRef = useRef<HTMLDivElement>(null);
  const serviceButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [locationManagementOpen, setLocationManagementOpen] = useState(false);
  const [selection, setSelection] = useState<ServiceSelection | null>(() =>
    services[0] ? { index: 0, id: services[0].id } : null,
  );
  const serviceAtSelectedIndex = selection ? services[selection.index] : undefined;
  const selectedIndex =
    selection && serviceAtSelectedIndex?.id === selection.id
      ? selection.index
      : selection
        ? services.findIndex(({ id }) => id === selection.id)
        : -1;
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : services.length > 0 ? 0 : -1;
  const selectedService = effectiveIndex >= 0 ? services[effectiveIndex] : undefined;

  function addService() {
    const id = onServiceAdd();
    setSelection({ index: services.length, id });
  }

  function changeService(patch: Partial<ServiceDirectoryEntry>) {
    if (!selectedService) return;
    onServiceChange(effectiveIndex, selectedService.id, patch);
  }

  function removeService() {
    if (!selectedService) return;
    const nextService = services[effectiveIndex + 1];
    const previousService = services[effectiveIndex - 1];
    const neighbor = nextService ?? previousService;
    const focusIndex = nextService ? effectiveIndex : previousService ? effectiveIndex - 1 : null;

    setSelection(neighbor && focusIndex !== null ? { index: focusIndex, id: neighbor.id } : null);
    onServiceRemove(effectiveIndex, selectedService.id);

    queueMicrotask(() => {
      if (focusIndex === null) {
        addActionRef.current?.querySelector('button')?.focus();
        return;
      }
      serviceButtonRefs.current[focusIndex]?.focus();
    });
  }

  return (
    <section className="flex flex-col gap-stack-md">
      <header className="flex flex-col gap-1">
        <h2 className="font-headline-md text-on-surface">Contatos</h2>
        <p className="font-body-md text-on-surface-variant">Edite os serviços que aparecem na rede de apoio.</p>
      </header>

      <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-headline-sm text-on-surface">Locais</h3>
            <p className="font-body-md text-on-surface-variant">
              Cadastre as cidades usadas para organizar os contatos.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            aria-expanded={locationManagementOpen}
            aria-controls="contacts-location-management-content"
            onClick={() => setLocationManagementOpen((current) => !current)}
          >
            {locationManagementOpen ? 'Ocultar' : 'Gerenciar locais'}
          </Button>
        </div>

        {locationManagementOpen ? (
          <div id="contacts-location-management-content" className="mt-4 flex flex-col gap-3">
            {locations.map((location, locationIndex) => {
              const contactCount = services.filter((service) => service.locationId === location.id).length;
              const cityIssues = issuesForPath(validation, `locations.${locationIndex}.city`);
              const stateIssues = issuesForPath(validation, `locations.${locationIndex}.state`);
              const locationId = `${fieldId}-location-${locationIndex}`;

              return (
                <div
                  key={`${location.id}-${locationIndex}`}
                  className="grid items-end gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 md:grid-cols-[minmax(0,1fr)_96px_auto_auto]"
                >
                  <Field label="Cidade" htmlFor={`${locationId}-city`} issues={cityIssues}>
                    <input
                      id={`${locationId}-city`}
                      className={fieldClass(cityIssues)}
                      value={location.city}
                      onChange={(event) => onLocationChange(locationIndex, location.id, { city: event.target.value })}
                    />
                  </Field>
                  <Field label="Estado" htmlFor={`${locationId}-state`} issues={stateIssues}>
                    <input
                      id={`${locationId}-state`}
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

      <div className="grid gap-stack-md lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
          <div ref={addActionRef}>
            <Button type="button" className="w-full" onClick={addService}>
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
                            onClick={() => setSelection({ index: serviceIndex, id: service.id })}
                            className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                              isSelected
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                            }`}
                          >
                            <span id={buttonTextId} className="flex flex-col">
                              <span className="font-label-md">{service.name || 'Contato sem nome'}</span>
                              <span
                                className={`font-label-sm ${
                                  isSelected ? 'text-on-primary/85' : 'text-on-surface-variant'
                                }`}
                              >
                                {service.type || 'Sem tipo'} · {service.city || 'Sem cidade'}
                              </span>
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

        {selectedService ? (
          <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-headline-sm text-on-surface">Editar {selectedService.name || 'contato sem nome'}</h3>
              <ConfirmButton
                key={`${effectiveIndex}-${selectedService.id}`}
                prompt="Remover contato"
                onConfirm={removeService}
                aria-label={`Remover contato ${selectedService.name || 'sem nome'}`}
              />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
              <ContactFields
                fieldId={fieldId}
                service={selectedService}
                locations={locations}
                serviceIndex={effectiveIndex}
                validation={validation}
                onChange={changeService}
              />

              <aside
                aria-labelledby={`${fieldId}-card-preview-title`}
                className="flex flex-col gap-3 rounded-xl border border-outline-variant/50 bg-surface-container p-3 xl:sticky xl:top-6"
              >
                <div className="px-1">
                  <h4 id={`${fieldId}-card-preview-title`} className="font-label-md text-on-surface">
                    Prévia do cartão
                  </h4>
                  <p className="font-label-sm text-on-surface-variant">
                    Esta é a aparência que será publicada na página de contatos.
                  </p>
                </div>
                <ServiceCard service={selectedService} preview />
              </aside>
            </div>
          </section>
        ) : null}
      </div>

      <ValidationSummary result={validation} />
    </section>
  );
}

function ContactFields({
  fieldId,
  service,
  locations,
  serviceIndex,
  validation,
  onChange,
}: {
  fieldId: string;
  service: ServiceDirectoryEntry;
  locations: ServiceLocation[];
  serviceIndex: number;
  validation: DashboardValidationResult;
  onChange: (patch: Partial<ServiceDirectoryEntry>) => void;
}) {
  const path = `contacts.${serviceIndex}`;
  const nameIssues = issuesForPath(validation, `${path}.name`);
  const typeIssues = issuesForPath(validation, `${path}.type`);
  const locationIssues = issuesForPath(validation, `${path}.locationId`);
  const addressIssues = issuesForPath(validation, `${path}.address`);
  const phoneIssues = mergeFieldIssues(
    issuesForPath(validation, `${path}.phoneDisplay`),
    issuesForPath(validation, `${path}.phoneHref`),
  );
  const hoursIssues = issuesForPath(validation, `${path}.hours`);
  const notesIssues = issuesForPath(validation, `${path}.notes`);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome" htmlFor={`${fieldId}-name`} hint="Nome exibido na rede de apoio." issues={nameIssues}>
        <input
          id={`${fieldId}-name`}
          className={fieldClass(nameIssues)}
          value={service.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <Field
        label="Categoria curta"
        htmlFor={`${fieldId}-type`}
        hint={`Use apenas uma etiqueta curta, com até ${MAX_SERVICE_TYPE_LENGTH} caracteres. Ex.: CAPS, UBS ou Clínica-escola.`}
        issues={typeIssues}
      >
        <input
          id={`${fieldId}-type`}
          list="contact-service-type-suggestions"
          maxLength={MAX_SERVICE_TYPE_LENGTH}
          className={fieldClass(typeIssues)}
          value={service.type}
          onChange={(event) => {
            const type = event.target.value;
            onChange({ type, badgeTone: badgeToneForServiceType(type) });
          }}
        />
      </Field>
      <datalist id="contact-service-type-suggestions">
        {serviceTypeSuggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>

      <Field
        label="Local"
        htmlFor={`${fieldId}-location`}
        hint="Cidade onde o atendimento é oferecido. Gerencie as cidades em “Gerenciar locais”."
        issues={locationIssues}
      >
        <select
          id={`${fieldId}-location`}
          className={fieldClass(locationIssues)}
          value={service.locationId ?? ''}
          onChange={(event) => onChange(applyLocationSelection(service, event.target.value || null, locations))}
        >
          <option value="">Sem local (atendimento nacional)</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {locationLabel(location)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Endereço"
        htmlFor={`${fieldId}-address`}
        hint="Local exibido para quem busca atendimento."
        issues={addressIssues}
      >
        <input
          id={`${fieldId}-address`}
          className={fieldClass(addressIssues)}
          value={service.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </Field>

      <Field
        label="Telefone"
        htmlFor={`${fieldId}-phone`}
        hint="A formatação digitada será mantida."
        issues={phoneIssues}
      >
        <input
          id={`${fieldId}-phone`}
          inputMode="tel"
          className={fieldClass(phoneIssues)}
          value={service.phoneDisplay}
          onChange={(event) => {
            const phoneDisplay = event.target.value;
            onChange({ phoneDisplay, phoneHref: normalizePhoneHref(phoneDisplay) });
          }}
        />
      </Field>

      <Field label="Horário de atendimento (opcional)" htmlFor={`${fieldId}-hours`} issues={hoursIssues}>
        <input
          id={`${fieldId}-hours`}
          className={fieldClass(hoursIssues)}
          value={service.hours ?? ''}
          onChange={(event) => onChange({ hours: event.target.value })}
        />
      </Field>

      <Field
        label="Sobre o atendimento (opcional)"
        htmlFor={`${fieldId}-notes`}
        hint="Escreva aqui a descrição do serviço, público atendido e orientações de acesso."
        issues={notesIssues}
      >
        <textarea
          id={`${fieldId}-notes`}
          className={fieldClass(notesIssues, textareaClass)}
          value={service.notes ?? ''}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>
    </div>
  );
}

function fieldClass(issues: FieldIssues, base = inputClass) {
  return fieldHasError(issues) ? `${base} ${inputInvalidClass}` : base;
}

function mergeFieldIssues(...issueGroups: FieldIssues[]): FieldIssues {
  return {
    errors: issueGroups.flatMap(({ errors }) => errors),
    warnings: issueGroups.flatMap(({ warnings }) => warnings),
  };
}

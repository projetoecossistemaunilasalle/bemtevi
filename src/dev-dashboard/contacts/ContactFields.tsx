import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { Field } from '../components/Field';
import { textareaClass } from '../components/fieldStyles';
import { issuesForPath } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { applyLocationSelection, badgeToneForServiceType, locationLabel, normalizePhoneHref } from './contactDrafts';
import { MAX_SERVICE_TYPE_LENGTH } from './contactsValidation';
import { fieldClass, mergeFieldIssues } from './contactValidationNavigation';

const serviceTypeSuggestions = ['CAPS', 'UBS', 'CRAS', 'CREAS', 'Universidade', 'Outro'];

export interface ContactFieldsProps {
  fieldId: string;
  service: ServiceDirectoryEntry;
  locations: ServiceLocation[];
  serviceIndex: number;
  validation: DashboardValidationResult;
  onChange: (patch: Partial<ServiceDirectoryEntry>) => void;
}

export function ContactFields({ fieldId, service, locations, serviceIndex, validation, onChange }: ContactFieldsProps) {
  const path = `contacts.${serviceIndex}`;
  const nameIssues = issuesForPath(validation, `${path}.name`);
  const typeIssues = issuesForPath(validation, `${path}.type`);
  const locationIssues = mergeFieldIssues(
    issuesForPath(validation, `${path}.locationId`),
    issuesForPath(validation, `${path}.city`),
    issuesForPath(validation, `${path}.state`),
  );
  const addressIssues = issuesForPath(validation, `${path}.address`);
  const phoneIssues = mergeFieldIssues(
    issuesForPath(validation, `${path}.phoneDisplay`),
    issuesForPath(validation, `${path}.phoneHref`),
  );
  const hoursIssues = issuesForPath(validation, `${path}.hours`);
  const notesIssues = issuesForPath(validation, `${path}.notes`);
  const latIssues = issuesForPath(validation, `${path}.lat`);
  const lngIssues = issuesForPath(validation, `${path}.lng`);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nome"
        htmlFor={`${fieldId}-name`}
        hint="Nome exibido na rede de apoio."
        issues={nameIssues}
        validationPath={`${path}.name`}
      >
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
        validationPath={`${path}.type`}
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
        validationPath={`${path}.locationId`}
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
        validationPath={`${path}.address`}
      >
        <input
          id={`${fieldId}-address`}
          className={fieldClass(addressIssues)}
          value={service.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Latitude (opcional)"
          htmlFor={`${fieldId}-lat`}
          hint="Ex.: -29.9145"
          issues={latIssues}
          validationPath={`${path}.lat`}
        >
          <input
            id={`${fieldId}-lat`}
            type="number"
            step="any"
            className={fieldClass(latIssues)}
            value={service.lat ?? ''}
            onChange={(event) => {
              const val = event.target.value.trim();
              onChange({ lat: val === '' ? undefined : Number(val) });
            }}
          />
        </Field>

        <Field
          label="Longitude (opcional)"
          htmlFor={`${fieldId}-lng`}
          hint="Ex.: -51.1812"
          issues={lngIssues}
          validationPath={`${path}.lng`}
        >
          <input
            id={`${fieldId}-lng`}
            type="number"
            step="any"
            className={fieldClass(lngIssues)}
            value={service.lng ?? ''}
            onChange={(event) => {
              const val = event.target.value.trim();
              onChange({ lng: val === '' ? undefined : Number(val) });
            }}
          />
        </Field>
      </div>

      <Field
        label="Telefone"
        htmlFor={`${fieldId}-phone`}
        hint="A formatação digitada será mantida."
        issues={phoneIssues}
        validationPath={`${path}.phoneDisplay`}
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

      <Field
        label="Horário de atendimento (opcional)"
        htmlFor={`${fieldId}-hours`}
        issues={hoursIssues}
        validationPath={`${path}.hours`}
      >
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
        validationPath={`${path}.notes`}
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

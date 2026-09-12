import { useEffect, useId, useRef, useState } from 'react';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { ServiceCard } from '../../design-system/components/ServiceCard';
import { ConfirmButton } from '../components/ConfirmButton';
import { ValidationSummary, type ValidationIssueAction } from '../components/ValidationSummary';
import type { DashboardValidationIssue, DashboardValidationResult } from '../validation/validationTypes';
import { scheduleValidationFocus } from '../validation/validationNavigation';
import { ContactDirectoryList } from './ContactDirectoryList';
import { ContactFields } from './ContactFields';
import { ContactLocationManager } from './ContactLocationManager';
import { normalizeContactValidationPath } from './contactValidationNavigation';

interface ServiceSelection {
  index: number;
  id: string;
}

export function ContactsDashboard({
  services,
  locations = [],
  validation,
  externalFocus,
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
  externalFocus?: { id: string; requestId: number; path?: string } | null;
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!externalFocus?.id) return;
    const contactIndex = services.findIndex((service) => service.id === externalFocus.id);
    if (contactIndex >= 0) {
      setSelection({ index: contactIndex, id: externalFocus.id });
      const path = externalFocus.path ?? `contacts.${contactIndex}.name`;
      window.setTimeout(() => scheduleValidationFocus(path), 120);
      return;
    }
    const locationIndex = locations.findIndex((location) => location.id === externalFocus.id);
    if (locationIndex >= 0) {
      setLocationManagementOpen(true);
      const path = externalFocus.path ?? `locations.${locationIndex}.city`;
      window.setTimeout(() => scheduleValidationFocus(path), 150);
    }
  }, [externalFocus?.requestId, externalFocus?.id, externalFocus?.path, locations, services]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  function getIssueAction(issue: DashboardValidationIssue): ValidationIssueAction | null {
    const locationMatch = /^locations\.(\d+)(?:\.|$)/.exec(issue.path ?? '');
    if (locationMatch) {
      const locationIndex = Number(locationMatch[1]);
      if (!locations[locationIndex]) return null;

      return {
        label: 'Ir ao local',
        description: 'revise o campo destacado no cadastro deste local.',
        onClick: () => {
          setLocationManagementOpen(true);
          scheduleValidationFocus(normalizeContactValidationPath(issue.path!));
        },
      };
    }

    const contactMatch = /^contacts\.(\d+)(?:\.|$)/.exec(issue.path ?? '');
    if (contactMatch) {
      const contactIndex = Number(contactMatch[1]);
      const contact = services[contactIndex];
      if (!contact) return null;

      return {
        label: 'Ir ao contato',
        description:
          issue.path === `contacts.${contactIndex}`
            ? 'revise o contato destacado; se o identificador interno estiver inválido, remova-o e crie outro.'
            : 'corrija o campo destacado no editor deste contato.',
        onClick: () => {
          setSelection({ index: contactIndex, id: contact.id });
          scheduleValidationFocus(normalizeContactValidationPath(issue.path!));
        },
      };
    }

    if (issue.id === 'no-locations') {
      return {
        label: 'Cadastrar local',
        description: 'abra a lista de locais e use “Novo local” para cadastrar uma cidade.',
        onClick: () => {
          setLocationManagementOpen(true);
          scheduleValidationFocus('locations');
        },
      };
    }

    return null;
  }

  return (
    <section className="flex flex-col gap-stack-md">
      <header className="flex flex-col gap-1">
        <h2 className="font-headline-md text-on-surface">Contatos</h2>
        <p className="font-body-md text-on-surface-variant">Edite os serviços que aparecem na rede de apoio.</p>
      </header>

      <ContactLocationManager
        locations={locations}
        services={services}
        validation={validation}
        fieldId={fieldId}
        open={locationManagementOpen}
        onToggleOpen={() => setLocationManagementOpen((current) => !current)}
        onLocationChange={onLocationChange}
        onLocationAdd={onLocationAdd}
        onLocationRemove={onLocationRemove}
      />

      <div className="grid gap-stack-md lg:grid-cols-[280px_minmax(0,1fr)]">
        <ContactDirectoryList
          services={services}
          locations={locations}
          effectiveIndex={effectiveIndex}
          fieldId={fieldId}
          validation={validation}
          addActionRef={addActionRef}
          serviceButtonRefs={serviceButtonRefs}
          onAddService={addService}
          onSelectService={(index, id) => setSelection({ index, id })}
        />

        {selectedService ? (
          <section
            data-validation-path={`contacts.${effectiveIndex}`}
            className="dashboard-validation-target flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5"
          >
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

      <ValidationSummary result={validation} getIssueAction={getIssueAction} />
    </section>
  );
}

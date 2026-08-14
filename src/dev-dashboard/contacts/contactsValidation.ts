import { deriveLocationsFromContacts, locationPairKey } from '../../domain/services/locations';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { findDuplicateIds } from '../validation/duplicateIds';
import {
  createValidationResult,
  type DashboardValidationIssue,
  type DashboardValidationResult,
} from '../validation/validationTypes';
import { normalizePhoneHref } from './contactDrafts';

export const MAX_SERVICE_TYPE_LENGTH = 24;

export function validateDashboardContacts(
  services: ServiceDirectoryEntry[],
  locations?: ServiceLocation[],
): DashboardValidationResult {
  const issues: DashboardValidationIssue[] = [];
  const hasLocationModel = locations !== undefined;
  const effectiveLocations = locations ?? deriveLocationsFromContacts(services);
  const locationsById = new Map(effectiveLocations.map((location) => [location.id, location]));

  findDuplicateIds(services.map((service) => service.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'contacts',
      id: `duplicate-contact-id:${id}`,
      message: `Existe mais de um contato com o ID "${id}".`,
    });
  });

  if (hasLocationModel) {
    findDuplicateIds(effectiveLocations.map((location) => location.id)).forEach((id) => {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `duplicate-location-id:${id}`,
        message: `Existe mais de um local com o ID "${id}".`,
      });
    });

    const seenPairs = new Set<string>();
    effectiveLocations.forEach((location, index) => {
      if (!location.city.trim()) {
        issues.push({
          level: 'error',
          area: 'contacts',
          id: `missing-location-city:${location.id}:${index}`,
          message: 'A cidade do local é obrigatória.',
          path: `locations.${index}.city`,
        });
      }
      if (!/^[A-Za-z]{2}$/.test(location.state)) {
        issues.push({
          level: 'error',
          area: 'contacts',
          id: `invalid-location-state:${location.id}:${index}`,
          message: 'O estado do local precisa ter exatamente duas letras.',
          path: `locations.${index}.state`,
        });
      }

      const pair = locationPairKey(location.city, location.state);
      if (seenPairs.has(pair)) {
        issues.push({
          level: 'error',
          area: 'contacts',
          id: `duplicate-location:${pair}`,
          message: `Existe mais de um local para "${location.city} - ${location.state}".`,
        });
      }
      seenPairs.add(pair);
    });

    if (effectiveLocations.length === 0) {
      issues.push({
        level: 'warning',
        area: 'contacts',
        id: 'no-locations',
        message: 'Nenhuma cidade cadastrada — contatos sem local aparecerão como nacionais.',
      });
    }
  }

  services.forEach((service, index) => {
    if (!service.id.trim()) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `missing-contact-id:${index}`,
        message: 'O ID do contato é obrigatório.',
      });
    }

    const requiredFields: Array<readonly [string, string, string]> = [
      ['name', service.name, 'O nome do contato é obrigatório.'],
      ['type', service.type, 'O tipo de serviço é obrigatório.'],
      ['address', service.address, 'O endereço é obrigatório.'],
    ];

    if (!hasLocationModel) {
      requiredFields.splice(2, 0, ['city', service.city, 'A cidade é obrigatória.']);
    }

    requiredFields.forEach(([field, value, message]) => {
      if (!value.trim()) {
        issues.push({
          level: 'error',
          area: 'contacts',
          id: `missing-${field}:${service.id}:${index}`,
          message,
          path: `contacts.${index}.${field}`,
        });
      }
    });

    if (service.type.trim().length > MAX_SERVICE_TYPE_LENGTH) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `long-type:${service.id}:${index}`,
        message: `A categoria deve ter no máximo ${MAX_SERVICE_TYPE_LENGTH} caracteres. Use o campo “Sobre o atendimento” para descrições.`,
        path: `contacts.${index}.type`,
      });
    }

    const locationId = typeof service.locationId === 'string' ? service.locationId.trim() : service.locationId;
    const assignedLocation =
      typeof locationId === 'string' && locationId.length > 0 ? locationsById.get(locationId) : undefined;

    if (hasLocationModel && locationId && !assignedLocation) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `unknown-location:${service.id}:${index}`,
        message: 'O local selecionado não existe mais.',
        path: `contacts.${index}.locationId`,
      });
    } else if (hasLocationModel && assignedLocation) {
      if (service.city !== assignedLocation.city || service.state !== assignedLocation.state) {
        issues.push({
          level: 'error',
          area: 'contacts',
          id: `location-mismatch:${service.id}:${index}`,
          message: 'A cidade e o estado do contato precisam coincidir com o local selecionado.',
          path: `contacts.${index}.locationId`,
        });
      }
    } else if (hasLocationModel && (service.city.trim() || service.state.trim())) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `unassigned-city:${service.id}:${index}`,
        message: "Use 'Sem local' para atendimento nacional.",
        path: `contacts.${index}.locationId`,
      });
    }

    if ((!hasLocationModel || assignedLocation) && !/^[A-Za-z]{2}$/.test(service.state)) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `invalid-state:${service.id}:${index}`,
        message: 'O estado precisa ter exatamente duas letras.',
        path: `contacts.${index}.state`,
      });
    }

    if (service.phoneDisplay.replace(/\D/g, '').length < 8) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `invalid-phone-display:${service.id}:${index}`,
        message: 'O telefone precisa ter pelo menos 8 dígitos.',
        path: `contacts.${index}.phoneDisplay`,
      });
    }

    if (service.phoneHref !== normalizePhoneHref(service.phoneDisplay)) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `invalid-phone-href:${service.id}:${index}`,
        message: 'O link do telefone precisa corresponder ao número informado.',
        path: `contacts.${index}.phoneHref`,
      });
    }

    if (
      service.lat !== undefined &&
      (typeof service.lat !== 'number' || !Number.isFinite(service.lat) || service.lat < -90 || service.lat > 90)
    ) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `invalid-lat:${service.id}:${index}`,
        message: 'A latitude deve ser um número entre -90 e 90.',
        path: `contacts.${index}.lat`,
      });
    }

    if (
      service.lng !== undefined &&
      (typeof service.lng !== 'number' || !Number.isFinite(service.lng) || service.lng < -180 || service.lng > 180)
    ) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `invalid-lng:${service.id}:${index}`,
        message: 'A longitude deve ser um número entre -180 e 180.',
        path: `contacts.${index}.lng`,
      });
    }
  });

  return createValidationResult(issues);
}

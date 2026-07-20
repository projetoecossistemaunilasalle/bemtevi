import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { findDuplicateIds } from '../validation/duplicateIds';
import {
  createValidationResult,
  type DashboardValidationIssue,
  type DashboardValidationResult,
} from '../validation/validationTypes';
import { normalizePhoneHref } from './contactDrafts';

export function validateDashboardContacts(services: ServiceDirectoryEntry[]): DashboardValidationResult {
  const issues: DashboardValidationIssue[] = [];

  findDuplicateIds(services.map((service) => service.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'contacts',
      id: `duplicate-contact-id:${id}`,
      message: `Existe mais de um contato com o ID "${id}".`,
    });
  });

  services.forEach((service, index) => {
    if (!service.id.trim()) {
      issues.push({
        level: 'error',
        area: 'contacts',
        id: `missing-contact-id:${index}`,
        message: 'O ID do contato é obrigatório.',
      });
    }

    const requiredFields = [
      ['name', service.name, 'O nome do contato é obrigatório.'],
      ['type', service.type, 'O tipo de serviço é obrigatório.'],
      ['city', service.city, 'A cidade é obrigatória.'],
      ['address', service.address, 'O endereço é obrigatório.'],
    ] as const;

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

    if (!/^[A-Za-z]{2}$/.test(service.state)) {
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
  });

  return createValidationResult(issues);
}

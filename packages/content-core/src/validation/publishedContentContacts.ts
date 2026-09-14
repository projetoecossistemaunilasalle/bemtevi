import type { ServiceDirectoryEntry, ServiceLocation } from '../model/services';
import { PublishedContentValidationError } from '../model/publishedContent';
import { locationPairKey } from '../model/locations';
import { isFiniteNumber, isNonEmptyString, isRecord } from './publishedContentGuards';

const SUPPORTED_BADGE_TONES = ['primary', 'secondary', 'neutral'] as const;

export function validateLocations(locations: unknown): ServiceLocation[] {
  if (!Array.isArray(locations)) {
    throw new PublishedContentValidationError('O campo "locations" deve ser uma lista.');
  }

  const ids = new Set<string>();
  const pairs = new Set<string>();

  return locations.map((location, index) => {
    if (!isRecord(location)) {
      throw new PublishedContentValidationError(`Local no índice ${index} deve ser um objeto.`);
    }

    const id = isNonEmptyString(location.id) ? location.id.trim() : '';
    const city = isNonEmptyString(location.city) ? location.city.trim() : '';
    const state = typeof location.state === 'string' ? location.state.trim().toUpperCase() : '';

    if (!id) {
      throw new PublishedContentValidationError(`Local no índice ${index} precisa de um "id".`);
    }
    if (!city) {
      throw new PublishedContentValidationError(`Local "${id}" precisa de uma "city".`);
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      throw new PublishedContentValidationError(`Local "${id}" precisa de um estado com duas letras.`);
    }
    if (ids.has(id)) {
      throw new PublishedContentValidationError(`Existe mais de um local com o ID "${id}".`);
    }

    const pair = locationPairKey(city, state);
    if (pairs.has(pair)) {
      throw new PublishedContentValidationError(`Existe mais de um local para "${city} - ${state}".`);
    }

    ids.add(id);
    pairs.add(pair);
    return { id, city, state };
  });
}

export function validateContactRecords(contacts: unknown): ServiceDirectoryEntry[] {
  if (!Array.isArray(contacts)) {
    throw new PublishedContentValidationError('O campo "contacts" deve ser uma lista.');
  }
  return contacts.map((contact, index) => {
    if (!isRecord(contact)) {
      throw new PublishedContentValidationError(`Contato no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(contact.id) ? String(contact.id) : `índice ${index}`;
    if (!isNonEmptyString(contact.id)) {
      throw new PublishedContentValidationError(`Contato no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(contact.name)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "name".`);
    }
    if (!isNonEmptyString(contact.type)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "type".`);
    }
    if (typeof contact.city !== 'string') {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "city" textual.`);
    }
    if (typeof contact.state !== 'string') {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "state" textual.`);
    }
    if (contact.locationId !== undefined && contact.locationId !== null && typeof contact.locationId !== 'string') {
      throw new PublishedContentValidationError(`Contato "${label}" tem um "locationId" inválido.`);
    }
    if (!isNonEmptyString(contact.address)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "address".`);
    }
    if (!isNonEmptyString(contact.phoneDisplay)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "phoneDisplay".`);
    }
    if (!isNonEmptyString(contact.phoneHref)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um "phoneHref".`);
    }
    if (!SUPPORTED_BADGE_TONES.includes(contact.badgeTone as (typeof SUPPORTED_BADGE_TONES)[number])) {
      throw new PublishedContentValidationError(`Contato "${label}" tem "badgeTone" inválido.`);
    }
    if (contact.lat !== undefined && (!isFiniteNumber(contact.lat) || contact.lat < -90 || contact.lat > 90)) {
      throw new PublishedContentValidationError(`Contato "${label}" tem "lat" inválido.`);
    }
    if (contact.lng !== undefined && (!isFiniteNumber(contact.lng) || contact.lng < -180 || contact.lng > 180)) {
      throw new PublishedContentValidationError(`Contato "${label}" tem "lng" inválido.`);
    }
    if (!isRecord(contact.review)) {
      throw new PublishedContentValidationError(`Contato "${label}" precisa de um objeto "review".`);
    }
    return contact as unknown as ServiceDirectoryEntry;
  });
}

export function validateContacts(
  contacts: ServiceDirectoryEntry[],
  locations: ServiceLocation[],
): ServiceDirectoryEntry[] {
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  contacts.forEach((contact, index) => {
    const label = isNonEmptyString(contact.id) ? contact.id : `índice ${index}`;
    const locationId = typeof contact.locationId === 'string' ? contact.locationId.trim() : contact.locationId;
    const location =
      typeof locationId === 'string' && locationId.length > 0 ? locationsById.get(locationId) : undefined;

    if (locationId !== undefined && locationId !== null && locationId !== '') {
      if (!location) {
        throw new PublishedContentValidationError(`Contato "${label}" referencia um local desconhecido.`);
      }
      if (contact.city !== location.city || contact.state !== location.state) {
        throw new PublishedContentValidationError(`Contato "${label}" não coincide com o local referenciado.`);
      }
      return;
    }

    if (contact.city.trim() || contact.state.trim()) {
      throw new PublishedContentValidationError(`Contato "${label}" sem local não pode conter cidade ou estado.`);
    }
  });

  return contacts;
}

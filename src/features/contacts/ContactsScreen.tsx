import { List, Map as MapIcon, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { canoasServices } from '../../content/services/canoas-services';
import { Page } from '../../design-system/components/Page';
import { ServiceCard } from '../../design-system/components/ServiceCard';
import { getServiceCoordinates, haversineKm, type GeoCoordinates } from '../../lib/geo/geo';
import { CityFilter, type CityFilterValue } from './CityFilter';
import { ContactsMap } from './ContactsMap';

export function ContactsScreen() {
  const { content } = usePublishedContent();
  const services = content.contacts;
  const [selectedCity, setSelectedCity] = useState<CityFilterValue>(null);
  const [userCoordinates, setUserCoordinates] = useState<GeoCoordinates | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const cityOptions = useMemo(() => {
    const labels = services
      .map((service) => (service.city ? `${service.city} - ${service.state}` : null))
      .filter((label): label is string => label !== null);
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [services]);

  const distancesById = useMemo(() => {
    if (!userCoordinates) return {};
    const result: Record<string, number> = {};
    services.forEach((service) => {
      const coords = getServiceCoordinates(service);
      if (coords) {
        result[service.id] = haversineKm(userCoordinates, coords);
      }
    });
    return result;
  }, [services, userCoordinates]);

  const visibleServices = useMemo(() => {
    const list =
      selectedCity === null
        ? [...services]
        : services.filter((service) => !service.city || `${service.city} - ${service.state}` === selectedCity);

    if (!userCoordinates) return list;

    return list.sort((a, b) => {
      const distA = distancesById[a.id];
      const distB = distancesById[b.id];
      if (distA !== undefined && distB !== undefined) return distA - distB;
      if (distA !== undefined) return -1;
      if (distB !== undefined) return 1;
      return 0;
    });
  }, [services, selectedCity, userCoordinates, distancesById]);

  const directoryTitle =
    cityOptions.length === 1 ? `Rede de apoio em ${cityOptions[0]?.replace(/\s+-\s+[A-Z]{2}$/, '')}` : 'Rede de apoio';

  return (
    <Page>
      <section className="mb-stack-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-container text-on-primary-container p-2 rounded-full flex items-center justify-center">
            <MapPin className="[&>circle]:fill-primary-container" fill="currentColor" size={24} />
          </div>
          <h1 className="font-headline-lg text-on-surface">{directoryTitle}</h1>
        </div>
        <p className="font-body-md text-on-surface-variant">{canoasServices.description}</p>
      </section>

      <div className="mb-stack-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <CityFilter
          cities={cityOptions}
          value={selectedCity}
          onChange={setSelectedCity}
          onUserCoordinatesChange={setUserCoordinates}
        />

        <div
          role="radiogroup"
          aria-label="Modo de visualização"
          className="flex items-center gap-1 self-start sm:self-auto rounded-xl bg-surface-container p-1 border border-outline-variant/50 shrink-0"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="Ver contatos em lista"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-xs sm:text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              viewMode === 'list'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <List size={16} aria-hidden="true" />
            Lista
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'map'}
            aria-label="Ver contatos no mapa"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-xs sm:text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              viewMode === 'map'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <MapIcon size={16} aria-hidden="true" />
            Mapa
          </button>
        </div>
      </div>

      {visibleServices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center font-body-md text-on-surface-variant">
          Nenhum contato encontrado para {selectedCity}. Tente outra cidade.
        </p>
      ) : viewMode === 'map' ? (
        <ContactsMap services={visibleServices} userCoordinates={userCoordinates} distancesById={distancesById} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
          {visibleServices.map((service) => (
            <ServiceCard key={service.id} service={service} distanceKm={distancesById[service.id]} />
          ))}
        </div>
      )}
    </Page>
  );
}

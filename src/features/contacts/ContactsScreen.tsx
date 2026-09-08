import { Building2, HeartPulse, Hospital, List, Map as MapIcon, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { canoasServices } from '../../content/services/canoas-services';
import { healthcareServiceGuidance } from '../../content/support/contacts';
import { Page } from '../../design-system/components/Page';
import { ServiceCard } from '../../design-system/components/ServiceCard';
import { getServiceCoordinates, haversineKm, type GeoCoordinates } from '../../lib/geo/geo';
import { CityFilter, type CityFilterValue } from './CityFilter';
import { ContactsMap } from './ContactsMap';
import { ServiceTypeFilter } from './ServiceTypeFilter';
import { matchesServiceTypeFilter, type ServiceTypeFilterKey } from './serviceTypeFilterTypes';

export function ContactsScreen() {
  const { content } = usePublishedContent();
  const services = content.contacts;
  const [selectedCity, setSelectedCity] = useState<CityFilterValue>(null);
  const [selectedType, setSelectedType] = useState<ServiceTypeFilterKey>('all');
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
    const list = services.filter((service) => {
      const matchesCity =
        selectedCity === null || !service.city || `${service.city} - ${service.state}` === selectedCity;
      const matchesType = matchesServiceTypeFilter(service.type, selectedType);
      return matchesCity && matchesType;
    });

    if (!userCoordinates) return list;

    return list.sort((a, b) => {
      const distA = distancesById[a.id];
      const distB = distancesById[b.id];
      if (distA !== undefined && distB !== undefined) return distA - distB;
      if (distA !== undefined) return -1;
      if (distB !== undefined) return 1;
      return 0;
    });
  }, [services, selectedCity, selectedType, userCoordinates, distancesById]);

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

      <section
        aria-labelledby="service-guidance-title"
        className="overflow-hidden rounded-2xl bg-surface-container-low shadow-sm"
      >
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Hospital size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="service-guidance-title" className="font-headline-sm text-on-surface">
                Onde buscar atendimento?
              </h2>
              <p className="font-body-md text-on-surface-variant">Entenda qual serviço pode ajudar neste momento.</p>
            </div>
          </div>
        </div>
        <div className="mt-5 grid divide-y divide-outline-variant/40 border-t border-outline-variant/40 md:grid-cols-3 md:divide-x md:divide-y-0">
          {healthcareServiceGuidance.map((item) => {
            const Icon = item.id === 'guidance-ubs' ? Building2 : item.id === 'guidance-caps' ? HeartPulse : Hospital;
            const iconColor =
              item.id === 'guidance-ubs'
                ? 'text-secondary'
                : item.id === 'guidance-caps'
                  ? 'text-primary'
                  : 'text-error';

            return (
              <article key={item.id} className="flex gap-3 px-5 py-5 sm:px-6">
                <Icon className={`${iconColor} mt-0.5 shrink-0`} size={21} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-label-md font-bold text-on-surface">{item.title}</h3>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 font-body-md leading-relaxed text-on-surface-variant">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mb-stack-md flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-start gap-2 flex-1">
            <CityFilter
              cities={cityOptions}
              value={selectedCity}
              onChange={setSelectedCity}
              onUserCoordinatesChange={setUserCoordinates}
            />
            <ServiceTypeFilter value={selectedType} onChange={setSelectedType} />
          </div>

          <div
            role="radiogroup"
            aria-label="Modo de visualização"
            className="flex items-center gap-1 self-start md:self-auto rounded-xl bg-surface-container p-1 border border-outline-variant/50 shrink-0"
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
      </div>

      {visibleServices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center font-body-md text-on-surface-variant">
          Nenhum contato encontrado para os filtros selecionados. Tente outra cidade ou tipo de serviço.
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

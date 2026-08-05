import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { canoasServices } from '../../content/services/canoas-services';
import { Page } from '../../design-system/components/Page';
import { ServiceCard } from '../../design-system/components/ServiceCard';
import { CityFilter, type CityFilterValue } from './CityFilter';

export function ContactsScreen() {
  const { content } = usePublishedContent();
  const services = content.contacts;
  const [selectedCity, setSelectedCity] = useState<CityFilterValue>(null);

  const cityOptions = useMemo(() => {
    const labels = services
      .map((service) => (service.city ? `${service.city} - ${service.state}` : null))
      .filter((label): label is string => label !== null);
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [services]);

  const visibleServices = useMemo(() => {
    if (selectedCity === null) return services;
    return services.filter((service) => !service.city || `${service.city} - ${service.state}` === selectedCity);
  }, [services, selectedCity]);

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

      <div className="mb-stack-md">
        <CityFilter cities={cityOptions} value={selectedCity} onChange={setSelectedCity} />
      </div>

      {visibleServices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center font-body-md text-on-surface-variant">
          Nenhum contato encontrado para {selectedCity}. Tente outra cidade.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
          {visibleServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </Page>
  );
}

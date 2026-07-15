import { MapPin } from 'lucide-react';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import { canoasServices } from '../../content/services/canoas-services';
import { Page } from '../../design-system/components/Page';
import { ServiceCard } from '../../design-system/components/ServiceCard';

export function ContactsScreen() {
  const { content } = usePublishedContent();
  const services = content.contacts;

  return (
    <Page>
      <section className="mb-stack-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-container text-on-primary-container p-2 rounded-full flex items-center justify-center">
            <MapPin fill="currentColor" size={24} />
          </div>
          <h1 className="font-headline-lg text-on-surface">{canoasServices.title}</h1>
        </div>
        <p className="font-body-md text-on-surface-variant">{canoasServices.description}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </Page>
  );
}

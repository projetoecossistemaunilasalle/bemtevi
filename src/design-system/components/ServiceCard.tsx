import { Clock, Map, Navigation, Phone } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { getServiceCoordinates } from '../../lib/geo/geo';
import { Badge } from './Badge';
import { LinkButton } from './Button';
import { Card } from './Card';

function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `a ~${meters} m de você`;
  }
  const formatted = (Math.round(km * 10) / 10).toFixed(1).replace('.', ',');
  return `a ~${formatted} km de você`;
}

function getMapUrl(service: ServiceDirectoryEntry): string | null {
  const coords = getServiceCoordinates(service);
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  if (service.city && service.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${service.name}, ${service.address}`)}`;
  }
  return null;
}

export function ServiceCard({
  service,
  distanceKm,
  preview = false,
}: {
  service: ServiceDirectoryEntry;
  distanceKm?: number;
  preview?: boolean;
}) {
  const mapUrl = getMapUrl(service);

  return (
    <Card className="border-l-4 border-l-primary overflow-hidden flex flex-col bg-surface-container-low">
      <article className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="min-w-0 flex flex-wrap gap-1.5 items-center">
            <Badge tone={service.badgeTone}>
              <span className="block min-w-0 truncate whitespace-nowrap">{service.type}</span>
            </Badge>
            {distanceKm !== undefined ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/70 px-2 py-0.5 text-xs font-semibold text-on-primary-container">
                <Navigation size={12} aria-hidden="true" />
                {formatDistance(distanceKm)}
              </span>
            ) : null}
          </div>
          {service.city ? (
            <span className="border border-outline-variant rounded-full px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant whitespace-nowrap">
              {service.city} - {service.state}
            </span>
          ) : null}
        </div>
        <h2 className="font-headline-md text-on-surface mb-4">{service.name}</h2>
        <div className="flex flex-col gap-2.5 font-body-md text-on-surface-variant">
          <div className="flex items-start gap-2.5">
            <Map className="text-secondary mt-1 shrink-0" size={18} />
            <span>{service.address}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="text-secondary shrink-0" size={18} />
            <span>{service.phoneDisplay}</span>
          </div>
          {service.hours ? (
            <div className="flex items-center gap-2.5">
              <Clock className="text-secondary shrink-0" size={18} />
              <span>{service.hours}</span>
            </div>
          ) : null}
        </div>
        {service.notes ? <ExpandableNotes text={service.notes} /> : null}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <LinkButton
            href={preview ? undefined : service.phoneHref}
            aria-disabled={preview || undefined}
            tabIndex={preview ? -1 : undefined}
            onClick={preview ? (event) => event.preventDefault() : undefined}
            className="flex-1"
          >
            <Phone size={18} />
            Ligar agora
          </LinkButton>
          {mapUrl ? (
            <LinkButton
              variant="secondary"
              href={preview ? undefined : mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Como chegar ao endereço de ${service.name}`}
              aria-disabled={preview || undefined}
              tabIndex={preview ? -1 : undefined}
              onClick={preview ? (event) => event.preventDefault() : undefined}
              className="flex-1"
            >
              <Navigation size={18} />
              Como chegar
            </LinkButton>
          ) : null}
        </div>
      </article>
    </Card>
  );
}

function ExpandableNotes({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => setCanExpand(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="border-t border-outline-variant/50 pt-3 mt-4 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Sobre o atendimento</span>
      <p
        ref={textRef}
        className={`font-body-md text-on-surface relative ${
          expanded ? '' : 'line-clamp-3'
        } ${!expanded && canExpand ? "after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-10 after:bg-gradient-to-t after:from-surface-container-low after:pointer-events-none" : ''}`}
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="self-start border-none bg-transparent p-0 font-semibold text-primary cursor-pointer hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary text-sm"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  );
}

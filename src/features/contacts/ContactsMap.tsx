import { ExternalLink, MapPin, Navigation, Phone, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { getServiceCoordinates, type GeoCoordinates } from '../../lib/geo/geo';
import { Badge } from '../../design-system/components/Badge';
import { LinkButton } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';

interface ContactsMapProps {
  services: ServiceDirectoryEntry[];
  userCoordinates?: GeoCoordinates | null;
  distancesById?: Record<string, number>;
}

function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `a ~${meters} m de você`;
  }
  const formatted = (Math.round(km * 10) / 10).toFixed(1).replace('.', ',');
  return `a ~${formatted} km de você`;
}

export function ContactsMap({ services, userCoordinates, distancesById = {} }: ContactsMapProps) {
  const mappableServices = useMemo(
    () =>
      services
        .map((s) => {
          const coords = getServiceCoordinates(s);
          if (!coords) return null;
          return {
            ...s,
            lat: coords.lat,
            lng: coords.lng,
          };
        })
        .filter((s): s is ServiceDirectoryEntry & { lat: number; lng: number } => s !== null),
    [services],
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => mappableServices[0]?.id ?? null);
  const [zoomMode, setZoomMode] = useState<'detail' | 'overview'>('detail');

  const activeService = useMemo(
    () => mappableServices.find((s) => s.id === selectedServiceId) ?? mappableServices[0] ?? null,
    [mappableServices, selectedServiceId],
  );

  const mapBounds = useMemo(() => {
    if (mappableServices.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    mappableServices.forEach((s) => {
      minLat = Math.min(minLat, s.lat);
      maxLat = Math.max(maxLat, s.lat);
      minLng = Math.min(minLng, s.lng);
      maxLng = Math.max(maxLng, s.lng);
    });

    if (userCoordinates) {
      minLat = Math.min(minLat, userCoordinates.lat);
      maxLat = Math.max(maxLat, userCoordinates.lat);
      minLng = Math.min(minLng, userCoordinates.lng);
      maxLng = Math.max(maxLng, userCoordinates.lng);
    }

    const padding = 0.015;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const bbox = `${minLng - padding}%2C${minLat - padding}%2C${maxLng + padding}%2C${maxLat + padding}`;
    return { bbox, centerLat, centerLng };
  }, [mappableServices, userCoordinates]);

  const osmEmbedUrl = useMemo(() => {
    if (!activeService) return '';

    let bbox: string;
    if (zoomMode === 'detail') {
      // Close-up street/neighborhood zoom around the selected service (~500-600m radius)
      const zoomDelta = 0.0055;
      const minLng = (activeService.lng - zoomDelta).toFixed(5);
      const minLat = (activeService.lat - zoomDelta).toFixed(5);
      const maxLng = (activeService.lng + zoomDelta).toFixed(5);
      const maxLat = (activeService.lat + zoomDelta).toFixed(5);
      bbox = `${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}`;
    } else {
      bbox =
        mapBounds?.bbox ??
        `${activeService.lng - 0.02}%2C${activeService.lat - 0.02}%2C${activeService.lng + 0.02}%2C${activeService.lat + 0.02}`;
    }

    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${activeService.lat}%2C${activeService.lng}`;
  }, [activeService, zoomMode, mapBounds]);

  if (mappableServices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center font-body-md text-on-surface-variant">
        <MapPin className="mx-auto mb-2 text-on-surface-variant" size={32} />
        <p className="font-semibold text-on-surface">Nenhum endereço com coordenadas disponível para este filtro.</p>
        <p className="mt-1 text-sm">Alterne para a visualização em lista para consultar todos os contatos.</p>
      </div>
    );
  }

  const externalMapUrl = activeService
    ? `https://www.google.com/maps/search/?api=1&query=${activeService.lat},${activeService.lng}`
    : 'https://www.google.com/maps';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        {/* Map Container */}
        <div className="relative overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container shadow-sm aspect-video sm:aspect-[16/10] lg:aspect-auto lg:h-[460px]">
          {osmEmbedUrl ? (
            <iframe
              title="Mapa de contatos da rede de apoio"
              src={osmEmbedUrl}
              className="h-full w-full border-0"
              loading="lazy"
            />
          ) : null}

          {/* User Location indicator badge if active */}
          {userCoordinates ? (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur px-3 py-1 text-xs font-semibold text-primary shadow-sm border border-outline-variant/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Sua localização aproximada
            </div>
          ) : null}

          {/* Zoom Mode Selector */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg bg-surface-container-lowest/95 backdrop-blur p-1 shadow-sm border border-outline-variant/50 text-xs">
            <button
              type="button"
              onClick={() => setZoomMode('detail')}
              aria-pressed={zoomMode === 'detail'}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                zoomMode === 'detail'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              Zoom no local
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('overview')}
              aria-pressed={zoomMode === 'overview'}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                zoomMode === 'overview'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              Visão geral
            </button>
          </div>

          <div className="absolute bottom-3 right-3 z-10">
            <LinkButton
              variant="secondary"
              size="sm"
              href={externalMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-container-lowest/95 backdrop-blur text-xs"
            >
              <ExternalLink size={14} />
              Abrir no Google Maps
            </LinkButton>
          </div>
        </div>

        {/* Services List / Pin Selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-md text-on-surface-variant uppercase tracking-wider text-xs">
              Pontos de atendimento ({mappableServices.length})
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
            {mappableServices.map((service) => {
              const isSelected = service.id === activeService?.id;
              const distance = distancesById[service.id];

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-container/15 ring-2 ring-primary/20 shadow-sm'
                      : 'border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Badge tone={service.badgeTone}>
                      <span className="text-xs">{service.type}</span>
                    </Badge>
                    {distance !== undefined ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Navigation size={12} aria-hidden="true" />
                        {formatDistance(distance)}
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant font-medium">{service.city}</span>
                    )}
                  </div>
                  <h3 className="font-headline-sm text-base text-on-surface font-semibold mb-1">{service.name}</h3>
                  <p className="font-body-md text-xs text-on-surface-variant line-clamp-1">{service.address}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Card of Currently Selected Service */}
      {activeService ? (
        <Card className="border-l-4 border-l-primary bg-surface-container-low p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge tone={activeService.badgeTone}>
                  <span>{activeService.type}</span>
                </Badge>
                {distancesById[activeService.id] !== undefined ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/70 px-2 py-0.5 text-xs font-semibold text-on-primary-container">
                    <Navigation size={12} aria-hidden="true" />
                    {formatDistance(distancesById[activeService.id]!)}
                  </span>
                ) : null}
              </div>
              <h2 className="font-headline-md text-lg text-on-surface mt-1">{activeService.name}</h2>
              <p className="font-body-md text-sm text-on-surface-variant">{activeService.address}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <LinkButton href={activeService.phoneHref} size="sm">
                <Phone size={16} />
                {activeService.phoneDisplay}
              </LinkButton>
              <LinkButton
                variant="secondary"
                size="sm"
                href={`https://www.google.com/maps/search/?api=1&query=${activeService.lat},${activeService.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation size={16} />
                Como chegar
              </LinkButton>
            </div>
          </div>
        </Card>
      ) : null}

      {/* LGPD Privacy Note */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-lowest rounded-lg p-2.5 border border-outline-variant/40">
        <ShieldCheck size={16} className="text-primary shrink-0" />
        <span>
          <strong>Privacidade garantida:</strong> sua localização fica guardada apenas na memória do navegador para o
          cálculo de proximidade e nunca é salva ou transmitida a nenhum servidor.
        </span>
      </div>
    </div>
  );
}

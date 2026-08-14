import type { ContentMetadata, ReviewMetadata } from '../content/types';

export interface ServiceLocation {
  id: string;
  city: string;
  state: string;
}

export interface ServiceDirectoryEntry {
  id: string;
  name: string;
  type: string;
  badgeTone: 'primary' | 'secondary' | 'neutral';
  city: string;
  state: string;
  locationId?: string | null;
  address: string;
  phoneDisplay: string;
  phoneHref: string;
  hours?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  review: ReviewMetadata;
}

export interface ServicesContent extends ContentMetadata {
  title: string;
  description: string;
  services: ServiceDirectoryEntry[];
}

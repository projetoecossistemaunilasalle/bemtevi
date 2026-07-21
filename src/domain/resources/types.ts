import type { ContentMetadata, ReviewMetadata } from '../content/types';

export type EducationResourceAudience = 'teachers' | 'public_school_teachers' | 'general';

export type EducationResourceFeaturedImage =
  | { kind: 'catalog'; imageId: string }
  | { kind: 'external'; imageUrl: string; alt?: string }
  | { kind: 'uploaded'; dataUrl: string; alt?: string; fileName?: string };

export type EducationResourceBlockKind = 'paragraph' | 'heading' | 'list' | 'image' | 'video' | 'sourceLink' | 'link';

export interface EducationResourceBlock {
  id: string;
  kind: EducationResourceBlockKind;
  title?: string;
  text?: string;
  items?: string[];
  imageUrl?: string;
  imageFileName?: string;
  alt?: string;
  url?: string;
  label?: string;
  description?: string;
}

export interface EducationResourceEmbed {
  provider: 'youtube' | 'external';
  url: string;
}

export interface EducationResource {
  id: string;
  title: string;
  source: string;
  description: string;
  imageUrl?: string;
  imageFileName?: string;
  featuredImage?: EducationResourceFeaturedImage;
  tags: string[];
  audience: EducationResourceAudience;
  body?: EducationResourceBlock[];
  embed?: EducationResourceEmbed;
  href?: string;
  group?: string;
  groupOrder?: number;
  review: ReviewMetadata;
}

export interface ResourcesContent extends ContentMetadata {
  resources: EducationResource[];
}

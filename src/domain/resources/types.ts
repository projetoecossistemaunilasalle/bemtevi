import type { ContentMetadata, ReviewMetadata } from '../content/types';

export interface EducationResource {
  id: string;
  title: string;
  source: string;
  description: string;
  imageUrl?: string;
  tags: string[];
  href?: string;
  review: ReviewMetadata;
}

export interface ResourcesContent extends ContentMetadata {
  resources: EducationResource[];
}


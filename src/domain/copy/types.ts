import type { ContentMetadata } from '../content/types';

export interface HomeActionCopy {
  id: string;
  label: string;
  description: string;
}

export interface HomeCopy extends ContentMetadata {
  title: string;
  subtitle: string;
  privacyReassurance: string;
  actions: HomeActionCopy[];
}


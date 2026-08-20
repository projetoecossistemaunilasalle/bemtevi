import type { ContentMetadata } from '../content/types';

export interface HomeActionCopy {
  id: string;
  label: string;
  description: string;
}

export interface HomeCopy extends ContentMetadata {
  greeting: string;
  subtitle: string;
  educationalDisclaimer: string;
  privacyReassurance: string;
  actions: HomeActionCopy[];
}

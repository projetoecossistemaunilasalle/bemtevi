export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'archived';
export type ContentLocale = 'pt-BR';

export interface ReviewMetadata {
  status: 'pending_review' | 'approved' | 'changes_requested';
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
}

export interface ContentMetadata {
  id: string;
  version: string;
  status: ContentStatus;
  locale: ContentLocale;
}

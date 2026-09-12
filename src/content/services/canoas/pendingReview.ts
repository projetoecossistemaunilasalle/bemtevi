import type { ReviewMetadata } from '../../../domain/content/types';

export const pendingReviewMetadata = {
  status: 'pending_review',
  reviewedBy: null,
  reviewedAt: null,
  notes: '',
} as const satisfies ReviewMetadata;

export const pendingReview = pendingReviewMetadata;

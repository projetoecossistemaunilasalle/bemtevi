import type { PublishedContentPayload, PublishedContentSnapshot } from '../app/content/publishedContent';
import { toPublishedContentPayload } from './dashboardModel';
import type { DashboardShippedContent } from './content/shippedContent';

export function buildDashboardPublicationPayload(content: DashboardShippedContent): PublishedContentPayload {
  return toPublishedContentPayload(content);
}

/**
 * PublishDashboard invokes its callback only after a confirmed publication.
 * Keep draft cleanup behind that callback rather than coupling it to review or
 * candidate preparation.
 */
export function createDashboardPublicationSuccessHandler(onClearDraft: () => void) {
  return (_snapshot: PublishedContentSnapshot) => {
    onClearDraft();
  };
}

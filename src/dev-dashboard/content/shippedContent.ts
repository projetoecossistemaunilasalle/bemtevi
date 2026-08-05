import { getBundledContent } from '../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../app/content/publishedContent';

export type DashboardShippedContent = Omit<PublishedContentPayload, 'defaultGroupOrder' | 'locations'> & {
  locations?: PublishedContentPayload['locations'];
  defaultGroupOrder?: number;
};

export function getShippedDashboardContent(): DashboardShippedContent {
  return getBundledContent();
}

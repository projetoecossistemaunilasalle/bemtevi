export const FEATURED_IMAGE_IDS = [
  'hands-holding-plant',
  'classroom-1',
  'classroom-2',
  'green-patch',
  'respiracao-1',
  'respiracao-2',
] as const;

export function isFeaturedImageId(value: string | undefined): boolean {
  return typeof value === 'string' && (FEATURED_IMAGE_IDS as readonly string[]).includes(value);
}

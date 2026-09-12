/** Supported first-party destinations shared by flow editors and effects. */
export const NAVIGATION_OPTIONS = ['/apoio', '/contatos', '/educacao'] as const;

export type FlowNavigationDestination = (typeof NAVIGATION_OPTIONS)[number];

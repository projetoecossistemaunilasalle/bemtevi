// Compatibility facade: the group type and default id live in @bemtevi/content-core
// (model/groups). The editorial group list below is content data and stays in the repo.
import type { EducationResourceGroup } from '@bemtevi/content-core';

export type { EducationResourceGroup };
export { DEFAULT_EDUCATION_GROUP_ID } from '@bemtevi/content-core';

export const educationResourceGroups: EducationResourceGroup[] = [
  { id: 'auto-cuidado', title: 'Autocuidado', order: 1 },
  { id: 'sala-de-aula', title: 'Sala de Aula', order: 2 },
  { id: 'formacao', title: 'Formação', order: 3 },
];

export interface EducationResourceGroup {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export const DEFAULT_EDUCATION_GROUP_ID = 'geral' as const;

export const educationResourceGroups: EducationResourceGroup[] = [
  { id: 'auto-cuidado', title: 'Autocuidado', order: 1 },
  { id: 'sala-de-aula', title: 'Sala de Aula', order: 2 },
  { id: 'formacao', title: 'Formação', order: 3 },
];

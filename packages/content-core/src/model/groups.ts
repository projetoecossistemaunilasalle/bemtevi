export interface EducationResourceGroup {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export const DEFAULT_EDUCATION_GROUP_ID = 'geral' as const;

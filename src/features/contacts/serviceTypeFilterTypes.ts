export type ServiceTypeFilterKey = 'all' | 'clinicas_escola' | 'caps' | 'upas_hospitais';

export interface ServiceTypeOption {
  key: ServiceTypeFilterKey;
  label: string;
}

export const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
  { key: 'all', label: 'Todos os serviços' },
  { key: 'clinicas_escola', label: 'Clínicas-escola e serviços com valor social' },
  { key: 'caps', label: 'CAPS' },
  { key: 'upas_hospitais', label: 'UPAs e Hospitais / Pronto-socorro' },
];

export function matchesServiceTypeFilter(serviceType: string, filterKey: ServiceTypeFilterKey): boolean {
  if (filterKey === 'all') return true;
  const normalized = serviceType.toLocaleLowerCase('pt-BR');
  if (filterKey === 'caps') {
    return normalized.includes('caps');
  }
  if (filterKey === 'upas_hospitais') {
    return (
      normalized.includes('upa') ||
      normalized.includes('hospital') ||
      normalized.includes('pronto') ||
      normalized.includes('emergência')
    );
  }
  if (filterKey === 'clinicas_escola') {
    return (
      normalized.includes('universidade') ||
      normalized.includes('escola') ||
      normalized.includes('social') ||
      normalized.includes('ubs')
    );
  }
  return true;
}

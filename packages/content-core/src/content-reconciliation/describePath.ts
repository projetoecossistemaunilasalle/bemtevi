import type { ContentPath } from './types';

const labels: Record<string, string> = {
  flows: 'Fluxos',
  educationMaterials: 'Materiais',
  educationGroups: 'Grupos',
  contacts: 'Contatos',
  locations: 'Locais',
  nodes: 'Etapas',
  options: 'Escolhas',
  body: 'Conteúdo',
  title: 'Título',
  name: 'Nome',
  text: 'Texto',
  description: 'Descrição',
  next: 'Destino',
  defaultGroupOrder: 'Ordem padrão dos grupos',
  effects: 'Efeitos',
  nodeOrder: 'Ordem das etapas',
};
export function describePath(path: ContentPath): string {
  return path
    .map((part) =>
      part.kind === 'record' ? part.id : part.kind === 'order' ? 'Ordem dos itens' : (labels[part.key] ?? part.key),
    )
    .join(' / ');
}

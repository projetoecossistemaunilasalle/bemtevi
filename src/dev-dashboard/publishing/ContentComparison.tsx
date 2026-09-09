import { useId, useState } from 'react';
import { Button } from '../../design-system/components/Button';
import { describePath, type SemanticChange, type ValueSlot } from './semanticDiff';

export function SlotPreview({ label, slot, comparedTo }: { label: string; slot: ValueSlot; comparedTo?: ValueSlot }) {
  const [expanded, setExpanded] = useState(false);
  if (!slot.present)
    return (
      <div className="min-w-0">
        <h4 className="font-label-md">{label}</h4>
        <p className="font-body-md">Ausente (removido)</p>
      </div>
    );
  const value = slot.value;
  if (typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value))
    return (
      <div className="min-w-0">
        <h4 className="font-label-md">{label}</h4>
        <img src={value} alt="Imagem do conteúdo em revisão" className="max-h-48 max-w-full object-contain" />
        <p className="font-body-sm">Imagem incorporada ({Math.round((value.length * 0.75) / 1024)} KiB)</p>
      </div>
    );
  const text =
    typeof value === 'string'
      ? value.startsWith('data:')
        ? '[Arquivo incorporado; disponível na cópia de segurança]'
        : value
      : JSON.stringify(
          value,
          (_key, entry: unknown) =>
            typeof entry === 'string' && entry.startsWith('data:')
              ? '[Arquivo incorporado; disponível na cópia de segurança]'
              : entry,
          2,
        );
  const long = text.length > 800;
  const visible = expanded ? text : text.slice(0, 800);
  let start = 0,
    end = text.length;
  if (typeof value === 'string' && comparedTo?.present && typeof comparedTo.value === 'string') {
    const other = comparedTo.value;
    while (start < text.length && start < other.length && text[start] === other[start]) start++;
    let suffix = 0;
    while (
      end - suffix > start &&
      other.length - suffix > start &&
      text[end - suffix - 1] === other[other.length - suffix - 1]
    )
      suffix++;
    end -= suffix;
  }
  return (
    <div className="min-w-0">
      <h4 className="font-label-md">{label}</h4>
      <pre className="mt-2 whitespace-pre-wrap break-words font-body-md [overflow-wrap:anywhere]">
        {comparedTo ? (
          <>
            {visible.slice(0, start)}
            <mark className="bg-secondary-container text-on-secondary-container">{visible.slice(start, end)}</mark>
            {visible.slice(end)}
          </>
        ) : (
          visible
        )}
      </pre>
      {long && (
        <Button size="sm" variant="secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Recolher valor' : 'Mostrar valor completo'}
        </Button>
      )}
    </div>
  );
}

export function ContentComparison({
  changes,
  title,
  onOpen,
}: {
  changes: SemanticChange[];
  title: string;
  onOpen?(change: SemanticChange): void;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [area, setArea] = useState('all');
  const [limit, setLimit] = useState(50);
  const id = useId();
  const filtered = changes.filter(
    (change) =>
      (kind === 'all' || change.kind === kind) &&
      (area === 'all' || (change.path[0]?.kind === 'field' && change.path[0].key === area)) &&
      `${describePath(change.path)} ${change.recordLabel ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const kinds = { added: 'Adicionado', removed: 'Removido', edited: 'Alterado', moved: 'Movido' };
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-headline-sm">
        {title} ({changes.length})
      </h3>
      <div className="flex flex-wrap gap-3">
        <label htmlFor={`${id}-search`} className="font-body-md">
          Buscar por nome, campo ou ID
          <input
            id={`${id}-search`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(50);
            }}
            className="block min-h-11 max-w-full rounded-md border border-outline-variant bg-surface p-2"
          />
        </label>
        <label className="font-body-md">
          Tipo
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(50);
            }}
            className="block min-h-11 rounded-md border border-outline-variant bg-surface p-2"
          >
            <option value="all">Todos</option>
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="font-body-md">
          Área
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setLimit(50);
            }}
            className="block min-h-11 rounded-md border border-outline-variant bg-surface p-2"
          >
            <option value="all">Todas</option>
            {['flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations', 'defaultGroupOrder'].map(
              (key) => (
                <option key={key} value={key}>
                  {describePath([{ kind: 'field', key }])}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <p className="font-body-sm">{filtered.length} alterações encontradas</p>
      {filtered.slice(0, limit).map((change) => (
        <details key={change.id} className="border-b border-outline-variant py-3">
          <summary className="min-h-11 cursor-pointer break-words font-label-md [overflow-wrap:anywhere]">
            {kinds[change.kind]}: {describePath(change.path)}
            {change.recordLabel ? ` · ${change.recordLabel}` : ''}
          </summary>
          <div className="grid min-w-0 gap-4 py-3 md:grid-cols-2">
            <SlotPreview label="Antes" slot={change.before} comparedTo={change.after} />
            <SlotPreview label="Depois" slot={change.after} comparedTo={change.before} />
          </div>
          {onOpen && change.kind !== 'removed' && (
            <Button variant="secondary" onClick={() => onOpen(change)}>
              Abrir no editor
            </Button>
          )}
        </details>
      ))}
      {filtered.length > limit && (
        <Button variant="secondary" onClick={() => setLimit(limit + 50)}>
          Carregar mais
        </Button>
      )}
    </section>
  );
}

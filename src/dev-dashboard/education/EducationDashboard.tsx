import { useMemo, useState } from 'react';
import { defaultFeaturedImageId, featuredImageOptions } from '../../content/resources/featuredImages';
import type {
  EducationResource,
  EducationResourceBlock,
  EducationResourceFeaturedImage,
} from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { FieldHint } from '../components/FieldHint';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardEducation } from './educationValidation';

const blockKindLabels: Record<EducationResourceBlock['kind'], string> = {
  paragraph: 'Parágrafo',
  heading: 'Título',
  list: 'Lista',
  image: 'Imagem',
  video: 'Vídeo',
  sourceLink: 'Link da fonte',
};

export function EducationDashboard({
  resources,
  groups,
  onResourceChange,
  onResourceAdd,
}: {
  resources: EducationResource[];
  groups: EducationResourceGroup[];
  onResourceChange: (resourceIndex: number, resourceId: string, patch: Partial<EducationResource>) => void;
  onResourceAdd: () => void;
}) {
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
  const selectedResource = resources[selectedResourceIndex] ?? resources[0];
  const validation = useMemo(() => validateDashboardEducation(resources, groups), [resources, groups]);

  function addResource() {
    onResourceAdd();
    setSelectedResourceIndex(resources.length);
  }

  function updateTags(tags: string[]) {
    onResourceChange(selectedResourceIndex, selectedResource.id, { tags });
  }

  function addTag() {
    updateTags([...selectedResource.tags, 'nova-tag']);
  }

  function updateTag(tagIndex: number, value: string) {
    updateTags(selectedResource.tags.map((tag, index) => (index === tagIndex ? value : tag)));
  }

  function removeTag(tagIndex: number) {
    updateTags(selectedResource.tags.filter((_, index) => index !== tagIndex));
  }

  const [newBlockKind, setNewBlockKind] = useState<EducationResourceBlock['kind']>('paragraph');

  if (!selectedResource) {
    return (
      <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <p className="font-body-md text-on-surface-variant">Nenhum material disponível.</p>
        <button
          type="button"
          onClick={addResource}
          className="mt-3 min-h-11 rounded-full bg-primary px-4 font-label-md text-on-primary"
        >
          Novo material
        </button>
      </section>
    );
  }

  const selectedResourceBody = selectedResource.body ?? [
    {
      id: `${selectedResource.id}-overview`,
      kind: 'paragraph',
      title: 'Sobre este material',
      text: 'Descreva aqui o conteúdo principal do material.',
    },
  ];

  const featuredImage = selectedResource.featuredImage ?? {
    kind: 'catalog',
    imageId: defaultFeaturedImageId,
  };

  function updateFeaturedImage(featuredImage: EducationResourceFeaturedImage) {
    onResourceChange(selectedResourceIndex, selectedResource.id, { featuredImage });
  }

  function updateBody(body: EducationResourceBlock[]) {
    onResourceChange(selectedResourceIndex, selectedResource.id, { body });
  }

  function updateBlock(blockId: string, patch: Partial<EducationResourceBlock>) {
    updateBody(selectedResourceBody.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function addBlock() {
    updateBody([...selectedResourceBody, createBodyBlock(newBlockKind, selectedResourceBody.length)]);
  }

  function removeBlock(blockId: string) {
    updateBody(selectedResourceBody.filter((block) => block.id !== blockId));
  }

  function moveBlock(blockIndex: number, direction: -1 | 1) {
    const body = [...selectedResourceBody];
    const nextIndex = blockIndex + direction;
    if (nextIndex < 0 || nextIndex >= body.length) return;
    [body[blockIndex], body[nextIndex]] = [body[nextIndex], body[blockIndex]];
    updateBody(body);
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <h2 className="font-headline-sm text-on-surface">Materiais</h2>
        <button
          type="button"
          onClick={addResource}
          className="mt-3 min-h-11 w-full rounded-full bg-primary px-4 font-label-md text-on-primary"
        >
          Novo material
        </button>
        <div className="mt-3 flex flex-col gap-2">
          {resources.map((resource, resourceIndex) => (
            <button
              key={`${resource.id}-${resourceIndex}`}
              type="button"
              onClick={() => setSelectedResourceIndex(resourceIndex)}
              className={`rounded-lg px-3 py-2 text-left font-label-md ${
                selectedResourceIndex === resourceIndex
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface'
              }`}
            >
              {resource.title}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-col gap-stack-md">
        <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">Dados principais</h2>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Título do material</span>
            <input
              aria-label="Título do material"
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.title}
              onChange={(event) =>
                onResourceChange(selectedResourceIndex, selectedResource.id, { title: event.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Descrição do material</span>
            <textarea
              aria-label="Descrição do material"
              className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
              value={selectedResource.description}
              onChange={(event) =>
                onResourceChange(selectedResourceIndex, selectedResource.id, { description: event.target.value })
              }
            />
            <FieldHint>Resumo curto que aparece na lista de materiais.</FieldHint>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Fonte do material</span>
            <input
              aria-label="Fonte do material"
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.source}
              onChange={(event) =>
                onResourceChange(selectedResourceIndex, selectedResource.id, { source: event.target.value })
              }
            />
            <FieldHint>Nome da organização, autora ou referência principal do material.</FieldHint>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Miniatura da biblioteca</span>
            <input
              aria-label="URL da miniatura da biblioteca"
              className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
              value={selectedResource.imageUrl ?? ''}
              onChange={(event) =>
                onResourceChange(selectedResourceIndex, selectedResource.id, { imageUrl: event.target.value })
              }
            />
            <FieldHint>Imagem pequena usada no cartão da biblioteca de Estudos.</FieldHint>
          </label>

          <fieldset
            aria-label="Imagem principal do material"
            className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 p-4"
          >
            <legend className="font-label-md text-on-surface font-semibold">Imagem principal do material</legend>
            <FieldHint>Imagem grande exibida acima do conteúdo do material.</FieldHint>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 font-label-md text-on-surface">
                <input
                  checked={featuredImage.kind === 'catalog'}
                  name="featured-image-kind"
                  type="radio"
                  onChange={() => updateFeaturedImage({ kind: 'catalog', imageId: defaultFeaturedImageId })}
                />
                Usar imagem padrão
              </label>
              <label className="flex items-center gap-2 font-label-md text-on-surface">
                <input
                  checked={featuredImage.kind === 'external'}
                  name="featured-image-kind"
                  type="radio"
                  onChange={() => updateFeaturedImage({ kind: 'external', imageUrl: selectedResource.imageUrl ?? '' })}
                />
                Usar URL externa
              </label>
            </div>
            {featuredImage.kind === 'catalog' ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {featuredImageOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.alt}
                    aria-pressed={featuredImage.kind === 'catalog' && featuredImage.imageId === option.id}
                    onClick={() => updateFeaturedImage({ kind: 'catalog', imageId: option.id })}
                    className={`h-24 overflow-hidden rounded-xl border-2 ${
                      featuredImage.kind === 'catalog' && featuredImage.imageId === option.id
                        ? 'border-primary'
                        : 'border-transparent'
                    }`}
                  >
                    <img alt="" className="h-full w-full object-cover" src={option.src} />
                  </button>
                ))}
              </div>
            ) : (
              <label className="flex flex-col gap-2">
                <span className="font-label-md text-on-surface font-semibold">URL da imagem principal</span>
                <input
                  aria-label="URL da imagem principal"
                  className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
                  value={featuredImage.kind === 'external' ? featuredImage.imageUrl : ''}
                  onChange={(event) => updateFeaturedImage({ kind: 'external', imageUrl: event.target.value })}
                />
              </label>
            )}
          </fieldset>
          <div>
            <h3 className="font-headline-sm text-on-surface">Tags</h3>
            <FieldHint>Use palavras curtas para ajudar professores a encontrar o material.</FieldHint>
            <div className="mt-3 flex flex-col gap-2">
              {selectedResource.tags.map((tag, tagIndex) => (
                <div key={tagIndex} className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-on-surface">Tag {tagIndex + 1}</span>
                    <input
                      aria-label={`Tag ${tagIndex + 1}`}
                      className="min-h-10 rounded-lg border border-outline-variant bg-surface px-3"
                      value={tag}
                      onChange={(event) => updateTag(tagIndex, event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTag(tagIndex)}
                    className="self-end rounded-full bg-error-container px-4 py-2 font-label-md text-on-error-container"
                  >
                    Remover tag
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTag}
              className="mt-3 min-h-11 rounded-full bg-secondary-container px-4 font-label-md text-on-secondary-container"
            >
              Adicionar tag
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">Conteúdo do material</h2>
          <div className="flex flex-col gap-6">
            {selectedResourceBody.map((block, blockIndex) => {
              const blockNumber = blockIndex + 1;
              return (
                <div key={block.id} className="flex flex-col gap-3 rounded-lg border border-outline-variant/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-on-surface-variant font-semibold">
                      Bloco {blockNumber} — {blockKindLabels[block.kind]}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveBlock(blockIndex, -1)}
                        className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-on-secondary-container"
                        aria-label={`Mover bloco ${blockNumber} para cima`}
                      >
                        Mover para cima
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(blockIndex, 1)}
                        className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-on-secondary-container"
                        aria-label={`Mover bloco ${blockNumber} para baixo`}
                      >
                        Mover para baixo
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="rounded-full bg-error-container px-3 py-1 font-label-sm text-on-error-container"
                        aria-label={`Remover bloco ${blockNumber}`}
                      >
                        Remover bloco
                      </button>
                    </div>
                  </div>
                  <BlockFields
                    block={block}
                    blockNumber={blockNumber}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/30 pt-4">
            <label className="flex flex-col gap-2">
              <span className="font-label-md text-on-surface">Tipo do novo bloco</span>
              <select
                className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
                value={newBlockKind}
                onChange={(event) => setNewBlockKind(event.target.value as EducationResourceBlock['kind'])}
              >
                {Object.entries(blockKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addBlock}
              className="min-h-11 self-start rounded-full bg-primary px-4 font-label-md text-on-primary"
            >
              Adicionar bloco
            </button>
          </div>
        </section>

        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}

function createBodyBlock(kind: EducationResourceBlock['kind'], existingCount: number): EducationResourceBlock {
  const id = `body-block-${Date.now()}-${existingCount + 1}`;

  if (kind === 'heading') return { id, kind, text: 'Novo título' };
  if (kind === 'list') return { id, kind, title: 'Nova lista', items: ['Novo item'] };
  if (kind === 'image') return { id, kind, imageUrl: 'https://example.com/image.jpg', alt: '' };
  if (kind === 'video') return { id, kind, title: 'Novo vídeo', url: 'https://www.youtube.com/watch?v=abcdef12345' };
  if (kind === 'sourceLink') return { id, kind, label: 'Acessar fonte original', url: 'https://example.com' };

  return { id, kind: 'paragraph', title: 'Novo bloco', text: 'Texto do bloco.' };
}

function BlockFields({
  block,
  blockNumber,
  onChange,
}: {
  block: EducationResourceBlock;
  blockNumber: number;
  onChange: (patch: Partial<EducationResourceBlock>) => void;
}) {
  if (block.kind === 'paragraph') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Título do bloco {blockNumber}</span>
          <input
            aria-label={`Título do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do bloco {blockNumber}</span>
          <textarea
            aria-label={`Texto do bloco ${blockNumber}`}
            className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
            value={block.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'heading') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Título do bloco {blockNumber}</span>
          <input
            aria-label={`Título do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'video') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Título do bloco {blockNumber}</span>
          <input
            aria-label={`Título do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL do vídeo do bloco {blockNumber}</span>
          <input
            aria-label={`URL do vídeo do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.url ?? ''}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'image') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL da imagem do bloco {blockNumber}</span>
          <input
            aria-label={`URL da imagem do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.imageUrl ?? ''}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Descrição da imagem do bloco {blockNumber}</span>
          <input
            aria-label={`Descrição da imagem do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.alt ?? ''}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'list') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Itens da lista do bloco {blockNumber}</span>
          <textarea
            aria-label={`Itens da lista do bloco ${blockNumber}`}
            className="min-h-24 rounded-lg border border-outline-variant bg-surface px-3 py-2"
            value={(block.items ?? []).join('\n')}
            onChange={(e) => onChange({ items: e.target.value.split('\n') })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'sourceLink') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do link do bloco {blockNumber}</span>
          <input
            aria-label={`Texto do link do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL da fonte do bloco {blockNumber}</span>
          <input
            aria-label={`URL da fonte do bloco ${blockNumber}`}
            className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
            value={block.url ?? ''}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
      </div>
    );
  }

  return null;
}

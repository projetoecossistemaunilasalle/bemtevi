import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { defaultFeaturedImageId, featuredImageOptions } from '../../content/resources/featuredImages';
import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import type {
  EducationResource,
  EducationResourceBlock,
  EducationResourceFeaturedImage,
} from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { Button } from '../../design-system/components/Button';
import { ChipInput } from '../components/ChipInput';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import {
  inputClass,
  inputClassSm,
  inputInvalidClass,
  textareaClass,
  textareaClassTall,
} from '../components/fieldStyles';
import { ValidationSummary } from '../components/ValidationSummary';
import { issuesForPath } from '../validation/fieldIssues';
import type { FieldIssues } from '../validation/fieldIssues';
import { validateDashboardEducation } from './educationValidation';

const blockKindLabels: Record<EducationResourceBlock['kind'], string> = {
  paragraph: 'Parágrafo',
  heading: 'Título',
  list: 'Lista',
  image: 'Imagem',
  video: 'Vídeo',
  sourceLink: 'Link da fonte',
};

type ManagedEducationGroup = EducationResourceGroup & { isDefault?: boolean };

export function EducationDashboard({
  resources,
  groups,
  defaultGroupOrder = 0,
  onResourceChange,
  onResourceAdd,
  onGroupChange,
  onGroupAdd,
  onGroupRemove,
  onGroupMove,
}: {
  resources: EducationResource[];
  groups: EducationResourceGroup[];
  defaultGroupOrder?: number;
  onResourceChange: (resourceIndex: number, resourceId: string, patch: Partial<EducationResource>) => void;
  onResourceAdd: () => string;
  onGroupChange: (groupIndex: number, groupId: string, patch: Partial<EducationResourceGroup>) => void;
  onGroupAdd: () => void;
  onGroupRemove: (groupIndex: number, groupId: string) => void;
  onGroupMove: (groupIndex: number, direction: -1 | 1) => void;
}) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(() => resources[0]?.id ?? null);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const selectedIndex = useMemo(
    () => resources.findIndex((resource) => resource.id === selectedResourceId),
    [resources, selectedResourceId],
  );
  const validation = useMemo(() => validateDashboardEducation(resources, groups), [resources, groups]);

  // Canonical selection: fall back to the first resource if the selected id is
  // no longer present (e.g. after the data set changes). All field edits and
  // list highlighting key off these two values.
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedResource = resources[effectiveIndex];

  function changeField(patch: Partial<EducationResource>) {
    if (!selectedResource) return;
    onResourceChange(effectiveIndex, selectedResource.id, patch);
  }

  function addResource() {
    const newId = onResourceAdd();
    setSelectedResourceId(newId);
  }

  /** Builds an invalid-aware input className for a given issue set. */
  function fieldClass(issues: FieldIssues, base = inputClass) {
    return issues.errors.length > 0 ? `${base} ${inputInvalidClass}` : base;
  }

  const [newBlockKind, setNewBlockKind] = useState<EducationResourceBlock['kind']>('paragraph');

  const selectedResourceBody = selectedResource
    ? (selectedResource.body ?? [
        {
          id: `${selectedResource.id}-overview`,
          kind: 'paragraph',
          title: 'Sobre este material',
          text: 'Descreva aqui o conteúdo principal do material.',
        },
      ])
    : [];

  const featuredImage = selectedResource?.featuredImage ?? {
    kind: 'catalog',
    imageId: defaultFeaturedImageId,
  };

  function updateFeaturedImage(next: EducationResourceFeaturedImage) {
    changeField({ featuredImage: next });
  }

  function updateBody(body: EducationResourceBlock[]) {
    changeField({ body });
  }

  function updateGroupSelection(groupId: string | undefined) {
    if (groupId === undefined || groupId === DEFAULT_EDUCATION_GROUP_ID) {
      changeField({ group: undefined });
    } else {
      changeField({ group: groupId });
    }
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

  // Path prefix used to scope inline validation issues to the selected resource.
  const resourcePath = selectedResource?.id ?? '';

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <GroupManagementSection
        groups={groups}
        defaultGroupOrder={defaultGroupOrder}
        onGroupChange={onGroupChange}
        onGroupAdd={onGroupAdd}
        onGroupRemove={onGroupRemove}
        onGroupMove={onGroupMove}
        groupsExpanded={groupsExpanded}
        onToggleExpanded={() => setGroupsExpanded((current) => !current)}
      />

      {!selectedResource ? (
        <section className="lg:col-span-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <p className="font-body-md text-on-surface-variant">Nenhum material disponível.</p>
          <Button className="mt-3" onClick={addResource}>
            Novo material
          </Button>
        </section>
      ) : (
        <>
          <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
            <h2 className="font-headline-sm text-on-surface">Materiais</h2>
            <Button className="mt-3 w-full" onClick={addResource}>
              Novo material
            </Button>
            <div className="mt-3 flex flex-col gap-2">
              {resources.map((resource, resourceIndex) => (
                <button
                  key={`${resource.id}-${resourceIndex}`}
                  type="button"
                  onClick={() => setSelectedResourceId(resource.id)}
                  className={`rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                    resource.id === selectedResource.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
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
              <Field label="Título do material" issues={issuesForPath(validation, `${resourcePath}.title`)}>
                <input
                  aria-label="Título do material"
                  className={fieldClass(issuesForPath(validation, `${resourcePath}.title`))}
                  value={selectedResource.title}
                  onChange={(event) => changeField({ title: event.target.value })}
                />
              </Field>
              <Field
                label="Descrição do material"
                hint="Resumo curto que aparece na lista de materiais."
                issues={issuesForPath(validation, `${resourcePath}.description`)}
              >
                <textarea
                  aria-label="Descrição do material"
                  className={fieldClass(issuesForPath(validation, `${resourcePath}.description`), textareaClassTall)}
                  value={selectedResource.description}
                  onChange={(event) => changeField({ description: event.target.value })}
                />
              </Field>
              <Field
                label="Fonte do material"
                hint="Nome da organização, autora ou referência principal do material."
                issues={issuesForPath(validation, `${resourcePath}.source`)}
              >
                <input
                  aria-label="Fonte do material"
                  className={fieldClass(issuesForPath(validation, `${resourcePath}.source`))}
                  value={selectedResource.source}
                  onChange={(event) => changeField({ source: event.target.value })}
                />
              </Field>

              <Field label="Miniatura da biblioteca" hint="Imagem pequena usada no cartão da biblioteca de Estudos.">
                <input
                  aria-label="URL da miniatura da biblioteca"
                  className={inputClass}
                  value={selectedResource.imageUrl ?? ''}
                  onChange={(event) => changeField({ imageUrl: event.target.value })}
                />
              </Field>

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
                      onChange={() =>
                        updateFeaturedImage({ kind: 'external', imageUrl: selectedResource.imageUrl ?? '' })
                      }
                    />
                    Usar URL externa
                  </label>
                </div>
                {featuredImage.kind === 'catalog' ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {featuredImageOptions.map((option) => {
                      const isActive = featuredImage.kind === 'catalog' && featuredImage.imageId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-label={option.alt}
                          aria-pressed={isActive}
                          onClick={() => updateFeaturedImage({ kind: 'catalog', imageId: option.id })}
                          className={`relative h-24 overflow-hidden rounded-xl border-2 transition-all ${
                            isActive
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-transparent hover:border-outline-variant'
                          }`}
                        >
                          <img alt="" className="h-full w-full object-cover" src={option.src} />
                          {isActive && (
                            <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
                              <Check aria-hidden="true" className="h-4 w-4" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Field
                    label="URL da imagem principal"
                    issues={issuesForPath(validation, `${resourcePath}.featuredImage`)}
                  >
                    <input
                      aria-label="URL da imagem principal"
                      className={fieldClass(issuesForPath(validation, `${resourcePath}.featuredImage`))}
                      value={featuredImage.kind === 'external' ? featuredImage.imageUrl : ''}
                      onChange={(event) => updateFeaturedImage({ kind: 'external', imageUrl: event.target.value })}
                    />
                  </Field>
                )}
              </fieldset>
              <Field label="Grupo do material" hint="Categoria que agrupa este material junto com outros relacionados.">
                <select
                  aria-label="Grupo do material"
                  className={inputClass}
                  value={selectedResource.group ?? DEFAULT_EDUCATION_GROUP_ID}
                  onChange={(event) => updateGroupSelection(event.target.value || undefined)}
                >
                  <option value={DEFAULT_EDUCATION_GROUP_ID}>Geral</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-col gap-2">
                <span className="font-label-md text-on-surface">Tags</span>
                <FieldHint>Use palavras curtas para ajudar professores a encontrar o material.</FieldHint>
                <ChipInput
                  aria-label="Tags do material"
                  placeholder="Digite uma tag e pressione Enter"
                  values={selectedResource.tags}
                  onChange={(tags) => changeField({ tags })}
                />
              </div>
            </section>

            <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
              <h2 className="font-headline-sm text-on-surface">Conteúdo do material</h2>
              <div className="flex flex-col gap-6">
                {selectedResourceBody.map((block, blockIndex) => {
                  const blockNumber = blockIndex + 1;
                  const blockIssues = issuesForPath(validation, `${resourcePath}.body.${block.id}`);
                  return (
                    <div key={block.id} className="flex flex-col gap-3 rounded-lg border border-outline-variant/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-label-md text-on-surface-variant font-semibold">
                          Bloco {blockNumber} — {blockKindLabels[block.kind]}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveBlock(blockIndex, -1)}
                            aria-label={`Mover bloco ${blockNumber} para cima`}
                          >
                            Mover para cima
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => moveBlock(blockIndex, 1)}
                            aria-label={`Mover bloco ${blockNumber} para baixo`}
                          >
                            Mover para baixo
                          </Button>
                          <ConfirmButton
                            prompt="Remover bloco"
                            confirmLabel="Confirmar"
                            onConfirm={() => removeBlock(block.id)}
                            aria-label={`Remover bloco ${blockNumber}`}
                            className="rounded-full bg-error-container px-4 py-2 font-label-sm text-on-error-container transition-colors hover:bg-error-container/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                          />
                        </div>
                      </div>
                      <BlockFields
                        block={block}
                        blockNumber={blockNumber}
                        invalid={blockIssues.errors.length > 0}
                        onChange={(patch) => updateBlock(block.id, patch)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/30 pt-4">
                <Field label="Tipo do novo bloco">
                  <select
                    aria-label="Tipo do novo bloco"
                    className={inputClass}
                    value={newBlockKind}
                    onChange={(event) => setNewBlockKind(event.target.value as EducationResourceBlock['kind'])}
                  >
                    {Object.entries(blockKindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button onClick={addBlock} className="self-start">
                  Adicionar bloco
                </Button>
              </div>
            </section>

            <ValidationSummary result={validation} />
          </div>
        </>
      )}
    </section>
  );
}

function getManagedGroups(groups: EducationResourceGroup[], defaultGroupOrder: number): ManagedEducationGroup[] {
  return [
    {
      id: DEFAULT_EDUCATION_GROUP_ID,
      title: 'Geral',
      description: 'Grupo padrão para materiais sem categoria específica.',
      order: defaultGroupOrder,
      isDefault: true,
    },
    ...groups,
  ].sort((left, right) => left.order - right.order);
}

function GroupManagementSection({
  groups,
  defaultGroupOrder,
  groupsExpanded,
  onGroupChange,
  onGroupAdd,
  onGroupRemove,
  onGroupMove,
  onToggleExpanded,
}: {
  groups: EducationResourceGroup[];
  defaultGroupOrder: number;
  groupsExpanded: boolean;
  onGroupChange: (groupIndex: number, groupId: string, patch: Partial<EducationResourceGroup>) => void;
  onGroupAdd: () => void;
  onGroupRemove: (groupIndex: number, groupId: string) => void;
  onGroupMove: (groupIndex: number, direction: -1 | 1) => void;
  onToggleExpanded: () => void;
}) {
  return (
    <section className="lg:col-span-2 flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <button
        type="button"
        aria-expanded={groupsExpanded}
        aria-controls="education-group-management-content"
        aria-label={`Gerenciar grupos de materiais (${groupsExpanded ? 'ocultar' : 'mostrar'})`}
        onClick={onToggleExpanded}
        className="flex items-center justify-between font-headline-sm text-on-surface"
      >
        <span>Grupos de materiais</span>
        <span className="font-label-md">{groupsExpanded ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      <FieldHint>Gerencie os grupos usados para organizar os materiais no Dashboard.</FieldHint>

      {groupsExpanded && (
        <div id="education-group-management-content" className="mt-3 flex flex-col gap-3">
          {(() => {
            const managedGroups = getManagedGroups(groups, defaultGroupOrder);

            return managedGroups.map((group, groupIndex) => {
              const isDefault = group.isDefault === true;

              return (
                <div
                  key={group.id}
                  className="grid gap-3 rounded-lg border border-outline-variant/30 p-3 md:grid-cols-[1fr_auto]"
                >
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-on-surface-variant">Título</span>
                      <input
                        aria-label={`Título do grupo ${group.title}`}
                        className={inputClassSm}
                        value={group.title}
                        disabled={isDefault}
                        onChange={(event) => onGroupChange(groupIndex, group.id, { title: event.target.value })}
                      />
                    </label>
                    {isDefault ? (
                      <FieldHint>
                        Geral é o grupo padrão para materiais sem categoria específica. Ele não pode ser removido porque
                        garante que todo material tenha uma seção padrão.
                      </FieldHint>
                    ) : (
                      <label className="flex flex-col gap-1">
                        <span className="font-label-sm text-on-surface-variant">Descrição opcional</span>
                        <textarea
                          aria-label={`Descrição do grupo ${group.title}`}
                          className={textareaClass}
                          value={group.description ?? ''}
                          onChange={(event) => onGroupChange(groupIndex, group.id, { description: event.target.value })}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={groupIndex === 0}
                      onClick={() => onGroupMove(isDefault ? -1 : groupIndex - 1, -1)}
                      aria-label={`Mover grupo ${group.title} para cima`}
                    >
                      Mover para cima
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={groupIndex === managedGroups.length - 1}
                      onClick={() => onGroupMove(isDefault ? -1 : groupIndex - 1, 1)}
                      aria-label={`Mover grupo ${group.title} para baixo`}
                    >
                      Mover para baixo
                    </Button>
                    {!isDefault && (
                      <ConfirmButton
                        prompt="Remover"
                        confirmLabel="Confirmar"
                        onConfirm={() => onGroupRemove(groupIndex, group.id)}
                        aria-label={`Remover grupo ${group.title}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-error-container px-4 py-2 font-label-md text-on-error-container transition-colors hover:bg-error-container/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                      />
                    )}
                    {isDefault && <span className="font-label-sm text-on-surface-variant">Grupo padrão</span>}
                  </div>
                </div>
              );
            });
          })()}
          <Button onClick={onGroupAdd} className="self-start">
            Novo grupo
          </Button>
        </div>
      )}
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
  invalid = false,
  onChange,
}: {
  block: EducationResourceBlock;
  blockNumber: number;
  invalid?: boolean;
  onChange: (patch: Partial<EducationResourceBlock>) => void;
}) {
  const baseInput = invalid ? `${inputClass} ${inputInvalidClass}` : inputClass;
  const baseTextarea = invalid ? `${textareaClassTall} ${inputInvalidClass}` : textareaClassTall;

  if (block.kind === 'paragraph') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Título do bloco {blockNumber}</span>
          <input
            aria-label={`Título do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do bloco {blockNumber}</span>
          <textarea
            aria-label={`Texto do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseTextarea}
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
            aria-invalid={invalid || undefined}
            className={baseInput}
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
            className={baseInput}
            value={block.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL do vídeo do bloco {blockNumber}</span>
          <input
            aria-label={`URL do vídeo do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
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
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.imageUrl ?? ''}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Descrição da imagem do bloco {blockNumber}</span>
          <input
            aria-label={`Descrição da imagem do bloco ${blockNumber}`}
            className={baseInput}
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
            aria-invalid={invalid || undefined}
            className={baseTextarea}
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
            className={baseInput}
            value={block.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL da fonte do bloco {blockNumber}</span>
          <input
            aria-label={`URL da fonte do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.url ?? ''}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
      </div>
    );
  }

  return null;
}

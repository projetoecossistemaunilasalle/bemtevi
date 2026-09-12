import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EducationResourceBlock } from '../../domain/resources/types';
import { Button } from '../../design-system/components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { inputClass } from '../components/fieldStyles';
import { issuesForPath } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { EducationBlockFields } from './EducationBlockFields';

const blockKindLabels: Record<EducationResourceBlock['kind'], string> = {
  paragraph: 'Parágrafo',
  heading: 'Título',
  list: 'Lista',
  image: 'Imagem',
  video: 'Vídeo',
  pdf: 'PDF incorporado',
  sourceLink: 'Link da fonte',
  link: 'Link',
};

export function EducationBodyEditor({
  body,
  resourcePath,
  validation,
  focusRequest,
  onChange,
  readImageFile,
}: {
  body: EducationResourceBlock[];
  resourcePath: string;
  validation: DashboardValidationResult;
  focusRequest?: { blockId: string; requestId: number } | null;
  onChange: (body: EducationResourceBlock[]) => void;
  readImageFile: (file: File, path: string) => Promise<string | null>;
}) {
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(() => new Set());
  const [newBlockKind, setNewBlockKind] = useState<EducationResourceBlock['kind']>('paragraph');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!focusRequest?.blockId) return;
    setCollapsedBlockIds((current) => {
      const next = new Set(current);
      next.delete(focusRequest.blockId);
      return next;
    });
  }, [focusRequest?.blockId, focusRequest?.requestId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleBlock(blockId: string) {
    setCollapsedBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  function updateBlock(blockId: string, patch: Partial<EducationResourceBlock>) {
    onChange(body.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function addBlock() {
    const block = createBodyBlock(newBlockKind, body.length);
    onChange([...body, block]);
    setCollapsedBlockIds((current) => {
      const next = new Set(current);
      next.delete(block.id);
      return next;
    });
  }

  function moveBlock(blockIndex: number, direction: -1 | 1) {
    const nextIndex = blockIndex + direction;
    if (nextIndex < 0 || nextIndex >= body.length) return;
    const nextBody = [...body];
    [nextBody[blockIndex], nextBody[nextIndex]] = [nextBody[nextIndex], nextBody[blockIndex]];
    onChange(nextBody);
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-sm text-on-surface">Conteúdo do material</h2>
          <p className="font-label-sm text-on-surface-variant">
            {body.length === 1 ? '1 bloco de conteúdo' : `${body.length} blocos de conteúdo`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCollapsedBlockIds(new Set())}>
            Expandir todos
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCollapsedBlockIds(new Set(body.map((block) => block.id)))}
          >
            Recolher todos
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {body.map((block, blockIndex) => (
          <EducationBodyBlock
            key={block.id}
            block={block}
            blockIndex={blockIndex}
            blockCount={body.length}
            expanded={!collapsedBlockIds.has(block.id)}
            invalid={issuesForPath(validation, `${resourcePath}.body.${block.id}`).errors.length > 0}
            validationPath={`${resourcePath}.body.${block.id}`}
            onToggle={() => toggleBlock(block.id)}
            onMove={(direction) => moveBlock(blockIndex, direction)}
            onRemove={() => onChange(body.filter((candidate) => candidate.id !== block.id))}
            onChange={(patch) => updateBlock(block.id, patch)}
            readImageFile={readImageFile}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-outline-variant/30 pt-4">
        <Field label="Tipo do novo bloco" className="flex-1 min-w-[200px]">
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
  );
}

function EducationBodyBlock({
  block,
  blockIndex,
  blockCount,
  expanded,
  invalid,
  validationPath,
  onToggle,
  onMove,
  onRemove,
  onChange,
  readImageFile,
}: {
  block: EducationResourceBlock;
  blockIndex: number;
  blockCount: number;
  expanded: boolean;
  invalid: boolean;
  validationPath: string;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onChange: (patch: Partial<EducationResourceBlock>) => void;
  readImageFile: (file: File, path: string) => Promise<string | null>;
}) {
  const blockNumber = blockIndex + 1;
  return (
    <div
      data-validation-path={validationPath}
      className={`flex flex-col rounded-lg border transition-all ${expanded ? 'border-primary/40 bg-surface-container-lowest shadow-sm' : 'border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-low/80'}`}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 p-3.5 cursor-pointer select-none"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest('[data-no-toggle]')) onToggle();
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Bloco ${blockNumber}: ${blockKindLabels[block.kind]}`}
        onKeyDown={(event) => {
          if (
            (event.key === 'Enter' || event.key === ' ') &&
            !(event.target as HTMLElement).closest('[data-no-toggle]')
          ) {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-label-sm font-bold text-primary">
            {blockNumber}
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-label-md font-semibold text-on-surface">{blockKindLabels[block.kind]}</span>
              {invalid ? (
                <span className="rounded bg-error-container px-2 py-0.5 font-label-sm text-on-error-container font-medium">
                  Erro
                </span>
              ) : null}
            </div>
            <span className="font-body-sm text-on-surface-variant truncate">{getBlockSummary(block)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" data-no-toggle>
          <Button
            variant="secondary"
            size="sm"
            disabled={blockIndex === 0}
            onClick={() => onMove(-1)}
            aria-label={`Mover bloco ${blockNumber} para cima`}
            title="Mover para cima"
          >
            <ChevronUp className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only">Cima</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={blockIndex === blockCount - 1}
            onClick={() => onMove(1)}
            aria-label={`Mover bloco ${blockNumber} para baixo`}
            title="Mover para baixo"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only">Baixo</span>
          </Button>
          <ConfirmButton
            prompt="Remover bloco"
            confirmLabel="Confirmar"
            onConfirm={onRemove}
            aria-label={`Remover bloco ${blockNumber}`}
            className="rounded-full bg-error-container px-3 py-1.5 font-label-sm text-on-error-container transition-colors hover:bg-error-container/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          />
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label={expanded ? 'Recolher bloco' : 'Expandir bloco'}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-outline-variant/30 p-4 bg-surface-container-lowest rounded-b-lg">
          <EducationBlockFields
            block={block}
            blockNumber={blockNumber}
            invalid={invalid}
            onChange={onChange}
            readImageFile={readImageFile}
            validationPath={validationPath}
          />
        </div>
      ) : null}
    </div>
  );
}

function getBlockSummary(block: EducationResourceBlock): string {
  if (block.kind === 'paragraph') return block.title || block.text || 'Parágrafo sem texto';
  if (block.kind === 'heading') return block.text || 'Título sem texto';
  if (block.kind === 'video') return block.title || block.url || 'Vídeo sem URL';
  if (block.kind === 'pdf') return block.title || block.url || 'PDF sem URL';
  if (block.kind === 'image') {
    if (block.imageFileName) return `Imagem: ${block.imageFileName}`;
    if (block.alt) return `Imagem: ${block.alt}`;
    if (block.imageUrl) return `Imagem: ${block.imageUrl.slice(0, 40)}...`;
    return 'Imagem sem arquivo ou URL';
  }
  if (block.kind === 'list') {
    const count = block.items?.length ?? 0;
    return `${block.title ? `${block.title} • ` : ''}${count} ${count === 1 ? 'item' : 'itens'}`;
  }
  return block.label || block.url || (block.kind === 'sourceLink' ? 'Link de fonte' : 'Link');
}

function createBodyBlock(kind: EducationResourceBlock['kind'], existingCount: number): EducationResourceBlock {
  const id = `body-block-${crypto.randomUUID()}-${existingCount + 1}`;
  if (kind === 'heading') return { id, kind, text: 'Novo título' };
  if (kind === 'list') return { id, kind, title: 'Nova lista', items: ['Novo item'] };
  if (kind === 'image') return { id, kind, imageUrl: '', alt: '' };
  if (kind === 'video') return { id, kind, title: 'Novo vídeo', url: 'https://www.youtube.com/watch?v=abcdef12345' };
  if (kind === 'pdf') return { id, kind, title: 'Novo PDF', url: 'https://example.com/documento.pdf' };
  if (kind === 'sourceLink') return { id, kind, label: 'Acessar fonte original', url: 'https://example.com' };
  if (kind === 'link') return { id, kind, label: 'Formulário', url: 'https://example.com' };
  return { id, kind: 'paragraph', title: 'Novo bloco', text: 'Texto do bloco.' };
}

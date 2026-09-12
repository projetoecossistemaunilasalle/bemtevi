import { ExternalLink } from 'lucide-react';
import type { EducationResourceBlock } from '../../domain/resources/types';
import { Button } from '../../design-system/components/Button';
import { FieldHint } from '../components/FieldHint';
import { acceptImageTypes } from '../components/fileUpload';
import { inputClass, inputInvalidClass, textareaClassTall } from '../components/fieldStyles';
import { isUploadedImageValue, uploadedImageInputLabel } from './educationImageValue';

export function EducationBlockFields({
  block,
  blockNumber,
  invalid = false,
  onChange,
  readImageFile,
  validationPath,
}: {
  block: EducationResourceBlock;
  blockNumber: number;
  invalid?: boolean;
  onChange: (patch: Partial<EducationResourceBlock>) => void;
  readImageFile: (file: File, path: string) => Promise<string | null>;
  validationPath: string;
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
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do bloco {blockNumber}</span>
          <textarea
            data-validation-path={validationPath}
            aria-label={`Texto do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseTextarea}
            value={block.text ?? ''}
            onChange={(event) => onChange({ text: event.target.value })}
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
            data-validation-path={validationPath}
            aria-label={`Título do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.text ?? ''}
            onChange={(event) => onChange({ text: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'video' || block.kind === 'pdf') {
    const isPdf = block.kind === 'pdf';
    const titleLabel = `${isPdf ? 'Título do PDF do bloco' : 'Título do bloco'} ${blockNumber}`;
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">{titleLabel}</span>
          <input
            aria-label={titleLabel}
            className={baseInput}
            value={block.title ?? ''}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">
            {isPdf ? 'URL direta do PDF' : 'URL do vídeo'} do bloco {blockNumber}
          </span>
          <input
            data-validation-path={`${validationPath}.url`}
            aria-label={`${isPdf ? 'URL do PDF' : 'URL do vídeo'} do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.url ?? ''}
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </label>
        {isPdf && (
          <FieldHint>
            Use uma URL pública direta para o arquivo PDF. Se a fonte bloquear incorporação, o leitor poderá abrir o
            documento em outra aba.
          </FieldHint>
        )}
      </div>
    );
  }

  if (block.kind === 'image') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL da imagem do bloco {blockNumber}</span>
          <input
            data-validation-path={`${validationPath}.imageUrl`}
            aria-label={`URL da imagem do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            disabled={isUploadedImageValue(block.imageUrl)}
            value={
              isUploadedImageValue(block.imageUrl)
                ? uploadedImageInputLabel(block.imageFileName)
                : (block.imageUrl ?? '')
            }
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
        </label>
        {isUploadedImageValue(block.imageUrl) ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="self-start"
            onClick={() => onChange({ imageUrl: '', imageFileName: '' })}
          >
            Deletar imagem do bloco {blockNumber}
          </Button>
        ) : (
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-low hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <input
              type="file"
              accept={acceptImageTypes()}
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const dataUrl = await readImageFile(file, `${validationPath}.imageUrl`);
                if (dataUrl) onChange({ imageUrl: dataUrl, imageFileName: file.name });
                event.target.value = '';
              }}
            />
            {block.imageUrl ? 'Trocar imagem do bloco' : 'Enviar imagem do bloco'}
          </label>
        )}
        {block.imageUrl ? (
          <div className="h-40 w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
            <img alt={block.alt ?? ''} className="h-full w-full object-cover" src={block.imageUrl} />
          </div>
        ) : null}
        {block.imageFileName ? (
          <p className="font-label-sm text-on-surface-variant">Arquivo enviado: {block.imageFileName}</p>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Descrição da imagem do bloco {blockNumber}</span>
          <input
            aria-label={`Descrição da imagem do bloco ${blockNumber}`}
            className={baseInput}
            value={block.alt ?? ''}
            onChange={(event) => onChange({ alt: event.target.value })}
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
            data-validation-path={validationPath}
            aria-label={`Itens da lista do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseTextarea}
            value={(block.items ?? []).join('\n')}
            onChange={(event) => onChange({ items: event.target.value.split('\n') })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'sourceLink') {
    return (
      <div data-validation-path={validationPath} className="dashboard-validation-target flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto da fonte / Citação ABNT do bloco {blockNumber}</span>
          <textarea
            aria-label={`Texto do link do bloco ${blockNumber}`}
            className={baseTextarea}
            value={block.label ?? ''}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL direta da fonte (opcional se houver citação ABNT)</span>
          <input
            data-validation-path={`${validationPath}.url`}
            aria-label={`URL da fonte do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.url ?? ''}
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.kind === 'link') {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">Texto do link do bloco {blockNumber} (ex: Formulário)</span>
          <input
            data-validation-path={`${validationPath}.label`}
            aria-label={`Texto do link do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.label ?? ''}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-on-surface">URL do link do bloco {blockNumber}</span>
          <input
            data-validation-path={`${validationPath}.url`}
            aria-label={`URL do link do bloco ${blockNumber}`}
            aria-invalid={invalid || undefined}
            className={baseInput}
            value={block.url ?? ''}
            onChange={(event) => onChange({ url: event.target.value })}
          />
        </label>
        {block.label ? (
          <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
            <span className="font-label-sm text-on-surface-variant font-medium">Pré-visualização no material:</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 font-label-md font-semibold text-primary self-start">
              <span>{block.label}</span>
              <ExternalLink size={16} />
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

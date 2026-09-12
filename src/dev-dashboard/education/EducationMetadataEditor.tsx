import { useMemo, type ReactNode } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import { Badge } from '../../design-system/components/Badge';
import { Button } from '../../design-system/components/Button';
import { formatCitationSourceLabel, parseSourceCitations } from '../../features/education/sourceFormatter';
import { ChipInput } from '../components/ChipInput';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClass, inputInvalidClass, textareaClass, textareaClassTall } from '../components/fieldStyles';
import { acceptImageTypes } from '../components/fileUpload';
import { issuesForPath, type FieldIssues } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';
import {
  isPublicImagePath,
  isUploadedImageValue,
  publicImageInputLabel,
  uploadedImageInputLabel,
} from './educationImageValue';

export function EducationMetadataEditor({
  resource,
  resourceIndex,
  groups,
  validation,
  onChange,
  onRemove,
  readImageFile,
  featuredImageEditor,
}: {
  resource: EducationResource;
  resourceIndex: number;
  groups: EducationResourceGroup[];
  validation: DashboardValidationResult;
  onChange: (patch: Partial<EducationResource>) => void;
  onRemove: () => void;
  readImageFile: (file: File, path: string) => Promise<string | null>;
  featuredImageEditor: ReactNode;
}) {
  const resourcePath = resource.id;

  function updateGroupSelection(groupId: string | undefined) {
    onChange({ group: groupId === undefined || groupId === DEFAULT_EDUCATION_GROUP_ID ? undefined : groupId });
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-sm text-on-surface">Dados principais</h2>
        <ConfirmButton
          key={`${resourceIndex}-${resource.id}`}
          prompt="Remover material"
          onConfirm={onRemove}
          aria-label={`Remover material ${resource.title || 'sem título'}`}
        />
      </div>
      <Field
        label="Título do material"
        issues={issuesForPath(validation, `${resourcePath}.title`)}
        validationPath={`${resourcePath}.title`}
      >
        <input
          aria-label="Título do material"
          className={fieldClass(issuesForPath(validation, `${resourcePath}.title`))}
          value={resource.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Field>
      <Field
        label="Descrição do material"
        hint="Resumo curto que aparece na lista de materiais."
        issues={issuesForPath(validation, `${resourcePath}.description`)}
        validationPath={`${resourcePath}.description`}
      >
        <textarea
          aria-label="Descrição do material"
          className={fieldClass(issuesForPath(validation, `${resourcePath}.description`), textareaClassTall)}
          value={resource.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>
      <Field
        label="Fonte do material"
        hint="Fontes e referências bibliográficas no padrão ABNT. Separe múltiplas fontes com barra (/) ou quebra de linha. Links inseridos no texto serão detectados automaticamente."
        issues={issuesForPath(validation, `${resourcePath}.source`)}
        validationPath={`${resourcePath}.source`}
      >
        <textarea
          aria-label="Fonte do material"
          className={fieldClass(issuesForPath(validation, `${resourcePath}.source`), textareaClass)}
          rows={3}
          value={resource.source}
          onChange={(event) => onChange({ source: event.target.value })}
        />
        <SourceCardPreview sourceText={resource.source} />
      </Field>
      <Field
        label="Miniatura da biblioteca"
        hint="Imagem pequena usada no cartão da biblioteca de materiais."
        issues={issuesForPath(validation, `${resourcePath}.imageUrl`)}
        validationPath={`${resourcePath}.imageUrl`}
      >
        <div className="flex gap-2">
          <input
            aria-label="URL da miniatura da biblioteca"
            className={`${inputClass} flex-1`}
            disabled={isUploadedImageValue(resource.imageUrl) || isPublicImagePath(resource.imageUrl)}
            value={thumbnailInputValue(resource)}
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
          {isUploadedImageValue(resource.imageUrl) ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onChange({ imageUrl: '', imageFileName: '' })}
            >
              Deletar miniatura da biblioteca
            </Button>
          ) : (
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-sm font-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-low hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <input
                type="file"
                accept={acceptImageTypes()}
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await readImageFile(file, `${resourcePath}.imageUrl`);
                  if (dataUrl) onChange({ imageUrl: dataUrl, imageFileName: file.name });
                  event.target.value = '';
                }}
              />
              Enviar imagem
            </label>
          )}
        </div>
        {resource.imageUrl ? (
          <div className="h-32 w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
            <img alt="Miniatura da biblioteca" className="h-full w-full object-cover" src={resource.imageUrl} />
          </div>
        ) : null}
        {resource.imageFileName ? (
          <p className="font-label-sm text-on-surface-variant">Arquivo enviado: {resource.imageFileName}</p>
        ) : null}
      </Field>
      {featuredImageEditor}
      <Field
        label="Grupo do material"
        hint="Categoria que agrupa este material junto com outros relacionados."
        issues={issuesForPath(validation, `${resourcePath}.group`)}
        validationPath={`${resourcePath}.group`}
      >
        <select
          aria-label="Grupo do material"
          className={inputClass}
          value={resource.group ?? DEFAULT_EDUCATION_GROUP_ID}
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
      <div data-validation-path={`${resourcePath}.tags`} className="dashboard-validation-target flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Marcadores</span>
        <FieldHint>Use palavras curtas para ajudar professores a encontrar o material.</FieldHint>
        <ChipInput
          aria-label="Marcadores do material"
          placeholder="Digite um marcador e pressione Enter"
          values={resource.tags}
          onChange={(tags) => onChange({ tags })}
        />
      </div>
    </section>
  );
}

function SourceCardPreview({ sourceText }: { sourceText?: string }) {
  const citations = useMemo(() => parseSourceCitations(sourceText), [sourceText]);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3.5">
      <div className="flex items-center justify-between font-label-sm text-on-surface-variant font-semibold">
        <span>Pré-visualização da fonte no cartão</span>
        <span className="font-label-sm text-on-surface-variant/75">
          {citations.length === 1 ? '1 fonte' : `${citations.length} fontes`}
        </span>
      </div>
      {citations.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant/70 italic">
          Nenhuma fonte inserida. As citações e os selos do cartão aparecerão aqui.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2" aria-label="Pré-visualização dos selos no cartão">
            <span className="font-label-sm text-on-surface-variant">Selo no cartão:</span>
            {citations.map((citation) => (
              <span key={citation.id} title={citation.rawText}>
                <Badge tone="secondary">{formatCitationSourceLabel(citation.rawText)}</Badge>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-outline-variant/20 pt-2">
            <span className="font-label-sm text-on-surface-variant font-medium">Citações e links reconhecidos:</span>
            <ul className="flex flex-col gap-1.5 font-body-sm text-on-surface-variant">
              {citations.map((citation) => (
                <li
                  key={citation.id}
                  className="flex flex-col gap-1 rounded bg-surface-container-lowest p-2 border border-outline-variant/20"
                >
                  <span className="line-clamp-2">{citation.rawText}</span>
                  {citation.segments.some((segment) => segment.kind === 'link') ? (
                    <div className="flex flex-wrap gap-2 text-primary font-label-sm">
                      {citation.segments
                        .filter((segment) => segment.kind === 'link')
                        .map((segment, index) => (
                          <span key={index} className="underline underline-offset-2">
                            🔗 {segment.url}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function fieldClass(issues: FieldIssues, base = inputClass) {
  return issues.errors.length > 0 ? `${base} ${inputInvalidClass}` : base;
}

function thumbnailInputValue(resource: EducationResource) {
  if (isUploadedImageValue(resource.imageUrl)) return uploadedImageInputLabel(resource.imageFileName);
  if (isPublicImagePath(resource.imageUrl)) return publicImageInputLabel(resource.imageUrl);
  return resource.imageUrl ?? '';
}

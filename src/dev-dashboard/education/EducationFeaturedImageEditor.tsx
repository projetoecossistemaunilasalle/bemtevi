import { Check } from 'lucide-react';
import { defaultFeaturedImageId, featuredImageOptions } from '../../content/resources/featuredImages';
import type { EducationResource, EducationResourceFeaturedImage } from '../../domain/resources/types';
import { Button } from '../../design-system/components/Button';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClass, inputInvalidClass } from '../components/fieldStyles';
import { acceptImageTypes } from '../components/fileUpload';
import { issuesForPath } from '../validation/fieldIssues';
import type { DashboardValidationResult } from '../validation/validationTypes';

export function EducationFeaturedImageEditor({
  resource,
  validation,
  onChange,
  readImageFile,
}: {
  resource: EducationResource;
  validation: DashboardValidationResult;
  onChange: (featuredImage: EducationResourceFeaturedImage) => void;
  readImageFile: (file: File, path: string) => Promise<string | null>;
}) {
  const resourcePath = resource.id;
  const featuredImage = resource.featuredImage ?? { kind: 'catalog', imageId: defaultFeaturedImageId };
  const featuredImageIssues = issuesForPath(validation, `${resourcePath}.featuredImage`);

  return (
    <fieldset
      data-validation-path={`${resourcePath}.featuredImage`}
      aria-label="Imagem principal do material"
      className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 p-4"
    >
      <legend className="font-label-md text-on-surface font-semibold">Imagem principal do material</legend>
      <FieldHint>Imagem grande exibida acima do conteúdo do material.</FieldHint>
      <div className="flex flex-wrap gap-3">
        <ImageKindOption
          checked={featuredImage.kind === 'catalog'}
          label="Usar imagem padrão"
          onChange={() => onChange({ kind: 'catalog', imageId: defaultFeaturedImageId })}
        />
        <ImageKindOption
          checked={featuredImage.kind === 'external'}
          label="Usar URL externa"
          onChange={() => onChange({ kind: 'external', imageUrl: resource.imageUrl ?? '' })}
        />
        <ImageKindOption
          checked={featuredImage.kind === 'uploaded'}
          label="Enviar do computador"
          onChange={() => onChange({ kind: 'uploaded', dataUrl: '', fileName: '' })}
        />
      </div>
      {featuredImage.kind === 'catalog' ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {featuredImageOptions.map((option) => {
            const isActive = featuredImage.imageId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-label={option.alt}
                aria-pressed={isActive}
                onClick={() => onChange({ kind: 'catalog', imageId: option.id })}
                className={`relative h-24 overflow-hidden rounded-xl border-2 transition-all ${
                  isActive ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-outline-variant'
                }`}
              >
                <img alt="" className="h-full w-full object-cover" src={option.src} />
                {isActive ? (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : featuredImage.kind === 'uploaded' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-low hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <input
                type="file"
                accept={acceptImageTypes()}
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await readImageFile(file, `${resourcePath}.featuredImage`);
                  if (dataUrl) onChange({ kind: 'uploaded', dataUrl, fileName: file.name });
                  event.target.value = '';
                }}
              />
              {featuredImage.dataUrl ? 'Trocar imagem' : 'Escolher imagem'}
            </label>
            {featuredImage.dataUrl ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => onChange({ kind: 'catalog', imageId: defaultFeaturedImageId })}
              >
                Deletar imagem principal
              </Button>
            ) : null}
          </div>
          {featuredImage.dataUrl ? (
            <div className="h-48 w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
              <img alt={featuredImage.alt ?? ''} className="h-full w-full object-cover" src={featuredImage.dataUrl} />
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">Nenhuma imagem selecionada.</p>
          )}
          {featuredImage.fileName ? (
            <p className="font-label-sm text-on-surface-variant">Arquivo enviado: {featuredImage.fileName}</p>
          ) : null}
          <Field label="Descrição da imagem (acessibilidade)">
            <input
              aria-label="Descrição da imagem principal"
              className={inputClass}
              value={featuredImage.alt ?? ''}
              onChange={(event) => onChange({ ...featuredImage, alt: event.target.value })}
            />
          </Field>
        </div>
      ) : (
        <Field
          label="URL da imagem principal"
          issues={featuredImageIssues}
          validationPath={`${resourcePath}.featuredImage`}
        >
          <input
            aria-label="URL da imagem principal"
            className={featuredImageIssues.errors.length > 0 ? `${inputClass} ${inputInvalidClass}` : inputClass}
            value={featuredImage.imageUrl}
            onChange={(event) => onChange({ kind: 'external', imageUrl: event.target.value })}
          />
          {featuredImage.imageUrl ? (
            <div className="mt-3 h-48 w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
              <img alt={featuredImage.alt ?? ''} className="h-full w-full object-cover" src={featuredImage.imageUrl} />
            </div>
          ) : null}
        </Field>
      )}
    </fieldset>
  );
}

function ImageKindOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 font-label-md text-on-surface">
      <input checked={checked} name="featured-image-kind" type="radio" onChange={onChange} />
      {label}
    </label>
  );
}

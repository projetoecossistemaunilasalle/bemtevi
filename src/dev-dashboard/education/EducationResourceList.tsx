import { AlertCircle } from 'lucide-react';
import type { EducationResource } from '../../domain/resources/types';
import { Button } from '../../design-system/components/Button';
import type { DashboardValidationResult } from '../validation/validationTypes';

export function EducationResourceList({
  resources,
  selectedIndex,
  validation,
  onAdd,
  onSelect,
}: {
  resources: EducationResource[];
  selectedIndex: number;
  validation: DashboardValidationResult;
  onAdd: () => void;
  onSelect: (resourceIndex: number, resourceId: string) => void;
}) {
  return (
    <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      <h2 className="font-headline-sm text-on-surface">Materiais</h2>
      <Button className="mt-3 w-full" onClick={onAdd}>
        Novo material
      </Button>
      <div className="mt-3 flex flex-col gap-2">
        {resources.map((resource, resourceIndex) => {
          const hasErrors = validation.errors.some(
            (issue) => issue.path === `materials.${resourceIndex}` || issue.path?.startsWith(`${resource.id}.`),
          );
          const isSelected = resourceIndex === selectedIndex;

          return (
            <button
              key={`${resource.id}-${resourceIndex}`}
              type="button"
              onClick={() => onSelect(resourceIndex, resource.id)}
              className={`rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                isSelected
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
              }`}
            >
              {resource.title}
              {hasErrors ? (
                <span
                  className={`mt-1 flex items-center gap-1 font-label-sm ${isSelected ? 'text-on-primary' : 'text-error'}`}
                >
                  <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  Precisa de correção
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

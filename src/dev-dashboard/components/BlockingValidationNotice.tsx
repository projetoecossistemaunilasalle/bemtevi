import { AlertCircle, ArrowRight } from 'lucide-react';
import type { DashboardValidationArea, DashboardValidationResult } from '../validation/validationTypes';

const areaLabels: Record<DashboardValidationArea, string> = {
  flows: 'Fluxos',
  education: 'Materiais',
  contacts: 'Contatos',
  export: 'Exportação',
};

export function BlockingValidationNotice({
  validation,
  actionLabel,
  onOpenArea,
}: {
  validation: DashboardValidationResult;
  actionLabel: 'publicar' | 'exportar';
  onOpenArea?: (area: DashboardValidationArea) => void;
}) {
  if (validation.errors.length === 0) return null;

  const errorsByArea = validation.errors.reduce<Partial<Record<DashboardValidationArea, number>>>((counts, issue) => {
    counts[issue.area] = (counts[issue.area] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <aside role="alert" className="rounded-lg border border-error/35 bg-error-container/55 p-4 text-on-error-container">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-headline-sm">Ainda não é possível {actionLabel}</h3>
          <p className="mt-1 max-w-[70ch] font-body-md">
            {validation.errors.length === 1
              ? 'Há 1 erro que precisa ser corrigido. Seu rascunho foi mantido.'
              : `Há ${validation.errors.length} erros que precisam ser corrigidos. Seu rascunho foi mantido.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(errorsByArea).map(([area, count]) => (
              <button
                key={area}
                type="button"
                onClick={() => onOpenArea?.(area as DashboardValidationArea)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-current/35 px-3 py-1.5 font-label-sm transition-colors hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Revisar {count} {count === 1 ? 'erro' : 'erros'} em {areaLabels[area as DashboardValidationArea]}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

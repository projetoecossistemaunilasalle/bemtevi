import { useMemo, useState } from 'react';
import type { DashboardDraftContent } from './exportBundle';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { buildExportBundle } from './exportBundle';

export function ExportDashboard({
  shipped,
  drafts,
  validation,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
}) {
  const [exportedAt] = useState(() => new Date().toISOString());
  const bundle = useMemo(
    () =>
      buildExportBundle({
        shipped,
        drafts,
        validation,
        exportedAt,
      }),
    [drafts, exportedAt, shipped, validation],
  );
  const hasErrors = validation.errors.length > 0;

  function downloadBundle() {
    if (hasErrors) return;

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secuida-dashboard-export-${bundle.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div>
        <h2 className="font-headline-sm text-on-surface">Arquivo para revisão</h2>
        <p className="mt-2 font-body-md text-on-surface-variant">
          Envie este arquivo para a pessoa responsável pelo repositório.
        </p>
        <p className="font-body-md text-on-surface-variant">Ele não publica nada sozinho.</p>
      </div>
      <div className="rounded-lg bg-surface-container-low p-4">
        <p className="font-body-md text-on-surface-variant">
          Fluxos no arquivo: {bundle.changes.flows.length}. Materiais no arquivo:{' '}
          {bundle.changes.educationMaterials.length}. Grupos no arquivo:{' '}
          {bundle.changes.educationGroups.length}.
        </p>
      </div>
      <button
        type="button"
        disabled={hasErrors}
        onClick={downloadBundle}
        className="min-h-11 w-fit rounded-full bg-primary px-5 font-label-md text-on-primary disabled:bg-secondary-container disabled:text-on-secondary-container"
      >
        Gerar arquivo JSON
      </button>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DashboardDraftContent } from './exportBundle';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { buildExportBundle } from './exportBundle';
import { Button } from '../../design-system/components/Button';

const LAST_EXPORTED_AT_KEY = 'secuida:dev-dashboard:lastExportedAt';

export function ExportDashboard({
  shipped,
  drafts,
  validation,
  draftUpdatedAt,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
}) {
  const [exportedAt, setExportedAt] = useState<string | null>(() => localStorage.getItem(LAST_EXPORTED_AT_KEY));
  const bundle = useMemo(
    () =>
      buildExportBundle({
        shipped,
        drafts,
        validation,
        exportedAt: new Date().toISOString(),
      }),
    [drafts, shipped, validation],
  );
  const hasErrors = validation.errors.length > 0;
  const changeCounts = useMemo(() => computeChangeCounts(bundle, shipped, drafts), [bundle, shipped, drafts]);
  const totalChanges =
    changeCounts.flows.added +
    changeCounts.flows.patched +
    changeCounts.flows.removed +
    changeCounts.materials.added +
    changeCounts.materials.patched +
    changeCounts.materials.removed +
    changeCounts.groups.added +
    changeCounts.groups.patched +
    changeCounts.groups.removed;
  const hasChanges = totalChanges > 0;
  const hasStaleExport = exportedAt !== null && draftUpdatedAt !== null && draftUpdatedAt > exportedAt;

  function downloadBundle() {
    if (hasErrors || !hasChanges) return;

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = bundle.exportedAt.slice(0, 10);
    const time = bundle.exportedAt.slice(11, 19).replace(/:/g, '-');
    link.download = `secuida-dashboard-export-${date}-${time}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    const now = new Date().toISOString();
    localStorage.setItem(LAST_EXPORTED_AT_KEY, now);
    setExportedAt(now);
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

      {!hasChanges ? (
        <div className="rounded-lg bg-surface-container-low p-4">
          <p className="font-body-md text-on-surface-variant">
            Nada para exportar — todas as alterações coincidem com o conteúdo publicado.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-container-low p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ChangeStat
              label="Fluxos"
              added={changeCounts.flows.added}
              patched={changeCounts.flows.patched}
              removed={changeCounts.flows.removed}
            />
            <ChangeStat
              label="Materiais"
              added={changeCounts.materials.added}
              patched={changeCounts.materials.patched}
              removed={changeCounts.materials.removed}
            />
            <ChangeStat
              label="Grupos"
              added={changeCounts.groups.added}
              patched={changeCounts.groups.patched}
              removed={changeCounts.groups.removed}
            />
            <ChangeStat
              label="Grupos removidos"
              added={0}
              patched={0}
              removed={drafts.removedEducationGroupIds?.length ?? 0}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={hasErrors || !hasChanges} onClick={downloadBundle}>
          Gerar arquivo JSON
        </Button>
        {exportedAt ? (
          <span className="flex items-center gap-1.5 font-label-md text-on-surface-variant">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
            Exportado
          </span>
        ) : null}
        {hasStaleExport ? (
          <span className="font-label-sm text-on-surface-variant">Há alterações desde a última exportação.</span>
        ) : null}
      </div>
    </section>
  );
}

function ChangeStat({
  label,
  added,
  patched,
  removed,
}: {
  label: string;
  added: number;
  patched: number;
  removed: number;
}) {
  const total = added + patched + removed;
  if (total === 0) return <p className="font-label-md text-on-surface-variant">{label}: 0</p>;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} adicionado${added === 1 ? '' : 's'}`);
  if (patched > 0) parts.push(`${patched} editado${patched === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`${removed} removido${removed === 1 ? '' : 's'}`);

  return (
    <div>
      <p className="font-label-sm text-on-surface-variant">{label}</p>
      <p className="font-label-md text-on-surface">{parts.join(', ')}</p>
    </div>
  );
}

function computeChangeCounts(
  bundle: ReturnType<typeof buildExportBundle>,
  shipped: DashboardShippedContent,
  drafts: DashboardDraftContent,
) {
  const shippedFlowIds = new Set(shipped.flows.map((f) => f.id));
  const draftFlowIds = new Set(drafts.flows.map((f) => f.id));
  const shippedMaterialIds = new Set(shipped.educationMaterials.map((m) => m.id));
  const draftMaterialIds = new Set(drafts.educationMaterials.map((m) => m.id));
  const shippedGroupIds = new Set(shipped.educationGroups.map((g) => g.id));
  const draftGroupIds = new Set(drafts.educationGroups.map((g) => g.id));

  return {
    flows: {
      added: bundle.changes.flows.filter((f) => !shippedFlowIds.has(f.id)).length,
      patched: bundle.changes.flows.filter((f) => shippedFlowIds.has(f.id)).length,
      removed: shipped.flows.filter((f) => !draftFlowIds.has(f.id)).length,
    },
    materials: {
      added: bundle.changes.educationMaterials.filter((m) => !shippedMaterialIds.has(m.id)).length,
      patched: bundle.changes.educationMaterials.filter((m) => shippedMaterialIds.has(m.id)).length,
      removed: shipped.educationMaterials.filter((m) => !draftMaterialIds.has(m.id)).length,
    },
    groups: {
      added: bundle.changes.educationGroups.filter((g) => !shippedGroupIds.has(g.id)).length,
      patched: bundle.changes.educationGroups.filter((g) => shippedGroupIds.has(g.id)).length,
      removed: shipped.educationGroups.filter((g) => !draftGroupIds.has(g.id)).length,
    },
  };
}

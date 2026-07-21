import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DashboardDraftContent } from './exportBundle';
import type { DashboardShippedContent } from '../content/shippedContent';
import type { DashboardValidationResult } from '../validation/validationTypes';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { buildExportBundle } from './exportBundle';
import { createZip } from './createZip';
import { extractImagesFromDrafts } from './extractImages';
import { computeChangeSummary } from '../publishing/changeSummary';
import { Button } from '../../design-system/components/Button';

const LAST_EXPORTED_AT_KEY = 'bemtevi:dev-dashboard:lastExportedAt';

import { ConfirmButton } from '../components/ConfirmButton';

export function ExportDashboard({
  shipped,
  drafts,
  validation,
  draftUpdatedAt,
  onResetDrafts,
}: {
  shipped: DashboardShippedContent;
  drafts: DashboardDraftContent;
  validation: DashboardValidationResult;
  draftUpdatedAt: string | null;
  onResetDrafts(): void;
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
  const changeCounts = useMemo(() => {
    const baseline: PublishedContentPayload = {
      flows: shipped.flows,
      educationMaterials: shipped.educationMaterials,
      educationGroups: shipped.educationGroups,
      contacts: shipped.contacts,
      defaultGroupOrder: shipped.defaultGroupOrder ?? 0,
    };
    const draft: PublishedContentPayload = {
      flows: drafts.flows,
      educationMaterials: drafts.educationMaterials,
      educationGroups: drafts.educationGroups,
      contacts: drafts.contacts,
      defaultGroupOrder: drafts.defaultGroupOrder ?? 0,
    };
    return computeChangeSummary(baseline, draft);
  }, [shipped, drafts]);
  const hasChanges = changeCounts.total > 0;
  const hasStaleExport = exportedAt !== null && draftUpdatedAt !== null && draftUpdatedAt > exportedAt;

  async function downloadBundle() {
    if (hasErrors || !hasChanges) return;

    const { json, images } = extractImagesFromDrafts(bundle.changes);
    const bundleWithPaths = { ...bundle, changes: json };

    const files = [
      { name: 'data.json', data: new TextEncoder().encode(JSON.stringify(bundleWithPaths, null, 2)) },
      ...images.map((img) => ({ name: img.name, data: img.data })),
    ];

    const zipData = createZip(files);
    const blob = new Blob([zipData], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = bundle.exportedAt.slice(0, 10);
    const time = bundle.exportedAt.slice(11, 19).replace(/:/g, '-');
    link.download = `bemtevi-dashboard-export-${date}-${time}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    const now = new Date().toISOString();
    localStorage.setItem(LAST_EXPORTED_AT_KEY, now);
    setExportedAt(now);
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <section className="flex flex-col gap-stack-md rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <div>
          <h2 className="font-headline-sm text-on-surface">Arquivo para revisão</h2>
          <p className="mt-2 font-body-md text-on-surface-variant">
            Envie este arquivo ZIP para a pessoa responsável pelo repositório.
          </p>
          <p className="font-body-md text-on-surface-variant">Ele contém o JSON de dados e as imagens enviadas.</p>
        </div>

        {!hasChanges ? (
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="font-body-md text-on-surface-variant">
              Nada para exportar — todas as alterações coincidem com o conteúdo publicado.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChangeStat
                label="Fluxos"
                added={changeCounts.flows.added}
                edited={changeCounts.flows.edited}
                removed={changeCounts.flows.removed}
              />
              <ChangeStat
                label="Materiais"
                added={changeCounts.materials.added}
                edited={changeCounts.materials.edited}
                removed={changeCounts.materials.removed}
              />
              <ChangeStat
                label="Grupos"
                added={changeCounts.groups.added}
                edited={changeCounts.groups.edited}
                removed={changeCounts.groups.removed}
              />
              <ChangeStat
                label="Grupos removidos"
                added={0}
                edited={0}
                removed={drafts.removedEducationGroupIds?.length ?? 0}
              />
              <ChangeStat
                label="Contatos"
                added={changeCounts.contacts.added}
                edited={changeCounts.contacts.edited}
                removed={changeCounts.contacts.removed}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={hasErrors || !hasChanges} onClick={downloadBundle}>
            Gerar arquivo ZIP
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

      <section className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error-container/10 p-5">
        <div>
          <h3 className="font-headline-sm text-error">Descartar rascunho local</h3>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Esta ação descarta apenas o rascunho local deste navegador (edições, adições e remoções pendentes em fluxos,
            materiais, grupos e contatos) e restaura tudo de volta ao conteúdo atualmente publicado. O conteúdo já
            publicado não será alterado ou apagado.
          </p>
        </div>
        <div>
          <ConfirmButton
            prompt="Limpar TODAS as alterações"
            confirmLabel="Confirmar e limpar tudo"
            cancelLabel="Cancelar"
            disabled={!hasChanges}
            onConfirm={onResetDrafts}
          />
        </div>
      </section>
    </div>
  );
}

function ChangeStat({
  label,
  added,
  edited,
  removed,
}: {
  label: string;
  added: number;
  edited: number;
  removed: number;
}) {
  const total = added + edited + removed;
  if (total === 0) return <p className="font-label-md text-on-surface-variant">{label}: 0</p>;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} adicionado${added === 1 ? '' : 's'}`);
  if (edited > 0) parts.push(`${edited} editado${edited === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`${removed} removido${removed === 1 ? '' : 's'}`);

  return (
    <div>
      <p className="font-label-sm text-on-surface-variant">{label}</p>
      <p className="font-label-md text-on-surface">{parts.join(', ')}</p>
    </div>
  );
}

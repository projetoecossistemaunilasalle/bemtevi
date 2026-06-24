import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardFlows } from './flowValidation';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';

export function FlowDashboard({
  flows,
  resources,
  onFlowChange,
  onFlowAdd,
}: {
  flows: GuidedFlow[];
  resources: EducationResource[];
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
  onFlowAdd?: () => void;
}) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => flows[0]?.id ?? null);
  const [mapVisible, setMapVisible] = useState(false);
  const selectedIndex = useMemo(() => flows.findIndex((flow) => flow.id === selectedFlowId), [flows, selectedFlowId]);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedFlow = flows[effectiveIndex];
  const validation = useMemo(
    () =>
      validateDashboardFlows(
        flows,
        resources.map((resource) => resource.id),
      ),
    [flows, resources],
  );

  if (!selectedFlow) {
    return (
      <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <p className="font-body-md text-on-surface-variant">Nenhum fluxo disponível.</p>
        {onFlowAdd && (
          <Button className="mt-3" onClick={onFlowAdd}>
            Novo fluxo
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
        <h2 className="font-headline-sm text-on-surface">Fluxos</h2>
        <div className="mt-3 flex flex-col gap-2">
          {flows.map((flow, flowIndex) => (
            <button
              key={`${flow.id}-${flowIndex}`}
              type="button"
              onClick={() => setSelectedFlowId(flow.id)}
              className={`rounded-lg px-3 py-2 text-left font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                flow.id === selectedFlow.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
              }`}
            >
              {flow.title}
            </button>
          ))}
        </div>
      </aside>
      <div className="flex flex-col gap-stack-md">
        <FlowPreview key={`${selectedFlow.id}-${effectiveIndex}`} flow={selectedFlow} flows={flows} />

        <FlowEditor
          flow={selectedFlow}
          flows={flows}
          onChange={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
        />

        {mapVisible ? (
          <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-on-surface">Mapa visual</h2>
              <Button variant="secondary" size="sm" onClick={() => setMapVisible(false)}>
                Ocultar mapa
              </Button>
            </div>
            <FlowMap flow={selectedFlow} flows={flows} />
          </section>
        ) : (
          <Button variant="secondary" onClick={() => setMapVisible(true)}>
            Mapa visual
          </Button>
        )}

        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}

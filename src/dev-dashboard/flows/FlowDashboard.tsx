import { useMemo, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { ValidationSummary } from '../components/ValidationSummary';
import { validateDashboardFlows } from './flowValidation';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';
import { FlowRedirections } from './FlowRedirectionsPanel';

type FlowDetailTab = 'editor' | 'preview' | 'map' | 'redirections';

const flowDetailTabs: Array<{ id: FlowDetailTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
  { id: 'redirections', label: 'Redirecionamentos' },
];

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
  const [activeDetailTab, setActiveDetailTab] = useState<FlowDetailTab>('editor');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});
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

  function handleEditNode(nodeId: string) {
    const expandedKey = `${selectedFlow.id}:${nodeId}`;
    setExpandedNodeIds((current) => ({ ...current, [expandedKey]: true }));
    setActiveDetailTab('editor');
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
        <div
          aria-label="Detalhes do fluxo"
          className="flex flex-wrap gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2"
        >
          {flowDetailTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeDetailTab === tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`min-h-9 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                activeDetailTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeDetailTab === 'editor' && (
          <FlowEditor
            key={`${selectedFlow.id}-${effectiveIndex}`}
            flow={selectedFlow}
            flows={flows}
            expandedNodeIds={expandedNodeIds}
            onExpandedChange={setExpandedNodeIds}
            onChange={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
          />
        )}

        {activeDetailTab === 'preview' && (
          <FlowPreview key={`${selectedFlow.id}-${effectiveIndex}`} flow={selectedFlow} flows={flows} />
        )}

        {activeDetailTab === 'map' && <FlowMap flow={selectedFlow} flows={flows} />}

        {activeDetailTab === 'redirections' && <FlowRedirections flow={selectedFlow} onEditNode={handleEditNode} />}

        <ValidationSummary result={validation} />
      </div>
    </section>
  );
}

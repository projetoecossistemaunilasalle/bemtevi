import { useMemo } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import type { ValidationIssueAction } from '../components/ValidationSummary';
import type { DashboardValidationIssue } from '../validation/validationTypes';
import { FlowDashboardSidebar } from './FlowDashboardSidebar';
import { FlowDashboardWorkspace } from './FlowDashboardWorkspace';
import { validateDashboardFlows } from './flowValidation';
import { resolveFlowValidationTarget } from './flowValidationNavigation';
import { useFlowDashboardController } from './useFlowDashboardController';
import { useFlowImport } from './useFlowImport';

export function FlowDashboard({
  flows,
  resources,
  externalFocus,
  onFlowChange,
  onFlowAdd,
  onFlowImport,
  onFlowRemove,
}: {
  flows: GuidedFlow[];
  resources: EducationResource[];
  externalFocus?: { id: string; requestId: number } | null;
  onFlowChange: (flowIndex: number, flowId: string, patch: Partial<GuidedFlow>) => void;
  onFlowAdd?: () => void;
  onFlowImport?: (flow: GuidedFlow) => void;
  onFlowRemove?: (flowId: string) => void;
}) {
  const controller = useFlowDashboardController({ flows, externalFocus });
  const {
    inputRef: flowImportRef,
    error: flowImportError,
    openFilePicker,
    handleFile: handleImportFile,
  } = useFlowImport(onFlowImport, controller.selectFlow);
  const validation = useMemo(
    () =>
      validateDashboardFlows(
        flows,
        resources.map((resource) => resource.id),
      ),
    [flows, resources],
  );

  if (!controller.selectedFlow) {
    return (
      <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
        <p className="font-body-md text-on-surface-variant">Nenhum fluxo disponível.</p>
        {onFlowAdd || onFlowImport ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {onFlowAdd ? <Button onClick={onFlowAdd}>+ Criar Novo Fluxo</Button> : null}
            {onFlowImport ? (
              <>
                <Button variant="secondary" onClick={openFilePicker}>
                  Importar fluxo JSON
                </Button>
                <input
                  ref={flowImportRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {flowImportError ? (
          <p role="alert" className="mt-3 font-body-sm text-error">
            {flowImportError}
          </p>
        ) : null}
      </section>
    );
  }

  const selectedFlow = controller.selectedFlow;

  function addResultNode() {
    const nodeId = createUniqueId('nova_etapa', selectedFlow.nodes);
    onFlowChange(controller.effectiveIndex, selectedFlow.id, {
      nodes: {
        ...selectedFlow.nodes,
        [nodeId]: { id: nodeId, kind: 'result', text: 'Nova etapa final.' },
      },
    });
    controller.selectNode(nodeId);
  }

  function getIssueAction(issue: DashboardValidationIssue): ValidationIssueAction | null {
    const target = resolveFlowValidationTarget(issue, flows);
    if (!target) return null;
    return {
      label: target.nodeId ? 'Corrigir no mapa' : 'Abrir configurações no mapa',
      description: target.description,
      onClick: () => controller.openValidationTarget(target),
    };
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <FlowDashboardSidebar
        flows={flows}
        selectedFlow={selectedFlow}
        confirmDeleteFlowId={controller.confirmDeleteFlowId}
        activeDetailTab={controller.activeDetailTab}
        nodes={controller.nodes}
        visibleNodes={controller.visibleNodes}
        activeNodeId={controller.activeNodeId}
        nodeSearch={controller.nodeSearch}
        activeNodeFilter={controller.activeNodeFilter}
        importInputRef={flowImportRef}
        importError={flowImportError}
        canAdd={Boolean(onFlowAdd)}
        canImport={Boolean(onFlowImport)}
        onSelectFlow={controller.selectFlow}
        onRequestRemove={controller.setConfirmDeleteFlowId}
        onConfirmRemove={(flowId) => controller.confirmFlowRemoval(flowId, onFlowRemove)}
        onAddFlow={() => onFlowAdd?.()}
        onOpenImport={openFilePicker}
        onImportFile={handleImportFile}
        onSearchChange={controller.setNodeSearch}
        onFilterChange={controller.setActiveNodeFilter}
        onSelectNode={controller.selectNode}
        onAddResultNode={addResultNode}
      />
      <FlowDashboardWorkspace
        flow={selectedFlow}
        flowIndex={controller.effectiveIndex}
        flows={flows}
        activeDetailTab={controller.activeDetailTab}
        selectedNodeId={controller.activeNodeId}
        nodeScrollRequest={controller.nodeScrollRequest}
        nodeSearch={controller.nodeSearch}
        activeNodeFilter={controller.activeNodeFilter}
        validationFocusRequest={controller.validationFocusRequest}
        validation={validation}
        onSelectTab={controller.setActiveDetailTab}
        onFlowChange={(patch) => onFlowChange(controller.effectiveIndex, selectedFlow.id, patch)}
        onSelectNode={(nodeId) => (nodeId ? controller.selectNode(nodeId) : controller.clearNodeSelection())}
        onEditNode={controller.editNode}
        onSelectFlow={controller.selectFlow}
        getIssueAction={getIssueAction}
      />
    </section>
  );
}

function createUniqueId(baseId: string, records: Record<string, unknown>) {
  if (!records[baseId]) return baseId;
  let index = 2;
  while (records[`${baseId}_${index}`]) index += 1;
  return `${baseId}_${index}`;
}

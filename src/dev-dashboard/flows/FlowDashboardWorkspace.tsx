import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { DashboardValidationResult } from '../validation/validationTypes';
import { ValidationSummary, type ValidationIssueActionResolver } from '../components/ValidationSummary';
import type { MapFocusRequest } from './FlowDestinationMap';
import { FlowEditor } from './FlowEditor';
import { FlowMap } from './FlowMap';
import { FlowPreview } from './FlowPreview';
import { flowDetailTabs, type FlowDetailTab, type NodeFilter } from './flowDashboardTypes';

export function FlowDashboardWorkspace({
  flow,
  flowIndex,
  flows,
  activeDetailTab,
  selectedNodeId,
  nodeScrollRequest,
  nodeSearch,
  activeNodeFilter,
  validationFocusRequest,
  validation,
  onSelectTab,
  onFlowChange,
  onSelectNode,
  onEditNode,
  onSelectFlow,
  getIssueAction,
}: {
  flow: GuidedFlow;
  flowIndex: number;
  flows: GuidedFlow[];
  activeDetailTab: FlowDetailTab;
  selectedNodeId: string | null;
  nodeScrollRequest: { nodeId: string; requestId: number } | null;
  nodeSearch: string;
  activeNodeFilter: NodeFilter;
  validationFocusRequest: MapFocusRequest | null;
  validation: DashboardValidationResult;
  onSelectTab: (tab: FlowDetailTab) => void;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onSelectNode: (nodeId: string | null) => void;
  onEditNode: (flowId: string, nodeId: string) => void;
  onSelectFlow: (flowId: string) => void;
  getIssueAction: ValidationIssueActionResolver;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-stack-md">
      <div
        aria-label="Detalhes do fluxo"
        className="flex flex-wrap gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-2"
      >
        {flowDetailTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeDetailTab === tab.id}
            onClick={() => onSelectTab(tab.id)}
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
      {activeDetailTab === 'editor' ? (
        <FlowEditor
          key={`${flow.id}-${flowIndex}`}
          flow={flow}
          flows={flows}
          onChange={onFlowChange}
          selectedNodeId={selectedNodeId}
          scrollRequest={nodeScrollRequest}
          nodeSearch={nodeSearch}
          activeNodeFilter={activeNodeFilter}
          onSelectNodeId={onSelectNode}
        />
      ) : null}
      {activeDetailTab === 'preview' ? <FlowPreview key={`${flow.id}-${flowIndex}`} flow={flow} flows={flows} /> : null}
      {activeDetailTab === 'map' ? (
        <FlowMap
          key={flow.id}
          flow={flow}
          flows={flows}
          onFlowChange={onFlowChange}
          onEditNode={onEditNode}
          onSelectFlow={onSelectFlow}
          focusRequest={validationFocusRequest}
        />
      ) : null}
      <ValidationSummary result={validation} getIssueAction={getIssueAction} />
    </div>
  );
}

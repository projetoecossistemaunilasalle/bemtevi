import { useEffect, useMemo, useState } from 'react';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import type { MapFocusRequest } from './FlowDestinationMap';
import {
  isNodePanelSection,
  type FlowDetailTab,
  type FlowValidationTarget,
  type NodeFilter,
} from './flowDashboardTypes';

export function useFlowDashboardController({
  flows,
  externalFocus,
}: {
  flows: GuidedFlow[];
  externalFocus?: { id: string; requestId: number } | null;
}) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => flows[0]?.id ?? null);
  const [confirmDeleteFlowId, setConfirmDeleteFlowId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTabState] = useState<FlowDetailTab>('editor');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeScrollRequest, setNodeScrollRequest] = useState<{ nodeId: string; requestId: number } | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [activeNodeFilter, setActiveNodeFilter] = useState<NodeFilter>('all');
  const [validationFocusRequest, setValidationFocusRequest] = useState<MapFocusRequest | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!externalFocus?.id || !flows.some((flow) => flow.id === externalFocus.id)) return;
    setSelectedFlowId(externalFocus.id);
    setSelectedNodeId(null);
    setNodeScrollRequest(null);
    setConfirmDeleteFlowId(null);
    setValidationFocusRequest(null);
    setActiveDetailTabState('editor');
  }, [externalFocus?.requestId, externalFocus?.id, flows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedIndex = useMemo(() => flows.findIndex((flow) => flow.id === selectedFlowId), [flows, selectedFlowId]);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedFlow = flows[effectiveIndex];
  const nodes = useMemo(() => (selectedFlow ? Object.values(selectedFlow.nodes) : []), [selectedFlow]);
  const visibleNodes = useMemo(
    () => filterFlowNodes(nodes, nodeSearch, activeNodeFilter),
    [nodes, nodeSearch, activeNodeFilter],
  );
  const activeNodeId = useMemo(
    () =>
      selectedNodeId && visibleNodes.some((node) => node.id === selectedNodeId)
        ? selectedNodeId
        : (visibleNodes[0]?.id ?? null),
    [selectedNodeId, visibleNodes],
  );

  function selectFlow(flowId: string) {
    setSelectedFlowId(flowId);
    setSelectedNodeId(null);
    setNodeScrollRequest(null);
    setConfirmDeleteFlowId(null);
    setValidationFocusRequest(null);
  }

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setNodeScrollRequest((request) => ({ nodeId, requestId: (request?.requestId ?? 0) + 1 }));
  }

  function clearNodeSelection() {
    setSelectedNodeId(null);
  }

  function setActiveDetailTab(tab: FlowDetailTab) {
    setActiveDetailTabState(tab);
    setValidationFocusRequest(null);
  }

  function editNode(flowId: string, nodeId: string) {
    if (flowId !== selectedFlow?.id) setSelectedFlowId(flowId);
    selectNode(nodeId);
    setActiveDetailTabState('editor');
  }

  function openValidationTarget(target: FlowValidationTarget) {
    setSelectedFlowId(target.flowId);
    setNodeSearch('');
    setActiveNodeFilter('all');
    setActiveDetailTabState('map');
    setValidationFocusRequest((request) => ({
      nodeId: target.nodeId,
      section: isNodePanelSection(target.section) ? target.section : undefined,
      requestId: (request?.requestId ?? 0) + 1,
    }));
  }

  function confirmFlowRemoval(flowId: string, onFlowRemove?: (flowId: string) => void) {
    if (flowId === selectedFlowId) {
      setSelectedFlowId(flows.find((flow) => flow.id !== flowId)?.id ?? null);
    }
    onFlowRemove?.(flowId);
    setConfirmDeleteFlowId(null);
  }

  return {
    selectedFlowId,
    selectedFlow,
    effectiveIndex,
    nodes,
    visibleNodes,
    activeNodeId,
    selectedNodeId,
    nodeScrollRequest,
    nodeSearch,
    setNodeSearch,
    activeNodeFilter,
    setActiveNodeFilter,
    activeDetailTab,
    validationFocusRequest,
    confirmDeleteFlowId,
    setConfirmDeleteFlowId,
    selectFlow,
    selectNode,
    clearNodeSelection,
    setActiveDetailTab,
    editNode,
    openValidationTarget,
    confirmFlowRemoval,
  };
}

function filterFlowNodes(nodes: FlowNode[], search: string, filter: NodeFilter) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  return nodes.filter((node) => {
    const matchesSearch =
      !normalizedSearch ||
      node.id.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      node.text.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    if (!matchesSearch) return false;
    if (filter === 'result') return node.kind === 'result';
    if (filter === 'branch') return node.kind === 'score_branch';
    if (filter === 'safety') return nodeHasDeferredSafety(node);
    return true;
  });
}

function nodeHasDeferredSafety(node: FlowNode) {
  return (
    node.kind === 'choice' &&
    node.options.some((option) => option.effects?.some((effect) => effect.kind === 'deferred_safety'))
  );
}

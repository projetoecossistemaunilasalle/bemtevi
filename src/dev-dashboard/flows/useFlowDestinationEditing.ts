import { useCallback, useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Connection, NodeMouseHandler } from '@xyflow/react';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import type { DestinationRFNode } from './flowDestinationModels';
import type { MapFocusRequest, MapFocusSection } from './flowDisplay';
import {
  addBranch,
  addNode,
  addOption,
  applyTerminalEffect,
  connectSource,
  type ConnectionSource,
  type TerminalDestination,
} from './flowMutations';

export interface UseFlowDestinationEditingOptions {
  flow: GuidedFlow;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  focusRequest?: MapFocusRequest | null;
  onRequestSettingsOpen?: () => void;
  onFocusRequestApplied?: (requestId: number) => void;
  addStageTriggerRef: RefObject<HTMLButtonElement | null>;
}

export function useFlowDestinationEditing({
  flow,
  onFlowChange,
  focusRequest,
  onRequestSettingsOpen,
  onFocusRequestApplied,
  addStageTriggerRef,
}: UseFlowDestinationEditingOptions) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState<{
    section?: MapFocusSection;
    targetId?: string;
    requestId: number;
  } | null>(null);
  const [addStageOpen, setAddStageOpen] = useState(false);

  const handleAddConnectedStage = useCallback(
    (source: ConnectionSource, kind: FlowNode['kind']) => {
      const { flow: nextFlow, nodeId: newNodeId } = addNode(flow, { kind, connectFrom: source });
      onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
      setSelectedNodeId(newNodeId);
      setPanelFocusRequest(null);
    },
    [flow, onFlowChange],
  );

  const handleApplyTerminalEffect = useCallback(
    (source: ConnectionSource, destination: TerminalDestination) => {
      const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, destination);
      if (applied) {
        onFlowChange({ nodes: nextFlow.nodes });
      }
    },
    [flow, onFlowChange],
  );

  const handleFocusSection = useCallback((nodeId: string, section: MapFocusSection, targetId?: string) => {
    setSelectedNodeId(nodeId);
    setPanelFocusRequest({ section, targetId, requestId: Date.now() });
  }, []);

  const handleAddOption = useCallback(
    (nodeId: string) => {
      const { flow: nextFlow, optionId } = addOption(flow, nodeId);
      onFlowChange({ nodes: nextFlow.nodes });
      setSelectedNodeId(nodeId);
      setPanelFocusRequest({ section: 'opcao', targetId: optionId, requestId: Date.now() });
    },
    [flow, onFlowChange],
  );

  const handleAddBranch = useCallback(
    (nodeId: string) => {
      const { flow: nextFlow, branchId } = addBranch(flow, nodeId);
      onFlowChange({ nodes: nextFlow.nodes });
      setSelectedNodeId(nodeId);
      setPanelFocusRequest({ section: 'faixa', targetId: branchId, requestId: Date.now() });
    },
    [flow, onFlowChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceNode = flow.nodes[connection.source];
      if (!sourceNode) return;

      let source: ConnectionSource | undefined;
      if (sourceNode.kind === 'choice') {
        if (connection.sourceHandle === 'free-text') {
          source = { kind: 'free_text', nodeId: sourceNode.id };
        } else if (connection.sourceHandle) {
          source = { kind: 'option', nodeId: sourceNode.id, optionId: connection.sourceHandle };
        }
      } else if (sourceNode.kind === 'score_branch') {
        if (connection.sourceHandle) {
          source = { kind: 'branch', nodeId: sourceNode.id, branchId: connection.sourceHandle };
        }
      }

      if (!source) return;

      if (connection.target.startsWith('destination:navigate:')) {
        const dest = connection.target.replace('destination:navigate:', '') as '/apoio' | '/contatos' | '/educacao';
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, { kind: 'navigate', destination: dest });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:flow_start:')) {
        const targetFlowId = connection.target.replace('destination:flow_start:', '');
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, {
          kind: 'flow_start',
          flowId: targetFlowId,
        });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:end_flow:')) {
        const { flow: nextFlow, applied } = applyTerminalEffect(flow, source, { kind: 'end_flow', message: '' });
        if (applied) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (connection.target.startsWith('destination:result:')) {
        const targetNodeId = connection.target.replace('destination:result:', '');
        const { flow: nextFlow, connected } = connectSource(flow, source, targetNodeId);
        if (connected) onFlowChange({ nodes: nextFlow.nodes });
        return;
      }

      if (flow.nodes[connection.target]) {
        const { flow: nextFlow, connected } = connectSource(flow, source, connection.target);
        if (connected) {
          onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
        }
      }
    },
    [flow, onFlowChange],
  );

  const handleNodeClick: NodeMouseHandler<DestinationRFNode> = useCallback(
    (event, node) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, [role="menu"], .flow-destination-quick-menu, .nodrag, .nopan')) {
        return;
      }
      if (flow.nodes[node.id]) {
        setSelectedNodeId(node.id);
        setPanelFocusRequest(null);
      }
    },
    [flow.nodes],
  );

  const handleCloseNodePanel = useCallback(() => {
    const nodeId = selectedNodeId;
    setSelectedNodeId(null);
    setPanelFocusRequest(null);
    document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`)?.focus?.();
  }, [selectedNodeId]);

  const handleAddStage = useCallback(
    (kind: FlowNode['kind']) => {
      const { flow: nextFlow, nodeId: newNodeId } = addNode(flow, { kind });
      onFlowChange({ nodes: nextFlow.nodes, ...(nextFlow.nodeOrder ? { nodeOrder: nextFlow.nodeOrder } : {}) });
      setAddStageOpen(false);
      setSelectedNodeId(newNodeId);
      setPanelFocusRequest(null);
      addStageTriggerRef.current?.focus();
    },
    [flow, onFlowChange, addStageTriggerRef],
  );

  const handleAddStageKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!addStageOpen || event.key !== 'Escape') return;
      setAddStageOpen(false);
      addStageTriggerRef.current?.focus();
    },
    [addStageOpen, addStageTriggerRef],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.nodeId) {
      if (flow.nodes[focusRequest.nodeId]) {
        setSelectedNodeId(focusRequest.nodeId);
        setPanelFocusRequest({ section: focusRequest.section, requestId: focusRequest.requestId });
      }
    } else {
      setSelectedNodeId(null);
      setPanelFocusRequest(null);
      onRequestSettingsOpen?.();
    }
    onFocusRequestApplied?.(focusRequest.requestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.requestId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedNode = selectedNodeId ? (flow.nodes[selectedNodeId] ?? null) : null;

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    panelFocusRequest,
    setPanelFocusRequest,
    addStageOpen,
    setAddStageOpen,
    handleAddConnectedStage,
    handleApplyTerminalEffect,
    handleFocusSection,
    handleAddOption,
    handleAddBranch,
    onConnect,
    handleNodeClick,
    handleCloseNodePanel,
    handleAddStage,
    handleAddStageKeyDown,
  };
}

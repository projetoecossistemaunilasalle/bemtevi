import { useCallback, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { GuidedFlow, FlowNode } from '../../domain/flow-engine/types';
import { buildFlowGraph, type FlowNodeData } from './flowMapLayout';
import { FlowMapInspector } from './FlowMapInspector';

// ─── Custom node components ────────────────────────────────────────────────

function nodeColor(node: FlowNode): { border: string; bg: string; text: string } {
  if (node.kind === 'result') return { border: '#bdcabf', bg: '#f0f3ff', text: '#111c2c' };
  if (node.kind === 'score_branch') return { border: '#7a5900', bg: '#ffdf9e', text: '#5c4300' };
  if (node.kind !== 'choice') return { border: '#bdcabf', bg: '#ffffff', text: '#111c2c' };

  const hasSafetyInterrupt = node.options.some((o) => o.effects?.some((e) => e.kind === 'safety_interrupt'));
  const hasDeferredSafety = node.options.some((o) => o.effects?.some((e) => e.kind === 'deferred_safety'));

  if (hasSafetyInterrupt) return { border: '#ba1a1a', bg: '#ffdad6', text: '#93000a' };
  if (hasDeferredSafety) return { border: '#7a5900', bg: '#fff8e8', text: '#5c4300' };
  return { border: '#bdcabf', bg: '#ffffff', text: '#111c2c' };
}

function ChoiceNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  const colors = nodeColor(node);
  const hasScore = node.kind === 'choice' && node.options.some((o) => o.effects?.some((e) => e.kind === 'score'));

  return (
    <div
      style={{ border: `2px solid ${colors.border}`, background: colors.bg, color: colors.text }}
      className="min-w-[160px] max-w-[220px] overflow-hidden rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="break-all font-medium leading-tight">
          {node.text.slice(0, 80)}
          {node.text.length > 80 ? '…' : ''}
        </p>
        {hasScore && (
          <span className="ml-1 shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
            +pts
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] opacity-60">{node.kind === 'choice' ? `${node.options.length} opções` : ''}</p>
    </div>
  );
}

function ScoreBranchNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  return (
    <div
      style={{ border: '2px solid #7a5900', background: '#ffdf9e', color: '#5c4300' }}
      className="min-w-[160px] max-w-[220px] overflow-hidden rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-center gap-1">
        <span className="shrink-0 text-base">⇄</span>
        <p className="break-all font-medium leading-tight">{node.text.slice(0, 60)}</p>
      </div>
      <p className="mt-1 text-[10px] opacity-60">
        {node.kind === 'score_branch' ? `${node.branches.length} faixas · ${node.scoreKey}` : ''}
      </p>
    </div>
  );
}

function ResultNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  return (
    <div
      style={{ border: '1px solid #bdcabf', background: '#f0f3ff', color: '#111c2c' }}
      className="min-w-[160px] max-w-[220px] overflow-hidden rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="break-all leading-tight text-on-surface-variant">
          {node.text.slice(0, 60)}
          {node.text.length > 60 ? '…' : ''}
        </p>
        <span className="ml-1 shrink-0 rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
          FIM
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  choiceNode: ChoiceNodeComponent,
  scoreBranchNode: ScoreBranchNodeComponent,
  resultNode: ResultNodeComponent,
};

// ─── Main component ────────────────────────────────────────────────────────

export function FlowMap({
  flow,
  flows,
  onFlowChange,
  onEditNode,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (nodeId: string) => void;
}) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildFlowGraph(flow), [flow]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? (Object.values(flow.nodes).find((n) => n.id === selectedNodeId) ?? null) : null;

  const handleNodeClick: NodeMouseHandler = useCallback((_event, rfNode) => {
    setSelectedNodeId(rfNode.id);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      if (!selectedNodeId) return;
      const updatedNodes = {
        ...flow.nodes,
        [selectedNodeId]: { ...flow.nodes[selectedNodeId], text },
      };
      onFlowChange({ nodes: updatedNodes });
    },
    [flow.nodes, onFlowChange, selectedNodeId],
  );

  const handleRemoveEffect = useCallback(
    (optionId: string, effectIndex: number) => {
      if (!selectedNodeId) return;
      const node = flow.nodes[selectedNodeId];
      if (node.kind !== 'choice') return;
      const updatedOptions = node.options.map((opt) => {
        if (opt.id !== optionId) return opt;
        const newEffects = (opt.effects ?? []).filter((_, i) => i !== effectIndex);
        return { ...opt, effects: newEffects.length > 0 ? newEffects : undefined };
      });
      const updatedNodes = {
        ...flow.nodes,
        [selectedNodeId]: { ...node, options: updatedOptions },
      };
      onFlowChange({ nodes: updatedNodes as GuidedFlow['nodes'] });
    },
    [flow.nodes, onFlowChange, selectedNodeId],
  );

  const flowNodesList = useMemo(() => Object.values(flow.nodes), [flow.nodes]);

  return (
    <section
      className="relative rounded-lg border border-outline-variant/50 bg-surface-container-lowest"
      data-testid="flow-map-canvas"
      style={{ height: '600px' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ width: selectedNode ? 'calc(100% - 320px)' : '100%' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {selectedNode && (
        <FlowMapInspector
          node={selectedNode}
          nodes={flowNodesList}
          flows={flows}
          onTextChange={handleTextChange}
          onRemoveEffect={handleRemoveEffect}
          onEditFully={() => {
            if (selectedNodeId) onEditNode(selectedNodeId);
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </section>
  );
}

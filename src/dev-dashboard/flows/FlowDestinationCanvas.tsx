import { memo, type MouseEvent, type RefObject } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { FlowNode } from '../../domain/flow-engine/types';
import { FlowDestinationNode } from './FlowDestinationNode';
import type { DestinationRFEdge, DestinationRFNode } from './flowDestinationModels';
import { previewFlowText } from './flowText';

const MemoizedDestinationNode = memo(FlowDestinationNode);
const destinationNodeTypes = {
  choice: MemoizedDestinationNode,
  score_branch: MemoizedDestinationNode,
  result: MemoizedDestinationNode,
  destination: MemoizedDestinationNode,
  sequence: MemoizedDestinationNode,
  missing: MemoizedDestinationNode,
};

export interface FlowDestinationCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  flowTitle: string;
  hasSelectedNode: boolean;
  unreachableNodes: Array<{ id: string; order: number; node?: FlowNode }>;
  onSelectNode: (nodeId: string) => void;
  nodes: DestinationRFNode[];
  edges: DestinationRFEdge[];
  onNodesChange: OnNodesChange<DestinationRFNode>;
  onEdgesChange: OnEdgesChange<DestinationRFEdge>;
  onNodeClick: NodeMouseHandler<DestinationRFNode>;
  onConnect: (connection: Connection) => void;
  onInit: (instance: ReactFlowInstance<DestinationRFNode, DestinationRFEdge>) => void;
  onEdgeClick: (event: MouseEvent, edge: DestinationRFEdge) => void;
  onMoveStart: () => void;
  onMoveEnd: () => void;
  compactViewport: boolean;
}

export function FlowDestinationCanvas({
  canvasRef,
  flowTitle,
  hasSelectedNode,
  unreachableNodes,
  onSelectNode,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onConnect,
  onInit,
  onEdgeClick,
  onMoveStart,
  onMoveEnd,
  compactViewport,
}: FlowDestinationCanvasProps) {
  return (
    <>
      {unreachableNodes.length > 0 && (
        <div className="flow-destination-map__unreachable-strip" aria-label="Etapas fora do caminho de entrada">
          <span>
            <AlertTriangle aria-hidden="true" /> Fora da entrada
          </span>
          <div>
            {unreachableNodes.map((item) => (
              <button key={item.id} type="button" className="nodrag nopan" onClick={() => onSelectNode(item.id)}>
                Etapa {item.order + 1} <small>{previewFlowText(item.node?.text ?? item.id, 34)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={canvasRef}
        className={`flow-destination-map__canvas ${hasSelectedNode ? 'flow-destination-map__canvas--with-panel' : ''}`}
        aria-label={`Mapa por destino do fluxo ${flowTitle}`}
      >
        <div className="flow-destination-map__canvas-guide" aria-hidden="true">
          Arraste para navegar · clique na linha para ir ao destino · clique na etapa para editar
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={destinationNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          onInit={onInit}
          onEdgeClick={onEdgeClick}
          onMoveStart={onMoveStart}
          onMoveEnd={onMoveEnd}
          fitView={!compactViewport}
          defaultViewport={compactViewport ? { x: 20, y: 24, zoom: 0.72 } : undefined}
          fitViewOptions={{ padding: 0.14, maxZoom: 1.08 }}
          minZoom={0.18}
          maxZoom={1.5}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="var(--color-outline-variant)" gap={28} size={1} />
          <Controls showInteractive={false} />
          {nodes.length > 10 && <MiniMap pannable zoomable ariaLabel="Minimapa do fluxo" />}
        </ReactFlow>
      </div>
    </>
  );
}

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useEdgesState, useNodesState, type ReactFlowInstance } from '@xyflow/react';
import { NODE_WIDTH } from './flowDestinationLayout';
import type { DestinationRFEdge, DestinationRFNode } from './flowDestinationModels';

export interface UseFlowDestinationCanvasOptions {
  presentation: {
    nodes: DestinationRFNode[];
    edges: DestinationRFEdge[];
  };
}

export function useFlowDestinationCanvas({ presentation }: UseFlowDestinationCanvasOptions) {
  const compactViewport = typeof window !== 'undefined' && window.innerWidth <= 620;
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<DestinationRFNode, DestinationRFEdge> | null>(null);
  const edgePointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isPanningRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<DestinationRFNode>(presentation.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DestinationRFEdge>(presentation.edges);

  useEffect(() => {
    setNodes(presentation.nodes);
    setEdges(presentation.edges);
  }, [presentation.edges, presentation.nodes, setEdges, setNodes]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      edgePointerDownRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  const handleEdgeClick = useCallback(
    (_event: MouseEvent | { clientX: number; clientY: number }, edge: DestinationRFEdge) => {
      if (isPanningRef.current) return;
      const down = edgePointerDownRef.current;
      if (down) {
        const dx = _event.clientX - down.x;
        const dy = _event.clientY - down.y;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - down.time;
        if (dist > 8 || elapsed > 700) return;
      }
      const targetId = edge.target;
      if (!targetId) return;
      const rfNode = rfInstance?.getNode(targetId);
      const fallbackNode = nodes.find((node) => node.id === targetId);
      const position = rfNode?.position ?? fallbackNode?.position;
      if (!position) return;
      const width = rfNode?.measured?.width ?? fallbackNode?.measured?.width ?? NODE_WIDTH;
      const height = rfNode?.measured?.height ?? fallbackNode?.measured?.height ?? 110;
      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const zoom = rfInstance?.getZoom() ?? 0.88;
      try {
        rfInstance?.setCenter(centerX, centerY, { zoom, duration: 420 });
      } catch {
        rfInstance?.setCenter(centerX, centerY, { zoom });
      }
    },
    [rfInstance, nodes],
  );

  const onMoveStart = useCallback(() => {
    isPanningRef.current = true;
  }, []);

  const onMoveEnd = useCallback(() => {
    window.setTimeout(() => {
      isPanningRef.current = false;
    }, 120);
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    rfInstance,
    setRfInstance,
    handleEdgeClick,
    compactViewport,
    onMoveStart,
    onMoveEnd,
  };
}

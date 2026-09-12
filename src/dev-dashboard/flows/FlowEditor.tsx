import { useState, useMemo, useEffect } from 'react';
import type {
  ChoiceFlowNode,
  FlowNode,
  GuidedFlow,
  OrientationVideo,
  OrientationVisual,
  ScoreBranchFlowNode,
} from '../../domain/flow-engine/types';
import { FlowEditorInitialConfig } from './FlowEditorInitialConfig';
import { FlowEditorNodeCard } from './FlowEditorNodeCard';
import { FlowEditorOptionDrawer, type ActiveOptionEdit } from './FlowEditorOptionDrawer';
import { createUniqueId } from './flowEditorUtils';

export function FlowEditor({
  flow,
  flows,
  onChange,
  selectedNodeId,
  scrollRequest,
  nodeSearch,
  activeNodeFilter,
  onSelectNodeId,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onChange: (patch: Partial<GuidedFlow>) => void;
  selectedNodeId: string | null;
  scrollRequest: { nodeId: string; requestId: number } | null;
  nodeSearch: string;
  activeNodeFilter: 'all' | 'result' | 'safety' | 'branch';
  onSelectNodeId: (nodeId: string | null) => void;
}) {
  const [activeOptionEdit, setActiveOptionEdit] = useState<ActiveOptionEdit | null>(null);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const [initialConfigCollapsed, setInitialConfigCollapsed] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  useEffect(() => {
    if (scrollRequest) {
      const element = document.getElementById(`flow-node-${scrollRequest.nodeId}`);
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [scrollRequest]);

  const nodes = useMemo(() => {
    if (flow.nodeOrder) {
      const nodeMap = flow.nodes;
      const ordered = flow.nodeOrder.filter((id) => nodeMap[id]).map((id) => nodeMap[id]);
      Object.values(nodeMap).forEach((node) => {
        if (!flow.nodeOrder?.includes(node.id)) {
          ordered.push(node);
        }
      });
      return ordered;
    }
    return Object.values(flow.nodes);
  }, [flow.nodes, flow.nodeOrder]);

  function handleMoveNode(nodeId: string, direction: 'up' | 'down') {
    const currentOrder = nodes.map((n) => n.id);
    const currentIndex = currentOrder.indexOf(nodeId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    onChange({ nodeOrder: newOrder });
  }
  const existingScoreKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.values(flow.nodes).forEach((node) => {
      if (node.kind === 'choice') {
        node.options.forEach((option) => {
          option.effects?.forEach((effect) => {
            if (effect.kind === 'score') {
              keys.add(effect.scoreKey);
            }
          });
        });
      } else if (node.kind === 'score_branch') {
        keys.add(node.scoreKey);
      }
    });
    return Array.from(keys).filter(Boolean);
  }, [flow]);
  const firstNodeId = nodes[0]?.id ?? flow.entry.nodeId;

  function nodeHasDeferredSafety(node: FlowNode) {
    return (
      node.kind === 'choice' &&
      node.options.some((option) => option.effects?.some((effect) => effect.kind === 'deferred_safety'))
    );
  }

  const visibleNodes = nodes.filter((node) => {
    const normalizedSearch = nodeSearch.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch =
      !normalizedSearch ||
      node.id.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      node.text.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

    if (!matchesSearch) return false;
    if (activeNodeFilter === 'result') return node.kind === 'result';
    if (activeNodeFilter === 'branch') return node.kind === 'score_branch';
    if (activeNodeFilter === 'safety') return nodeHasDeferredSafety(node);
    return true;
  });

  function updateEntry(patch: Partial<GuidedFlow['entry']>) {
    onChange({ entry: { ...flow.entry, ...patch } });
  }

  function updateEnteringPhrase(index: number, value: string) {
    updateEntry({
      enteringPhrases: flow.entry.enteringPhrases.map((phrase, phraseIndex) =>
        phraseIndex === index ? value : phrase,
      ),
    });
  }

  function addEnteringPhrase() {
    updateEntry({ enteringPhrases: [...flow.entry.enteringPhrases, 'Nova frase'] });
  }

  function updateNode(nodeId: string, patch: Partial<FlowNode>) {
    onChange({
      nodes: {
        ...flow.nodes,
        [nodeId]: { ...flow.nodes[nodeId], ...patch } as FlowNode,
      },
    });
  }

  function addNodeVideo(node: FlowNode) {
    const videos = node.videos ?? [];
    const videoId = createUniqueId('video', Object.fromEntries(videos.map((video) => [video.id, video])));
    updateNode(node.id, {
      videos: [...videos, { id: videoId, title: 'Novo vídeo', url: '' }],
    });
  }

  function updateNodeVideo(node: FlowNode, videoId: string, patch: Partial<OrientationVideo>) {
    updateNode(node.id, {
      videos: (node.videos ?? []).map((video) => (video.id === videoId ? { ...video, ...patch } : video)),
    });
  }

  function removeNodeVideo(node: FlowNode, videoId: string) {
    const videos = (node.videos ?? []).filter((video) => video.id !== videoId);
    updateNode(node.id, { videos: videos.length > 0 ? videos : undefined });
  }

  function addNodeVisual(node: FlowNode) {
    const visuals = node.visuals ?? [];
    const visualId = createUniqueId('visual', Object.fromEntries(visuals.map((visual) => [visual.id, visual])));
    updateNode(node.id, { visuals: [...visuals, { id: visualId, alt: '', src: '' }] });
  }

  function updateNodeVisual(node: FlowNode, visualId: string, patch: Partial<OrientationVisual>) {
    updateNode(node.id, {
      visuals: (node.visuals ?? []).map((visual) => (visual.id === visualId ? { ...visual, ...patch } : visual)),
    });
  }

  function removeNodeVisual(node: FlowNode, visualId: string) {
    const visuals = (node.visuals ?? []).filter((visual) => visual.id !== visualId);
    updateNode(node.id, { visuals: visuals.length > 0 ? visuals : undefined });
  }

  function replaceNode(node: FlowNode) {
    onChange({
      nodes: {
        ...flow.nodes,
        [node.id]: node,
      },
    });
  }

  function duplicateNode(nodeId: string) {
    const sourceNode = flow.nodes[nodeId];
    if (!sourceNode) return;

    const newId = createUniqueId(`${nodeId}_copia`, flow.nodes);
    const clonedNode = JSON.parse(JSON.stringify(sourceNode)) as FlowNode;
    clonedNode.id = newId;

    const nextNodes = { ...flow.nodes };
    nextNodes[newId] = clonedNode;

    if (sourceNode.kind === 'choice') {
      const updatedSource = {
        ...sourceNode,
        options: sourceNode.options.map((option) => ({
          ...option,
          next: newId,
        })),
      };
      nextNodes[nodeId] = updatedSource;
    }

    onChange({ nodes: nextNodes });
    onSelectNodeId(newId);
  }

  function deleteNode(nodeId: string) {
    const nextNodes = { ...flow.nodes };
    delete nextNodes[nodeId];
    onChange({ nodes: nextNodes });

    const remainingNodes = Object.values(nextNodes);
    if (remainingNodes.length > 0) {
      onSelectNodeId(remainingNodes[0].id);
    } else {
      onSelectNodeId(null);
    }
    setConfirmDeleteNodeId(null);
  }

  function updateNodeKind(node: FlowNode, kind: FlowNode['kind']) {
    if (node.kind === kind) return;

    if (kind === 'choice') {
      replaceNode({
        id: node.id,
        kind: 'choice',
        text: node.text,
        videos: node.videos,
        visuals: node.visuals,
        options: [],
      });
      return;
    }

    if (kind === 'result') {
      replaceNode({ id: node.id, kind: 'result', text: node.text, videos: node.videos, visuals: node.visuals });
      return;
    }

    if (kind === 'score_branch') {
      replaceNode({
        id: node.id,
        kind: 'score_branch',
        text: node.text,
        videos: node.videos,
        visuals: node.visuals,
        scoreKey: existingScoreKeys[0] ?? '',
        branches: [{ id: 'faixa_1', min: 0, max: 0, next: firstNodeId }],
      });
    }
  }

  function updateChoiceOption(
    node: ChoiceFlowNode,
    optionId: string,
    patch: Partial<ChoiceFlowNode['options'][number]>,
  ) {
    updateNode(node.id, {
      options: node.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
    });
  }

  function handleOpenOptionEdit(node: ChoiceFlowNode, optionId: string) {
    const option = node.options.find((opt) => opt.id === optionId);
    if (option && existingScoreKeys.length > 0) {
      const isSrq20Q17 = flow.id === 'srq20' && node.id === 'q17';
      const isScoringOption = option.id === 'yes' || option.label.toLowerCase() === 'sim';
      if (!isSrq20Q17 && isScoringOption) {
        const hasScore = option.effects?.some((effect) => effect.kind === 'score');
        if (!hasScore) {
          // Auto-initialize score effect
          const nextEffects = [
            ...(option.effects ?? []),
            { kind: 'score' as const, scoreKey: existingScoreKeys[0], value: 1 },
          ];
          updateChoiceOption(node, optionId, { effects: nextEffects });
        }
      }
    }
    setActiveOptionEdit({ nodeId: node.id, optionId });
  }

  function addOption(node: ChoiceFlowNode) {
    const optionId = createUniqueId(
      'nova_opcao',
      Object.fromEntries(node.options.map((option) => [option.id, option])),
    );
    updateNode(node.id, {
      options: [
        ...node.options,
        {
          id: optionId,
          label: 'Nova opção',
          next: firstNodeId,
        },
      ],
    });
  }

  function updateOptionEffects(
    node: ChoiceFlowNode,
    optionId: string,
    update: (effects: ChoiceFlowNode['options'][number]['effects']) => ChoiceFlowNode['options'][number]['effects'],
  ) {
    const option = node.options.find((item) => item.id === optionId);
    if (!option) return;

    const currentEffects = option.effects ?? [];
    const nextEffects = update(currentEffects);

    updateChoiceOption(node, optionId, {
      effects: nextEffects?.length ? nextEffects : undefined,
    });
  }

  function updateScoreBranchNode(node: ScoreBranchFlowNode, patch: Partial<ScoreBranchFlowNode>) {
    replaceNode({ ...node, ...patch });
  }

  function updateScoreBranchRange(
    node: ScoreBranchFlowNode,
    branchId: string,
    patch: Partial<ScoreBranchFlowNode['branches'][number]>,
  ) {
    updateScoreBranchNode(node, {
      branches: node.branches.map((branch) => (branch.id === branchId ? { ...branch, ...patch } : branch)),
    });
  }

  function addScoreBranchRange(node: ScoreBranchFlowNode) {
    const branchId = createUniqueId('faixa', Object.fromEntries(node.branches.map((branch) => [branch.id, branch])));
    updateScoreBranchNode(node, {
      branches: [...node.branches, { id: branchId, min: 0, max: 0, next: firstNodeId }],
    });
  }

  function removeScoreBranchRange(node: ScoreBranchFlowNode, branchId: string) {
    updateScoreBranchNode(node, {
      branches: node.branches.filter((branch) => branch.id !== branchId),
    });
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <FlowEditorInitialConfig
        flow={flow}
        nodes={nodes}
        collapsed={initialConfigCollapsed}
        onToggle={() => setInitialConfigCollapsed((collapsed) => !collapsed)}
        onChange={onChange}
        onEntryChange={updateEntry}
        onEnteringPhraseChange={updateEnteringPhrase}
        onAddEnteringPhrase={addEnteringPhrase}
      />

      <section className="flex flex-col gap-stack-sm">
        <h3 className="font-headline-sm text-on-surface">Etapas</h3>
        <div className="flex flex-col gap-3">
          {visibleNodes.length > 0 ? (
            visibleNodes.map((node, index) => {
              const globalIndex = nodes.findIndex((item) => item.id === node.id);
              return (
                <FlowEditorNodeCard
                  key={node.id}
                  flow={flow}
                  node={node}
                  nodes={nodes}
                  stepNumber={globalIndex !== -1 ? globalIndex + 1 : index + 1}
                  isFirst={globalIndex === 0}
                  isLast={globalIndex === nodes.length - 1}
                  selected={node.id === selectedNodeId}
                  confirmDelete={confirmDeleteNodeId === node.id}
                  existingScoreKeys={existingScoreKeys}
                  imageError={imageError}
                  onSelectNodeId={onSelectNodeId}
                  onMoveNode={handleMoveNode}
                  onDuplicateNode={duplicateNode}
                  onDeleteNode={deleteNode}
                  onRequestDeleteNode={setConfirmDeleteNodeId}
                  onUpdateNode={updateNode}
                  onUpdateNodeKind={updateNodeKind}
                  onAddNodeVideo={addNodeVideo}
                  onUpdateNodeVideo={updateNodeVideo}
                  onRemoveNodeVideo={removeNodeVideo}
                  onAddNodeVisual={addNodeVisual}
                  onUpdateNodeVisual={updateNodeVisual}
                  onRemoveNodeVisual={removeNodeVisual}
                  setImageError={setImageError}
                  onAddOption={addOption}
                  onOpenOptionEdit={handleOpenOptionEdit}
                  onUpdateChoiceOption={updateChoiceOption}
                  onUpdateScoreBranchNode={updateScoreBranchNode}
                  onAddScoreBranchRange={addScoreBranchRange}
                  onUpdateScoreBranchRange={updateScoreBranchRange}
                  onRemoveScoreBranchRange={removeScoreBranchRange}
                />
              );
            })
          ) : (
            <p className="font-body-md text-on-surface-variant p-4 text-center bg-surface-container-lowest rounded-lg border border-outline-variant/50">
              Nenhuma etapa correspondente aos filtros.
            </p>
          )}
        </div>
      </section>

      {activeOptionEdit && (
        <FlowEditorOptionDrawer
          flow={flow}
          flows={flows}
          activeOptionEdit={activeOptionEdit}
          existingScoreKeys={existingScoreKeys}
          onClose={() => setActiveOptionEdit(null)}
          onUpdateChoiceOption={updateChoiceOption}
          onUpdateOptionEffects={updateOptionEffects}
        />
      )}
    </section>
  );
}

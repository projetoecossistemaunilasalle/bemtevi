import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChoiceFlowNode,
  FlowEffect,
  FlowNode,
  FlowOption,
  GuidedFlow,
  ResultFlowNode,
  ScoreBranch,
  ScoreBranchFlowNode,
} from '../../domain/flow-engine/types';
import { deleteNode, duplicateNode, moveNode, setEntryNode } from './flowMutations';
import type { MapFocusSection } from './flowDisplay';
import { buildFlowTopology, type FlowTopologyNode } from './flowTopology';
import { TargetSelect } from './flowTargetSelect';
import {
  EffectFields,
  EFFECT_KIND_OPTIONS,
  buildDefaultEffect,
  effectColors,
  effectSummaries,
  selectClassName,
} from './flowEffectFields';
import { Button } from '../../design-system/components/Button';

const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

/** First free `${node.id}-option-N`, matching switchNodeKind's naming convention. */
function uniqueOptionId(node: ChoiceFlowNode): string {
  let index = node.options.length + 1;
  let candidate = `${node.id}-option-${index}`;
  while (node.options.some((option) => option.id === candidate)) {
    index += 1;
    candidate = `${node.id}-option-${index}`;
  }
  return candidate;
}

/** First free `${node.id}-faixa-N` within the branch list, same convention as switchNodeKind. */
function uniqueBranchId(node: ScoreBranchFlowNode): string {
  let index = node.branches.length + 1;
  let candidate = `${node.id}-faixa-${index}`;
  while (node.branches.some((branch) => branch.id === candidate)) {
    index += 1;
    candidate = `${node.id}-faixa-${index}`;
  }
  return candidate;
}

/** First free `${node.id}-video-N`, available to every node kind. */
function uniqueVideoId(node: FlowNode): string {
  const videos = node.videos ?? [];
  let index = videos.length + 1;
  let candidate = `${node.id}-video-${index}`;
  while (videos.some((video) => video.id === candidate)) {
    index += 1;
    candidate = `${node.id}-video-${index}`;
  }
  return candidate;
}

/**
 * Advisory-only YouTube detection for the video URL hint; authoritative URL
 * validation stays in the flow summary (single source of truth).
 */
const YOUTUBE_URL_PATTERN = /youtube\.com|youtu\.be/i;

const textFieldClassName =
  'rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary';

interface DraftTextFieldProps {
  ariaLabel: string;
  value: string;
  /** Invoked at most once per blur and only when the draft differs from `value`. */
  onCommit: (next: string) => void;
}

/** Single-line text field with a per-field draft sentinel; commits onBlur like option labels. */
function DraftTextField({ ariaLabel, value, onCommit }: DraftTextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={ariaLabel}
      className={textFieldClassName}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        if (draft !== null && draft !== value) onCommit(draft);
      }}
    />
  );
}

interface DraftNumberFieldProps {
  ariaLabel: string;
  value: number;
  /** Never receives NaN: empty or non-numeric drafts are ignored on blur. */
  onCommit: (next: number) => void;
}

/**
 * Number input that never emits NaN — same contract as the effects module's
 * private EffectNumberField, addressed by aria-label for row-scoped fields.
 */
function DraftNumberField({ ariaLabel, value, onCommit }: DraftNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      className={textFieldClassName}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        const trimmed = draft?.trim() ?? '';
        if (trimmed === '') return; // Number('') === 0, so guard before parsing.
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed === value) return;
        onCommit(parsed);
      }}
    />
  );
}

interface OptionRowProps {
  option: FlowOption;
  index: number;
  targets: FlowTopologyNode[];
  flows: GuidedFlow[];
  /**
   * Updater-style edit channel for this row's option. Callers must invoke it
   * AT MOST ONCE per user event (single synchronous commit per event); the
   * `update` function is resolved against the latest committed option when the
   * panel handles the event, so it must never capture a render-time snapshot.
   */
  onOptionUpdate: (update: (current: FlowOption) => FlowOption) => void;
  onRemove: () => void;
}

/**
 * One editable option row: label, target, typed effect builder and remove
 * action. The label keeps a per-row draft (null = no pending edit, so external
 * values flow straight through). Commit happens onBlur by comparing the draft
 * to the last committed label — scoped per row on purpose, never via the
 * shared document.activeElement guard, so editing a label can't clobber
 * sibling rows or the texto textarea.
 */
function OptionRow({ option, index, targets, flows, onOptionUpdate, onRemove }: OptionRowProps) {
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const displayedLabel = draftLabel ?? option.label;
  const effects = option.effects ?? [];
  const presentKinds = new Set(effects.map((effect) => effect.kind));

  return (
    <div
      data-testid={`option-row-${index + 1}`}
      className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2"
    >
      <input
        aria-label={`Rótulo da opção ${index + 1}`}
        className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
        value={displayedLabel}
        onChange={(event) => setDraftLabel(event.target.value)}
        onBlur={() => {
          setDraftLabel(null);
          if (draftLabel !== null && draftLabel !== option.label) {
            onOptionUpdate((current) => ({ ...current, label: draftLabel }));
          }
        }}
      />
      {/* Selects don't blur reliably; commit the target immediately on change. */}
      <TargetSelect
        ariaLabel={`Destino da opção ${index + 1}`}
        value={option.next}
        onChange={(next) => onOptionUpdate((current) => ({ ...current, next }))}
        nodes={targets}
        allowEmpty
      />
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {effects.map((effect, effectIndex) => (
            <span
              key={effectIndex}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${effectColors[effect.kind]}`}
            >
              {
                // One cast mirrors patchEffect's narrowing limit: writers are
                // keyed exhaustively by kind, so the runtime kind guarantees
                // the matching writer's parameter.
                (effectSummaries[effect.kind] as (effect: FlowEffect) => string)(effect)
              }
              <button
                type="button"
                aria-label={`Remover efeito ${effectIndex + 1} (${effect.kind}) da opção ${index + 1}`}
                onClick={() =>
                  onOptionUpdate((current) => {
                    const remaining =
                      current.effects?.filter((_, candidateIndex) => candidateIndex !== effectIndex) ?? [];
                    if (remaining.length === 0) {
                      // Dropping the last chip removes the key entirely.
                      const { effects: _dropped, ...optionWithoutEffects } = current;
                      return optionWithoutEffects;
                    }
                    return { ...current, effects: remaining };
                  })
                }
                className="ml-0.5 rounded-full hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Controlled "menu" select: always resets to the placeholder after appending. */}
      <select
        aria-label={`Adicionar efeito à opção ${index + 1}`}
        className={selectClassName}
        value=""
        onChange={(event) => {
          const { value } = event.target;
          if (value === '') return;
          const kind = value as FlowEffect['kind'];
          onOptionUpdate((current) => ({
            ...current,
            effects: [...(current.effects ?? []), buildDefaultEffect(kind, flows)],
          }));
        }}
      >
        <option value="">Adicionar efeito…</option>
        {EFFECT_KIND_OPTIONS.filter((candidate) => candidate.kind === 'score' || !presentKinds.has(candidate.kind)).map(
          (candidate) => (
            <option key={candidate.kind} value={candidate.kind}>
              {candidate.label}
            </option>
          ),
        )}
      </select>
      {effects.map((effect, effectIndex) => (
        <div
          key={`${effect.kind}-${effectIndex}`}
          className="flex flex-col gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-2"
        >
          <EffectFields
            effect={effect}
            effectIndex={effectIndex}
            optionId={option.id}
            flows={flows}
            onEffectUpdate={(update) =>
              onOptionUpdate((current) => ({
                ...current,
                effects: (current.effects ?? []).map((candidate, candidateIndex) =>
                  candidateIndex === effectIndex ? update(candidate) : candidate,
                ),
              }))
            }
          />
        </div>
      ))}
      <button
        type="button"
        aria-label={`Remover opção ${index + 1}`}
        onClick={onRemove}
        className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
      >
        Remover opção
      </button>
    </div>
  );
}

/** Opções body for choice nodes: one row per option plus free-text routing. */
function ChoiceOptionsSection({
  node,
  targets,
  flows,
  onNodeChange,
}: {
  node: ChoiceFlowNode;
  targets: FlowTopologyNode[];
  flows: GuidedFlow[];
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: (update: (current: ChoiceFlowNode) => ChoiceFlowNode) => void;
}) {
  /**
   * Routes one option-scoped edit through the node-level updater. The mapping
   * runs against the LATEST options at event time — never against this
   * render's snapshot — and performs exactly one commit.
   */
  const commitOption = (optionId: string, update: (current: FlowOption) => FlowOption) =>
    onNodeChange((current) => ({
      ...current,
      options: current.options.map((candidate) => (candidate.id === optionId ? update(candidate) : candidate)),
    }));

  return (
    <>
      {node.options.map((option, index) => (
        <OptionRow
          key={option.id}
          option={option}
          index={index}
          targets={targets}
          flows={flows}
          onOptionUpdate={(update) => commitOption(option.id, update)}
          onRemove={() =>
            onNodeChange((current) => ({
              ...current,
              options: current.options.filter((candidate) => candidate.id !== option.id),
            }))
          }
        />
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            options: [...current.options, { id: uniqueOptionId(current), label: '', next: '' }],
          }))
        }
      >
        Adicionar opção
      </Button>
      <label className="flex items-center gap-2 font-label-sm text-sm text-on-surface">
        <input
          type="checkbox"
          checked={Boolean(node.freeText)}
          onChange={(event) =>
            onNodeChange((current) => {
              if (event.target.checked) return { ...current, freeText: { next: current.freeText?.next ?? '' } };
              const { freeText: _dropped, ...nodeWithoutFreeText } = current;
              return nodeWithoutFreeText;
            })
          }
        />
        Aceitar resposta livre
      </label>
      {node.freeText && (
        <TargetSelect
          ariaLabel="Destino da resposta livre"
          value={node.freeText.next}
          onChange={(next) => onNodeChange((current) => ({ ...current, freeText: { next } }))}
          nodes={targets}
          allowEmpty
        />
      )}
    </>
  );
}

interface ScoreBranchSectionProps {
  node: ScoreBranchFlowNode;
  targets: FlowTopologyNode[];
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: (update: (current: ScoreBranchFlowNode) => ScoreBranchFlowNode) => void;
}

/** Ramificação body: the score key plus one editable range row per branch. */
function ScoreBranchSection({ node, targets, onNodeChange }: ScoreBranchSectionProps) {
  /**
   * Routes one branch-scoped edit through the node-level updater. The mapping
   * runs against the LATEST branches at event time — never against this
   * render's snapshot — and addresses rows by position so duplicate legacy ids
   * can't fan a commit out to sibling rows. Exactly one commit per event.
   */
  const commitBranch = (index: number, update: (current: ScoreBranch) => ScoreBranch) =>
    onNodeChange((current) => ({
      ...current,
      branches: current.branches.map((candidate, candidateIndex) =>
        candidateIndex === index ? update(candidate) : candidate,
      ),
    }));

  return (
    <>
      <DraftTextField
        ariaLabel="Pontuação usada"
        value={node.scoreKey}
        onCommit={(scoreKey) => onNodeChange((current) => ({ ...current, scoreKey }))}
      />
      {node.branches.map((branch, index) => (
        <div
          key={branch.id}
          data-testid={`branch-row-${index + 1}`}
          className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2"
        >
          <div className="flex gap-2">
            <DraftNumberField
              ariaLabel={`De ${index + 1}`}
              value={branch.min}
              onCommit={(min) => commitBranch(index, (current) => ({ ...current, min }))}
            />
            <DraftNumberField
              ariaLabel={`Até ${index + 1}`}
              value={branch.max}
              onCommit={(max) => commitBranch(index, (current) => ({ ...current, max }))}
            />
          </div>
          {/* Selects don't blur reliably; commit the target immediately on change. */}
          <TargetSelect
            ariaLabel={`Destino da faixa ${index + 1}`}
            value={branch.next}
            onChange={(next) => commitBranch(index, (current) => ({ ...current, next }))}
            nodes={targets}
            allowEmpty
          />
          <button
            type="button"
            aria-label={`Remover faixa ${index + 1}`}
            onClick={() =>
              onNodeChange((current) => ({
                ...current,
                branches: current.branches.filter((_, candidateIndex) => candidateIndex !== index),
              }))
            }
            className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
          >
            Remover faixa
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            branches: [...current.branches, { id: uniqueBranchId(current), min: 0, max: 0, next: '' }],
          }))
        }
      >
        Adicionar faixa
      </Button>
    </>
  );
}

type MediaNodeChange = (update: (current: FlowNode) => FlowNode) => void;

interface MediaSectionProps {
  node: FlowNode;
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: MediaNodeChange;
}

/** Mídia body: video rows for every kind, recommendations for result nodes only. */
function MediaSection({ node, onNodeChange }: MediaSectionProps) {
  const videos = node.videos ?? [];

  return (
    <>
      {videos.map((video, index) => (
        <div
          key={video.id}
          data-testid={`video-row-${index + 1}`}
          className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2"
        >
          <DraftTextField
            ariaLabel={`Título do vídeo ${index + 1}`}
            value={video.title}
            onCommit={(title) =>
              onNodeChange((current) => ({
                ...current,
                videos: (current.videos ?? []).map((candidate, candidateIndex) =>
                  candidateIndex === index ? { ...candidate, title } : candidate,
                ),
              }))
            }
          />
          <div>
            <DraftTextField
              ariaLabel={`URL do vídeo ${index + 1}`}
              value={video.url}
              onCommit={(url) =>
                onNodeChange((current) => ({
                  ...current,
                  videos: (current.videos ?? []).map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, url } : candidate,
                  ),
                }))
              }
            />
            {/* Advisory only; the summary owns authoritative URL validation. */}
            {video.url !== '' && !YOUTUBE_URL_PATTERN.test(video.url) && (
              <p className="mt-1 font-body-md text-xs text-on-surface-variant">Use um link completo do YouTube.</p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Remover vídeo ${index + 1}`}
            onClick={() =>
              onNodeChange((current) => {
                const remaining = (current.videos ?? []).filter((_, candidateIndex) => candidateIndex !== index);
                if (remaining.length === 0) {
                  // Dropping the last video removes the key entirely.
                  const { videos: _dropped, ...nodeWithoutVideos } = current;
                  return nodeWithoutVideos;
                }
                return { ...current, videos: remaining };
              })
            }
            className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
          >
            Remover vídeo
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            videos: [...(current.videos ?? []), { id: uniqueVideoId(current), title: '', url: '' }],
          }))
        }
      >
        Adicionar vídeo
      </Button>
      {node.kind === 'result' && <RecommendationsField node={node} onNodeChange={onNodeChange} />}
    </>
  );
}

interface RecommendationsFieldProps {
  node: ResultFlowNode;
  onNodeChange: MediaNodeChange;
}

/**
 * One recommendation per line: displays the committed list joined by newlines
 * and commits the draft split back into trimmed, non-empty lines. A no-op edit
 * commits nothing; an emptied list drops the `recommendations` key entirely.
 */
function RecommendationsField({ node, onNodeChange }: RecommendationsFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const joined = (node.recommendations ?? []).join('\n');
  return (
    <textarea
      aria-label="Recomendações da etapa final"
      placeholder="Uma recomendação por linha."
      className={`min-h-[80px] ${textFieldClassName}`}
      value={draft ?? joined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        if (draft === null) return;
        const nextLines = draft
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '');
        const currentLines = node.recommendations ?? [];
        if (nextLines.length === currentLines.length && nextLines.every((line, i) => line === currentLines[i])) return;
        onNodeChange((current) => {
          if (current.kind !== 'result') return current; // narrowing guard, mirrors patchEffect
          if (nextLines.length === 0) {
            const { recommendations: _dropped, ...nodeWithoutRecommendations } = current;
            return nodeWithoutRecommendations;
          }
          return { ...current, recommendations: nextLines };
        });
      }}
    />
  );
}

/**
 * Structured side panel for editing a single flow stage in place, mounted
 * inside the destination map: the map owns canvas selection and drives
 * `nodeId`, forwards this panel's narrow patches through its `onFlowChange`,
 * and routes `onEditLegacy` to the full legacy editor.
 *
 * Callers must remount this panel per node (key={nodeId}) — the text guard
 * assumes unmount on switch.
 */
export interface NodeEditorPanelProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  nodeId: string;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onClose: () => void;
  /** Opens the legacy full editor for this node. */
  onEditLegacy: () => void;
  /** Scroll/focus request for a named panel section; bump requestId to re-fire. */
  focusRequest?: { section?: MapFocusSection; requestId: number } | null;
}

export function NodeEditorPanel({
  flow,
  flows,
  nodeId,
  onFlowChange,
  onClose,
  onEditLegacy,
  focusRequest,
}: NodeEditorPanelProps) {
  const node = flow.nodes[nodeId];
  const [localText, setLocalText] = useState(node?.text ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Topology feeds every target select; recomputed only when flow/flows change.
  const topology = useMemo(() => buildFlowTopology(flow, flows), [flow, flows]);

  // Follow external text changes unless the user is mid-edit in the textarea.
  if (node && localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  useEffect(() => {
    if (!focusRequest?.section) return;
    const section = containerRef.current?.querySelector<HTMLElement>(`[data-section="${focusRequest.section}"]`);
    section?.scrollIntoView({ block: 'nearest' });
    // Keyed on requestId only so repeated identical requests re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.requestId]);

  if (!node) return null;

  const isEntry = flow.entry.nodeId === nodeId;
  // Same ordering the topology uses for TargetSelect step labels; 0 only for a
  // node missing from its own topology (defensive, not reachable today).
  const stepNumber = topology.nodeById[nodeId]?.stepNumber ?? 0;

  // Effective step order behind moveNode: explicit nodeOrder when present,
  // otherwise the nodes record's insertion order. Drives the footer buttons'
  // disabled states (first/last of that order cannot move further).
  const effectiveOrder = flow.nodeOrder ?? Object.keys(flow.nodes);
  const effectiveIndex = effectiveOrder.indexOf(nodeId);
  const isFirstStep = effectiveIndex <= 0;
  const isLastStep = effectiveIndex === -1 || effectiveIndex >= effectiveOrder.length - 1;

  /** Structural patches stay narrow: only the keys the mutation actually touched. */
  const toNodesPatch = (next: GuidedFlow): Partial<GuidedFlow> => ({
    nodes: next.nodes,
    ...(next.nodeOrder ? { nodeOrder: next.nodeOrder } : {}),
  });

  /**
   * Reordering only ever changes `nodeOrder` — moveNode swaps within an
   * existing order or materializes it from insertion order, so the patch is
   * exactly `{nodeOrder}` either way (nodes content is untouched).
   */
  const handleMoveClick = (direction: 'up' | 'down') => {
    const result = moveNode(flow, nodeId, direction);
    if (!result.moved) return;
    onFlowChange({ nodeOrder: result.flow.nodeOrder });
  };

  const handleSetEntryClick = () => {
    onFlowChange({ entry: setEntryNode(flow, nodeId).entry });
  };

  const handleDuplicateClick = () => {
    onFlowChange(toNodesPatch(duplicateNode(flow, nodeId).flow));
  };

  const handleDeleteClick = () => {
    const result = deleteNode(flow, nodeId);
    if (result.error === 'last-node') {
      window.alert('O fluxo precisa ter pelo menos uma etapa.');
      return;
    }
    const brokenCount = result.broken.length;
    const consequence =
      brokenCount === 0
        ? 'Nenhuma conexão será afetada'
        : brokenCount === 1
          ? '1 conexão ficará sem destino'
          : `${brokenCount} conexões ficarão sem destino`;
    if (window.confirm(`Excluir esta etapa? ${consequence}`)) {
      onFlowChange(toNodesPatch(result.flow));
    }
  };

  /**
   * Whole-node replacement scoped to this node's record key.
   *
   * One-commit-per-event contract: editing helpers hand this an UPDATER and it
   * is resolved against the flow props current at event time — never against a
   * render-time snapshot captured in a closure. Helpers must call it at most
   * once per user event; multi-field edits must compose into a single updater.
   */
  const handleChoiceNodeChange = (update: (current: ChoiceFlowNode) => ChoiceFlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (currentNode?.kind !== 'choice') return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
  };

  /** Score-branch twin of the choice channel above: same updater-at-event-time, one-commit-per-event contract. */
  const handleScoreBranchNodeChange = (update: (current: ScoreBranchFlowNode) => ScoreBranchFlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (currentNode?.kind !== 'score_branch') return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
  };

  /**
   * Kind-agnostic media channel (videos on every kind, recommendations on
   * results): resolves the UPDATER against the flow props current at event
   * time and emits one narrow `{nodes}` patch per user event, like the
   * kind-scoped channels above.
   */
  const handleNodeMediaChange = (update: (current: FlowNode) => FlowNode) => {
    const currentNode = flow.nodes[nodeId];
    if (!currentNode) return;
    onFlowChange({ nodes: { ...flow.nodes, [nodeId]: update(currentNode) } });
  };

  return (
    <div
      ref={containerRef}
      data-testid="node-editor-panel"
      className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest p-4 shadow-lg"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-label-md text-on-surface">{`Etapa ${stepNumber}`}</h2>
          <span className="mt-1 inline-block rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-xs text-on-surface-variant">
            {kindLabels[node.kind]}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fechar painel de edição"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <section data-section="texto" className="flex flex-col gap-1">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Texto</h3>
        <textarea
          aria-label="Texto da etapa"
          className="min-h-[80px] rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            if (localText !== node.text) {
              onFlowChange({ nodes: { ...flow.nodes, [nodeId]: { ...node, text: localText } } });
            }
          }}
        />
      </section>

      {node.kind === 'choice' && (
        <section data-section="opcoes" className="flex flex-col gap-2">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Opções</h3>
          <ChoiceOptionsSection
            node={node}
            targets={topology.nodes}
            flows={flows}
            onNodeChange={handleChoiceNodeChange}
          />
        </section>
      )}
      {node.kind === 'score_branch' && (
        <section data-section="ramificacao" className="flex flex-col gap-2">
          <h3 className="font-label-sm text-xs text-on-surface-variant">Ramificação</h3>
          <ScoreBranchSection node={node} targets={topology.nodes} onNodeChange={handleScoreBranchNodeChange} />
        </section>
      )}
      {/* Mídia stays renderable for every kind: the add-video affordance is always available. */}
      <section data-section="midia" className="flex flex-col gap-2">
        <h3 className="font-label-sm text-xs text-on-surface-variant">Mídia</h3>
        <MediaSection node={node} onNodeChange={handleNodeMediaChange} />
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={isFirstStep}
            aria-label="Mover etapa para cima"
            onClick={() => handleMoveClick('up')}
          >
            Mover etapa para cima
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={isLastStep}
            aria-label="Mover etapa para baixo"
            onClick={() => handleMoveClick('down')}
          >
            Mover etapa para baixo
          </Button>
        </div>
        <Button variant="secondary" size="sm" className="w-full" disabled={isEntry} onClick={handleSetEntryClick}>
          Definir como entrada
        </Button>
        <Button variant="secondary" size="sm" className="w-full" onClick={handleDuplicateClick}>
          Duplicar etapa
        </Button>
        <Button variant="danger" size="sm" className="w-full" onClick={handleDeleteClick}>
          Excluir etapa
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onEditLegacy}>
          Abrir no editor legado
        </Button>
      </div>
    </div>
  );
}

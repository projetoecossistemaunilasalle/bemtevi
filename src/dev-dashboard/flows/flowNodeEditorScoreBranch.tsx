import { ArrowRight } from 'lucide-react';
import type { ScoreBranch, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { BranchNameField, DraftNumberField, DraftTextField } from './flowEditorFields';
import { uniqueBranchId } from './flowMutations';
import { selectClassName } from './flowEffectFields';
import { TargetSelect } from './flowTargetSelect';
import { NAVIGATION_OPTIONS } from './nodeEditorUtils';
import type { FlowTopologyNode } from './flowTopology';

interface ScoreBranchSectionProps {
  node: ScoreBranchFlowNode;
  targets: FlowTopologyNode[];
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: (update: (current: ScoreBranchFlowNode) => ScoreBranchFlowNode) => void;
  focusedBranchId?: string;
  viewMode?: 'focused' | 'all';
  onShowAll?: () => void;
}

/** Ramificação body: the score key plus one editable range row per branch. */
export function ScoreBranchSection({
  node,
  targets,
  onNodeChange,
  focusedBranchId,
  viewMode = 'all',
  onShowAll,
}: ScoreBranchSectionProps) {
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

  if (viewMode === 'focused' && focusedBranchId) {
    const branchIndex = node.branches.findIndex((b) => b.id === focusedBranchId);
    const branch = node.branches[branchIndex] ?? node.branches[0];
    const index = branchIndex !== -1 ? branchIndex : 0;

    if (branch) {
      return (
        <div className="flex flex-col gap-2">
          <div
            data-testid={`branch-row-${index + 1}`}
            className="flex flex-col gap-2.5 rounded-lg border border-primary/60 bg-primary/5 p-2.5 ring-2 ring-primary/30"
          >
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">Nome da faixa</span>
              <BranchNameField
                ariaLabel={`Nome da faixa ${index + 1}`}
                committedId={branch.id}
                siblingIds={node.branches
                  .filter((_, siblingIndex) => siblingIndex !== index)
                  .map((candidate) => candidate.id)}
                onCommit={(id) => commitBranch(index, (current) => ({ ...current, id }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
                Intervalo de pontuação (De / Até)
              </span>
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
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
                <ArrowRight aria-hidden="true" size={12} className="text-primary shrink-0" />
                <span>Leva para a etapa:</span>
              </span>
              <TargetSelect
                ariaLabel={`Destino da faixa ${index + 1}`}
                value={branch.next}
                onChange={(next) => commitBranch(index, (current) => ({ ...current, next }))}
                nodes={targets}
                allowEmpty
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
                Ou direcionar para tela do BemTeVi:
              </span>
              <select
                aria-label={`Destino de página ${index + 1}`}
                className={selectClassName}
                value={branch.navigation ?? ''}
                onChange={(event) => {
                  const { value } = event.target;
                  commitBranch(index, (current) => {
                    if (value === '') {
                      const { navigation: _dropped, ...branchWithoutNav } = current;
                      return branchWithoutNav;
                    }
                    return { ...current, navigation: value as (typeof NAVIGATION_OPTIONS)[number] };
                  });
                }}
              >
                <option value="">Nenhuma</option>
                {NAVIGATION_OPTIONS.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
                {branch.navigation && !(NAVIGATION_OPTIONS as readonly string[]).includes(branch.navigation) && (
                  <option value={branch.navigation}>{`Destino ausente · ${branch.navigation}`}</option>
                )}
              </select>
            </div>
            <button
              type="button"
              aria-label={`Remover faixa ${index + 1}`}
              disabled={node.branches.length === 1}
              onClick={() =>
                onNodeChange((current) => ({
                  ...current,
                  branches: current.branches.filter((_, candidateIndex) => candidateIndex !== index),
                }))
              }
              className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container disabled:opacity-40"
            >
              Remover faixa
            </button>
          </div>
          {onShowAll && (
            <div className="flex justify-end pt-1">
              <button type="button" onClick={onShowAll} className="font-label-sm text-xs text-primary hover:underline">
                Ver todas ({node.branches.length}) ▾
              </button>
            </div>
          )}
        </div>
      );
    }
  }

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
          className={`flex flex-col gap-2.5 rounded-lg border p-2.5 transition-all ${
            branch.id === focusedBranchId
              ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/30'
              : 'border-outline-variant/40 bg-surface-container-low'
          }`}
        >
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">Nome da faixa</span>
            <BranchNameField
              ariaLabel={`Nome da faixa ${index + 1}`}
              committedId={branch.id}
              siblingIds={node.branches
                .filter((_, siblingIndex) => siblingIndex !== index)
                .map((candidate) => candidate.id)}
              onCommit={(id) => commitBranch(index, (current) => ({ ...current, id }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
              Intervalo de pontuação (De / Até)
            </span>
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
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
              <ArrowRight aria-hidden="true" size={12} className="text-primary shrink-0" />
              <span>Leva para a etapa:</span>
            </span>
            {/* Selects don't blur reliably; commit the target immediately on change. */}
            <TargetSelect
              ariaLabel={`Destino da faixa ${index + 1}`}
              value={branch.next}
              onChange={(next) => commitBranch(index, (current) => ({ ...current, next }))}
              nodes={targets}
              allowEmpty
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
              Ou direcionar para tela do BemTeVi:
            </span>
            {/* Selects don't blur reliably; commit the page destination immediately on change. */}
            <select
              aria-label={`Destino de página ${index + 1}`}
              className={selectClassName}
              value={branch.navigation ?? ''}
              onChange={(event) => {
                const { value } = event.target;
                commitBranch(index, (current) => {
                  if (value === '') {
                    // Clearing the page destination removes the key entirely.
                    const { navigation: _dropped, ...branchWithoutNavigation } = current;
                    return branchWithoutNavigation;
                  }
                  return { ...current, navigation: value as (typeof NAVIGATION_OPTIONS)[number] };
                });
              }}
            >
              <option value="">Nenhuma</option>
              {NAVIGATION_OPTIONS.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
              {branch.navigation && !(NAVIGATION_OPTIONS as readonly string[]).includes(branch.navigation) && (
                <option value={branch.navigation}>{`Destino ausente · ${branch.navigation}`}</option>
              )}
            </select>
          </div>
          <button
            type="button"
            aria-label={`Remover faixa ${index + 1}`}
            disabled={node.branches.length === 1}
            onClick={() =>
              onNodeChange((current) => ({
                ...current,
                branches: current.branches.filter((_, candidateIndex) => candidateIndex !== index),
              }))
            }
            className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container disabled:opacity-40"
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

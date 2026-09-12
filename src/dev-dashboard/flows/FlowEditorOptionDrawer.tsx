import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ChoiceFlowNode, FlowOption, GuidedFlow } from '../../domain/flow-engine/types';
import { FlowEditorActionEffect } from './FlowEditorActionEffect';
import { FlowEditorScoreEffect } from './FlowEditorScoreEffect';
import { FlowEditorSafetyEffect } from './FlowEditorSafetyEffect';
import type { OptionEffectsUpdate } from './flowEditorUtils';

export interface ActiveOptionEdit {
  nodeId: string;
  optionId: string;
}

export interface FlowEditorOptionDrawerProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  activeOptionEdit: ActiveOptionEdit;
  existingScoreKeys: string[];
  onClose: () => void;
  onUpdateChoiceOption: (node: ChoiceFlowNode, optionId: string, patch: Partial<FlowOption>) => void;
  onUpdateOptionEffects: OptionEffectsUpdate;
}

/** Advanced option editor kept outside the stage list to isolate modal focus handling. */
export function FlowEditorOptionDrawer({
  flow,
  flows,
  activeOptionEdit,
  existingScoreKeys,
  onClose,
  onUpdateChoiceOption,
  onUpdateOptionEffects,
}: FlowEditorOptionDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = drawerRef.current;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleDrawerKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !container.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else if (activeElement === lastElement || !container.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    container?.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      container?.removeEventListener('keydown', handleDrawerKeyDown);
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus();
    };
  }, [activeOptionEdit]);

  const editNode = flow.nodes[activeOptionEdit.nodeId];
  const editOption =
    editNode?.kind === 'choice'
      ? editNode.options.find((option) => option.id === activeOptionEdit.optionId)
      : undefined;

  if (!editNode || editNode.kind !== 'choice' || !editOption) return null;

  return (
    <div
      role="presentation"
      data-testid="drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm cursor-default"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações Avançadas"
        className="h-full w-full max-w-md overflow-y-auto bg-surface-container-lowest p-6 shadow-2xl flex flex-col gap-4 border-l border-outline-variant"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <h3 className="font-headline-sm text-on-surface font-semibold">Configurações Avançadas</h3>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="text-on-surface hover:bg-surface-variant/20 rounded p-1 text-lg font-bold w-8 h-8 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="font-label-sm text-on-surface-variant">Opção selecionada</span>
            <p className="font-body-md text-on-surface font-semibold">{editOption.label}</p>
          </div>
          <FlowEditorActionEffect
            flow={flow}
            flows={flows}
            editNode={editNode}
            editOption={editOption}
            onUpdateChoiceOption={onUpdateChoiceOption}
          />
          <FlowEditorScoreEffect
            editNode={editNode}
            editOption={editOption}
            existingScoreKeys={existingScoreKeys}
            onUpdateOptionEffects={onUpdateOptionEffects}
          />
          <FlowEditorSafetyEffect
            flow={flow}
            editNode={editNode}
            editOption={editOption}
            onUpdateOptionEffects={onUpdateOptionEffects}
          />
        </div>
      </div>
    </div>
  );
}

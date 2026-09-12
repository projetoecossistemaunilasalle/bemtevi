import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import type { FlowNode, GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClass, textareaClass } from '../components/fieldStyles';
import { getFlowNodeLabel } from './flowDisplay';
import { flowPurposeLabels } from './flowLabels';

export interface FlowEditorInitialConfigProps {
  flow: GuidedFlow;
  nodes: FlowNode[];
  collapsed: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<GuidedFlow>) => void;
  onEntryChange: (patch: Partial<GuidedFlow['entry']>) => void;
  onEnteringPhraseChange: (index: number, value: string) => void;
  onAddEnteringPhrase: () => void;
}

/** Collapsible flow-level metadata and entry configuration. */
export function FlowEditorInitialConfig({
  flow,
  nodes,
  collapsed,
  onToggle,
  onChange,
  onEntryChange,
  onEnteringPhraseChange,
  onAddEnteringPhrase,
}: FlowEditorInitialConfigProps) {
  return (
    <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest overflow-hidden mb-4">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        className="px-5 py-3.5 bg-surface-container-low flex justify-between items-center cursor-pointer select-none"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" aria-hidden="true" />
          <h3 className="font-headline-sm text-on-surface">Configurações Iniciais e Entrada do Fluxo</h3>
        </div>
        {collapsed ? (
          <ChevronDown size={20} className="text-on-surface-variant" aria-hidden="true" />
        ) : (
          <ChevronUp size={20} className="text-on-surface-variant" aria-hidden="true" />
        )}
      </div>
      {!collapsed && (
        <div className="p-5 flex flex-col gap-4 border-t border-outline-variant/20">
          <Field label="Título do fluxo">
            <input
              aria-label="Título do fluxo"
              className={inputClass}
              value={flow.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>

          <Field label="Uso do fluxo" hint="Define onde este fluxo aparece no app e como ele pode ser iniciado.">
            <select
              aria-label="Uso do fluxo"
              className={inputClass}
              value={flow.purpose ?? 'common'}
              onChange={(event) =>
                onChange({
                  purpose: event.target.value === 'common' ? undefined : (event.target.value as GuidedFlow['purpose']),
                })
              }
            >
              <option value="common">{flowPurposeLabels.common}</option>
              <option value="orientation_entry">{flowPurposeLabels.orientation_entry}</option>
              <option value="post_flow_routing">{flowPurposeLabels.post_flow_routing}</option>
            </select>
          </Field>

          <div className="flex flex-col gap-4 border-t border-outline-variant/60 pt-4">
            <h3 className="font-headline-sm text-on-surface">Configuração de entrada</h3>

            <div className="flex flex-col gap-2">
              <span className="font-label-md text-on-surface">Frases de entrada</span>
              <FieldHint>São frases que uma pessoa pode escolher para começar este fluxo.</FieldHint>
              <ul className="flex flex-col gap-3">
                {flow.entry.enteringPhrases.map((phrase, phraseIndex) => (
                  <li key={`${phrase}-${phraseIndex}`}>
                    <textarea
                      aria-label={`Frase de entrada ${phraseIndex + 1}`}
                      className={textareaClass}
                      value={phrase}
                      onChange={(event) => onEnteringPhraseChange(phraseIndex, event.target.value)}
                    />
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" onClick={onAddEnteringPhrase} className="w-fit">
                Adicionar frase de entrada
              </Button>
            </div>

            <Field
              label="Mensagem antes do fluxo"
              hint="Aparece no chat logo antes da primeira etapa, quando o app está abrindo este fluxo."
            >
              <textarea
                aria-label="Mensagem antes do fluxo"
                className={textareaClass}
                value={flow.entry.transitionMessage}
                onChange={(event) => onEntryChange({ transitionMessage: event.target.value })}
              />
            </Field>

            <Field
              label="Primeira etapa"
              hint="Escolha qual etapa aparece primeiro para a pessoa. Os códigos técnicos ficam escondidos aqui."
            >
              <select
                aria-label="Primeira etapa"
                className={inputClass}
                value={flow.entry.nodeId}
                onChange={(event) => onEntryChange({ nodeId: event.target.value })}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {getFlowNodeLabel(node, nodes)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}

import type { GuidedFlow } from '../../domain/flow-engine/types';
import { FieldHint } from '../components/FieldHint';
import { flowPurposeLabels } from './flowLabels';

export function FlowEditor({ flow }: { flow: GuidedFlow }) {
  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Dados do fluxo</h2>

      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Título</span>
        <input
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={flow.title}
          readOnly
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-label-md text-on-surface">Uso do fluxo</span>
        <select
          className="min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          value={flow.purpose ?? 'common'}
          disabled
        >
          <option value="common">{flowPurposeLabels.common}</option>
          <option value="orientation_entry">{flowPurposeLabels.orientation_entry}</option>
          <option value="post_flow_routing">{flowPurposeLabels.post_flow_routing}</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <h3 className="font-headline-sm text-on-surface">Frases de entrada</h3>
        <FieldHint>São frases que uma pessoa pode escolher para começar este fluxo.</FieldHint>
        <ul className="flex flex-wrap gap-2">
          {flow.entry.enteringPhrases.map((phrase) => (
            <li key={phrase} className="rounded-full bg-primary-fixed px-3 py-1 font-label-sm text-on-surface">
              {phrase}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

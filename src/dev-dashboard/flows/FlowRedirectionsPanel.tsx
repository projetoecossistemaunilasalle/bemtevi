import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { getFlowRedirections, type FlowRedirectionKind } from './flowRedirections';

const kindLabels: Record<FlowRedirectionKind, string> = {
  deferred_safety: 'Encaminhamento de segurança ao final',
  safety_interrupt: 'Interrupção de segurança imediata',
  score_branch: 'Ramificação por pontuação',
  score: 'Pontuação acumulada',
  navigate: 'Navegação de tela',
  flow_start: 'Início de outro fluxo',
  end_flow: 'Encerramento',
};

export function FlowRedirections({ flow, onEditNode }: { flow: GuidedFlow; onEditNode: (nodeId: string) => void }) {
  const rows = getFlowRedirections(flow);

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div>
        <h2 className="font-headline-sm text-on-surface">Redirecionamentos</h2>
        <p className="mt-1 font-body-md text-on-surface-variant">
          Pontuações, ramificações e encaminhamentos que precisam ficar visíveis para revisão.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-outline-variant/70 p-6 text-center">
          <p className="font-label-lg text-on-surface">Este fluxo não tem redirecionamentos</p>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Todas as opções apenas avançam para a próxima etapa.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="rounded-full bg-surface px-3 py-1 font-label-sm text-on-surface-variant">
                    {kindLabels[row.kind]}
                  </span>
                  <h3 className="mt-2 font-label-lg text-on-surface">{row.title}</h3>
                  <p className="mt-1 font-body-md text-on-surface-variant">{row.summary}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onEditNode(row.nodeId)}>
                  Editar etapa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

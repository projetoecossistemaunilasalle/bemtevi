import type { GuidedFlow } from '../../domain/flow-engine/types';

export function FlowMap({ flow }: { flow: GuidedFlow }) {
  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <h2 className="font-headline-sm text-on-surface">Mapa visual</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.values(flow.nodes).map((node) => (
          <article key={node.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
            <p className="font-label-md text-on-surface">{node.id}</p>
            <p className="mt-1 font-body-md text-on-surface-variant">{node.text}</p>
            {node.kind === 'choice' && (
              <ul className="mt-2 flex flex-col gap-1">
                {node.options.map((option) => (
                  <li key={option.id} className="font-body-md text-on-surface-variant">
                    {option.label} {'->'} {option.effects?.find((effect) => effect.kind === 'flow_start') ? 'começa fluxo' : option.next}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

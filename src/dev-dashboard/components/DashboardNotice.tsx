import { Info } from 'lucide-react';

export function DashboardNotice() {
  return (
    <aside className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <Info className="mt-0.5 shrink-0 text-secondary" size={20} aria-hidden="true" />
      <div>
        <h2 className="font-headline-sm text-on-surface">Rascunho local</h2>
        <p className="mt-1 font-body-md text-on-surface-variant">
          Este conteúdo está salvo apenas neste navegador. Ele ainda não foi publicado.
        </p>
      </div>
    </aside>
  );
}

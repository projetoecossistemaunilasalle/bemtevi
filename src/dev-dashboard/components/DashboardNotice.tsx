import { useState } from 'react';
import { Info, X } from 'lucide-react';

const DISMISS_KEY = 'bemtevi:dev-dashboard:notice-dismissed';

/**
 * Inline "local draft" banner. Once dismissed it stays hidden (per browser)
 * until localStorage is cleared — the information only needs to land once.
 */
export function DashboardNotice() {
  const [dismissed, setDismissed] = useState(() => readDismissed());

  if (dismissed) return null;

  return (
    <aside className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <Info className="mt-0.5 shrink-0 text-secondary" size={20} aria-hidden="true" />
      <div className="flex-1">
        <h2 className="font-headline-sm text-on-surface">Rascunho local</h2>
        <p className="mt-1 font-body-md text-on-surface-variant">
          Este conteúdo está salvo apenas neste navegador. Ele ainda não foi publicado.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          writeDismissed();
          setDismissed(true);
        }}
        aria-label="Dispensar aviso"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </aside>
  );
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDismissed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, 'true');
  } catch {
    // Ignore write failures.
  }
}

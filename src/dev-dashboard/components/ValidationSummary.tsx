import type { DashboardValidationResult } from '../validation/validationTypes';

export function ValidationSummary({ result }: { result: DashboardValidationResult }) {
  return (
    <section className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
      <h3 className="font-headline-sm text-on-surface">Validação</h3>
      {result.errors.length === 0 && result.warnings.length === 0 ? (
        <p className="mt-2 font-body-md text-on-surface-variant">Nenhum problema encontrado neste rascunho.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {[...result.errors, ...result.warnings].map((issue) => (
            <li key={issue.id} className="font-body-md text-on-surface-variant">
              <strong>{issue.level === 'error' ? 'Erro:' : 'Aviso:'}</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

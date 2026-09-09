import { useState } from 'react';
import { Button } from '../../design-system/components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { deleteArchivedWorkspace, listWorkspaceCheckpoints, type DraftWorkspace } from './workspace';

export function WorkspaceHistory({
  workspaces,
  disabled,
  onRestore,
}: {
  workspaces: DraftWorkspace[];
  disabled: boolean;
  onRestore(raw: string): Promise<boolean>;
}) {
  const [checkpoints, setCheckpoints] = useState<DraftWorkspace[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(50);
  async function inspect(id: string) {
    try {
      setCheckpoints((await listWorkspaceCheckpoints(id)).reverse());
      setLimit(50);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <details className="my-4 border-b border-outline-variant py-3">
      <summary className="min-h-11 cursor-pointer font-label-md">Histórico de rascunhos e checkpoints</summary>
      <p className="max-w-[75ch] font-body-md">
        Restaurar cria uma cópia independente. A exclusão definitiva só está disponível para arquivos já arquivados.
      </p>
      {error && <p role="alert">Não foi possível acessar o histórico. Nenhum rascunho aberto foi substituído.</p>}
      {workspaces
        .filter((w) => !removed.includes(w.workspaceId))
        .map((workspace) => (
          <div key={workspace.workspaceId} className="flex flex-wrap items-center gap-3 py-2">
            <span className="font-body-md">
              {workspace.workspaceId.slice(0, 8)} · geração {workspace.generation} ·{' '}
              {workspace.archived ? 'Arquivado' : 'Preservado'}
            </span>
            <Button variant="secondary" disabled={disabled} onClick={() => void onRestore(JSON.stringify(workspace))}>
              Restaurar cópia
            </Button>
            <Button variant="secondary" disabled={disabled} onClick={() => void inspect(workspace.workspaceId)}>
              Ver checkpoints
            </Button>
            {workspace.archived && (
              <ConfirmButton
                prompt="Excluir arquivo definitivamente"
                confirmLabel="Confirmar exclusão definitiva"
                disabled={disabled}
                onConfirm={() => {
                  void deleteArchivedWorkspace(workspace.workspaceId)
                    .then((ok) => {
                      if (ok) {
                        setRemoved((ids) => [...ids, workspace.workspaceId]);
                        setCheckpoints([]);
                      } else setError(true);
                    })
                    .catch(() => setError(true));
                }}
              />
            )}
          </div>
        ))}
      {checkpoints.slice(0, limit).map((checkpoint) => (
        <div key={`${checkpoint.workspaceId}:${checkpoint.generation}`} className="py-2">
          <Button variant="secondary" disabled={disabled} onClick={() => void onRestore(JSON.stringify(checkpoint))}>
            Restaurar checkpoint {checkpoint.generation}
          </Button>
        </div>
      ))}
      {checkpoints.length > limit && (
        <Button variant="secondary" onClick={() => setLimit(limit + 50)}>
          Carregar mais checkpoints
        </Button>
      )}
    </details>
  );
}

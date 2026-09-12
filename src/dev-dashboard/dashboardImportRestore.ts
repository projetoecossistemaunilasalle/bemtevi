import { useRef, type ChangeEvent } from 'react';
import type { PublishedContentPayload } from '../app/content/publishedContent';
import { createWorkspace, type DraftWorkspace } from './draft-storage/workspace';

export interface DashboardImportRestoreStore {
  current: { current: DraftWorkspace | null };
  restore(raw: string): Promise<boolean>;
  setError(error: string | null): void;
}

export function useDashboardImportRestore({
  store,
  publishedDraft,
  revision,
}: {
  store: DashboardImportRestoreStore;
  publishedDraft: PublishedContentPayload;
  revision: number | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadBackup(json: string) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bemtevi-rascunho-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadBackup() {
    downloadBackup(JSON.stringify(store.current.current ?? createWorkspace(publishedDraft, revision), null, 2));
  }

  function handleRestoreBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        void store.restore(text);
      } catch (error) {
        store.setError(error instanceof Error ? error.message : 'Falha ao restaurar rascunho do arquivo.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return { fileInputRef, handleDownloadBackup, handleRestoreBackupFile, downloadBackup };
}

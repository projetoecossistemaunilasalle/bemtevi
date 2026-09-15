import { useRef, useState } from 'react';
import type { ContentDraft, PublishedContentPayload } from '@bemtevi/content-core';
import { ExportRepository, type ExportSelection } from './files/exportRepository';
import { createEditorialArchive } from './files/createEditorialArchive';
import { parseEditorialArchive, type ArchiveSource } from './files/parseEditorialArchive';
import { importEditorialOperations, type EditorialImportResult } from './files/importEditorialOperations';
import {
  CodeTag,
  ExportColumn,
  FileDropZone,
  ImportPreviewPanel,
  Notice,
  StepHeading,
  UsageGuide,
  type ImportPreview,
  type ReadyPreview,
} from './ImportPreviewPanel';

/** File-first AI flow (docs 06/16, task AI-FILE-02): exact props, clean-flush export/apply, preview-first, no publish toggle. */

export interface AiFileArchiveSectionProps {
  draft: ContentDraft;
  flush(): Promise<boolean>;
  applyCandidate(base: PublishedContentPayload, candidate: PublishedContentPayload): Promise<boolean>;
  exportRepository: ExportRepository;
}

type ImportOutcome = { ok: false; error: string } | (ReadyPreview & { ok: true });
type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };
type ImportStatus = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'flush-blocked'; message: string };
export function AiFileArchiveSection({ draft, flush, applyCandidate, exportRepository }: AiFileArchiveSectionProps) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: 'idle' });
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: 'idle' });
  const [preview, setPreview] = useState<ImportPreview>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport(selection: ExportSelection | null) {
    if (exportStatus.kind === 'working') return;
    // Clean-flush requirement: export is blocked when a dirty flush fails.
    const flushed = await flush();
    if (!flushed) {
      setExportStatus({
        kind: 'error',
        message: 'Há alterações não salvas. Finalize o salvamento antes de exportar o arquivo para a IA.',
      });
      return;
    }
    setExportStatus({ kind: 'working' });
    const created = await exportRepository.create(crypto.randomUUID(), draft.generation, selection);
    if (created.ok === false)
      return void setExportStatus({ kind: 'error', message: describeError(created.error.code, 'exportar') });
    const archive = await createEditorialArchive(created.data);
    downloadFile(new Blob([archive.zipData as unknown as BlobPart], { type: 'application/zip' }), archive.fileName);
    setExportStatus({
      kind: 'success',
      message:
        archive.imageCount > 0
          ? `Arquivo gerado com ${archive.imageCount} imagem(ns). Envie o ZIP inteiro ao ChatGPT.`
          : 'Arquivo gerado. Envie o ZIP ao ChatGPT.',
    });
  }

  async function handleFile(file: File) {
    if (preview.kind === 'parsing' || preview.kind === 'applying') return;
    const fail = (message: string) => {
      setImportStatus({ kind: 'error', message });
      setPreview({ kind: 'idle' });
    };
    setPreview({ kind: 'parsing' });
    setImportStatus({ kind: 'idle' });
    const outcome = await runAiFileImport(file, exportRepository);
    if (outcome.ok === false) fail(outcome.error);
    else setPreview(outcome);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleApply() {
    if (preview.kind !== 'ready') return;
    // Clean-flush requirement: apply is blocked when a dirty flush fails.
    const flushed = await flush();
    if (!flushed) {
      setImportStatus({
        kind: 'flush-blocked',
        message: 'Há alterações não salvas. Finalize o salvamento antes de aplicar as operações.',
      });
      return;
    }
    const attempted = preview;
    setPreview({ kind: 'applying' });
    const applied = await applyCandidate(draft.payload, attempted.candidate);
    if (!applied) {
      setPreview(attempted);
      setImportStatus({
        kind: 'error',
        message: 'Não foi possível aplicar: o rascunho mudou desde a exportação. Exporte novamente e repita a edição.',
      });
      return;
    }
    setPreview({ kind: 'idle' });
    setImportStatus({ kind: 'idle' });
    setExportStatus({ kind: 'idle' });
  }

  function discardPreview() {
    setPreview({ kind: 'idle' });
    setImportStatus({ kind: 'idle' });
  }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-primary/30 bg-primary-container/10 p-5">
      <h2 className="font-headline-sm text-on-surface">Ajuda rápida com ChatGPT</h2>
      <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">
        Gere um arquivo com o conteúdo atual, envie ao ChatGPT na web e devolva o resultado aqui. Não é preciso instalar
        nada.
      </p>

      <div className="grid gap-4 rounded-lg bg-surface-container-lowest p-4 md:grid-cols-[1fr_1fr]">
        <ExportColumn
          working={exportStatus.kind === 'working'}
          onExport={(selection) => void handleExport(selection)}
        />
        <div className="flex flex-col gap-3">
          <StepHeading step={2} tone="secondary">
            Enviar arquivo da IA
          </StepHeading>
          <p className="font-body-sm text-on-surface-variant">
            Quando o ChatGPT devolver o arquivo (ZIP com <CodeTag>operations.json</CodeTag> ou apenas{' '}
            <CodeTag>.json</CodeTag>), envie aqui. O painel valida, mostra o preview e aplica só quando você confirmar.
          </p>
          <FileDropZone fileInputRef={fileInputRef} onFile={handleFile} />
        </div>
      </div>
      <UsageGuide />
      {exportStatus.kind === 'success' && <Notice kind="status" message={exportStatus.message} />}
      {exportStatus.kind === 'error' && <Notice kind="alert" message={exportStatus.message} />}
      {importStatus.kind !== 'idle' && <Notice kind="alert" message={importStatus.message} />}
      {(preview.kind === 'parsing' || preview.kind === 'applying') && (
        <p role="status" className="font-body-md text-on-surface-variant">
          {preview.kind === 'parsing' ? 'Validando o arquivo da IA...' : 'Aplicando as operações ao rascunho...'}
        </p>
      )}
      {preview.kind === 'ready' && (
        <ImportPreviewPanel preview={preview} onApply={() => void handleApply()} onDiscard={discardPreview} />
      )}
      <p className="font-body-sm text-on-surface-variant">
        Segurança: este recurso só aparece para administradores. Todo arquivo é validado localmente; nada é publicado
        automaticamente.
      </p>
    </section>
  );
}

/** Pure pipeline: parse archive, fetch owner export, compute preview. */
async function runAiFileImport(file: File, repository: ExportRepository): Promise<ImportOutcome> {
  try {
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
    const source: ArchiveSource = isZip
      ? { kind: 'zip', bytes: new Uint8Array(await file.arrayBuffer()) }
      : { kind: 'json', text: await file.text() };
    const parsed = await parseEditorialArchive(source);
    if (parsed.ok === false) return { ok: false, error: parsed.error.message };
    const exportId = typeof parsed.data.envelopeRaw['exportId'] === 'string' ? parsed.data.envelopeRaw['exportId'] : '';
    if (exportId === '') return { ok: false, error: 'O arquivo não informa o exportId da exportação correspondente.' };
    const ownerExport = await repository.get(exportId);
    if (ownerExport.ok === false) {
      return {
        ok: false,
        error:
          ownerExport.error.code === 'export_base_unavailable'
            ? 'A exportação usada pela IA não está mais disponível (expirada ou removida). Exporte o conteúdo novamente.'
            : describeError(ownerExport.error.code, 'recuperar a exportação'),
      };
    }
    const result: EditorialImportResult = await importEditorialOperations(parsed.data, ownerExport.data);
    if (result.ok === false) return { ok: false, error: result.error.message };
    return { ok: true, kind: 'ready', fileName: file.name, ...result.data };
  } catch {
    return { ok: false, error: 'Falha ao ler o arquivo da IA.' };
  }
}

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Você precisa estar autenticado como administrador.',
  stale_generation: 'O rascunho mudou desde a exportação. Exporte novamente.',
  export_base_unavailable: 'A exportação não está mais disponível. Exporte novamente.',
  unavailable: 'Serviço indisponível. Tente novamente.',
  retry_required: 'Serviço indisponível. Tente novamente.',
};
function describeError(code: string, action: string): string {
  return ERROR_TEXT[code] ?? `Não foi possível ${action} o arquivo (${code}).`;
}
function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

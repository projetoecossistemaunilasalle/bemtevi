import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import type {
  ContentDraft,
  ContentValidationIssue,
  PublishedContentPayload,
  SemanticChange,
} from '@bemtevi/content-core';
import { ExportRepository, type ExportSelection } from './files/exportRepository';
import { createEditorialArchive } from './files/createEditorialArchive';
import { parseEditorialArchive, type ArchiveSource } from './files/parseEditorialArchive';
import { importEditorialOperations, type EditorialImportResult } from './files/importEditorialOperations';
import { ContentComparison } from '../publishing/ContentComparison';

/** File-first AI flow (docs 06/16, task AI-FILE-02): exact props, clean-flush export/apply, preview-first, no publish toggle. */

export interface AiFileArchiveSectionProps {
  draft: ContentDraft;
  flush(): Promise<boolean>;
  applyCandidate(base: PublishedContentPayload, candidate: PublishedContentPayload): Promise<boolean>;
  exportRepository: ExportRepository;
}

// prettier-ignore
type ReadyPreview = { kind: 'ready'; fileName: string; candidate: PublishedContentPayload; changes: SemanticChange[]; issues: ContentValidationIssue[]; operationsCount: number };
type ImportPreview = { kind: 'idle' } | { kind: 'parsing' } | ReadyPreview | { kind: 'applying' };
// prettier-ignore
type ImportOutcome = { ok: false; error: string } | (ReadyPreview & { ok: true });
type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };
type ImportStatus = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'flush-blocked'; message: string };
type ExportScope = 'all' | 'educationMaterials';
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
      // prettier-ignore
      setExportStatus({ kind: 'error', message: 'Há alterações não salvas. Finalize o salvamento antes de exportar o arquivo para a IA.' });
      return;
    }
    // prettier-ignore
    setExportStatus({ kind: 'working' });
    const created = await exportRepository.create(crypto.randomUUID(), draft.generation, selection);
    if (created.ok === false)
      return void setExportStatus({ kind: 'error', message: describeError(created.error.code, 'exportar') });
    const archive = await createEditorialArchive(created.data);
    downloadFile(new Blob([archive.zipData as unknown as BlobPart], { type: 'application/zip' }), archive.fileName);
    // prettier-ignore
    setExportStatus({ kind: 'success', message: archive.imageCount > 0
      ? `Arquivo gerado com ${archive.imageCount} imagem(ns). Envie o ZIP inteiro ao ChatGPT.`
      : 'Arquivo gerado. Envie o ZIP ao ChatGPT.' });
  }

  async function handleFile(file: File) {
    if (preview.kind === 'parsing' || preview.kind === 'applying') return;
    // prettier-ignore
    const fail = (message: string) => { setImportStatus({ kind: 'error', message }); setPreview({ kind: 'idle' }); };
    // prettier-ignore
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
      // prettier-ignore
      setImportStatus({ kind: 'flush-blocked', message: 'Há alterações não salvas. Finalize o salvamento antes de aplicar as operações.' });
      return;
    }
    // prettier-ignore
    const attempted = preview;
    setPreview({ kind: 'applying' });
    const applied = await applyCandidate(draft.payload, attempted.candidate);
    if (!applied) {
      setPreview(attempted);
      // prettier-ignore
      setImportStatus({ kind: 'error', message: 'Não foi possível aplicar: o rascunho mudou desde a exportação. Exporte novamente e repita a edição.' });
      return;
    }
    // prettier-ignore
    setPreview({ kind: 'idle' });
    setImportStatus({ kind: 'idle' });
    setExportStatus({ kind: 'idle' });
  }

  // prettier-ignore
  function discardPreview() { setPreview({ kind: 'idle' }); setImportStatus({ kind: 'idle' }); }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-primary/30 bg-primary-container/10 p-5">
      {/* prettier-ignore */}
      <h2 className="font-headline-sm text-on-surface">Ajuda rápida com ChatGPT</h2>
      {/* prettier-ignore */}
      <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">Gere um arquivo com o conteúdo atual, envie ao ChatGPT na web e devolva o resultado aqui. Não é preciso instalar nada.</p>

      <div className="grid gap-4 rounded-lg bg-surface-container-lowest p-4 md:grid-cols-[1fr_1fr]">
        {/* prettier-ignore */}
        <ExportColumn working={exportStatus.kind === 'working'} onExport={(selection) => void handleExport(selection)} />
        <div className="flex flex-col gap-3">
          {/* prettier-ignore */}
          <StepHeading step={2} tone="secondary">Enviar arquivo da IA</StepHeading>
          {/* prettier-ignore */}
          <p className="font-body-sm text-on-surface-variant">Quando o ChatGPT devolver o arquivo (ZIP com <CodeTag>operations.json</CodeTag> ou apenas <CodeTag>.json</CodeTag>), envie aqui. O painel valida, mostra o preview e aplica só quando você confirmar.</p>
          <FileDropZone fileInputRef={fileInputRef} onFile={handleFile} />
        </div>
      </div>
      <UsageGuide />
      {exportStatus.kind === 'success' && <Notice kind="status" message={exportStatus.message} />}
      {exportStatus.kind === 'error' && <Notice kind="alert" message={exportStatus.message} />}
      {importStatus.kind !== 'idle' && <Notice kind="alert" message={importStatus.message} />}
      {/* prettier-ignore */}
      {(preview.kind === 'parsing' || preview.kind === 'applying') && (
        <p role="status" className="font-body-md text-on-surface-variant">
          {preview.kind === 'parsing' ? 'Validando o arquivo da IA...' : 'Aplicando as operações ao rascunho...'}
        </p>
      )}
      {/* prettier-ignore */}
      {preview.kind === 'ready' && (
        <ImportPreviewPanel preview={preview} onApply={() => void handleApply()} onDiscard={discardPreview} />
      )}
      {/* prettier-ignore */}
      <p className="font-body-sm text-on-surface-variant">Segurança: este recurso só aparece para administradores. Todo arquivo é validado localmente; nada é publicado automaticamente.</p>
    </section>
  );
}

/** Pure pipeline: parse archive, fetch owner export, compute preview. */
async function runAiFileImport(file: File, repository: ExportRepository): Promise<ImportOutcome> {
  try {
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
    // prettier-ignore
    const source: ArchiveSource = isZip ? { kind: 'zip', bytes: new Uint8Array(await file.arrayBuffer()) } : { kind: 'json', text: await file.text() };
    const parsed = await parseEditorialArchive(source);
    if (parsed.ok === false) return { ok: false, error: parsed.error.message };
    const exportId = typeof parsed.data.envelopeRaw['exportId'] === 'string' ? parsed.data.envelopeRaw['exportId'] : '';
    if (exportId === '') return { ok: false, error: 'O arquivo não informa o exportId da exportação correspondente.' };
    const ownerExport = await repository.get(exportId);
    if (ownerExport.ok === false) {
      // prettier-ignore
      return { ok: false, error: ownerExport.error.code === 'export_base_unavailable'
        ? 'A exportação usada pela IA não está mais disponível (expirada ou removida). Exporte o conteúdo novamente.'
        : describeError(ownerExport.error.code, 'recuperar a exportação') };
    }
    const result: EditorialImportResult = await importEditorialOperations(parsed.data, ownerExport.data);
    if (result.ok === false) return { ok: false, error: result.error.message };
    return { ok: true, kind: 'ready', fileName: file.name, ...result.data };
  } catch {
    return { ok: false, error: 'Falha ao ler o arquivo da IA.' };
  }
}

// prettier-ignore
const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Você precisa estar autenticado como administrador.',
  stale_generation: 'O rascunho mudou desde a exportação. Exporte novamente.',
  export_base_unavailable: 'A exportação não está mais disponível. Exporte novamente.',
  unavailable: 'Serviço indisponível. Tente novamente.', retry_required: 'Serviço indisponível. Tente novamente.',
};
function describeError(code: string, action: string): string {
  return ERROR_TEXT[code] ?? `Não foi possível ${action} o arquivo (${code}).`;
}
// prettier-ignore
function Notice({ message, kind }: { message: string; kind: 'status' | 'alert' }) {
  // prettier-ignore
  const tone = kind === 'status' ? 'border-primary/30 bg-primary-container/20 text-on-surface' : 'border-error/30 bg-error-container/20 text-on-error-container';
  return (
    <div role={kind} className={`flex items-start gap-2 rounded-lg border p-4 ${tone}`}>
      {/* prettier-ignore */}
      {kind === 'status' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
      <p className={kind === 'status' ? 'font-body-md' : 'font-body-sm'}>{message}</p>
    </div>
  );
}

// prettier-ignore
const USAGE_STEPS = [
  'Clique em “Baixar arquivo para IA”, salve o ZIP e arraste-o numa conversa do chat.openai.com.',
  'Cole junto a mensagem: “Siga as instruções de instructions.md. Quero que: [descreva aqui o que mudar]”',
  'Quando o ChatGPT devolver o arquivo (ZIP ou operations.json), baixe-o e envie aqui em “Selecionar arquivo da IA”.',
  'Confira o preview das alterações e os avisos (se houver) e clique em “Aplicar ao rascunho”.',
];
// prettier-ignore
function UsageGuide() {
  return (
    <details className="rounded-lg bg-surface-container-low p-4">
      <summary className="min-h-11 cursor-pointer font-label-md font-semibold text-on-surface">Como usar com o ChatGPT (passo a passo)</summary>
      <ol className="mt-2 list-decimal list-inside flex flex-col gap-1.5 font-body-sm text-on-surface-variant">
        {USAGE_STEPS.map((step) => (<li key={step}>{step}</li>))}
      </ol>
    </details>
  );
}

// prettier-ignore
function ExportColumn({ working, onExport }: { working: boolean; onExport(selection: ExportSelection | null): void | Promise<void> }) {
  // prettier-ignore
  const [selectedScope, setSelectedScope] = useState<ExportScope>('all'); const [materialId, setMaterialId] = useState('');
  // prettier-ignore
  const selection: ExportSelection | null = selectedScope === 'educationMaterials' && materialId.trim() !== '' ? { scope: 'educationMaterials', ids: [materialId.trim()] } : null;
  return (
    <div className="flex flex-col gap-3">
      <StepHeading step={1} tone="primary">Baixar arquivo para a IA</StepHeading>
      {/* prettier-ignore */}
      <p className="font-body-sm text-on-surface-variant">Gera um ZIP com <CodeTag>context.json</CodeTag>, <CodeTag>instructions.md</CodeTag> e <CodeTag>images/</CodeTag>. A IA devolve apenas <CodeTag>operations.json</CodeTag>.</p>
      {/* prettier-ignore */}
      <div className="flex flex-col gap-2">
        <label htmlFor="export-scope" className="font-body-sm text-on-surface-variant">O que exportar</label>
        {/* prettier-ignore */}
        <select id="export-scope" value={selectedScope} onChange={(e) => setSelectedScope(e.target.value === 'educationMaterials' ? 'educationMaterials' : 'all')} className="mt-1 block min-h-11 rounded-md border border-outline-variant bg-surface p-2">
          <option value="all">Todo o conteúdo</option>
          <option value="educationMaterials">Um material específico</option>
        </select>
        {/* prettier-ignore */}
        {selectedScope === 'educationMaterials' && (
          <input value={materialId} onChange={(e) => setMaterialId(e.target.value)} placeholder="ID do material" aria-label="ID do material educativo a exportar" className="min-h-11 rounded-md border border-outline-variant bg-surface p-2" />
        )}
      </div>
      {/* prettier-ignore */}
      <Button onClick={() => void onExport(selection)} disabled={working} className="self-start"><Download aria-hidden="true" className="h-4 w-4" />{working ? 'Gerando...' : 'Baixar arquivo para IA (.zip)'}</Button>
      {/* prettier-ignore */}
      <p className="font-body-sm text-on-surface-variant">O arquivo expira em 14 dias. Se expirar, exporte novamente — não reutilize o arquivo antigo.</p>
    </div>
  );
}

// prettier-ignore
function FileDropZone({ fileInputRef, onFile }: { fileInputRef: React.RefObject<HTMLInputElement | null>; onFile(file: File): void }) {
  // prettier-ignore
  const [dragOver, setDragOver] = useState(false); const openPicker = () => fileInputRef.current?.click();
  // prettier-ignore
  return (
    <>
      <div
        role="button" tabIndex={0} aria-label="Selecionar arquivo da IA"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        onClick={openPicker}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dragOver ? 'border-primary bg-primary-container/20' : 'border-outline-variant/60 bg-surface-container-low hover:bg-surface-container hover:border-primary/40'}`}
      >
        <span className="font-label-md text-on-surface">Selecionar arquivo da IA</span>
        <span className="font-body-sm text-on-surface-variant">Arraste o ZIP/JSON aqui — aceita .zip e .json</span>
      </div>
      {/* prettier-ignore */}
      <input ref={fileInputRef} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </>
  );
}

// prettier-ignore
function ImportPreviewPanel({ preview, onApply, onDiscard }: { preview: ReadyPreview; onApply(): void; onDiscard(): void }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      {/* prettier-ignore */}
      <h4 className="font-headline-sm text-on-surface">Preview de “{preview.fileName}” — {preview.operationsCount} operação(ões)</h4>
      <p className="font-body-sm text-on-surface-variant">Revise as alterações antes de aplicar. Nada muda no rascunho até você confirmar.</p>
      {preview.issues.length > 0 && (
        <div className="rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container">
          <p className="font-label-md font-semibold">Avisos de validação ({preview.issues.length})</p>
          {/* prettier-ignore */}
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-body-sm">
            {preview.issues.slice(0, 20).map((issue, index) => (<li key={`${issue.code}-${index}`}>{issue.level === 'error' ? 'Erro' : 'Aviso'}: {issue.message}{issue.path !== undefined ? ` (${issue.path})` : ''}</li>))}
          </ul>
          <p className="mt-2 font-body-sm">É possível aplicar com avisos; a publicação fica bloqueada enquanto houver erros.</p>
        </div>
      )}
      <ContentComparison changes={preview.changes} title="Alterações propostas pela IA" />
      {/* prettier-ignore */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onApply}><CheckCircle2 aria-hidden="true" className="h-4 w-4" />Aplicar ao rascunho</Button>
        <Button variant="secondary" onClick={onDiscard}>Descartar</Button>
      </div>
      {/* prettier-ignore */}
      <p className="font-body-sm text-on-surface-variant">Aplicar só atualiza o rascunho compartilhado. Publicar é uma etapa separada, na aba de publicação.</p>
    </div>
  );
}

// prettier-ignore
function StepHeading({ step, tone, children }: { step: 1 | 2; tone: 'primary' | 'secondary'; children: React.ReactNode }) {
  const chip = tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container';
  return (
    <h3 className="flex items-center gap-2 font-label-md font-semibold text-on-surface">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${chip}`}>{step}</span>
      {children}
    </h3>
  );
}

function CodeTag({ children }: { children: string }) {
  return <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">{children}</code>;
}

// prettier-ignore
function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = fileName;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}

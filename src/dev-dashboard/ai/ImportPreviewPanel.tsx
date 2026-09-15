import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import type { ContentValidationIssue, PublishedContentPayload, SemanticChange } from '@bemtevi/content-core';
import { Button } from '../../design-system/components/Button';
import type { ExportSelection } from './files/exportRepository';
import { ContentComparison } from '../publishing/ContentComparison';

export type ReadyPreview = {
  kind: 'ready';
  fileName: string;
  candidate: PublishedContentPayload;
  changes: SemanticChange[];
  issues: ContentValidationIssue[];
  operationsCount: number;
};

export type ImportPreview = { kind: 'idle' } | { kind: 'parsing' } | ReadyPreview | { kind: 'applying' };
export type ExportScope = 'all' | 'educationMaterials';

export function Notice({ message, kind }: { message: string; kind: 'status' | 'alert' }) {
  const tone =
    kind === 'status'
      ? 'border-primary/30 bg-primary-container/20 text-on-surface'
      : 'border-error/30 bg-error-container/20 text-on-error-container';
  return (
    <div role={kind} className={`flex items-start gap-2 rounded-lg border p-4 ${tone}`}>
      {kind === 'status' ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      ) : (
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <p className={kind === 'status' ? 'font-body-md' : 'font-body-sm'}>{message}</p>
    </div>
  );
}

const USAGE_STEPS = [
  'Clique em “Baixar arquivo para IA”, salve o ZIP e arraste-o numa conversa do chat.openai.com.',
  'Cole junto a mensagem: “Siga as instruções de instructions.md. Quero que: [descreva aqui o que mudar]”',
  'Quando o ChatGPT devolver o arquivo (ZIP ou operations.json), baixe-o e envie aqui em “Selecionar arquivo da IA”.',
  'Confira o preview das alterações e os avisos (se houver) e clique em “Aplicar ao rascunho”.',
];

export function UsageGuide() {
  return (
    <details className="rounded-lg bg-surface-container-low p-4">
      <summary className="min-h-11 cursor-pointer font-label-md font-semibold text-on-surface">
        Como usar com o ChatGPT (passo a passo)
      </summary>
      <ol className="mt-2 list-decimal list-inside flex flex-col gap-1.5 font-body-sm text-on-surface-variant">
        {USAGE_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}

export function ExportColumn({
  working,
  onExport,
}: {
  working: boolean;
  onExport(selection: ExportSelection | null): void | Promise<void>;
}) {
  const [selectedScope, setSelectedScope] = useState<ExportScope>('all');
  const [materialId, setMaterialId] = useState('');
  const selection: ExportSelection | null =
    selectedScope === 'educationMaterials' && materialId.trim() !== ''
      ? { scope: 'educationMaterials', ids: [materialId.trim()] }
      : null;
  return (
    <div className="flex flex-col gap-3">
      <StepHeading step={1} tone="primary">
        Baixar arquivo para a IA
      </StepHeading>
      <p className="font-body-sm text-on-surface-variant">
        Gera um ZIP com <CodeTag>context.json</CodeTag>, <CodeTag>instructions.md</CodeTag> e <CodeTag>images/</CodeTag>
        {'. A IA devolve apenas '}
        <CodeTag>operations.json</CodeTag>.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="export-scope" className="font-body-sm text-on-surface-variant">
          O que exportar
        </label>
        <select
          id="export-scope"
          value={selectedScope}
          onChange={(e) => setSelectedScope(e.target.value === 'educationMaterials' ? 'educationMaterials' : 'all')}
          className="mt-1 block min-h-11 rounded-md border border-outline-variant bg-surface p-2"
        >
          <option value="all">Todo o conteúdo</option>
          <option value="educationMaterials">Um material específico</option>
        </select>
        {selectedScope === 'educationMaterials' && (
          <input
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            placeholder="ID do material"
            aria-label="ID do material educativo a exportar"
            className="min-h-11 rounded-md border border-outline-variant bg-surface p-2"
          />
        )}
      </div>
      <Button onClick={() => void onExport(selection)} disabled={working} className="self-start">
        <Download aria-hidden="true" className="h-4 w-4" />
        {working ? 'Gerando...' : 'Baixar arquivo para IA (.zip)'}
      </Button>
      <p className="font-body-sm text-on-surface-variant">
        O arquivo expira em 14 dias. Se expirar, exporte novamente — não reutilize o arquivo antigo.
      </p>
    </div>
  );
}

export function FileDropZone({
  fileInputRef,
  onFile,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile(file: File): void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const openPicker = () => fileInputRef.current?.click();
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Selecionar arquivo da IA"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dragOver ? 'border-primary bg-primary-container/20' : 'border-outline-variant/60 bg-surface-container-low hover:bg-surface-container hover:border-primary/40'}`}
      >
        <span className="font-label-md text-on-surface">Selecionar arquivo da IA</span>
        <span className="font-body-sm text-on-surface-variant">Arraste o ZIP/JSON aqui — aceita .zip e .json</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </>
  );
}

export function ImportPreviewPanel({
  preview,
  onApply,
  onDiscard,
}: {
  preview: ReadyPreview;
  onApply(): void;
  onDiscard(): void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
      <h4 className="font-headline-sm text-on-surface">
        Preview de “{preview.fileName}” — {preview.operationsCount} operação(ões)
      </h4>
      <p className="font-body-sm text-on-surface-variant">
        Revise as alterações antes de aplicar. Nada muda no rascunho até você confirmar.
      </p>
      {preview.issues.length > 0 && (
        <div className="rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container">
          <p className="font-label-md font-semibold">Avisos de validação ({preview.issues.length})</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-body-sm">
            {preview.issues.slice(0, 20).map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.level === 'error' ? 'Erro' : 'Aviso'}: {issue.message}
                {issue.path !== undefined ? ` (${issue.path})` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-body-sm">
            É possível aplicar com avisos; a publicação fica bloqueada enquanto houver erros.
          </p>
        </div>
      )}
      <ContentComparison changes={preview.changes} title="Alterações propostas pela IA" />
      <div className="flex flex-wrap gap-3">
        <Button onClick={onApply}>
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Aplicar ao rascunho
        </Button>
        <Button variant="secondary" onClick={onDiscard}>
          Descartar
        </Button>
      </div>
      <p className="font-body-sm text-on-surface-variant">
        Aplicar só atualiza o rascunho compartilhado. Publicar é uma etapa separada, na aba de publicação.
      </p>
    </div>
  );
}

export function StepHeading({
  step,
  tone,
  children,
}: {
  step: 1 | 2;
  tone: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const chip = tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container';
  return (
    <h3 className="flex items-center gap-2 font-label-md font-semibold text-on-surface">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${chip}`}>{step}</span>
      {children}
    </h3>
  );
}

export function CodeTag({ children }: { children: string }) {
  return <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">{children}</code>;
}

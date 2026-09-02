import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload, FileArchive, Sparkles } from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { createAiArchive, parseAiArchiveFile, downloadBlob } from './aiArchive';
import { DirectAgentSection } from './DirectAgentSection';
import { applyAiOperations, type AiOperationEnvelope } from './aiOperations';

interface AiArchiveSectionProps {
  draft: PublishedContentPayload;
  /** The Neon revision used to build the AI request. */
  baseRevision: number;
  onApply: (nextPayload: PublishedContentPayload, envelope: AiOperationEnvelope) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'downloading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function AiArchiveSection(props: AiArchiveSectionProps) {
  return (
    <div className="flex flex-col gap-stack-lg">
      <DirectAgentSection {...props} />
      <AiFileArchiveSection {...props} />
    </div>
  );
}

function AiFileArchiveSection({ draft, baseRevision, onApply }: AiArchiveSectionProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleDownload() {
    setStatus({ kind: 'downloading' });
    try {
      const { zipData, fileName, imageCount } = await createAiArchive(draft, baseRevision);
      const blob = new Blob([zipData as unknown as BlobPart], { type: 'application/zip' });
      downloadBlob(blob, fileName);
      setStatus({
        kind: 'success',
        message:
          imageCount > 0
            ? `Arquivo gerado com ${imageCount} imagem(ns). Envie o ZIP inteiro para o ChatGPT.`
            : 'Arquivo gerado. Envie o ZIP para o ChatGPT.',
      });
      setTimeout(() => setStatus({ kind: 'idle' }), 6000);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao gerar arquivo.' });
    }
  }

  async function handleFile(file: File) {
    setStatus({ kind: 'idle' });
    try {
      const operations = await parseAiArchiveFile(file);
      const payload = applyAiOperations(draft, operations, baseRevision);
      onApply(payload, operations);
      setStatus({
        kind: 'success',
        message: `Arquivo "${file.name}" validado! Revise as alterações abaixo e publique quando estiver pronto.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Arquivo inválido.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-primary/30 bg-primary-container/10 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Sparkles aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline-sm text-on-surface">Assistente de IA via arquivo</h2>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Para administradores: gere um arquivo, envie ao ChatGPT na web e devolva o resultado. Todo o conteúdo fica
            em português. Não é preciso instalar nada.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg bg-surface-container-lowest p-4 md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-label-md font-semibold text-on-surface">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold">
              1
            </span>
            Baixar arquivo para a IA
          </h3>
          <p className="font-body-sm text-on-surface-variant">
            Gera um ZIP com{' '}
            <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">data.json</code> +{' '}
            <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">
              INSTRUCOES-PARA-IA.txt
            </code>{' '}
            + <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">images/</code>. As
            imagens já vão separadas — a IA não precisa devolvê-las.
          </p>
          <Button onClick={handleDownload} disabled={status.kind === 'downloading'} className="self-start">
            <Download aria-hidden="true" className="h-4 w-4" />
            {status.kind === 'downloading' ? 'Gerando...' : 'Baixar arquivo para IA (.zip)'}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-label-md font-semibold text-on-surface">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
              2
            </span>
            Enviar arquivo da IA
          </h3>
          <p className="font-body-sm text-on-surface-variant">
            Depois que o ChatGPT devolver o arquivo (ZIP com{' '}
            <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">operations.json</code> ou
            apenas <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">.json</code>), envie
            aqui. O painel validará as operações antes de aplicá-las ao rascunho.
          </p>
          <div
            role="button"
            tabIndex={0}
            aria-label="Arraste o arquivo da IA aqui ou clique para selecionar"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${dragOver ? 'border-primary bg-primary-container/20' : 'border-outline-variant/60 bg-surface-container-low hover:bg-surface-container hover:border-primary/40'}`}
          >
            <FileArchive
              aria-hidden="true"
              className={`h-8 w-8 ${dragOver ? 'text-primary' : 'text-on-surface-variant/60'}`}
            />
            <span className="font-label-md text-on-surface">Arraste o ZIP/JSON aqui ou clique para selecionar</span>
            <span className="font-body-sm text-on-surface-variant">Aceita .zip e .json</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload aria-hidden="true" className="h-4 w-4" />
              Selecionar arquivo da IA
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      </div>

      {/* Passo a passo */}
      <div className="rounded-lg bg-surface-container-low p-4">
        <h4 className="font-label-md font-semibold text-on-surface">Como usar com o ChatGPT (passo a passo)</h4>
        <ol className="mt-2 list-decimal list-inside flex flex-col gap-1.5 font-body-sm text-on-surface-variant">
          <li>
            Clique em <strong className="text-on-surface">Baixar arquivo para IA</strong> e salve o ZIP.
          </li>
          <li>
            Abra o{' '}
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary hover:text-primary/80"
            >
              chat.openai.com
            </a>{' '}
            e arraste o ZIP na conversa.
          </li>
          <li>
            Cole junto a mensagem:{' '}
            <em className="text-on-surface">
              “Siga as instruções de INSTRUCOES-PARA-IA.txt. Quero que: [descreva aqui o que mudar]”
            </em>
          </li>
          <li>O ChatGPT devolverá um novo arquivo (ZIP ou operations.json). Baixe-o.</li>
          <li>
            Volte aqui, clique em <strong className="text-on-surface">Selecionar arquivo da IA</strong> ou arraste o
            arquivo na área pontilhada.
          </li>
          <li>Confira o preview e os erros (se houver) e depois clique em “Publicar alterações”.</li>
        </ol>
      </div>

      {status.kind === 'success' && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary-container/20 p-4 text-on-surface"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <p className="font-body-md">{status.message}</p>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container"
        >
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-error mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-label-md font-semibold">Falha ao processar arquivo da IA</p>
            <p className="mt-1 font-body-sm whitespace-pre-wrap">{status.message}</p>
            <p className="mt-2 font-body-sm">
              Dica: peça ao ChatGPT para devolver <strong>apenas o data.json</strong> dentro de{' '}
              <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">```json</code> ou um ZIP
              com <code className="rounded bg-surface-container-low px-1 py-0.5 font-mono text-xs">data.json</code> na
              raiz. Verifique se o JSON não foi cortado.
            </p>
          </div>
        </div>
      )}

      <p className="font-body-sm text-on-surface-variant">
        Segurança: este recurso só aparece para administradores. Todo arquivo enviado é validado localmente; nada é
        publicado automaticamente. Você sempre revisa antes de clicar em Publicar.
      </p>
    </section>
  );
}

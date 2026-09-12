import { useState, type ChangeEvent } from 'react';
import type { FlowExercise, FlowNode, ResultFlowNode } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { acceptImageTypes, readFileAsDataUrl } from '../components/fileUpload';
import { DraftTextField, textFieldClassName } from './flowEditorFields';
import { selectClassName } from './flowEffectFields';
import { uniqueVideoId, uniqueVisualId, YOUTUBE_URL_PATTERN } from './nodeEditorUtils';

type MediaNodeChange = (update: (current: FlowNode) => FlowNode) => void;

interface MediaSectionProps {
  node: FlowNode;
  /** Same one-commit-per-event contract as the panel-level handler below. */
  onNodeChange: MediaNodeChange;
}

/** Mídia body: video rows and image rows for every kind, recommendations for result nodes only. */
export function MediaSection({ node, onNodeChange }: MediaSectionProps) {
  const videos = node.videos ?? [];
  const visuals = node.visuals ?? [];
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <>
      {/* Exercício interativo: componente nativo acoplado à etapa (ex: respiração guiada). */}
      <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">Exercício interativo</span>
          <select
            aria-label="Exercício interativo"
            className={selectClassName}
            value={node.exercise ?? ''}
            onChange={(event) => {
              const nextExercise = event.target.value as FlowExercise | '';
              onNodeChange((current) => {
                if (!nextExercise) {
                  const { exercise: _dropped, ...nodeWithoutExercise } = current;
                  return nodeWithoutExercise;
                }
                return { ...current, exercise: nextExercise };
              });
            }}
          >
            <option value="">Nenhum exercício</option>
            <option value="breathing">Respiração guiada</option>
          </select>
        </label>
        {node.exercise === 'breathing' && (
          <p className="font-body-md text-xs text-on-surface-variant">
            O exercício de respiração guiada será exibido diretamente nesta etapa do fluxo.
          </p>
        )}
      </div>

      {videos.map((video, index) => (
        <div
          key={video.id}
          data-testid={`video-row-${index + 1}`}
          className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2"
        >
          <DraftTextField
            ariaLabel={`Título do vídeo ${index + 1}`}
            value={video.title}
            onCommit={(title) =>
              onNodeChange((current) => ({
                ...current,
                videos: (current.videos ?? []).map((candidate, candidateIndex) =>
                  candidateIndex === index ? { ...candidate, title } : candidate,
                ),
              }))
            }
          />
          <div>
            <DraftTextField
              ariaLabel={`URL do vídeo ${index + 1}`}
              value={video.url}
              onCommit={(url) =>
                onNodeChange((current) => ({
                  ...current,
                  videos: (current.videos ?? []).map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, url } : candidate,
                  ),
                }))
              }
            />
            {/* Advisory only; the summary owns authoritative URL validation. */}
            {video.url !== '' && !YOUTUBE_URL_PATTERN.test(video.url) && (
              <p className="mt-1 font-body-md text-xs text-on-surface-variant">Use um link completo do YouTube.</p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Remover vídeo ${index + 1}`}
            onClick={() =>
              onNodeChange((current) => {
                const remaining = (current.videos ?? []).filter((_, candidateIndex) => candidateIndex !== index);
                if (remaining.length === 0) {
                  // Dropping the last video removes the key entirely.
                  const { videos: _dropped, ...nodeWithoutVideos } = current;
                  return nodeWithoutVideos;
                }
                return { ...current, videos: remaining };
              })
            }
            className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
          >
            Remover vídeo
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onNodeChange((current) => ({
            ...current,
            videos: [...(current.videos ?? []), { id: uniqueVideoId(current), title: '', url: '' }],
          }))
        }
      >
        Adicionar vídeo
      </Button>
      {/* Imagens: sem catálogo — upload local (data URL) ou link externo. */}
      <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
        <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">Imagens</span>
        {visuals.length === 0 && (
          <p className="font-body-md text-xs text-on-surface-variant">
            A imagem aparece logo abaixo da mensagem no chat. Envie um arquivo ou cole um link https://…
          </p>
        )}
        {visuals.map((visual, index) => {
          const uploaded = visual.src.trimStart().startsWith('data:');
          const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploadError(null);
            try {
              const dataUrl = await readFileAsDataUrl(file);
              onNodeChange((current) => ({
                ...current,
                visuals: (current.visuals ?? []).map((candidate, candidateIndex) =>
                  candidateIndex === index ? { ...candidate, src: dataUrl } : candidate,
                ),
              }));
            } catch (error) {
              setUploadError(
                error instanceof Error ? error.message : 'Não foi possível enviar a imagem. Escolha outro arquivo.',
              );
            } finally {
              event.target.value = '';
            }
          };
          return (
            <div
              key={visual.id}
              data-testid={`visual-row-${index + 1}`}
              className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2"
            >
              <div className="flex flex-col gap-1">
                <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
                  Origem da imagem
                </span>
                {uploaded ? (
                  <input
                    aria-label={`Origem da imagem ${index + 1}`}
                    className={textFieldClassName}
                    value="Imagem enviada neste navegador"
                    disabled
                  />
                ) : (
                  <DraftTextField
                    ariaLabel={`Origem da imagem ${index + 1}`}
                    value={visual.src}
                    onCommit={(src) =>
                      onNodeChange((current) => ({
                        ...current,
                        visuals: (current.visuals ?? []).map((candidate, candidateIndex) =>
                          candidateIndex === index ? { ...candidate, src } : candidate,
                        ),
                      }))
                    }
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant">
                  Descrição da imagem (acessibilidade)
                </span>
                <DraftTextField
                  ariaLabel={`Descrição da imagem ${index + 1}`}
                  value={visual.alt}
                  onCommit={(alt) =>
                    onNodeChange((current) => ({
                      ...current,
                      visuals: (current.visuals ?? []).map((candidate, candidateIndex) =>
                        candidateIndex === index ? { ...candidate, alt } : candidate,
                      ),
                    }))
                  }
                />
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-sm text-on-surface shadow-sm transition-colors hover:bg-surface-container-low hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <input
                  type="file"
                  accept={acceptImageTypes()}
                  className="sr-only"
                  aria-label={`${uploaded ? 'Trocar' : 'Enviar'} imagem ${index + 1}`}
                  onChange={handleUpload}
                />
                {uploaded ? 'Trocar imagem' : 'Enviar imagem'}
              </label>
              {uploaded && (
                <Button
                  variant="danger"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    onNodeChange((current) => ({
                      ...current,
                      visuals: (current.visuals ?? []).map((candidate, candidateIndex) =>
                        candidateIndex === index ? { ...candidate, src: '' } : candidate,
                      ),
                    }))
                  }
                >
                  Deletar imagem enviada
                </Button>
              )}
              {visual.src !== '' && (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
                  <img src={visual.src} alt={visual.alt} className="h-full w-full object-cover" />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remover imagem ${index + 1}`}
                onClick={() =>
                  onNodeChange((current) => {
                    const remaining = (current.visuals ?? []).filter((_, candidateIndex) => candidateIndex !== index);
                    if (remaining.length === 0) {
                      // Dropping the last visual removes the key entirely.
                      const { visuals: _dropped, ...nodeWithoutVisuals } = current;
                      return nodeWithoutVisuals;
                    }
                    return { ...current, visuals: remaining };
                  })
                }
                className="self-start rounded-full px-2 py-1 font-label-sm text-xs text-on-surface-variant transition-colors hover:bg-error-container/60 hover:text-on-error-container"
              >
                Remover imagem
              </button>
            </div>
          );
        })}
        {uploadError && (
          <p role="alert" className="font-body-md text-xs text-error">
            {uploadError}
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onNodeChange((current) => ({
              ...current,
              visuals: [...(current.visuals ?? []), { id: uniqueVisualId(current), alt: '', src: '' }],
            }))
          }
        >
          Adicionar imagem
        </Button>
      </div>
      {node.kind === 'result' && <RecommendationsField node={node} onNodeChange={onNodeChange} />}
    </>
  );
}

interface RecommendationsFieldProps {
  node: ResultFlowNode;
  onNodeChange: MediaNodeChange;
}

/**
 * One recommendation per line: displays the committed list joined by newlines
 * and commits the draft split back into trimmed, non-empty lines. A no-op edit
 * commits nothing; an emptied list drops the `recommendations` key entirely.
 */
function RecommendationsField({ node, onNodeChange }: RecommendationsFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const joined = (node.recommendations ?? []).join('\n');
  return (
    <textarea
      aria-label="Recomendações da etapa final"
      placeholder="Uma recomendação por linha."
      className={`min-h-[80px] ${textFieldClassName}`}
      value={draft ?? joined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setDraft(null);
        if (draft === null) return;
        const nextLines = draft
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '');
        const currentLines = node.recommendations ?? [];
        if (nextLines.length === currentLines.length && nextLines.every((line, i) => line === currentLines[i])) return;
        onNodeChange((current) => {
          if (current.kind !== 'result') return current; // narrowing guard, mirrors patchEffect
          if (nextLines.length === 0) {
            const { recommendations: _dropped, ...nodeWithoutRecommendations } = current;
            return nodeWithoutRecommendations;
          }
          return { ...current, recommendations: nextLines };
        });
      }}
    />
  );
}

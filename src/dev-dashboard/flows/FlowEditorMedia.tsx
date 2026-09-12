import { Image as ImageIcon, Trash2, Youtube } from 'lucide-react';
import type { FlowNode, OrientationVideo, OrientationVisual } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { YouTubeVideoCard } from '../../design-system/components/YouTubeVideoCard';
import { parseYouTubeVideoId } from '../../domain/media/youtube';
import { inputClassSm } from '../components/fieldStyles';
import { acceptImageTypes, readFileAsDataUrl } from '../components/fileUpload';

export interface FlowEditorMediaProps {
  node: FlowNode;
  stepLabel: string;
  imageError: string | null;
  onAddNodeVideo: (node: FlowNode) => void;
  onUpdateNodeVideo: (node: FlowNode, videoId: string, patch: Partial<OrientationVideo>) => void;
  onRemoveNodeVideo: (node: FlowNode, videoId: string) => void;
  onAddNodeVisual: (node: FlowNode) => void;
  onUpdateNodeVisual: (node: FlowNode, visualId: string, patch: Partial<OrientationVisual>) => void;
  onRemoveNodeVisual: (node: FlowNode, visualId: string) => void;
  setImageError: (message: string | null) => void;
}

/** Shared media editor used by both choice and result stages. */
export function FlowEditorMedia({
  node,
  stepLabel,
  imageError,
  onAddNodeVideo,
  onUpdateNodeVideo,
  onRemoveNodeVideo,
  onAddNodeVisual,
  onUpdateNodeVisual,
  onRemoveNodeVisual,
  setImageError,
}: FlowEditorMediaProps) {
  return (
    <>
      {node.kind !== 'score_branch' && (
        <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-[#c5221f]" aria-hidden="true" />
                <h5 className="font-label-md text-on-surface">Vídeos na orientação</h5>
              </div>
              <p className="mt-1 max-w-xl font-body-sm text-on-surface-variant">
                O vídeo aparece logo abaixo desta mensagem no chat. Use um link do YouTube.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onAddNodeVideo(node)}
              aria-label={`Adicionar vídeo do YouTube na ${stepLabel}`}
            >
              Adicionar vídeo
            </Button>
          </div>

          {(node.videos ?? []).map((video, videoIndex) => {
            const hasInvalidUrl = video.url.trim().length > 0 && parseYouTubeVideoId(video.url) === null;

            return (
              <div
                key={video.id}
                className="grid gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]"
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-on-surface">Título do vídeo</span>
                    <input
                      aria-label={`Título do vídeo ${videoIndex + 1} da ${stepLabel}`}
                      className={inputClassSm}
                      value={video.title}
                      onChange={(event) => onUpdateNodeVideo(node, video.id, { title: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-label-sm text-on-surface">Link do YouTube</span>
                    <input
                      type="url"
                      aria-label={`Link do YouTube ${videoIndex + 1} da ${stepLabel}`}
                      className={inputClassSm}
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={video.url}
                      onChange={(event) => onUpdateNodeVideo(node, video.id, { url: event.target.value })}
                    />
                  </label>
                  {hasInvalidUrl && (
                    <p className="font-body-sm text-error" role="alert">
                      Informe um link válido do YouTube.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                    onClick={() => onRemoveNodeVideo(node, video.id)}
                    aria-label={`Remover vídeo ${video.title || videoIndex + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remover vídeo
                  </Button>
                </div>

                {parseYouTubeVideoId(video.url) !== null ? (
                  <YouTubeVideoCard title={video.title} url={video.url} className="self-start" />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 text-center font-body-sm text-on-surface-variant">
                    A prévia aparece aqui quando o link for válido.
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h5 className="font-label-md text-on-surface">Imagens na orientação</h5>
            </div>
            <p className="mt-1 max-w-xl font-body-sm text-on-surface-variant">
              A imagem aparece logo abaixo desta mensagem no chat. Envie um arquivo do computador ou cole um link
              (https://...).
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onAddNodeVisual(node)}
            aria-label={`Adicionar imagem na ${stepLabel}`}
          >
            Adicionar imagem
          </Button>
        </div>

        {imageError && (
          <p role="alert" className="font-body-sm text-error">
            {imageError}
          </p>
        )}

        {(node.visuals ?? []).map((visual, visualIndex) => {
          const uploaded = visual.src.trimStart().startsWith('data:');

          return (
            <div
              key={visual.id}
              className="grid gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]"
            >
              <div className="flex min-w-0 flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-on-surface">Origem da imagem</span>
                  <input
                    type="url"
                    aria-label={`Origem da imagem ${visualIndex + 1} da ${stepLabel}`}
                    className={inputClassSm}
                    placeholder="https://..."
                    disabled={uploaded}
                    value={uploaded ? 'Imagem enviada neste navegador' : visual.src}
                    onChange={(event) => onUpdateNodeVisual(node, visual.id, { src: event.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-on-surface">Descrição da imagem (acessibilidade)</span>
                  <input
                    aria-label={`Descrição da imagem ${visualIndex + 1} da ${stepLabel}`}
                    className={inputClassSm}
                    value={visual.alt}
                    onChange={(event) => onUpdateNodeVisual(node, visual.id, { alt: event.target.value })}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-label-md text-on-surface shadow-sm transition-colors hover:bg-surface-container-low hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <input
                      type="file"
                      accept={acceptImageTypes()}
                      className="sr-only"
                      aria-label={`${uploaded ? 'Trocar' : 'Enviar'} imagem ${visualIndex + 1} da ${stepLabel}`}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await readFileAsDataUrl(file);
                          setImageError(null);
                          onUpdateNodeVisual(node, visual.id, { src: dataUrl });
                        } catch (error) {
                          setImageError(
                            error instanceof Error
                              ? error.message
                              : 'Não foi possível enviar a imagem. Escolha outro arquivo.',
                          );
                        }
                        event.target.value = '';
                      }}
                    />
                    {uploaded ? 'Trocar imagem' : 'Enviar imagem'}
                  </label>
                  {uploaded && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => onUpdateNodeVisual(node, visual.id, { src: '' })}
                    >
                      Deletar imagem enviada
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onRemoveNodeVisual(node, visual.id)}
                    aria-label={`Remover imagem ${visualIndex + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remover imagem
                  </Button>
                </div>
              </div>

              {visual.src.trim().length > 0 && (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
                  <img alt={visual.alt} className="h-full w-full object-cover" src={visual.src} />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

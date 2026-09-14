import { parseYouTubeVideoId } from '../model/youtube';

const allowedFlowExercises = ['breathing'];

export function hasMediaText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isMediaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const imageDataUrlPattern = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

function isValidImageDataUrl(value: string) {
  return imageDataUrlPattern.test(value.trim());
}

function isExternalVisualSrc(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/');
}

export function validateNodeVisuals(flowLabel: string, nodeId: string, visuals: unknown, errors: string[]) {
  if (visuals === undefined) return;
  if (!Array.isArray(visuals)) {
    errors.push(`Os recursos visuais do nó ${nodeId} no fluxo ${flowLabel} precisam estar em uma lista.`);
    return;
  }

  const ids = new Set<string>();
  visuals.forEach((visual, index) => {
    if (!isMediaRecord(visual)) {
      errors.push(`O recurso visual no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa ser um objeto.`);
      return;
    }

    const visualId = hasMediaText(visual.id) ? String(visual.id) : `index-${index}`;
    if (!hasMediaText(visual.id)) {
      errors.push(
        `O recurso visual no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um ID.`,
      );
    } else if (ids.has(visualId)) {
      errors.push(`O nó ${nodeId} do fluxo ${flowLabel} tem o ID de recurso visual repetido: ${visualId}.`);
    } else {
      ids.add(visualId);
    }

    if (!hasMediaText(visual.alt)) {
      errors.push(
        `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um texto alternativo.`,
      );
    }
    if (!hasMediaText(visual.src)) {
      errors.push(`O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar uma origem.`);
    } else {
      const src = String(visual.src);
      if (src.trim().startsWith('data:')) {
        if (!isValidImageDataUrl(src)) {
          errors.push(
            `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, usa um formato de imagem enviada inválido.`,
          );
        }
      } else if (!isExternalVisualSrc(src)) {
        errors.push(
          `O recurso visual ${visualId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa usar um link http(s) ou caminho iniciado por "/".`,
        );
      }
    }
  });
}

export function validateNodeVideos(flowLabel: string, nodeId: string, videos: unknown, errors: string[]) {
  if (videos === undefined) return;
  if (!Array.isArray(videos)) {
    errors.push(`Os vídeos do nó ${nodeId} no fluxo ${flowLabel} precisam estar em uma lista.`);
    return;
  }

  const ids = new Set<string>();
  videos.forEach((video, index) => {
    if (!isMediaRecord(video)) {
      errors.push(`O vídeo no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa ser um objeto.`);
      return;
    }

    const videoId = hasMediaText(video.id) ? String(video.id) : `index-${index}`;
    if (!hasMediaText(video.id)) {
      errors.push(`O vídeo no índice ${index} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um ID.`);
    } else if (ids.has(videoId)) {
      errors.push(`O nó ${nodeId} do fluxo ${flowLabel} tem o ID de vídeo repetido: ${videoId}.`);
    } else {
      ids.add(videoId);
    }

    if (!hasMediaText(video.title)) {
      errors.push(`O vídeo ${videoId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa informar um título.`);
    }
    if (!hasMediaText(video.url) || parseYouTubeVideoId(String(video.url)) === null) {
      errors.push(`O vídeo ${videoId} do nó ${nodeId}, no fluxo ${flowLabel}, precisa usar uma URL válida do YouTube.`);
    }
  });
}

export function validateNodeExercise(flowLabel: string, nodeId: string, exercise: unknown, errors: string[]) {
  if (exercise === undefined) return;
  if (typeof exercise !== 'string' || !allowedFlowExercises.includes(exercise)) {
    errors.push(
      `O exercício do nó ${nodeId} no fluxo ${flowLabel} deve ser um destes: ${allowedFlowExercises.join(', ')}.`,
    );
  }
}

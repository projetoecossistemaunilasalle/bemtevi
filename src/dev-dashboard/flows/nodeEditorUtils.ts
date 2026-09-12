import type { FlowEffect, FlowNode } from '../../domain/flow-engine/types';
import { EFFECT_KIND_OPTIONS } from './flowEffectFields';

export { NAVIGATION_OPTIONS } from './flowNavigation';

export const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

/** Shared wording for the inline kind switch and the map's add-stage menu. */
export const KIND_SWITCH_OPTIONS: Array<{ kind: FlowNode['kind']; label: string }> = [
  { kind: 'choice', label: 'Pergunta' },
  { kind: 'result', label: 'Final' },
  { kind: 'score_branch', label: 'Ramificação' },
];

/** First free `${node.id}-video-N`, available to every node kind. */
export function uniqueVideoId(node: FlowNode): string {
  const videos = node.videos ?? [];
  let index = videos.length + 1;
  let candidate = `${node.id}-video-${index}`;
  while (videos.some((video) => video.id === candidate)) {
    index += 1;
    candidate = `${node.id}-video-${index}`;
  }
  return candidate;
}

/** First free `${node.id}-visual-N`, mirroring uniqueVideoId. */
export function uniqueVisualId(node: FlowNode): string {
  const visuals = node.visuals ?? [];
  let index = visuals.length + 1;
  let candidate = `${node.id}-visual-${index}`;
  while (visuals.some((visual) => visual.id === candidate)) {
    index += 1;
    candidate = `${node.id}-visual-${index}`;
  }
  return candidate;
}

/** Advisory-only YouTube detection; authoritative validation stays elsewhere. */
export const YOUTUBE_URL_PATTERN = /youtube\.com|youtu\.be/i;

export function effectKindLabel(kind: FlowEffect['kind']) {
  return EFFECT_KIND_OPTIONS.find((option) => option.kind === kind)?.label.toLocaleLowerCase('pt-BR') ?? 'ação';
}

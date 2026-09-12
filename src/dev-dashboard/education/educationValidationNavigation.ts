import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import type { DashboardValidationIssue } from '../validation/validationTypes';

export type EducationValidationTarget =
  | {
      kind: 'group';
      groupIndex: number;
      focusPath: string;
      label: 'Ir ao grupo';
      description: string;
    }
  | {
      kind: 'resource';
      resourceIndex: number;
      resourceId: string;
      blockId?: string;
      focusPath: string;
      label: 'Ir ao material';
      description: string;
    };

/**
 * Reduces nested featured-image diagnostics to the editor surface that owns
 * the value. Other paths stay untouched so block and field targets retain the
 * same focus semantics as their validation issue.
 */
export function normalizeEducationValidationPath(path: string): string {
  if (/^materials\.\d+$/.test(path)) return path;

  const featuredImageMarker = '.featuredImage.';
  const featuredImageIndex = path.indexOf(featuredImageMarker);
  if (featuredImageIndex >= 0) {
    return path.slice(0, featuredImageIndex + '.featuredImage'.length);
  }

  return path;
}

/**
 * Resolves an education validation issue to the dashboard surface that can
 * correct it. The returned target is intentionally pure: the dashboard owns
 * selection, group expansion, block expansion, and focus side effects.
 */
export function resolveEducationValidationTarget(
  issue: DashboardValidationIssue,
  resources: EducationResource[],
  groups: EducationResourceGroup[],
): EducationValidationTarget | null {
  const path = issue.path;
  if (!path) return null;

  const groupMatch = /^groups\.(\d+)(?:\.|$)/.exec(path);
  if (groupMatch) {
    const groupIndex = Number(groupMatch[1]);
    if (!groups[groupIndex]) return null;

    return {
      kind: 'group',
      groupIndex,
      focusPath: path,
      label: 'Ir ao grupo',
      description: path.endsWith('.title')
        ? 'preencha o título destacado no cadastro do grupo.'
        : 'revise o grupo destacado; se o identificador estiver inválido, remova-o e crie outro.',
    };
  }

  const duplicateMaterialMatch = /^materials\.(\d+)$/.exec(path);
  const resourceIndex = duplicateMaterialMatch
    ? Number(duplicateMaterialMatch[1])
    : resources.findIndex((resource) => path === resource.id || path.startsWith(`${resource.id}.`));
  const resource = resources[resourceIndex];
  if (!resource) return null;

  const blockPathPrefix = `${resource.id}.body.`;
  const blockPath = path.startsWith(blockPathPrefix) ? path.slice(blockPathPrefix.length) : undefined;
  const blockId = blockPath?.split('.')[0];
  const isBlockTarget = blockPath !== undefined;

  return {
    kind: 'resource',
    resourceIndex,
    resourceId: resource.id,
    ...(blockId ? { blockId } : {}),
    focusPath: normalizeEducationValidationPath(path),
    label: 'Ir ao material',
    description: duplicateMaterialMatch
      ? 'revise o material destacado; se o identificador estiver duplicado, remova-o e crie outro.'
      : isBlockTarget
        ? 'corrija o campo destacado dentro do bloco de conteúdo indicado.'
        : 'corrija o campo destacado nos dados deste material.',
  };
}

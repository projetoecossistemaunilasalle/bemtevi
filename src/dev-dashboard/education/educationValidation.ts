import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import { findFeaturedImageOption } from '../../content/resources/featuredImages';
import { isImageDataUrl } from '../components/fileUpload';
import { createValidationResult, type DashboardValidationIssue } from '../validation/validationTypes';
import { findDuplicateIds } from '../validation/duplicateIds';

type EducationResourceBodyBlock = NonNullable<EducationResource['body']>[number];

export function validateDashboardEducation(resources: EducationResource[], groups: EducationResourceGroup[]) {
  const issues: DashboardValidationIssue[] = [];

  findDuplicateIds(resources.map((resource) => resource.id)).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'education',
      id: `duplicate-material-id:${id}`,
      message: `Existe mais de um material com o ID "${id}".`,
    });
  });

  resources.forEach((resource) => {
    if (!resource.title.trim()) pushMissing(issues, resource.id, 'title', 'O título é obrigatório.');
    if (!resource.source.trim()) pushMissing(issues, resource.id, 'source', 'A fonte é obrigatória.');
    if (!resource.description.trim()) pushMissing(issues, resource.id, 'description', 'A descrição é obrigatória.');

    if (resource.imageUrl && !isValidImageUrl(resource.imageUrl)) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `invalid-thumbnail-image:${resource.id}`,
        message: 'A miniatura da biblioteca precisa ser um link http://, https:// ou um arquivo enviado.',
        path: `${resource.id}.imageUrl`,
      });
    }

    if (resource.tags.length === 0) {
      issues.push({
        level: 'warning',
        area: 'education',
        id: `empty-tags:${resource.id}`,
        message: 'Este material ainda não tem tags.',
        path: `${resource.id}.tags`,
      });
    }

    if (!resource.featuredImage) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `missing-featured-image:${resource.id}`,
        message: 'A imagem principal do material é obrigatória.',
        path: `${resource.id}.featuredImage`,
      });
    } else if (resource.featuredImage.kind === 'catalog') {
      const option = findFeaturedImageOption(resource.featuredImage.imageId);
      if (!option) {
        issues.push({
          level: 'error',
          area: 'education',
          id: `unknown-featured-image:${resource.id}`,
          message: 'A imagem principal selecionada não existe no catálogo.',
          path: `${resource.id}.featuredImage.imageId`,
        });
      }
    } else if (resource.featuredImage.kind === 'external') {
      if (!isValidImageUrl(resource.featuredImage.imageUrl)) {
        issues.push({
          level: 'error',
          area: 'education',
          id: `invalid-featured-image-url:${resource.id}`,
          message: 'A URL da imagem principal precisa ser um link http://, https:// ou um arquivo enviado.',
          path: `${resource.id}.featuredImage.imageUrl`,
        });
      }
    } else if (resource.featuredImage.kind === 'uploaded') {
      if (!resource.featuredImage.dataUrl.trim()) {
        issues.push({
          level: 'error',
          area: 'education',
          id: `missing-uploaded-featured-image:${resource.id}`,
          message: 'Escolha uma imagem principal do computador ou use outra opção de imagem.',
          path: `${resource.id}.featuredImage.dataUrl`,
        });
      } else if (!isValidImageUrl(resource.featuredImage.dataUrl)) {
        issues.push({
          level: 'error',
          area: 'education',
          id: `invalid-uploaded-featured-image:${resource.id}`,
          message: 'A imagem enviada parece estar corrompida. Tente enviar novamente.',
          path: `${resource.id}.featuredImage.dataUrl`,
        });
      }
    }

    resource.body?.forEach((block) => validateBodyBlock(issues, resource.id, block));
  });

  const groupIds = groups.map((g) => g.id);
  findDuplicateIds(groupIds).forEach((id) => {
    issues.push({
      level: 'error',
      area: 'education',
      id: `duplicate-group-id:${id}`,
      message: `Existe mais de um grupo com o ID "${id}".`,
    });
  });

  groups.forEach((group) => {
    if (group.id === DEFAULT_EDUCATION_GROUP_ID) {
      issues.push({
        level: 'error',
        area: 'education',
        id: `reserved-group-id:${DEFAULT_EDUCATION_GROUP_ID}`,
        message: `O ID "${DEFAULT_EDUCATION_GROUP_ID}" é reservado e não pode ser usado.`,
      });
    }

    if (!group.title.trim()) {
      issues.push({
        level: 'warning',
        area: 'education',
        id: `empty-group-title:${group.id}`,
        message: `O grupo "${group.id}" não tem título.`,
      });
    }
  });

  const validGroupIds = new Set(groupIds);
  resources.forEach((resource) => {
    if (
      resource.group !== undefined &&
      resource.group !== DEFAULT_EDUCATION_GROUP_ID &&
      !validGroupIds.has(resource.group)
    ) {
      issues.push({
        level: 'warning',
        area: 'education',
        id: `dangling-group:${resource.id}`,
        message: `O material "${resource.id}" referencia o grupo "${resource.group}", que não existe.`,
      });
    }
  });

  return createValidationResult(issues);
}

function validateBodyBlock(issues: DashboardValidationIssue[], resourceId: string, block: EducationResourceBodyBlock) {
  const path = `${resourceId}.body.${block.id}`;

  if ((block.kind === 'paragraph' || block.kind === 'heading') && !block.text?.trim()) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `empty-body-block:${resourceId}:${block.id}`,
      message: 'Este bloco do conteúdo está vazio.',
      path,
    });
  }

  if (block.kind === 'list' && (!block.items || block.items.every((item) => !item.trim()))) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `empty-body-block:${resourceId}:${block.id}`,
      message: 'Este bloco do conteúdo está vazio.',
      path,
    });
  }

  if (block.kind === 'image' && !isValidImageUrl(block.imageUrl ?? '')) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-body-image-url:${resourceId}:${block.id}`,
      message: 'A URL da imagem interna precisa ser um link http://, https:// ou um arquivo enviado.',
      path: `${path}.imageUrl`,
    });
  }

  if (block.kind === 'video' && !isHttpUrl(block.url ?? '')) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-video-block-url:${resourceId}:${block.id}`,
      message: 'A URL do vídeo precisa começar com http:// ou https://.',
      path: `${path}.url`,
    });
  }

  if (block.kind === 'sourceLink' && (!block.label?.trim() || !isHttpUrl(block.url ?? ''))) {
    issues.push({
      level: 'error',
      area: 'education',
      id: `invalid-source-link-block:${resourceId}:${block.id}`,
      message: 'O bloco de fonte precisa de rótulo e URL pública.',
      path,
    });
  }
}

function pushMissing(issues: DashboardValidationIssue[], resourceId: string, field: string, message: string) {
  issues.push({
    level: 'error',
    area: 'education',
    id: `missing-${field}:${resourceId}`,
    message,
    path: `${resourceId}.${field}`,
  });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidImageUrl(value: string) {
  return isRelativeImagePath(value) || isHttpUrl(value) || isImageDataUrl(value);
}

function isRelativeImagePath(value: string) {
  const trimmedValue = value.trim();
  return (trimmedValue.startsWith('/') && !trimmedValue.startsWith('//')) || trimmedValue.startsWith('./');
}

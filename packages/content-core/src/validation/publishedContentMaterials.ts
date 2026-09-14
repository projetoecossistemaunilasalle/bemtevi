import type { EducationResourceGroup } from '../model/groups';
import type { GuidedFlow } from '../model/flowTypes';
import type { EducationResource } from '../model/resources';
import { parseGuidedFlow } from './parseFlow';
import { validateFlow } from './validateFlow';
import { isFiniteNumber, isNonEmptyString, isRecord } from './publishedContentGuards';
import { PublishedContentValidationError } from '../model/publishedContent';

const SUPPORTED_AUDIENCES = ['teachers', 'public_school_teachers', 'general'] as const;
const SUPPORTED_EDUCATION_BLOCK_KINDS = [
  'paragraph',
  'heading',
  'list',
  'image',
  'video',
  'pdf',
  'sourceLink',
] as const;

export function validateFlows(flows: unknown): GuidedFlow[] {
  if (!Array.isArray(flows)) {
    throw new PublishedContentValidationError('O campo "flows" deve ser uma lista.');
  }
  return flows.map((flow, index) => {
    const label = isRecord(flow) && isNonEmptyString(flow.id) ? String(flow.id) : `índice ${index}`;
    const validation = validateFlow(flow);
    if (!validation.valid) {
      throw new PublishedContentValidationError(`Fluxo "${label}" inválido: ${validation.errors.join(' ')}`);
    }
    return parseGuidedFlow(flow);
  });
}

export function validateEducationMaterials(materials: unknown): EducationResource[] {
  if (!Array.isArray(materials)) {
    throw new PublishedContentValidationError('O campo "educationMaterials" deve ser uma lista.');
  }
  return materials.map((material, index) => {
    if (!isRecord(material)) {
      throw new PublishedContentValidationError(`Recurso educacional no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(material.id) ? String(material.id) : `índice ${index}`;
    if (!isNonEmptyString(material.id)) {
      throw new PublishedContentValidationError(`Recurso educacional no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(material.title)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "title".`);
    }
    if (!isNonEmptyString(material.source)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "source".`);
    }
    if (!isNonEmptyString(material.description)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um "description".`);
    }
    if (!Array.isArray(material.tags) || material.tags.some((tag) => typeof tag !== 'string')) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de "tags" como lista de textos.`);
    }
    if (!SUPPORTED_AUDIENCES.includes(material.audience as (typeof SUPPORTED_AUDIENCES)[number])) {
      throw new PublishedContentValidationError(`Recurso "${label}" tem "audience" inválido.`);
    }
    if (!isRecord(material.review)) {
      throw new PublishedContentValidationError(`Recurso "${label}" precisa de um objeto "review".`);
    }
    if (material.body !== undefined) {
      if (!Array.isArray(material.body)) {
        throw new PublishedContentValidationError(`Recurso "${label}" tem "body" inválido.`);
      }
      material.body.forEach((block) => {
        if (
          !isRecord(block) ||
          !isNonEmptyString(block.id) ||
          !SUPPORTED_EDUCATION_BLOCK_KINDS.includes(block.kind as (typeof SUPPORTED_EDUCATION_BLOCK_KINDS)[number])
        ) {
          throw new PublishedContentValidationError(`Recurso "${label}" tem bloco de "body" inválido.`);
        }
        if (
          block.kind === 'list' &&
          block.items !== undefined &&
          (!Array.isArray(block.items) || block.items.some((item) => typeof item !== 'string'))
        ) {
          throw new PublishedContentValidationError(`Recurso "${label}" tem bloco de "body" inválido.`);
        }
      });
    }
    return material as unknown as EducationResource;
  });
}

export function validateEducationGroups(groups: unknown): EducationResourceGroup[] {
  if (!Array.isArray(groups)) {
    throw new PublishedContentValidationError('O campo "educationGroups" deve ser uma lista.');
  }
  return groups.map((group, index) => {
    if (!isRecord(group)) {
      throw new PublishedContentValidationError(`Grupo no índice ${index} deve ser um objeto.`);
    }
    const label = isNonEmptyString(group.id) ? String(group.id) : `índice ${index}`;
    if (!isNonEmptyString(group.id)) {
      throw new PublishedContentValidationError(`Grupo no índice ${index} precisa de um "id".`);
    }
    if (!isNonEmptyString(group.title)) {
      throw new PublishedContentValidationError(`Grupo "${label}" precisa de um "title".`);
    }
    if (!isFiniteNumber(group.order)) {
      throw new PublishedContentValidationError(`Grupo "${label}" precisa de um "order" numérico.`);
    }
    return group as unknown as EducationResourceGroup;
  });
}

import { describe, expect, it } from 'vitest';
import type { EducationResource } from '../../../domain/resources/types';
import type { EducationResourceGroup } from '../../../content/resources/groups';
import type { DashboardValidationIssue } from '../../validation/validationTypes';
import { normalizeEducationValidationPath, resolveEducationValidationTarget } from '../educationValidationNavigation';

function resource(id: string, body: EducationResource['body'] = []): EducationResource {
  return {
    id,
    title: `Material ${id}`,
    source: 'Fonte de teste',
    description: 'Descrição de teste',
    tags: ['teste'],
    audience: 'general',
    body,
    review: { status: 'approved', reviewedBy: 'Teste', reviewedAt: '2026-09-12', notes: '' },
  };
}

function issue(path?: string): DashboardValidationIssue {
  return {
    level: 'error',
    area: 'education',
    id: `test:${path ?? 'without-path'}`,
    message: 'Problema de validação.',
    path,
  };
}

const groups: EducationResourceGroup[] = [
  { id: 'autocuidado', title: 'Autocuidado', order: 1 },
  { id: 'formacao', title: 'Formação', order: 2 },
];

describe('normalizeEducationValidationPath', () => {
  it('keeps material index and regular field paths intact', () => {
    expect(normalizeEducationValidationPath('materials.2')).toBe('materials.2');
    expect(normalizeEducationValidationPath('mat-1.body.bloco-1.text')).toBe('mat-1.body.bloco-1.text');
  });

  it('collapses nested featured-image fields to the featured-image editor target', () => {
    expect(normalizeEducationValidationPath('mat-1.featuredImage.imageId')).toBe('mat-1.featuredImage');
    expect(normalizeEducationValidationPath('mat-1.featuredImage.dataUrl')).toBe('mat-1.featuredImage');
  });
});

describe('resolveEducationValidationTarget', () => {
  it('resolves groups by their validation index and preserves field focus', () => {
    const target = resolveEducationValidationTarget(issue('groups.1.title'), [], groups);

    expect(target).toEqual({
      kind: 'group',
      groupIndex: 1,
      focusPath: 'groups.1.title',
      label: 'Ir ao grupo',
      description: 'preencha o título destacado no cadastro do grupo.',
    });
  });

  it('uses the explicit duplicate-material index instead of an ambiguous resource id', () => {
    const resources = [resource('duplicado'), resource('duplicado')];
    const target = resolveEducationValidationTarget(issue('materials.1'), resources, []);

    expect(target).toMatchObject({
      kind: 'resource',
      resourceIndex: 1,
      resourceId: 'duplicado',
      focusPath: 'materials.1',
      label: 'Ir ao material',
    });
    expect(target?.description).toContain('identificador estiver duplicado');
  });

  it('resolves resource fields by stable id and exposes the block to expand', () => {
    const resources = [resource('outro'), resource('mat-1', [{ id: 'bloco-1', kind: 'paragraph', text: '' }])];
    const target = resolveEducationValidationTarget(issue('mat-1.body.bloco-1.text'), resources, []);

    expect(target).toEqual({
      kind: 'resource',
      resourceIndex: 1,
      resourceId: 'mat-1',
      blockId: 'bloco-1',
      focusPath: 'mat-1.body.bloco-1.text',
      label: 'Ir ao material',
      description: 'corrija o campo destacado dentro do bloco de conteúdo indicado.',
    });
  });

  it('normalizes featured-image targets and leaves generic resource targets actionable', () => {
    const resources = [resource('mat-1')];

    expect(resolveEducationValidationTarget(issue('mat-1.featuredImage.imageId'), resources, [])).toMatchObject({
      resourceIndex: 0,
      resourceId: 'mat-1',
      focusPath: 'mat-1.featuredImage',
    });
    expect(resolveEducationValidationTarget(issue('mat-1.title'), resources, [])).toMatchObject({
      resourceIndex: 0,
      resourceId: 'mat-1',
      focusPath: 'mat-1.title',
    });
  });

  it('returns null when an issue does not belong to an existing group or resource', () => {
    expect(resolveEducationValidationTarget(issue('groups.4.title'), [], groups)).toBeNull();
    expect(resolveEducationValidationTarget(issue('missing.title'), [resource('mat-1')], [])).toBeNull();
    expect(resolveEducationValidationTarget(issue(), [resource('mat-1')], [])).toBeNull();
  });
});

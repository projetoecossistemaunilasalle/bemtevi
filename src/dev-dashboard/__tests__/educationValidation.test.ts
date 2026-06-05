import { describe, expect, it } from 'vitest';
import type { EducationResource } from '../../domain/resources/types';
import { validateDashboardEducation } from '../education/educationValidation';

const baseResource: EducationResource = {
  id: 'resource-one',
  title: 'Material de teste',
  source: 'Equipe SeCuida',
  description: 'Descrição clara do material.',
  imageUrl: 'https://example.com/thumb.jpg',
  featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
  tags: ['descanso'],
  audience: 'teachers',
  contentType: 'summary',
  review: {
    status: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    notes: '',
  },
};

describe('validateDashboardEducation', () => {
  it('rejects duplicate material IDs', () => {
    const result = validateDashboardEducation([baseResource, { ...baseResource }]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-material-id:resource-one',
        message: 'Existe mais de um material com o ID "resource-one".',
      }),
    );
  });

  it('rejects video materials without URL', () => {
    const result = validateDashboardEducation([{ ...baseResource, contentType: 'video_link' }]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-url:resource-one',
        message: 'Este tipo de material precisa de um link público.',
      }),
    );
  });

  it('warns when tags are empty', () => {
    const result = validateDashboardEducation([{ ...baseResource, tags: [] }]);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'empty-tags:resource-one',
        message: 'Este material ainda não tem tags.',
      }),
    );
  });

  it('rejects materials without a featured image', () => {
    const result = validateDashboardEducation([{ ...baseResource, featuredImage: undefined }]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-featured-image:resource-one',
        message: 'A imagem principal do material é obrigatória.',
      }),
    );
  });

  it('rejects unknown featured image catalog IDs', () => {
    const result = validateDashboardEducation([
      { ...baseResource, featuredImage: { kind: 'catalog', imageId: 'unknown-image' } },
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'unknown-featured-image:resource-one',
        message: 'A imagem principal selecionada não existe no catálogo.',
      }),
    );
  });

  it('rejects invalid external featured image URLs', () => {
    const result = validateDashboardEducation([
      { ...baseResource, featuredImage: { kind: 'external', imageUrl: 'not-a-url' } },
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-featured-image-url:resource-one',
        message: 'A URL da imagem principal precisa começar com http:// ou https://.',
      }),
    );
  });

  it('rejects empty paragraph body blocks', () => {
    const result = validateDashboardEducation([
      { ...baseResource, body: [{ id: 'overview', kind: 'paragraph', text: '   ' }] },
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'empty-body-block:resource-one:overview',
        message: 'Este bloco do conteúdo está vazio.',
      }),
    );
  });

  it('rejects body image blocks with invalid URLs', () => {
    const result = validateDashboardEducation([
      { ...baseResource, body: [{ id: 'image-one', kind: 'image', imageUrl: 'image.png' }] },
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-body-image-url:resource-one:image-one',
        message: 'A URL da imagem interna precisa começar com http:// ou https://.',
      }),
    );
  });

  it('rejects video blocks with invalid URLs', () => {
    const result = validateDashboardEducation([
      { ...baseResource, body: [{ id: 'video-one', kind: 'video', title: 'Vídeo', url: 'video' }] },
    ]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-video-block-url:resource-one:video-one',
        message: 'A URL do vídeo precisa começar com http:// ou https://.',
      }),
    );
  });
});

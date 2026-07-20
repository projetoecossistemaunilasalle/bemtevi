import { describe, expect, it } from 'vitest';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import { validateDashboardEducation } from '../education/educationValidation';

const baseResource: EducationResource = {
  id: 'resource-one',
  title: 'Material de teste',
  source: 'Equipe BemTeVi',
  description: 'Descrição clara do material.',
  imageUrl: 'https://example.com/thumb.jpg',
  featuredImage: { kind: 'catalog', imageId: 'hands-holding-plant' },
  tags: ['descanso'],
  audience: 'teachers',
  review: {
    status: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    notes: '',
  },
};

const shippedGroups: EducationResourceGroup[] = [
  { id: 'auto-cuidado', title: 'Autocuidado', order: 1 },
  { id: 'sala-de-aula', title: 'Sala de Aula', order: 2 },
  { id: 'formacao', title: 'Formação', order: 3 },
];

describe('validateDashboardEducation', () => {
  it('rejects duplicate material IDs', () => {
    const result = validateDashboardEducation([baseResource, { ...baseResource }], []);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'duplicate-material-id:resource-one',
        message: 'Existe mais de um material com o ID "resource-one".',
      }),
    );
  });

  it('warns when tags are empty', () => {
    const result = validateDashboardEducation([{ ...baseResource, tags: [] }], []);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        id: 'empty-tags:resource-one',
        message: 'Este material ainda não tem tags.',
      }),
    );
  });

  it('rejects materials without a featured image', () => {
    const result = validateDashboardEducation([{ ...baseResource, featuredImage: undefined }], []);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-featured-image:resource-one',
        message: 'A imagem principal do material é obrigatória.',
      }),
    );
  });

  it('rejects unknown featured image catalog IDs', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, featuredImage: { kind: 'catalog', imageId: 'unknown-image' } }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'unknown-featured-image:resource-one',
        message: 'A imagem principal selecionada não existe no catálogo.',
      }),
    );
  });

  it('rejects invalid external featured image URLs', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, featuredImage: { kind: 'external', imageUrl: 'not-a-url' } }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-featured-image-url:resource-one',
        message: 'A URL da imagem principal precisa ser um link http://, https:// ou um arquivo enviado.',
      }),
    );
  });

  it('accepts uploaded thumbnail, featured image, and body image data URLs', () => {
    const result = validateDashboardEducation(
      [
        {
          ...baseResource,
          imageUrl: 'data:image/png;base64,AAAA',
          featuredImage: { kind: 'uploaded', dataUrl: 'data:image/png;base64,BBBB', fileName: 'main.png' },
          body: [{ id: 'image-one', kind: 'image', imageUrl: 'data:image/png;base64,CCCC', imageFileName: 'body.png' }],
        },
      ],
      [],
    );

    expect(result.errors).toEqual([]);
  });

  it('accepts relative image paths for thumbnails, featured images, and body images', () => {
    const result = validateDashboardEducation(
      [
        {
          ...baseResource,
          imageUrl: '/assets/thumb.png',
          featuredImage: { kind: 'external', imageUrl: '/assets/main.webp' },
          body: [{ id: 'image-one', kind: 'image', imageUrl: '/assets/body.jpg' }],
        },
      ],
      [],
    );

    expect(result.errors).toEqual([]);
  });

  it('accepts exported relative paths for uploaded featured images', () => {
    const result = validateDashboardEducation(
      [
        {
          ...baseResource,
          featuredImage: { kind: 'uploaded', dataUrl: './images/resource-featured.jpg', fileName: 'main.jpg' },
        },
      ],
      [],
    );

    expect(result.errors).toEqual([]);
  });

  it('accepts uploaded image data URLs with whitespace and missing padding', () => {
    const result = validateDashboardEducation(
      [
        {
          ...baseResource,
          imageUrl: 'data:image/png;base64,QU\nJD',
          featuredImage: { kind: 'uploaded', dataUrl: ' data:image/png;base64,RE VG ', fileName: 'main.png' },
          body: [{ id: 'image-one', kind: 'image', imageUrl: 'data:image/png;base64,R0hJ' }],
        },
      ],
      [],
    );

    expect(result.errors).toEqual([]);
  });

  it('rejects protocol-relative image URLs', () => {
    const result = validateDashboardEducation([{ ...baseResource, imageUrl: '//example.com/thumb.jpg' }], []);

    expect(result.errors).toContainEqual(expect.objectContaining({ id: 'invalid-thumbnail-image:resource-one' }));
  });

  it('asks for an image when uploaded featured image mode has no selected file', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, featuredImage: { kind: 'uploaded', dataUrl: '', fileName: '' } }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'missing-uploaded-featured-image:resource-one',
        message: 'Escolha uma imagem principal do computador ou use outra opção de imagem.',
      }),
    );
    expect(result.errors).not.toContainEqual(
      expect.objectContaining({ id: 'invalid-uploaded-featured-image:resource-one' }),
    );
  });

  it('rejects corrupt uploaded image data URLs', () => {
    const result = validateDashboardEducation(
      [
        {
          ...baseResource,
          imageUrl: 'data:text/plain;base64,AAAA',
          featuredImage: { kind: 'uploaded', dataUrl: 'data:image/png;base64,not-valid-base64%%' },
          body: [{ id: 'image-one', kind: 'image', imageUrl: 'data:image/png;base64,also-invalid%%' }],
        },
      ],
      [],
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'invalid-thumbnail-image:resource-one' }),
        expect.objectContaining({ id: 'invalid-uploaded-featured-image:resource-one' }),
        expect.objectContaining({ id: 'invalid-body-image-url:resource-one:image-one' }),
      ]),
    );
  });

  it('rejects empty paragraph body blocks', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, body: [{ id: 'overview', kind: 'paragraph', text: '   ' }] }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'empty-body-block:resource-one:overview',
        message: 'Este bloco do conteúdo está vazio.',
      }),
    );
  });

  it('rejects body image blocks with invalid URLs', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, body: [{ id: 'image-one', kind: 'image', imageUrl: 'image.png' }] }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-body-image-url:resource-one:image-one',
        message: 'A URL da imagem interna precisa ser um link http://, https:// ou um arquivo enviado.',
      }),
    );
  });

  it('rejects video blocks with invalid URLs', () => {
    const result = validateDashboardEducation(
      [{ ...baseResource, body: [{ id: 'video-one', kind: 'video', title: 'Vídeo', url: 'video' }] }],
      [],
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        id: 'invalid-video-block-url:resource-one:video-one',
        message: 'A URL do vídeo precisa começar com http:// ou https://.',
      }),
    );
  });

  describe('group validation', () => {
    it('detects duplicate group IDs', () => {
      const groups: EducationResourceGroup[] = [
        { id: 'my-group', title: 'My Group', order: 1 },
        { id: 'my-group', title: 'Duplicate', order: 2 },
      ];
      const result = validateDashboardEducation([baseResource], groups);

      expect(result.errors).toContainEqual(expect.objectContaining({ id: 'duplicate-group-id:my-group' }));
    });

    it('detects reserved group id "geral"', () => {
      const groups: EducationResourceGroup[] = [{ id: DEFAULT_EDUCATION_GROUP_ID, title: 'Geral', order: 1 }];
      const result = validateDashboardEducation([baseResource], groups);

      expect(result.errors).toContainEqual(
        expect.objectContaining({ id: `reserved-group-id:${DEFAULT_EDUCATION_GROUP_ID}` }),
      );
    });

    it('warns when a group has an empty title', () => {
      const groups: EducationResourceGroup[] = [{ id: 'empty-title-group', title: '   ', order: 1 }];
      const result = validateDashboardEducation([baseResource], groups);

      expect(result.warnings).toContainEqual(expect.objectContaining({ id: 'empty-group-title:empty-title-group' }));
    });

    it('warns when a resource references a non-existent group', () => {
      const result = validateDashboardEducation(
        [{ ...baseResource, id: 'bad-ref', group: 'non-existent-group' }],
        shippedGroups,
      );

      expect(result.warnings).toContainEqual(expect.objectContaining({ id: 'dangling-group:bad-ref' }));
    });

    it('does not warn when group is undefined', () => {
      const result = validateDashboardEducation([{ ...baseResource, group: undefined }], shippedGroups);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ id: expect.stringMatching(/^dangling-group:/) }),
      );
    });

    it('does not warn when group is "geral"', () => {
      const result = validateDashboardEducation(
        [{ ...baseResource, group: DEFAULT_EDUCATION_GROUP_ID }],
        shippedGroups,
      );

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ id: expect.stringMatching(/^dangling-group:/) }),
      );
    });

    it('does not warn when group references a known shipped group', () => {
      const result = validateDashboardEducation([{ ...baseResource, group: 'auto-cuidado' }], shippedGroups);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({ id: expect.stringMatching(/^dangling-group:/) }),
      );
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import type { DashboardDraftContent } from '../export/exportBundle';
import { extractImagesFromDrafts } from '../export/extractImages';

const pngDataUrl = (value: string) => `data:image/png;base64,${btoa(value)}`;

const contact: ServiceDirectoryEntry = {
  id: 'canoas-caps-praca-brasil',
  name: 'CAPS II Praça Brasil',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Av. Getúlio Vargas, 7071 - Centro, Canoas - RS',
  phoneDisplay: '(51) 3236-1500',
  phoneHref: 'tel:5132361500',
  review: { status: 'approved', reviewedBy: 'Equipe BemTeVi', reviewedAt: null, notes: '' },
};

describe('extractImagesFromDrafts', () => {
  it('extracts uploaded material images into ZIP image paths', () => {
    const drafts: DashboardDraftContent = {
      flows: [],
      educationGroups: [],
      contacts: [contact],
      educationMaterials: [
        {
          id: 'material-one',
          title: 'Material',
          source: 'Equipe BemTeVi',
          description: 'Descrição.',
          imageUrl: pngDataUrl('thumb'),
          imageFileName: 'thumb upload.png',
          featuredImage: {
            kind: 'uploaded',
            dataUrl: pngDataUrl('featured'),
            fileName: 'featured upload.png',
            alt: 'Imagem principal',
          },
          body: [
            {
              id: 'body-image',
              kind: 'image',
              imageUrl: pngDataUrl('body'),
              imageFileName: 'body upload.png',
              alt: 'Imagem interna',
            },
          ],
          tags: ['teste'],
          audience: 'teachers',
          review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
    };

    const result = extractImagesFromDrafts(drafts);
    const material = result.json.educationMaterials[0];

    expect(result.images.map((image) => image.name)).toEqual([
      'images/material-one-thumbnail-thumb_upload.png',
      'images/material-one-featured-featured_upload.png',
      'images/material-one-block-body-image-body_upload.png',
    ]);
    expect(material?.imageUrl).toBe('./images/material-one-thumbnail-thumb_upload.png');
    expect(material?.featuredImage).toEqual({
      kind: 'uploaded',
      dataUrl: './images/material-one-featured-featured_upload.png',
      fileName: 'featured upload.png',
      alt: 'Imagem principal',
    });
    expect(material?.body?.[0]?.imageUrl).toBe('./images/material-one-block-body-image-body_upload.png');
    expect(result.json.contacts).toEqual([contact]);
    expect(JSON.stringify(result.json)).not.toContain('data:image/');
  });
});

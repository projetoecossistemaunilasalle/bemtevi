import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
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
  it('extracts uploaded flow visuals from every node kind and leaves external URLs intact', () => {
    const flow: GuidedFlow = {
      id: 'flow-one',
      version: '1.0.0',
      locale: 'pt-BR',
      title: 'Fluxo',
      type: 'guided_conversation',
      status: 'draft',
      entry: {
        nodeId: 'question',
        enteringPhrases: ['Começar'],
        transitionMessage: 'Vamos começar.',
      },
      nodes: {
        question: {
          id: 'question',
          kind: 'choice',
          text: 'Pergunta',
          options: [{ id: 'continue', label: 'Continuar', next: 'result' }],
          visuals: [{ id: 'uploaded-choice', alt: 'Escolha', src: pngDataUrl('choice') }],
        },
        result: {
          id: 'result',
          kind: 'result',
          text: 'Resultado',
          visuals: [{ id: 'uploaded-result', alt: 'Resultado', src: pngDataUrl('result') }],
        },
        score: {
          id: 'score',
          kind: 'score_branch',
          text: 'Faixa',
          scoreKey: 'score',
          branches: [{ id: 'low', min: 0, max: 1, next: 'result' }],
          visuals: [
            { id: 'uploaded-score', alt: 'Faixa', src: pngDataUrl('score') },
            { id: 'external', alt: 'Externa', src: 'https://example.com/image.png' },
          ],
        },
      },
    };

    const result = extractImagesFromDrafts({
      flows: [flow],
      educationMaterials: [],
      educationGroups: [],
      contacts: [],
    });
    const extractedFlow = result.json.flows[0];

    expect(result.images.map((image) => image.name)).toEqual([
      'images/flow-flow-one-node-question-visual-uploaded-choice.png',
      'images/flow-flow-one-node-result-visual-uploaded-result.png',
      'images/flow-flow-one-node-score-visual-uploaded-score.png',
    ]);
    expect(extractedFlow?.nodes.question.visuals?.[0]?.src).toBe(
      './images/flow-flow-one-node-question-visual-uploaded-choice.png',
    );
    expect(extractedFlow?.nodes.result.visuals?.[0]?.src).toBe(
      './images/flow-flow-one-node-result-visual-uploaded-result.png',
    );
    expect(extractedFlow?.nodes.score.visuals?.[0]?.src).toBe(
      './images/flow-flow-one-node-score-visual-uploaded-score.png',
    );
    expect(extractedFlow?.nodes.score.visuals?.[1]?.src).toBe('https://example.com/image.png');
    expect(JSON.stringify(result.json)).not.toContain('data:image/');
  });

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

  it('extracts flow images before material images', () => {
    const drafts: DashboardDraftContent = {
      flows: [
        {
          id: 'fluxo-a',
          version: '1.0.0',
          locale: 'pt-BR',
          title: 'Fluxo A',
          type: 'guided_conversation',
          status: 'draft',
          entry: { nodeId: 'inicio', enteringPhrases: ['Oi'], transitionMessage: 'Vamos lá.' },
          nodes: {
            inicio: {
              id: 'inicio',
              kind: 'result',
              text: 'Fim',
              visuals: [{ id: 'calma', alt: 'Imagem', src: pngDataUrl('calma') }],
            },
          },
        },
      ],
      educationMaterials: [
        {
          id: 'material-one',
          title: 'Material',
          source: 'Equipe BemTeVi',
          description: 'Descrição.',
          imageUrl: pngDataUrl('thumb'),
          imageFileName: 'thumb upload.png',
          tags: ['teste'],
          audience: 'teachers',
          review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
      educationGroups: [],
      contacts: [],
    };

    const result = extractImagesFromDrafts(drafts);

    expect(result.images.map((image) => image.name)).toEqual([
      'images/flow-fluxo-a-node-inicio-visual-calma.png',
      'images/material-one-thumbnail-thumb_upload.png',
    ]);
  });
});

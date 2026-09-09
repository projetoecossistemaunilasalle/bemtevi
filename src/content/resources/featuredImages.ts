import handsHoldingPlant from '../../assets/featured-images/hands_holding_plant.png';
import classroom1 from '../../assets/featured-images/classroom_1.webp';
import classroom2 from '../../assets/featured-images/classroom_2.webp';
import greenPatch from '../../assets/featured-images/green_patch.webp';
import { FEATURED_IMAGE_IDS } from './featuredImageIds';

export interface FeaturedImageOption {
  id: string;
  src: string;
  alt: string;
}

export const featuredImageOptions = [
  {
    id: FEATURED_IMAGE_IDS[0],
    src: handsHoldingPlant,
    alt: 'Mãos segurando uma planta pequena.',
  },
  {
    id: FEATURED_IMAGE_IDS[1],
    src: classroom1,
    alt: 'Sala de aula vazia.',
  },
  {
    id: FEATURED_IMAGE_IDS[2],
    src: classroom2,
    alt: 'Sala de aula vazia com uma mesa com café e um caderno.',
  },
  {
    id: FEATURED_IMAGE_IDS[3],
    src: greenPatch,
    alt: 'Mesa com café e um caderno com uma janela para uma floresta ao lado.',
  },
  {
    id: FEATURED_IMAGE_IDS[4],
    src: '/bemtevi/respiracao1.jpg',
    alt: 'Pessoa praticando respiração em ambiente tranquilo.',
  },
  {
    id: FEATURED_IMAGE_IDS[5],
    src: '/bemtevi/respiracao2.jpg',
    alt: 'Exercício de respiração guiada para pausa e autocuidado.',
  },
] satisfies FeaturedImageOption[];

export const defaultFeaturedImageId = featuredImageOptions[0]?.id ?? '';

export function findFeaturedImageOption(imageId: string | undefined) {
  return featuredImageOptions.find((image) => image.id === imageId);
}

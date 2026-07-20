import handsHoldingPlant from '../../assets/featured-images/hands_holding_plant.png';
import classroom1 from '../../assets/featured-images/classroom_1.png';
import classroom2 from '../../assets/featured-images/classroom_2.png';
import greenPatch from '../../assets/featured-images/green_patch.png';

export interface FeaturedImageOption {
  id: string;
  src: string;
  alt: string;
}

export const featuredImageOptions = [
  {
    id: 'hands-holding-plant',
    src: handsHoldingPlant,
    alt: 'Mãos segurando uma planta pequena.',
  },
  {
    id: 'classroom-1',
    src: classroom1,
    alt: 'Sala de aula vazia.',
  },
  {
    id: 'classroom-2',
    src: classroom2,
    alt: 'Sala de aula vazia com uma mesa com café e um caderno.',
  },
  {
    id: 'green-patch',
    src: greenPatch,
    alt: 'Mesa com café e um caderno com uma janela para uma floresta ao lado.',
  },
  {
    id: 'respiracao-1',
    src: '/bemtevi/respiracao1.jpg',
    alt: 'Pessoa praticando respiração em ambiente tranquilo.',
  },
  {
    id: 'respiracao-2',
    src: '/bemtevi/respiracao2.jpg',
    alt: 'Exercício de respiração guiada para pausa e autocuidado.',
  },
] satisfies FeaturedImageOption[];

export const defaultFeaturedImageId = featuredImageOptions[0]?.id ?? '';

export function findFeaturedImageOption(imageId: string | undefined) {
  return featuredImageOptions.find((image) => image.id === imageId);
}

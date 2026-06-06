export interface FeaturedImageOption {
  id: string;
  src: string;
  alt: string;
}

export const featuredImageOptions = [
  {
    id: 'hands-holding-plant',
    src: `${import.meta.env.BASE_URL}hands_holding_plant.png`,
    alt: 'Mãos segurando uma planta pequena.',
  },
  {
    id: 'classroom-1',
    src: `${import.meta.env.BASE_URL}classroom_1.png`,
    alt: 'Sala de aula vazia.',
  },
  {
    id: 'classroom-2',
    src: `${import.meta.env.BASE_URL}classroom_2.png`,
    alt: 'Sala de aula vazia com uma mesa com café e um caderno.',
  },
  {
    id: 'green-patch',
    src: `${import.meta.env.BASE_URL}green_patch.png`,
    alt: 'Mesa com café e um caderno com uma janela para uma floresta ao lado.',
  },
] satisfies FeaturedImageOption[];

export const defaultFeaturedImageId = featuredImageOptions[0]?.id ?? '';

export function findFeaturedImageOption(imageId: string | undefined) {
  return featuredImageOptions.find((image) => image.id === imageId);
}

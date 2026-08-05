export const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
export const MAX_IMAGE_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2048;

type DecodedImage = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close?: () => void;
};

export type ImageProcessingDependencies = {
  createImageBitmap?: (source: Blob) => Promise<ImageBitmap>;
  createCanvas: () => HTMLCanvasElement;
  createImage: () => HTMLImageElement;
};

const defaultImageProcessingDependencies: ImageProcessingDependencies = {
  createImageBitmap:
    typeof globalThis.createImageBitmap === 'function' ? (source) => globalThis.createImageBitmap(source) : undefined,
  createCanvas: () => document.createElement('canvas'),
  createImage: () => new Image(),
};

const CONVERTIBLE_RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif']);

export async function readFileAsDataUrl(
  file: File,
  dependencies: ImageProcessingDependencies = defaultImageProcessingDependencies,
): Promise<string> {
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error('A imagem selecionada é muito grande. Escolha um arquivo de até 25 MiB.');
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    if (!CONVERTIBLE_RASTER_TYPES.has(file.type.toLowerCase())) {
      throw new Error('A imagem não pôde ser reduzida para 1 MiB neste formato. Use PNG, JPEG, WebP ou AVIF.');
    }
    return compressRasterImage(file, dependencies);
  }

  const rawDataUrl = await readRawFileAsDataUrl(file);
  if (rawDataUrl.length <= MAX_IMAGE_UPLOAD_BYTES) return rawDataUrl;

  if (!CONVERTIBLE_RASTER_TYPES.has(file.type.toLowerCase())) {
    throw new Error('A imagem não pôde ser reduzida para 1 MiB neste formato. Use PNG, JPEG, WebP ou AVIF.');
  }

  return compressRasterImage(file, dependencies);
}

function readRawFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao ler a imagem como arquivo.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

async function decodeRasterImage(file: File, dependencies: ImageProcessingDependencies): Promise<DecodedImage> {
  if (dependencies.createImageBitmap) {
    const bitmap = await dependencies.createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }

  const image = dependencies.createImage();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Falha ao decodificar a imagem.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
  };
}

async function compressRasterImage(file: File, dependencies: ImageProcessingDependencies): Promise<string> {
  let decodedImage: DecodedImage | undefined;
  try {
    decodedImage = await decodeRasterImage(file, dependencies);
    if (!decodedImage.width || !decodedImage.height) {
      throw new Error('Falha ao identificar as dimensões da imagem.');
    }

    const canvas = dependencies.createCanvas();
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não consegue processar imagens neste momento.');

    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(decodedImage.width, decodedImage.height));
    let width = Math.max(1, Math.round(decodedImage.width * initialScale));
    let height = Math.max(1, Math.round(decodedImage.height * initialScale));
    const qualities = [0.86, 0.72, 0.58, 0.44, 0.3];

    for (let dimensionAttempt = 0; dimensionAttempt < 8; dimensionAttempt++) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      decodedImage.draw(context, width, height);

      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp;base64,')) {
          throw new Error('Seu navegador não consegue converter imagens para WebP.');
        }
        if (dataUrl.length <= MAX_IMAGE_UPLOAD_BYTES) return dataUrl;
      }

      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Seu navegador')) throw error;
    throw new Error('Não foi possível processar esta imagem. Tente usar PNG, JPEG, WebP ou AVIF.', { cause: error });
  } finally {
    decodedImage?.close?.();
  }

  throw new Error('Não foi possível reduzir a imagem para 1 MiB. Tente uma imagem com menos detalhes.');
}

export function acceptImageTypes(): string {
  return 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif';
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function parseImageDataUrl(value: string | undefined): { mimeType: string; data: Uint8Array } | null {
  if (!value) return null;

  const normalizedValue = value.trim().replace(/\s/g, '');
  const match = normalizedValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;

  const mimeType = match[1] ?? '';
  if (!acceptImageTypes().split(',').includes(mimeType)) return null;

  try {
    const base64 = match[2] ?? '';
    const remainder = base64.length % 4;
    if (remainder === 1) return null;

    const paddedBase64 = remainder === 0 ? base64 : base64.padEnd(base64.length + 4 - remainder, '=');
    const binary = atob(paddedBase64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      data[i] = binary.charCodeAt(i);
    }
    return { mimeType, data };
  } catch {
    return null;
  }
}

export function isImageDataUrl(value: string | undefined): value is string {
  return parseImageDataUrl(value) !== null;
}

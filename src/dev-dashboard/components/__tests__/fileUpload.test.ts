import { describe, expect, it, vi } from 'vitest';
import {
  MAX_IMAGE_SOURCE_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  readFileAsDataUrl,
  type ImageProcessingDependencies,
} from '../fileUpload';

function mockImageProcessing(toDataUrl: (quality?: number) => string): {
  dependencies: ImageProcessingDependencies;
  toDataURL: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const toDataURL = vi.fn(toDataUrl);
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: vi.fn(() => context),
    toDataURL,
  } as unknown as HTMLCanvasElement;
  const dependencies: ImageProcessingDependencies = {
    createImageBitmap: vi.fn(async () => ({ width: 4000, height: 3000, close }) as unknown as ImageBitmap),
    createCanvas: () => canvas,
    createImage: () => new Image(),
  };

  return { dependencies, toDataURL, close };
}

describe('readFileAsDataUrl', () => {
  it('compresses a normal large raster source to WebP', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.png', { type: 'image/png' });
    const { dependencies, toDataURL, close } = mockImageProcessing(() => 'data:image/webp;base64,compressed');

    await expect(readFileAsDataUrl(file, dependencies)).resolves.toBe('data:image/webp;base64,compressed');
    expect(toDataURL).toHaveBeenCalledWith('image/webp', expect.any(Number));
    expect(close).toHaveBeenCalledOnce();
  });

  it('reads a valid small image as a data URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'small.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });

  it('keeps trying until the encoded WebP data URL is within the final limit', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' });
    const oversized = `data:image/webp;base64,${'x'.repeat(MAX_IMAGE_UPLOAD_BYTES)}`;
    const accepted = `data:image/webp;base64,${'x'.repeat(100)}`;
    let attempt = 0;
    const { dependencies, toDataURL } = mockImageProcessing(() => (attempt++ === 0 ? oversized : accepted));

    const result = await readFileAsDataUrl(file, dependencies);

    expect(result).toBe(accepted);
    expect(result.length).toBeLessThanOrEqual(MAX_IMAGE_UPLOAD_BYTES);
    expect(toDataURL).toHaveBeenCalledTimes(2);
  });

  it('rejects a source file above the browser memory guard', async () => {
    const createImageBitmap = vi.fn();
    const file = new File([new Uint8Array(MAX_IMAGE_SOURCE_BYTES + 1)], 'too-large.png', { type: 'image/png' });
    const dependencies: ImageProcessingDependencies = {
      createImageBitmap,
      createCanvas: () => document.createElement('canvas'),
      createImage: () => new Image(),
    };

    await expect(readFileAsDataUrl(file, dependencies)).rejects.toThrow('25 MiB');
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('surfaces a processing error when the browser cannot decode the source', async () => {
    const dependencies: ImageProcessingDependencies = {
      createImageBitmap: vi.fn().mockRejectedValue(new Error('decode failed')),
      createCanvas: () => document.createElement('canvas'),
      createImage: () => new Image(),
    };
    const file = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'broken.webp', { type: 'image/webp' });

    await expect(readFileAsDataUrl(file, dependencies)).rejects.toThrow('Não foi possível processar esta imagem');
  });
});

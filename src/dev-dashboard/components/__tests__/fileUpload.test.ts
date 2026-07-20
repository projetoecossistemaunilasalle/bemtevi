import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_UPLOAD_BYTES, readFileAsDataUrl } from '../fileUpload';

describe('readFileAsDataUrl', () => {
  it('rejects image files larger than 1 MiB before FileReader work starts', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], 'large.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).rejects.toThrow('1 MiB');
  });

  it('reads a valid small image as a data URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'small.png', { type: 'image/png' });
    await expect(readFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });
});

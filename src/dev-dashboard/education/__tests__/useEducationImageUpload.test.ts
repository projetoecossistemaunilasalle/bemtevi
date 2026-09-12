import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEducationImageUpload, type EducationImageDataUrlReader } from '../useEducationImageUpload';

const file = new File(['image'], 'educador.png', { type: 'image/png' });

describe('useEducationImageUpload', () => {
  it('returns the data URL and clears a previous error after a successful read', async () => {
    const readImage = vi
      .fn<EducationImageDataUrlReader>()
      .mockRejectedValueOnce(new Error('A imagem está muito grande.'))
      .mockResolvedValueOnce('data:image/png;base64,AAAA');
    const { result } = renderHook(() => useEducationImageUpload(readImage));

    await act(async () => {
      await result.current.readImageSafely(file, 'material-1.imageUrl');
    });
    expect(result.current.imageError).toEqual({
      message: 'A imagem está muito grande.',
      path: 'material-1.imageUrl',
    });

    await act(async () => {
      await expect(result.current.readImageSafely(file, 'material-1.imageUrl')).resolves.toBe(
        'data:image/png;base64,AAAA',
      );
    });
    expect(result.current.imageError).toBeNull();
    expect(readImage).toHaveBeenCalledTimes(2);
  });

  it('returns null and preserves an Error message with the field path', async () => {
    const readImage = vi.fn<EducationImageDataUrlReader>().mockRejectedValue(new Error('Formato inválido.'));
    const { result } = renderHook(() => useEducationImageUpload(readImage));

    let dataUrl: string | null = 'unexpected';
    await act(async () => {
      dataUrl = await result.current.readImageSafely(file, 'material-2.featuredImage');
    });

    expect(dataUrl).toBeNull();
    expect(result.current.imageError).toEqual({
      message: 'Formato inválido.',
      path: 'material-2.featuredImage',
    });
  });

  it('uses the PT-BR fallback for non-Error failures and exposes explicit clearing', async () => {
    const readImage = vi.fn<EducationImageDataUrlReader>().mockRejectedValue('reader failure');
    const { result } = renderHook(() => useEducationImageUpload(readImage));

    await act(async () => {
      await result.current.readImageSafely(file, 'material-3.body.block-1.imageUrl');
    });

    expect(result.current.imageError).toEqual({
      message: 'Não foi possível enviar a imagem. Escolha outro arquivo.',
      path: 'material-3.body.block-1.imageUrl',
    });

    act(() => result.current.clearImageError());
    expect(result.current.imageError).toBeNull();
  });
});

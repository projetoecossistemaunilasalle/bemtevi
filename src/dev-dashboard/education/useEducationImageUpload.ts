import { useState } from 'react';
import { readFileAsDataUrl } from '../components/fileUpload';

const FALLBACK_IMAGE_UPLOAD_ERROR = 'Não foi possível enviar a imagem. Escolha outro arquivo.';

export type EducationImageUploadError = {
  message: string;
  path: string;
};

export type EducationImageDataUrlReader = (file: File) => Promise<string>;

/**
 * Keeps image upload failures scoped to the education editor and gives callers
 * a null result instead of making each file input handle read errors itself.
 */
export function useEducationImageUpload(readImage: EducationImageDataUrlReader = readFileAsDataUrl): {
  imageError: EducationImageUploadError | null;
  readImageSafely: (file: File, path: string) => Promise<string | null>;
  clearImageError: () => void;
} {
  const [imageError, setImageError] = useState<EducationImageUploadError | null>(null);

  function clearImageError() {
    setImageError(null);
  }

  async function readImageSafely(file: File, path: string): Promise<string | null> {
    clearImageError();
    try {
      const dataUrl = await readImage(file);
      clearImageError();
      return dataUrl;
    } catch (error) {
      setImageError({
        message: error instanceof Error ? error.message : FALLBACK_IMAGE_UPLOAD_ERROR,
        path,
      });
      return null;
    }
  }

  return { imageError, readImageSafely, clearImageError };
}

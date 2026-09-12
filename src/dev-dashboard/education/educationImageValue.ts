export function isUploadedImageValue(value: string | undefined) {
  return value?.trimStart().startsWith('data:') ?? false;
}

export function isPublicImagePath(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith('/') && !trimmed.startsWith('//');
}

export function publicImageInputLabel(value: string | undefined) {
  const name = value?.split('/').pop() ?? '';
  return `Imagem interna (${name})`;
}

export function uploadedImageInputLabel(fileName: string | undefined) {
  const label = fileName?.trim() || 'Base64';
  return `Imagem enviada (${label})`;
}

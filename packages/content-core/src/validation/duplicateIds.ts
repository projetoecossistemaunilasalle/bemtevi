export function findDuplicateIds(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return [...duplicates];
}

/** Equivalent of `Array.prototype.findLastIndex` for records with a string `id` (ES2022 lib). */
export function findLastIndexById<T extends { id: string }>(values: T[], id: string): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index]?.id === id) return index;
  }
  return -1;
}

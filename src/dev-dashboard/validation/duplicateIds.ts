export function findDuplicateIds(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return [...duplicates];
}

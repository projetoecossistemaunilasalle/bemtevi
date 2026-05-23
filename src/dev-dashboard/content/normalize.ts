export function normalizeForComparison(value: unknown): string {
  return JSON.stringify(sortRecord(value));
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecord);

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortRecord(entryValue)]),
    );
  }

  return value;
}

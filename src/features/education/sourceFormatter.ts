export interface CitationSegment {
  kind: 'text' | 'link';
  content: string;
  url?: string;
}

export interface ParsedCitation {
  id: string;
  rawText: string;
  segments: CitationSegment[];
}

const SOURCE_LABEL_MAX_LENGTH = 42;

/**
 * Reduces an ABNT reference to the source name used by library-card badges.
 * Corporate authors prefer their acronym; personal authors prefer the surname.
 */
export function formatCitationSourceLabel(rawText: string): string {
  const citation = rawText.trim();
  if (!citation) return '';

  const acronym = citation.match(/\(([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9.-]{1,14})\)\s*\./u)?.[1];
  if (acronym) return acronym;

  const surname = citation.match(/^([A-ZÀ-ÖØ-Þ][\p{L}'’-]+),/u)?.[1];
  if (surname) {
    return /\bet\s+al\./iu.test(citation.slice(0, 80)) ? `${surname} et al.` : surname;
  }

  const authorEnd = citation.search(/\.\s+(?=[A-ZÀ-ÖØ-Þ])/u);
  const author = authorEnd > 0 ? citation.slice(0, authorEnd) : citation;
  if (author.length <= SOURCE_LABEL_MAX_LENGTH) return author;

  return `${author.slice(0, SOURCE_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Older materials stored the bibliography as a regular paragraph at the end of
 * the body. Recognize that block so it can be rendered by the citations view.
 */
export function isLegacySourceBlock({ kind, title }: { kind: string; title?: string }): boolean {
  if (kind !== 'paragraph' || !title) return false;

  return /^(fontes?(?:\s+(?:consultadas|e\s+refer[eê]ncias))?|refer[eê]ncias?)$/i.test(title.trim());
}

/**
 * Regular expression matching URLs starting with http://, https://, www., or doi.org
 */
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|doi\.org\/[^\s]+)/gi;

// A slash only separates citations when it follows a completed sentence or is
// surrounded by spaces. This keeps the slashes that are part of URLs intact.
const CITATION_SEPARATOR_REGEX = /(?:(?<=\.)\s*\/\s*|(?<=\S)\s+\/\s*|(?<=\d{4})\/\s*)(?=[A-ZÀ-ÖØ-Þ])/gu;

/**
 * Normalizes an extracted URL so it opens properly in a browser.
 */
export function normalizeCitationUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/[.,;)]+$/, '');
  if (trimmed.toLowerCase().startsWith('www.')) {
    return `https://${trimmed}`;
  }
  if (trimmed.toLowerCase().startsWith('doi.org/')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function pushTextSegment(segments: CitationSegment[], text: string) {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === 'text') {
    last.content += text;
  } else {
    segments.push({ kind: 'text', content: text });
  }
}

/**
 * Parses a citation text entry into segments of plain text and clickable links.
 */
export function parseCitationSegments(text: string): CitationSegment[] {
  if (!text) return [];

  const segments: CitationSegment[] = [];
  let lastIndex = 0;

  // Reset regex index state
  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = URL_REGEX.exec(text);

  while (match !== null) {
    const rawMatch = match[0];
    const matchIndex = match.index;

    // Clean trailing punctuation attached to URL like "2023." or "2005,"
    let cleanUrl = rawMatch;
    let trailingPunct = '';
    const trailingMatch = rawMatch.match(/([.,;:)]+)$/);
    if (trailingMatch) {
      trailingPunct = trailingMatch[1];
      cleanUrl = rawMatch.slice(0, -trailingPunct.length);
    }

    // Append preceding plain text
    if (matchIndex > lastIndex) {
      pushTextSegment(segments, text.slice(lastIndex, matchIndex));
    }

    if (cleanUrl.length > 0) {
      segments.push({
        kind: 'link',
        content: cleanUrl,
        url: normalizeCitationUrl(cleanUrl),
      });
    }

    if (trailingPunct) {
      pushTextSegment(segments, trailingPunct);
    }

    lastIndex = matchIndex + rawMatch.length;
    match = URL_REGEX.exec(text);
  }

  if (lastIndex < text.length) {
    pushTextSegment(segments, text.slice(lastIndex));
  }

  return segments;
}

/**
 * Splits a full source string (which may contain multiple ABNT references separated by '/' or newlines)
 * into a list of parsed citations with auto-detected links.
 */
export function parseSourceCitations(sourceText: string | undefined | null): ParsedCitation[] {
  if (!sourceText || !sourceText.trim()) return [];

  // Split on newlines and citation separators without breaking URLs.
  const rawItems = sourceText
    .split(/\r?\n/)
    .flatMap((line) => line.split(CITATION_SEPARATOR_REGEX))
    .map((item) => item.trim())
    .filter(Boolean);

  return rawItems.map((rawText, index) => ({
    id: `citation-${index + 1}`,
    rawText,
    segments: parseCitationSegments(rawText),
  }));
}

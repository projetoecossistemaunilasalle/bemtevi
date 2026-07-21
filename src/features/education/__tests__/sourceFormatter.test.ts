import { describe, expect, it } from 'vitest';
import {
  formatCitationSourceLabel,
  isLegacySourceBlock,
  normalizeCitationUrl,
  parseCitationSegments,
  parseSourceCitations,
} from '../sourceFormatter';

describe('sourceFormatter', () => {
  it('normalizes URLs correctly', () => {
    expect(normalizeCitationUrl('www.scielo.br/artigo')).toBe('https://www.scielo.br/artigo');
    expect(normalizeCitationUrl('doi.org/10.1590/e280023')).toBe('https://doi.org/10.1590/e280023');
    expect(normalizeCitationUrl('https://example.com/test.')).toBe('https://example.com/test');
  });

  it('parses single ABNT citation without links', () => {
    const text = 'ABREU, R. M. de A.; CRUZ, L. B. dos S. Políticas públicas em educação. v. 28, 2023.';
    const citations = parseSourceCitations(text);

    expect(citations).toHaveLength(1);
    expect(citations[0].rawText).toBe(text);
    expect(citations[0].segments).toEqual([{ kind: 'text', content: text }]);
  });

  it('splits multiple citations separated by slashes / and newlines', () => {
    const raw =
      'ABREU, R. M. de A. Citação 1, 2023./CECCIM, Ricardo Burg. Citação 2, 2005./ PARROTT, E. et al. Citação 3, 2025.';
    const citations = parseSourceCitations(raw);

    expect(citations).toHaveLength(3);
    expect(citations[0].rawText).toContain('ABREU');
    expect(citations[1].rawText).toContain('CECCIM');
    expect(citations[2].rawText).toContain('PARROTT');
  });

  it('splits a compact slash separator directly after a publication year', () => {
    const citations = parseSourceCitations(
      'PENTEADO, R. Z. Mal-estar docente, jan. 2019/SIMÕES, E. C. Violência contra professores, mar. 2022.',
    );

    expect(citations.map((citation) => formatCitationSourceLabel(citation.rawText))).toEqual(['PENTEADO', 'SIMÕES']);
  });

  it('detects embedded URLs in citation text and separates punctuation', () => {
    const raw = 'ABREU, R. M. de A. Políticas públicas. Disponível em: https://www.scielo.br/e280023. Acesso em 2023.';
    const segments = parseCitationSegments(raw);

    expect(segments).toEqual([
      { kind: 'text', content: 'ABREU, R. M. de A. Políticas públicas. Disponível em: ' },
      { kind: 'link', content: 'https://www.scielo.br/e280023', url: 'https://www.scielo.br/e280023' },
      { kind: 'text', content: '. Acesso em 2023.' },
    ]);
  });

  it('keeps URLs intact when splitting citations so they remain clickable', () => {
    const citations = parseSourceCitations(
      'SILVA, A. Guia de cuidado. Disponível em: https://example.org/guias/cuidado. / SOUZA, B. Outra referência, 2025.',
    );

    expect(citations).toHaveLength(2);
    expect(citations[0].segments).toContainEqual({
      kind: 'link',
      content: 'https://example.org/guias/cuidado',
      url: 'https://example.org/guias/cuidado',
    });
  });

  it('detects doi.org links in citations', () => {
    const raw = 'PARROTT, E. et al. School Mental Health, 2025. doi.org/10.1007/s12345.';
    const segments = parseCitationSegments(raw);

    expect(segments).toEqual([
      { kind: 'text', content: 'PARROTT, E. et al. School Mental Health, 2025. ' },
      { kind: 'link', content: 'doi.org/10.1007/s12345', url: 'https://doi.org/10.1007/s12345' },
      { kind: 'text', content: '.' },
    ]);
  });

  it('identifies old source paragraphs for migration to the citations card', () => {
    expect(isLegacySourceBlock({ kind: 'paragraph', title: 'Fontes consultadas' })).toBe(true);
    expect(isLegacySourceBlock({ kind: 'paragraph', title: 'Fontes e Referências' })).toBe(true);
    expect(isLegacySourceBlock({ kind: 'paragraph', title: 'Aplicação prática' })).toBe(false);
  });

  it('turns full references into compact source labels', () => {
    expect(
      formatCitationSourceLabel(
        'ORGANIZAÇÃO MUNDIAL DA SAÚDE (OMS). Saúde mental depende de bem-estar físico e social.',
      ),
    ).toBe('OMS');
    expect(formatCitationSourceLabel('PARROTT, E. et al. The Role of Teachers in Fostering Resilience.')).toBe(
      'PARROTT et al.',
    );
    expect(formatCitationSourceLabel('FEEVALE')).toBe('FEEVALE');
  });
});

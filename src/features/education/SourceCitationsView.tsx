import { ExternalLink, BookOpen } from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { parseSourceCitations } from './sourceFormatter';

export function SourceCitationsView({
  sourceText,
  className = '',
  variant = 'card',
}: {
  sourceText: string | undefined | null;
  className?: string;
  variant?: 'card' | 'compact' | 'inline';
}) {
  const citations = parseSourceCitations(sourceText);

  if (citations.length === 0) {
    return null;
  }

  if (variant === 'inline' || variant === 'compact') {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {citations.map((citation) => (
          <p key={citation.id} className="font-body-md text-on-surface-variant leading-relaxed">
            {citation.segments.map((segment, index) =>
              segment.kind === 'link' && segment.url ? (
                <a
                  key={`${citation.id}-link-${index}`}
                  href={segment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span>{segment.content}</span>
                  <ExternalLink size={13} className="inline shrink-0" />
                </a>
              ) : (
                <span key={`${citation.id}-text-${index}`}>{segment.content}</span>
              ),
            )}
          </p>
        ))}
      </div>
    );
  }

  return (
    <Card className={`p-5 flex flex-col gap-3 border-outline-variant/50 bg-surface-container-lowest ${className}`}>
      <div className="flex items-center gap-2 text-on-surface">
        <BookOpen size={20} className="text-primary shrink-0" />
        <h3 className="font-headline-sm text-on-surface">Fontes e Referências</h3>
      </div>
      <div className="flex flex-col gap-3 divide-y divide-outline-variant/20">
        {citations.map((citation, idx) => (
          <div key={citation.id} className={idx > 0 ? 'pt-3' : ''}>
            <p className="font-body-md text-on-surface-variant leading-relaxed">
              {citation.segments.map((segment, index) =>
                segment.kind === 'link' && segment.url ? (
                  <a
                    key={`${citation.id}-link-${index}`}
                    href={segment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span>{segment.content}</span>
                    <ExternalLink size={13} className="inline shrink-0" />
                  </a>
                ) : (
                  <span key={`${citation.id}-text-${index}`}>{segment.content}</span>
                ),
              )}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

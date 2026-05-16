import { BookOpen, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../app/routes';
import { resourcesContent } from '../../content/resources/resources';
import { Badge } from '../../design-system/components/Badge';
import { Button } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { PageHeader } from '../../design-system/components/PageHeader';

export function EducationLibraryScreen() {
  const navigate = useNavigate();

  return (
    <Page>
      <PageHeader
        title="Biblioteca de educação"
        description="Recursos revisáveis para apoiar professores com informação clara, prática e não diagnóstica."
        icon={<BookOpen className="text-primary" size={32} />}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
        {resourcesContent.resources.map((resource) => (
          <Card key={resource.id} className="p-6 flex flex-col gap-stack-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-stack-sm flex-1">
                <Badge tone="secondary">{resource.source}</Badge>
                <h2 className="font-headline-sm text-on-surface">{resource.title}</h2>
              </div>
              {resource.imageUrl ? (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container-low flex items-center justify-center border border-outline-variant/20">
                  <img alt="" className="w-full h-full object-cover opacity-90 mix-blend-multiply" src={resource.imageUrl} />
                </div>
              ) : null}
            </div>
            <p className="font-body-md text-on-surface-variant">{resource.description}</p>
            <div className="flex flex-wrap gap-2">
              {resource.tags.map((tag) => (
                <span key={tag} className="font-label-md text-secondary bg-surface-container-low px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-auto pt-2">
              <Button
                className="w-full rounded-full"
                onClick={() => navigate(routes.educationDetail.replace(':resourceId', resource.id))}
              >
                <GraduationCap size={20} />
                Ver material
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </Page>
  );
}

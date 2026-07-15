import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import { BookOpen, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../app/routes';
import { resolveEducationResourcesForPreview } from './educationResourcePreview';
import { Badge } from '../../design-system/components/Badge';
import { Button } from '../../design-system/components/Button';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { PageHeader } from '../../design-system/components/PageHeader';

export function EducationLibraryScreen() {
  const navigate = useNavigate();
  const { resources, groups, defaultGroupOrder, isPreviewingDrafts } = resolveEducationResourcesForPreview();

  // Determine group for each resource
  const groupAssignments = resources.map((resource) => {
    if (!resource.group || resource.group === DEFAULT_EDUCATION_GROUP_ID) return DEFAULT_EDUCATION_GROUP_ID;
    const groupExists = groups.some((g) => g.id === resource.group);
    return groupExists ? resource.group : DEFAULT_EDUCATION_GROUP_ID;
  });

  // Build groups to render (only those with resources)
  const groupsWithResources = [
    { id: DEFAULT_EDUCATION_GROUP_ID, title: '', order: defaultGroupOrder },
    ...[...groups].sort((a, b) => a.order - b.order),
  ]
    .sort((a, b) => a.order - b.order)
    .filter((group) => resources.some((r, i) => groupAssignments[i] === group.id));

  return (
    <Page>
      <PageHeader
        title="Biblioteca de educação"
        description="Recursos revisáveis para apoiar professores com informação clara, prática e não diagnóstica."
        icon={<BookOpen className="text-primary" size={32} />}
      />

      {isPreviewingDrafts ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 font-body-md text-yellow-900">
          Essa é uma versão de teste. O conteúdo não está salvo no site oficial.
        </div>
      ) : null}

      {groupsWithResources.map((group, sectionIndex) => {
        const isGeral = group.id === DEFAULT_EDUCATION_GROUP_ID;
        const showGeralSeparator = isGeral && sectionIndex > 0;
        const groupResourceIndices = resources
          .map((_, i) => i)
          .filter((i) => groupAssignments[i] === group.id)
          .sort((a, b) => {
            const orderA = resources[a].groupOrder === undefined ? Infinity : resources[a].groupOrder!;
            const orderB = resources[b].groupOrder === undefined ? Infinity : resources[b].groupOrder!;
            if (orderA !== orderB) return orderA - orderB;
            return a - b; // stable original order
          });

        return (
          <section key={group.id}>
            {showGeralSeparator ? (
              <div
                aria-label="Separador entre grupos de materiais"
                className="mb-6 flex items-center gap-4 pt-2"
                role="separator"
              >
                <span className="h-px flex-1 bg-outline-variant/70" />
                <span className="h-2 w-2 rounded-full bg-secondary/60" />
                <span className="h-px flex-1 bg-outline-variant/70" />
              </div>
            ) : null}
            {!isGeral && <h2 className="font-headline-md text-on-surface mb-4">{group.title}</h2>}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-stack-md ${isGeral ? '' : 'mb-8'}`}>
              {groupResourceIndices.map((resourceIndex) => {
                const resource = resources[resourceIndex];
                return (
                  <Card key={resource.id} className="p-6 flex flex-col gap-stack-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-stack-sm flex-1">
                        <Badge tone="secondary">{resource.source}</Badge>
                        <h3 className="font-headline-sm text-on-surface">{resource.title}</h3>
                      </div>
                      {resource.imageUrl ? (
                        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-container-low flex items-center justify-center border border-outline-variant/20">
                          <img alt="" className="w-full h-full object-cover" src={resource.imageUrl} />
                        </div>
                      ) : null}
                    </div>
                    <p className="font-body-md text-on-surface-variant">{resource.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {resource.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-label-md text-secondary bg-surface-container-low px-3 py-1 rounded-full"
                        >
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
                );
              })}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

import type { EducationResourceGroup } from '../../content/resources/groups';
import { DEFAULT_EDUCATION_GROUP_ID } from '../../content/resources/groups';
import { Button } from '../../design-system/components/Button';
import { ConfirmButton } from '../components/ConfirmButton';
import { Field } from '../components/Field';
import { FieldHint } from '../components/FieldHint';
import { inputClassSm, textareaClass } from '../components/fieldStyles';
import { issuesForPath } from '../validation/fieldIssues';
import { validateDashboardEducation } from './educationValidation';

type ManagedEducationGroup = EducationResourceGroup & { isDefault?: boolean };

function getManagedGroups(groups: EducationResourceGroup[], defaultGroupOrder: number): ManagedEducationGroup[] {
  return [
    {
      id: DEFAULT_EDUCATION_GROUP_ID,
      title: 'Geral',
      description: 'Grupo padrão para materiais sem categoria específica.',
      order: defaultGroupOrder,
      isDefault: true,
    },
    ...groups,
  ].sort((left, right) => left.order - right.order);
}

export function EducationGroupManagement({
  groups,
  defaultGroupOrder,
  groupsExpanded,
  validation,
  onGroupChange,
  onGroupAdd,
  onGroupRemove,
  onGroupMove,
  onToggleExpanded,
}: {
  groups: EducationResourceGroup[];
  defaultGroupOrder: number;
  groupsExpanded: boolean;
  validation: ReturnType<typeof validateDashboardEducation>;
  onGroupChange: (groupIndex: number, groupId: string, patch: Partial<EducationResourceGroup>) => void;
  onGroupAdd: () => void;
  onGroupRemove: (groupIndex: number, groupId: string) => void;
  onGroupMove: (groupIndex: number, direction: -1 | 1) => void;
  onToggleExpanded: () => void;
}) {
  const managedGroups = getManagedGroups(groups, defaultGroupOrder);

  return (
    <section className="lg:col-span-2 flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <button
        type="button"
        aria-expanded={groupsExpanded}
        aria-controls="education-group-management-content"
        aria-label={`Gerenciar grupos de materiais (${groupsExpanded ? 'ocultar' : 'mostrar'})`}
        onClick={onToggleExpanded}
        className="flex items-center justify-between font-headline-sm text-on-surface"
      >
        <span>Grupos de materiais</span>
        <span className="font-label-md">{groupsExpanded ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      <FieldHint>Gerencie os grupos usados para organizar os materiais no painel administrativo.</FieldHint>

      {groupsExpanded && (
        <div id="education-group-management-content" className="mt-3 flex flex-col gap-3">
          {managedGroups.map((group, groupIndex) => {
            const isDefault = group.isDefault === true;

            return (
              <div
                key={`${group.id}-${groupIndex}`}
                data-validation-path={isDefault ? undefined : `groups.${groupIndex}`}
                className="grid gap-3 rounded-lg border border-outline-variant/30 p-3 md:grid-cols-[1fr_auto]"
              >
                <div className="flex flex-col gap-2">
                  <Field
                    label="Título"
                    issues={isDefault ? undefined : issuesForPath(validation, `groups.${groupIndex}.title`)}
                    validationPath={isDefault ? undefined : `groups.${groupIndex}.title`}
                  >
                    <input
                      aria-label={`Título do grupo ${group.title}`}
                      className={inputClassSm}
                      value={group.title}
                      disabled={isDefault}
                      onChange={(event) => onGroupChange(groupIndex, group.id, { title: event.target.value })}
                    />
                  </Field>
                  {isDefault ? (
                    <FieldHint>
                      Geral é o grupo padrão para materiais sem categoria específica. Ele não pode ser removido porque
                      garante que todo material tenha uma seção padrão.
                    </FieldHint>
                  ) : (
                    <label className="flex flex-col gap-1">
                      <span className="font-label-sm text-on-surface-variant">Descrição opcional</span>
                      <textarea
                        aria-label={`Descrição do grupo ${group.title}`}
                        className={textareaClass}
                        value={group.description ?? ''}
                        onChange={(event) => onGroupChange(groupIndex, group.id, { description: event.target.value })}
                      />
                    </label>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={groupIndex === 0}
                    onClick={() => onGroupMove(isDefault ? -1 : groupIndex - 1, -1)}
                    aria-label={`Mover grupo ${group.title} para cima`}
                  >
                    Mover para cima
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={groupIndex === managedGroups.length - 1}
                    onClick={() => onGroupMove(isDefault ? -1 : groupIndex - 1, 1)}
                    aria-label={`Mover grupo ${group.title} para baixo`}
                  >
                    Mover para baixo
                  </Button>
                  {!isDefault && (
                    <ConfirmButton
                      prompt="Remover"
                      confirmLabel="Confirmar"
                      onConfirm={() => onGroupRemove(groupIndex, group.id)}
                      aria-label={`Remover grupo ${group.title}`}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-error-container px-4 py-2 font-label-md text-on-error-container transition-colors hover:bg-error-container/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                    />
                  )}
                  {isDefault && <span className="font-label-sm text-on-surface-variant">Grupo padrão</span>}
                </div>
              </div>
            );
          })}
          <Button onClick={onGroupAdd} className="self-start">
            Novo grupo
          </Button>
        </div>
      )}
    </section>
  );
}

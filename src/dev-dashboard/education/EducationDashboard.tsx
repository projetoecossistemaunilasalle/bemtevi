import { useEffect, useMemo, useRef, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import type { EducationResourceGroup } from '../../content/resources/groups';
import { Button } from '../../design-system/components/Button';
import { ValidationSummary, type ValidationIssueAction } from '../components/ValidationSummary';
import { scheduleValidationFocus } from '../validation/validationNavigation';
import type { DashboardValidationIssue } from '../validation/validationTypes';
import { EducationBodyEditor } from './EducationBodyEditor';
import { EducationFeaturedImageEditor } from './EducationFeaturedImageEditor';
import { EducationGroupManagement } from './EducationGroupManagement';
import { EducationMetadataEditor } from './EducationMetadataEditor';
import { EducationResourceList } from './EducationResourceList';
import { validateDashboardEducation } from './educationValidation';
import { resolveEducationValidationTarget } from './educationValidationNavigation';
import { useEducationImageUpload } from './useEducationImageUpload';
import { useEducationResourceSelection } from './useEducationResourceSelection';

export type EducationDashboardProps = {
  resources: EducationResource[];
  groups: EducationResourceGroup[];
  defaultGroupOrder?: number;
  externalFocus?: { id: string; requestId: number; path?: string } | null;
  onResourceChange: (resourceIndex: number, resourceId: string, patch: Partial<EducationResource>) => void;
  onResourceAdd: () => string;
  onResourceRemove?: (resourceIndex: number, resourceId: string) => void;
  onGroupChange: (groupIndex: number, groupId: string, patch: Partial<EducationResourceGroup>) => void;
  onGroupAdd: () => void;
  onGroupRemove: (groupIndex: number, groupId: string) => void;
  onGroupMove: (groupIndex: number, direction: -1 | 1) => void;
};

export function EducationDashboard({
  resources,
  groups,
  defaultGroupOrder = 0,
  externalFocus,
  onResourceChange,
  onResourceAdd,
  onResourceRemove,
  onGroupChange,
  onGroupAdd,
  onGroupRemove,
  onGroupMove,
}: EducationDashboardProps) {
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [validationBlockFocus, setValidationBlockFocus] = useState<{ blockId: string; requestId: number } | null>(null);
  const [localBodyFocusRequestId, setLocalBodyFocusRequestId] = useState<number | null>(null);
  const validationFocusSequence = useRef(0);
  const validation = useMemo(() => validateDashboardEducation(resources, groups), [resources, groups]);
  const { imageError, readImageSafely } = useEducationImageUpload();
  const { effectiveIndex, selectedResource, selectResource, addResource, removeResource } =
    useEducationResourceSelection({ resources, externalFocus, onResourceAdd, onResourceRemove });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!externalFocus?.id || resources.some((resource) => resource.id === externalFocus.id)) return;
    const groupIndex = groups.findIndex((group) => group.id === externalFocus.id);
    if (groupIndex < 0) return;

    setGroupsExpanded(true);
    const path = externalFocus.path ?? `groups.${groupIndex}.title`;
    const timeoutId = window.setTimeout(() => scheduleValidationFocus(path), 150);
    return () => window.clearTimeout(timeoutId);
  }, [externalFocus?.id, externalFocus?.path, externalFocus?.requestId, groups, resources]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const externalBlockFocus = useMemo(() => {
    if (!externalFocus || externalFocus.id !== selectedResource?.id) return null;
    const blockId = getEducationBlockId(externalFocus.path);
    return blockId ? { blockId, requestId: externalFocus.requestId } : null;
  }, [externalFocus, selectedResource?.id]);
  const currentExternalFocusRequestId = externalFocus?.requestId ?? null;
  const bodyFocusRequest =
    localBodyFocusRequestId === currentExternalFocusRequestId ? validationBlockFocus : externalBlockFocus;

  function changeResource(patch: Partial<EducationResource>) {
    if (selectedResource && effectiveIndex >= 0) onResourceChange(effectiveIndex, selectedResource.id, patch);
  }

  function getIssueAction(issue: DashboardValidationIssue): ValidationIssueAction | null {
    const target = resolveEducationValidationTarget(issue, resources, groups);
    if (!target) return null;

    return {
      label: target.label,
      description: target.description,
      onClick: () => {
        if (target.kind === 'group') {
          setGroupsExpanded(true);
        } else {
          selectResource(target.resourceIndex);
          setLocalBodyFocusRequestId(currentExternalFocusRequestId);
          if (target.blockId) {
            validationFocusSequence.current += 1;
            setValidationBlockFocus({ blockId: target.blockId, requestId: validationFocusSequence.current });
          } else {
            setValidationBlockFocus(null);
          }
        }
        scheduleValidationFocus(target.focusPath);
      },
    };
  }

  return (
    <section className="grid gap-stack-md lg:grid-cols-[280px_1fr]">
      <EducationGroupManagement
        groups={groups}
        defaultGroupOrder={defaultGroupOrder}
        onGroupChange={onGroupChange}
        onGroupAdd={onGroupAdd}
        onGroupRemove={onGroupRemove}
        onGroupMove={onGroupMove}
        groupsExpanded={groupsExpanded}
        validation={validation}
        onToggleExpanded={() => setGroupsExpanded((current) => !current)}
      />

      {!selectedResource ? (
        <section className="lg:col-span-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <p className="font-body-md text-on-surface-variant">Nenhum material disponível.</p>
          <Button className="mt-3" onClick={addResource}>
            Novo material
          </Button>
        </section>
      ) : (
        <>
          <EducationResourceList
            resources={resources}
            selectedIndex={effectiveIndex}
            validation={validation}
            onAdd={addResource}
            onSelect={(resourceIndex) => {
              selectResource(resourceIndex);
              setLocalBodyFocusRequestId(currentExternalFocusRequestId);
              setValidationBlockFocus(null);
            }}
          />
          <div
            data-validation-path={`materials.${effectiveIndex}`}
            className="dashboard-validation-target flex flex-col gap-stack-md"
          >
            {imageError ? <EducationImageError message={imageError.message} path={imageError.path} /> : null}
            <EducationMetadataEditor
              resource={selectedResource}
              resourceIndex={effectiveIndex}
              groups={groups}
              validation={validation}
              onChange={changeResource}
              onRemove={removeResource}
              readImageFile={readImageSafely}
              featuredImageEditor={
                <EducationFeaturedImageEditor
                  resource={selectedResource}
                  validation={validation}
                  onChange={(featuredImage) => changeResource({ featuredImage })}
                  readImageFile={readImageSafely}
                />
              }
            />
            <EducationBodyEditor
              key={selectedResource.id}
              body={educationBody(selectedResource)}
              resourcePath={selectedResource.id}
              validation={validation}
              focusRequest={bodyFocusRequest}
              onChange={(body) => changeResource({ body })}
              readImageFile={readImageSafely}
            />
            <ValidationSummary result={validation} getIssueAction={getIssueAction} />
          </div>
        </>
      )}
    </section>
  );
}

function EducationImageError({ message, path }: { message: string; path: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-error bg-error-container px-4 py-3 font-label-md text-on-error-container"
    >
      <p className="font-label-md">Falha no campo de imagem</p>
      <p className="mt-1 font-body-md">{message}</p>
      <button
        type="button"
        className="mt-2 rounded-full border border-current/35 px-3 py-1.5 font-label-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => scheduleValidationFocus(path)}
      >
        Voltar ao campo da imagem
      </button>
    </div>
  );
}

function educationBody(resource: EducationResource) {
  return (
    resource.body ?? [
      {
        id: `${resource.id}-overview`,
        kind: 'paragraph' as const,
        title: 'Sobre este material',
        text: 'Descreva aqui o conteúdo principal do material.',
      },
    ]
  );
}

function getEducationBlockId(path?: string) {
  return path ? /(?:^|\.)body\.([^.]+)/.exec(path)?.[1] : undefined;
}

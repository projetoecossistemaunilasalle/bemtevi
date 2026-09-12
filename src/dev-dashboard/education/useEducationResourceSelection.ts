import { useEffect, useState } from 'react';
import type { EducationResource } from '../../domain/resources/types';
import { scheduleValidationFocus } from '../validation/validationNavigation';

export type EducationResourceSelection = { index: number; id: string };

export type EducationResourceFocus = {
  id: string;
  requestId: number;
  path?: string;
};

export type EducationResourceSelectionOptions = {
  resources: readonly EducationResource[];
  externalFocus?: EducationResourceFocus | null;
  onResourceAdd: () => string;
  onResourceRemove?: (resourceIndex: number, resourceId: string) => void;
  scheduleFocus?: (path: string) => void;
};

export type EducationResourceSelectionState = {
  selection: EducationResourceSelection | null;
  selectedIndex: number;
  effectiveIndex: number;
  selectedResource: EducationResource | undefined;
  selectResource: (resourceIndex: number) => boolean;
  selectResourceById: (resourceId: string) => boolean;
  addResource: () => string;
  removeResource: () => boolean;
};

const defaultScheduleFocus = scheduleValidationFocus;
const noopRemove = () => {};

/**
 * Owns education material selection while keeping an ID alongside the last
 * known index. The ID is authoritative when records are reordered or removed.
 */
export function useEducationResourceSelection({
  resources,
  externalFocus,
  onResourceAdd,
  onResourceRemove = noopRemove,
  scheduleFocus = defaultScheduleFocus,
}: EducationResourceSelectionOptions): EducationResourceSelectionState {
  const [selection, setSelection] = useState<EducationResourceSelection | null>(() =>
    resources[0] ? { index: 0, id: resources[0].id } : null,
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!externalFocus?.id) return;

    const resourceIndex = resources.findIndex((resource) => resource.id === externalFocus.id);
    if (resourceIndex < 0) return;

    setSelection((current) =>
      current?.index === resourceIndex && current.id === externalFocus.id
        ? current
        : { index: resourceIndex, id: externalFocus.id },
    );
    const path = externalFocus.path ?? `${externalFocus.id}.title`;
    const timeoutId = window.setTimeout(() => scheduleFocus(path), 120);
    return () => window.clearTimeout(timeoutId);
  }, [externalFocus?.requestId, externalFocus?.id, externalFocus?.path, resources, scheduleFocus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resourceAtSelectedIndex = selection ? resources[selection.index] : undefined;
  const selectedIndex =
    selection && resourceAtSelectedIndex?.id === selection.id
      ? selection.index
      : selection
        ? resources.findIndex((resource) => resource.id === selection.id)
        : -1;
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : resources.length > 0 ? 0 : -1;
  const selectedResource = effectiveIndex >= 0 ? resources[effectiveIndex] : undefined;

  function selectResource(resourceIndex: number) {
    const resource = resources[resourceIndex];
    if (!resource) return false;
    setSelection({ index: resourceIndex, id: resource.id });
    return true;
  }

  function selectResourceById(resourceId: string) {
    const resourceIndex = resources.findIndex((resource) => resource.id === resourceId);
    return selectResource(resourceIndex);
  }

  function addResource() {
    const resourceId = onResourceAdd();
    setSelection({ index: resources.length, id: resourceId });
    return resourceId;
  }

  function removeResource() {
    if (!selectedResource || effectiveIndex < 0) return false;

    const nextResource = resources[effectiveIndex + 1];
    const previousResource = resources[effectiveIndex - 1];
    const neighbor = nextResource ?? previousResource;
    const neighborIndex = nextResource ? effectiveIndex + 1 : previousResource ? effectiveIndex - 1 : -1;

    setSelection(neighbor && neighborIndex >= 0 ? { index: neighborIndex, id: neighbor.id } : null);
    onResourceRemove(effectiveIndex, selectedResource.id);
    return true;
  }

  return {
    selection,
    selectedIndex,
    effectiveIndex,
    selectedResource,
    selectResource,
    selectResourceById,
    addResource,
    removeResource,
  };
}

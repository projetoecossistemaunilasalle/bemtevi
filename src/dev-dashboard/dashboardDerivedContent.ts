import { useMemo } from 'react';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../app/content/publishedContent';
import { normalizeContactLocations } from '../domain/services/locations';
import { validateDashboardContacts } from './contacts/contactsValidation';
import { createEmptyDashboardDraftState, type DashboardDraftState } from './draft-storage/dashboardStorage';
import type { DraftWorkspace } from './draft-storage/workspace';
import { validateDashboardEducation } from './education/educationValidation';
import { validateDashboardFlows } from './flows/flowValidation';
import { compareContent } from './publishing/semanticDiff';
import type { DashboardTab } from './components/DashboardShell';
import { buildDashboardPublicationPayload } from './dashboardPublication';

export interface DashboardDerivedContent {
  remoteContent: PublishedContentPayload;
  mergedDrafts: PublishedContentPayload;
  draftState: DashboardDraftState;
  hasBackgroundRevision: boolean;
  hasPendingDraft: boolean;
  publishedDraft: PublishedContentPayload;
  changeSummary: ReturnType<typeof compareContent>;
  contactValidation: ReturnType<typeof validateDashboardContacts>;
  flowValidation: ReturnType<typeof validateDashboardFlows>;
  educationValidation: ReturnType<typeof validateDashboardEducation>;
  validation: {
    errors: ReturnType<typeof validateDashboardFlows>['errors'];
    warnings: ReturnType<typeof validateDashboardFlows>['warnings'];
  };
  tabErrorCounts: Partial<Record<DashboardTab, number>>;
}

export function normalizeDashboardRemoteContent(baseline: PublishedContentPayload): PublishedContentPayload {
  const normalized = normalizeContactLocations(baseline.contacts, baseline.locations ?? [], {
    allowDerivation: baseline.locations === undefined,
  });
  return {
    ...baseline,
    contacts: normalized.contacts,
    locations: normalized.locations,
  };
}

export function useDashboardDerivedContent(
  remoteContent: PublishedContentPayload,
  snapshot: PublishedContentSnapshot | null,
  workspace: DraftWorkspace | null,
): DashboardDerivedContent {
  const mergedDrafts = workspace?.local ?? remoteContent;
  const draftState = useMemo<DashboardDraftState>(
    () => ({
      ...createEmptyDashboardDraftState(),
      baseRevision: workspace?.base.revision,
      basePayload: workspace?.base.payload,
      updatedAt: workspace?.updatedAt ?? null,
    }),
    [workspace],
  );
  const hasBackgroundRevision =
    snapshot !== null &&
    typeof draftState.baseRevision === 'number' &&
    snapshot.revision > draftState.baseRevision &&
    workspace !== null;
  const hasPendingDraft = workspace !== null;

  const contactValidation = useMemo(
    () => validateDashboardContacts(mergedDrafts.contacts, mergedDrafts.locations),
    [mergedDrafts.contacts, mergedDrafts.locations],
  );
  const flowValidation = useMemo(
    () =>
      validateDashboardFlows(
        mergedDrafts.flows,
        mergedDrafts.educationMaterials.map((resource) => resource.id),
      ),
    [mergedDrafts.flows, mergedDrafts.educationMaterials],
  );
  const educationValidation = useMemo(
    () => validateDashboardEducation(mergedDrafts.educationMaterials, mergedDrafts.educationGroups),
    [mergedDrafts.educationMaterials, mergedDrafts.educationGroups],
  );
  const validation = useMemo(
    () => ({
      errors: [...flowValidation.errors, ...educationValidation.errors, ...contactValidation.errors],
      warnings: [...flowValidation.warnings, ...educationValidation.warnings, ...contactValidation.warnings],
    }),
    [flowValidation, educationValidation, contactValidation],
  );
  const publishedDraft = useMemo(() => buildDashboardPublicationPayload(mergedDrafts), [mergedDrafts]);
  const changeSummary = useMemo(
    () => compareContent(workspace?.base.payload ?? remoteContent, publishedDraft),
    [workspace?.base.payload, remoteContent, publishedDraft],
  );
  const tabErrorCounts: Partial<Record<DashboardTab, number>> = {
    flows: flowValidation.errors.length,
    education: educationValidation.errors.length,
    contacts: contactValidation.errors.length,
  };

  return {
    remoteContent,
    mergedDrafts,
    draftState,
    hasBackgroundRevision,
    hasPendingDraft,
    publishedDraft,
    changeSummary,
    contactValidation,
    flowValidation,
    educationValidation,
    validation,
    tabErrorCounts,
  };
}

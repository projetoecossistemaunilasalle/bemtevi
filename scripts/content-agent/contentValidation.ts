import {
  PublishedContentValidationError,
  validatePublicationPayload,
  type PublishedContentPayload,
} from '../../src/app/content/publishedContent';
import { validateDashboardContacts } from '../../src/dev-dashboard/contacts/contactsValidation';
import { validateDashboardEducation } from '../../src/dev-dashboard/education/educationValidation';
import { validateDashboardFlows } from '../../src/dev-dashboard/flows/flowValidation';

export interface ContentValidationIssue {
  code: string;
  level: 'error' | 'warning';
  message: string;
  path?: string;
}

export interface ContentValidation {
  valid: boolean;
  issues: ContentValidationIssue[];
}

export interface ContentInspection {
  payload: PublishedContentPayload | null;
  validation: ContentValidation;
}

/**
 * Runs the same publication and dashboard checks used by the admin UI.
 * Invalid candidates are deliberately returned to callers instead of being
 * discarded, so a draft can be repaired without losing the assistant's work.
 */
export function inspectContent(candidate: unknown): ContentInspection {
  let payload: PublishedContentPayload;
  try {
    payload = validatePublicationPayload(candidate as PublishedContentPayload);
  } catch (error) {
    return {
      payload: null,
      validation: {
        valid: false,
        issues: [
          {
            code: 'invalid_payload',
            level: 'error',
            message: error instanceof PublishedContentValidationError ? error.message : 'O payload é inválido.',
          },
        ],
      },
    };
  }

  const results = [
    validateDashboardContacts(payload.contacts, payload.locations),
    validateDashboardEducation(payload.educationMaterials, payload.educationGroups),
    validateDashboardFlows(
      payload.flows,
      payload.educationMaterials.map((resource) => resource.id),
    ),
  ];
  const issues = results.flatMap((result) =>
    [...result.errors, ...result.warnings].map((issue) => ({
      code: issue.id,
      level: issue.level,
      message: issue.message,
      ...(issue.path ? { path: issue.path } : {}),
    })),
  );
  return { payload, validation: { valid: !issues.some((issue) => issue.level === 'error'), issues } };
}

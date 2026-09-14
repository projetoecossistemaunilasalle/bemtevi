/**
 * Temporary legacy publication adapter (dossier docs 16/15, task INTEGRATION-02).
 *
 * This module holds the MOVED — not duplicated — direct `published_content`
 * insert/update implementation that the repository previously exposed as
 * `publishContent`. During the V2/legacy coexistence it is the ONLY
 * direct-publication code path: exclusively the `v2Enabled=false` dashboard
 * branch may import and use it. The V2 branch never imports this module and
 * never falls back to it on any error path.
 *
 * LEGACY-01 deletes this file after the cutover replacement proof; no later
 * task may recreate it.
 */

import {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  parsePublishedContentRow,
  validatePublicationPayload,
  PublishedContentValidationError,
  type PublishedContentPayload,
  type PublishedContentRow,
  type PublishedContentSnapshot,
} from '../../app/content/publishedContent';
import {
  mapDataApiError,
  mapThrownRepositoryError,
  PublishedContentRepositoryError,
} from '../../app/content/publishedContentRepository';
import type { PublishedContentGateway } from '../../app/content/publishedContentRepository';

export { createNeonPublishedContentGateway } from '../../app/content/publishedContentRepository';

/** Input of the legacy direct-table publication (unchanged semantics). */
export interface LegacyPublishInput {
  payload: PublishedContentPayload;
  expectedRevision: number | null;
  publisherId: string;
}

/** Signature the legacy dashboard branch passes down to the publish surface. */
export type LegacyPublishFn = (
  payload: PublishedContentPayload,
  publisherId: string,
  expectedRevision: number | null,
) => Promise<PublishedContentSnapshot>;

/** Parses a returned row, mapping structural failures to `invalid_payload`. */
function parseRow(row: PublishedContentRow): PublishedContentSnapshot {
  try {
    return parsePublishedContentRow(row);
  } catch (error) {
    if (error instanceof PublishedContentValidationError) {
      throw new PublishedContentRepositoryError(
        'invalid_payload',
        'O conteúdo publicado está corrompido ou incompatível.',
      );
    }
    throw error;
  }
}

/**
 * The legacy direct publication, moved verbatim from the repository's former
 * `publishContent` body: validate, compute revision+1, then INSERT (first
 * publication) or conditional UPDATE on the expected revision. Error mapping
 * reuses the exact repository mappers so legacy behavior is unchanged.
 */
export async function legacyPublishContent(
  gateway: PublishedContentGateway,
  input: LegacyPublishInput,
): Promise<PublishedContentSnapshot> {
  let payload: PublishedContentPayload;
  try {
    payload = validatePublicationPayload(input.payload);
  } catch (error) {
    if (error instanceof PublishedContentValidationError) {
      throw new PublishedContentRepositoryError('invalid_payload', 'O payload publicado é inválido.');
    }
    throw error;
  }

  const nextRevision = input.expectedRevision === null ? 1 : input.expectedRevision + 1;
  const write = {
    schema_version: PUBLISHED_CONTENT_SCHEMA_VERSION,
    revision: nextRevision,
    payload,
    published_at: new Date().toISOString(),
    published_by: input.publisherId,
  };

  try {
    const result =
      input.expectedRevision === null
        ? await gateway.insertCurrent({ id: 'current', ...write })
        : await gateway.updateCurrent(input.expectedRevision, { ...write });

    if (result.error) throw mapDataApiError(result.error);
    if (result.data === null) {
      throw new PublishedContentRepositoryError('conflict', 'Conflito de revisão ao publicar o conteúdo.');
    }
    return parseRow(result.data);
  } catch (error) {
    if (error instanceof PublishedContentRepositoryError) throw error;
    throw mapThrownRepositoryError(error);
  }
}

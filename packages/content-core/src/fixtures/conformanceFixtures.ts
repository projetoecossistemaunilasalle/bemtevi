import type { EditorialEnvelope, EditorialOperation } from '../contracts/operations';
import { fixtureSemanticInvalidOperations } from './invalidStates';

export { fixtureSemanticInvalidOperations } from './invalidStates';
import { MAX_OPERATIONS_PER_BATCH } from '../operations/allowlists';

/**
 * Deterministic shared fixtures (dossier MERGE-02): every editable field, every
 * unsettable field, every image action, accepted no-op, stale generation and
 * representative semantic-invalid draft states. Importable by TypeScript and
 * database tests; serialization is byte-stable.
 */

export {
  PNG_1X1_BASE64,
  FIXTURE_EXPORT_ID,
  FIXTURE_BASE_GENERATION,
  FIXTURE_BASE_DIGEST,
  conformanceBasePayload,
} from './basePayload';
import {
  conformanceBasePayload,
  FIXTURE_BASE_GENERATION,
  FIXTURE_BASE_DIGEST,
  FIXTURE_EXPORT_ID,
  PNG_1X1_BASE64,
} from './basePayload';

export const fixtureSelfCheck = {
  reviewed: true,
  noOutOfScopeChanges: true,
  noUnrequestedDeletes: true,
  noUnsupportedImagePaths: true,
  notes: ['Fixture determinística.'],
} as const;

export function buildFixtureEnvelope(
  operations: EditorialOperation[],
  baseGeneration: number = FIXTURE_BASE_GENERATION,
): EditorialEnvelope {
  return {
    schemaVersion: '2.0.0',
    exportId: FIXTURE_EXPORT_ID,
    baseGeneration,
    baseDigest: FIXTURE_BASE_DIGEST,
    operations: JSON.parse(JSON.stringify(operations)) as EditorialOperation[],
    selfCheck: { ...fixtureSelfCheck, notes: [...fixtureSelfCheck.notes] },
  };
}

/** Add values covering every allowed `add` key per scope (new IDs, no image slots). */
export const fixtureAddValues: Record<string, Record<string, unknown>> = {
  flows: {
    id: 'fluxo-novo',
    version: '1',
    locale: 'pt-BR',
    title: 'Fluxo novo',
    type: 'guided_conversation',
    purpose: 'post_flow_routing',
    status: 'draft',
    entry: { nodeId: 'no-novo', enteringPhrases: ['oi'], transitionMessage: 'Olá.' },
    nodes: { 'no-novo': { id: 'no-novo', kind: 'result', text: 'Fim.' } },
    nodeOrder: ['no-novo'],
  },
  educationMaterials: {
    id: 'material-novo',
    title: 'Material novo',
    source: 'BemTeVi',
    description: 'Descrição do material novo.',
    tags: ['apoio'],
    audience: 'general',
    body: [{ id: 'bloco-novo', kind: 'paragraph', text: 'Texto.' }],
    embed: { provider: 'external', url: 'https://exemplo.bemtevi.org/embed' },
    href: '/educacao/material-novo',
    group: 'grupo-dois',
    groupOrder: 2,
    review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
  },
  educationGroups: { id: 'grupo-novo', title: 'Grupo novo', description: 'Descrição.', order: 3 },
  contacts: {
    id: 'contato-novo',
    name: 'CAPS',
    type: 'saude',
    badgeTone: 'secondary',
    city: 'Curitiba',
    state: 'PR',
    locationId: 'local-um',
    address: 'Avenida de exemplo, 456',
    phoneDisplay: '(41) 4000-0000',
    phoneHref: 'tel:+554140000000',
    hours: 'Segunda a sexta, 8h às 17h',
    notes: 'Encaminhamento necessário.',
    lat: -25.44,
    lng: -49.28,
    review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
  },
  locations: { id: 'local-novo', city: 'Londrina', state: 'PR' },
};

/** Updates unsetting every allowed `unset` key per scope (`locations` allows none). */
export const fixtureUnsetOperations: Record<string, EditorialOperation[]> = {
  flows: [{ op: 'update', scope: 'flows', id: 'fluxo-exemplo', patch: {}, unset: ['purpose', 'nodeOrder'] }],
  educationMaterials: [
    {
      op: 'update',
      scope: 'educationMaterials',
      id: 'material-exemplo',
      patch: {},
      unset: ['body', 'embed', 'href', 'group', 'groupOrder'],
    },
  ],
  educationGroups: [{ op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: {}, unset: ['description'] }],
  contacts: [
    {
      op: 'update',
      scope: 'contacts',
      id: 'contato-um',
      patch: {},
      unset: ['locationId', 'hours', 'notes', 'lat', 'lng'],
    },
  ],
  locations: [],
};

/** Every image action on every slot kind (uploaded uses the 1x1 PNG). */
export const fixtureImageActionOperations: Array<{ name: string; operation: EditorialOperation }> = [
  {
    name: 'featured-uploaded',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'destaque.png', alt: 'Destaque' },
    },
  },
  {
    name: 'featured-catalog',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'catalog', imageId: 'green-patch' },
    },
  },
  {
    name: 'featured-external',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'external', url: 'https://exemplo.bemtevi.org/nova.png', alt: 'Nova' },
    },
  },
  {
    name: 'featured-remove',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'featured' },
      image: { kind: 'remove' },
    },
  },
  {
    name: 'legacy-uploaded',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'legacy' },
      image: { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'legada.png', alt: '' },
    },
  },
  {
    name: 'legacy-external',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'legacy' },
      image: { kind: 'external', url: 'https://exemplo.bemtevi.org/legada.png', alt: '' },
    },
  },
  {
    name: 'legacy-remove',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'legacy' },
      image: { kind: 'remove' },
    },
  },
  {
    name: 'body-uploaded',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'body', blockId: 'bloco-imagem' },
      image: { kind: 'uploaded', mime: 'image/png', base64: PNG_1X1_BASE64, fileName: 'corpo.png', alt: 'Corpo novo' },
    },
  },
  {
    name: 'body-external',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'body', blockId: 'bloco-imagem' },
      image: { kind: 'external', url: 'https://exemplo.bemtevi.org/corpo-novo.png', alt: 'Corpo novo' },
    },
  },
  {
    name: 'body-remove',
    operation: {
      op: 'set_material_image',
      materialId: 'material-exemplo',
      slot: { kind: 'body', blockId: 'bloco-imagem' },
      image: { kind: 'remove' },
    },
  },
];

/** Accepted no-op: update with byte-equal current values (apply yields unchanged payload). */
export const fixtureNoopOperations: EditorialOperation[] = [
  { op: 'update', scope: 'educationGroups', id: 'grupo-um', patch: { title: 'Grupo um' }, unset: [] },
];

export const fixtureStaleGenerationEnvelope: EditorialEnvelope = buildFixtureEnvelope(
  [fixtureNoopOperations[0] as EditorialOperation],
  FIXTURE_BASE_GENERATION + 1,
);

/** Byte-stable serialization of every fixture, for TS/DB conformance tests. */
export function serializeConformanceFixtures(): string {
  return JSON.stringify({
    schemaVersion: '2.0.0',
    basePayload: conformanceBasePayload,
    exportId: FIXTURE_EXPORT_ID,
    baseGeneration: FIXTURE_BASE_GENERATION,
    baseDigest: FIXTURE_BASE_DIGEST,
    addValues: fixtureAddValues,
    unsetOperations: fixtureUnsetOperations,
    imageActionOperations: fixtureImageActionOperations,
    noopOperations: fixtureNoopOperations,
    semanticInvalidOperations: fixtureSemanticInvalidOperations,
    staleGenerationEnvelope: fixtureStaleGenerationEnvelope,
    maxOperationsPerBatch: MAX_OPERATIONS_PER_BATCH,
  });
}

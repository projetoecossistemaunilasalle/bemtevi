import type { Scope } from '../contracts/operations';

/**
 * Literal scope field allowlists from the V2 contract (dossier 14-contracts.md,
 * "Exact scope field allowlists"). These lists are frozen data in code: they are
 * NOT derived from the legacy `ITEM_KEYS` object or from optional TypeScript
 * properties, and a change to the V1 compatibility facade never changes V2.
 */

export const OPERATION_SCHEMA_VERSION = '2.0.0' as const;

/** Minimum/maximum operations per envelope batch. */
export const MIN_OPERATIONS_PER_BATCH = 1;
export const MAX_OPERATIONS_PER_BATCH = 200;

/** Maximum UTF-8 size of an operations envelope (8 MiB). */
export const MAX_OPERATIONS_ENVELOPE_BYTES = 8 * 1024 * 1024;

/** selfCheck.notes bounds. */
export const MAX_SELF_CHECK_NOTES = 20;
export const MAX_SELF_CHECK_NOTE_LENGTH = 500;

/** ID bounds: nonempty strings of at most 200 Unicode code points. */
export const MAX_ID_CODE_POINTS = 200;

/** Database counter upper bound (safe integers). */
export const MAX_COUNTER = 9007199254740991;

/** Maximum JSON nesting depth accepted in operation values. */
export const MAX_JSON_DEPTH = 150;

/** Keys never accepted as object keys inside operation JSON. */
export const PROTOTYPE_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

export const EDITORIAL_SCOPES = [
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'locations',
] as const satisfies readonly Scope[];

/**
 * `add.value` allowed keys per scope (`id` required and must be present).
 * The `educationMaterials` list intentionally excludes the protected top-level
 * image fields `imageUrl`, `imageFileName` and `featuredImage`.
 */
export const ADD_ALLOWED_KEYS: Record<Scope, readonly string[]> = {
  flows: ['id', 'version', 'locale', 'title', 'type', 'purpose', 'status', 'entry', 'nodes', 'nodeOrder'],
  educationMaterials: [
    'id',
    'title',
    'source',
    'description',
    'tags',
    'audience',
    'body',
    'embed',
    'href',
    'group',
    'groupOrder',
    'review',
  ],
  educationGroups: ['id', 'title', 'description', 'order'],
  contacts: [
    'id',
    'name',
    'type',
    'badgeTone',
    'city',
    'state',
    'locationId',
    'address',
    'phoneDisplay',
    'phoneHref',
    'hours',
    'notes',
    'lat',
    'lng',
    'review',
  ],
  locations: ['id', 'city', 'state'],
};

/** `update.patch` allowed keys per scope (never includes `id`). */
export const UPDATE_PATCH_ALLOWED_KEYS: Record<Scope, readonly string[]> = {
  flows: ['version', 'locale', 'title', 'type', 'purpose', 'status', 'entry', 'nodes', 'nodeOrder'],
  educationMaterials: [
    'title',
    'source',
    'description',
    'tags',
    'audience',
    'body',
    'embed',
    'href',
    'group',
    'groupOrder',
    'review',
  ],
  educationGroups: ['title', 'description', 'order'],
  contacts: [
    'name',
    'type',
    'badgeTone',
    'city',
    'state',
    'locationId',
    'address',
    'phoneDisplay',
    'phoneHref',
    'hours',
    'notes',
    'lat',
    'lng',
    'review',
  ],
  locations: ['city', 'state'],
};

/** `update.unset` allowed keys per scope (`locations` allows none). */
export const UPDATE_UNSET_ALLOWED_KEYS: Record<Scope, readonly string[]> = {
  flows: ['purpose', 'nodeOrder'],
  educationMaterials: ['body', 'embed', 'href', 'group', 'groupOrder'],
  educationGroups: ['description'],
  contacts: ['locationId', 'hours', 'notes', 'lat', 'lng'],
  locations: [],
};

/** Protected top-level material image fields that generic operations can never name. */
export const PROTECTED_MATERIAL_IMAGE_KEYS = ['featuredImage', 'imageUrl', 'imageFileName'] as const;

/** Protected image block fields used by the retained-slot rules. */
export const PROTECTED_IMAGE_BLOCK_KEYS = ['imageUrl', 'imageFileName', 'alt'] as const;

export const UPLOADED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const MAX_UPLOADED_IMAGE_DECODED_BYTES = 1024 * 1024;
export const MAX_IMAGE_FILE_NAME_LENGTH = 120;
export const MAX_IMAGE_ALT_LENGTH = 500;
export const MAX_EXTERNAL_IMAGE_URL_LENGTH = 2048;

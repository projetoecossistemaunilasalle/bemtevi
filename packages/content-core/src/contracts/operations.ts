/**
 * JSON value space used by editorial operations. Values crossing the wire must
 * be JSON-representable; `undefined` is never a value (fields are omitted).
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

/** The five editable content scopes. `defaultGroupOrder` is a scalar payload field, not a scope. */
export type Scope = 'flows' | 'educationMaterials' | 'educationGroups' | 'contacts' | 'locations';

export type EditorialOperation =
  | { op: 'add'; scope: Scope; value: JsonRecord }
  | { op: 'update'; scope: Scope; id: string; patch: JsonRecord; unset: string[] }
  | { op: 'delete'; scope: Scope; id: string; confirmation: true }
  | { op: 'reorder'; scope: Scope; ids: string[] }
  | { op: 'set_default_group_order'; value: number }
  | { op: 'set_material_image'; materialId: string; slot: ImageSlot; image: ImageValue };

export type ImageSlot = { kind: 'featured' } | { kind: 'legacy' } | { kind: 'body'; blockId: string };

export type ImageValue =
  | { kind: 'uploaded'; mime: 'image/png' | 'image/jpeg' | 'image/webp'; base64: string; fileName: string; alt: string }
  | { kind: 'catalog'; imageId: string }
  | { kind: 'external'; url: string; alt: string }
  | { kind: 'remove' };

export interface EditorialEnvelope {
  schemaVersion: '2.0.0';
  exportId: string;
  baseGeneration: number;
  baseDigest: string;
  operations: EditorialOperation[];
  selfCheck: {
    reviewed: true;
    noOutOfScopeChanges: true;
    noUnrequestedDeletes: true;
    noUnsupportedImagePaths: true;
    notes: string[];
  };
}

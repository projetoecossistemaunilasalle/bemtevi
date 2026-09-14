import type { EditorialEnvelope, EditorialOperation, Scope } from '../contracts/operations';
import {
  ADD_ALLOWED_KEYS,
  EDITORIAL_SCOPES,
  MAX_OPERATIONS_ENVELOPE_BYTES,
  MAX_OPERATIONS_PER_BATCH,
  MAX_SELF_CHECK_NOTE_LENGTH,
  MAX_SELF_CHECK_NOTES,
  MIN_OPERATIONS_PER_BATCH,
  OPERATION_SCHEMA_VERSION,
  UPDATE_PATCH_ALLOWED_KEYS,
  UPDATE_UNSET_ALLOWED_KEYS,
} from './allowlists';
import {
  assertJsonLike,
  fail,
  isRecordInput,
  isSafeCounter,
  isValidId,
  ok,
  utf8ByteLength,
  type OpResult,
} from './jsonChecks';
import { parseImageSlot, parseImageValue } from './imageValues';

function parseScope(value: unknown): Scope | null {
  if (typeof value !== 'string') return null;
  return (EDITORIAL_SCOPES as readonly string[]).includes(value) ? (value as Scope) : null;
}

function unexpectedKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): string | null {
  const unexpected = unexpectedKeys(value, allowed);
  return unexpected.length > 0 ? `campo(s) não permitido(s): ${unexpected.join(', ')}.` : null;
}

function parseAddValue(scope: Scope, value: unknown): OpResult<EditorialOperation> {
  if (!isRecordInput(value)) return fail('invalid_operations', 'add precisa de "value" como objeto.');
  const issue = exactKeys(value, ADD_ALLOWED_KEYS[scope]);
  if (issue !== null) return fail('invalid_operations', `add (${scope}): ${issue}`);
  if (!isValidId(value.id))
    return fail('invalid_operations', `add (${scope}): "id" é obrigatório (até 200 caracteres).`);
  return ok({ op: 'add', scope, value: value as { [key: string]: never } });
}

function parseUpdate(scope: Scope, id: unknown, patch: unknown, unset: unknown): OpResult<EditorialOperation> {
  if (!isValidId(id)) return fail('invalid_operations', 'update: "id" inválido.');
  if (!isRecordInput(patch)) return fail('invalid_operations', 'update precisa de "patch" como objeto.');
  if (!Array.isArray(unset) || unset.some((key) => typeof key !== 'string')) {
    return fail('invalid_operations', 'update precisa de "unset" como lista de nomes de campos.');
  }
  const unsetKeys = unset as string[];
  if (new Set(unsetKeys).size !== unsetKeys.length) {
    return fail('invalid_operations', 'update: "unset" não pode conter campos repetidos.');
  }
  const patchIssue = exactKeys(patch, UPDATE_PATCH_ALLOWED_KEYS[scope]);
  if (patchIssue !== null) return fail('invalid_operations', `update (${scope}) patch: ${patchIssue}`);
  const unsetIssue = exactKeys(
    Object.fromEntries(unsetKeys.map((key) => [key, true])),
    UPDATE_UNSET_ALLOWED_KEYS[scope],
  );
  if (unsetIssue !== null) return fail('invalid_operations', `update (${scope}) unset: ${unsetIssue}`);
  const overlap = unsetKeys.filter((key) => key in patch);
  if (overlap.length > 0) {
    return fail('invalid_operations', `update: campos não podem estar em "patch" e "unset": ${overlap.join(', ')}.`);
  }
  if (Object.keys(patch).length === 0 && unsetKeys.length === 0) {
    return fail('invalid_operations', 'update: patch vazio com unset vazio é inválido.');
  }
  return ok({ op: 'update', scope, id, patch: patch as { [key: string]: never }, unset: unsetKeys });
}

/** Parses and validates a single editorial operation against the frozen allowlists. */
export function parseEditorialOperation(value: unknown): OpResult<EditorialOperation> {
  if (!isRecordInput(value)) return fail('invalid_operations', 'cada operação deve ser um objeto.');
  const jsonIssue = assertJsonLike(value, 'operação');
  if (jsonIssue !== null) return fail('invalid_operations', jsonIssue);
  const op = value.op;
  if (op === 'add') {
    const issue = exactKeys(value, ['op', 'scope', 'value']);
    if (issue !== null) return fail('invalid_operations', `add: ${issue}`);
    const scope = parseScope(value.scope);
    if (scope === null) return fail('invalid_operations', 'add: escopo inválido.');
    return parseAddValue(scope, value.value);
  }
  if (op === 'update') {
    const issue = exactKeys(value, ['op', 'scope', 'id', 'patch', 'unset']);
    if (issue !== null) return fail('invalid_operations', `update: ${issue}`);
    const scope = parseScope(value.scope);
    if (scope === null) return fail('invalid_operations', 'update: escopo inválido.');
    return parseUpdate(scope, value.id, value.patch, value.unset);
  }
  if (op === 'delete') {
    const issue = exactKeys(value, ['op', 'scope', 'id', 'confirmation']);
    if (issue !== null) return fail('invalid_operations', `delete: ${issue}`);
    if (parseScope(value.scope) === null) return fail('invalid_operations', 'delete: escopo inválido.');
    if (!isValidId(value.id)) return fail('invalid_operations', 'delete: "id" inválido.');
    if (value.confirmation !== true) return fail('invalid_operations', 'delete exige "confirmation": true.');
    return ok({ op: 'delete', scope: value.scope as Scope, id: value.id, confirmation: true });
  }
  if (op === 'reorder') {
    const issue = exactKeys(value, ['op', 'scope', 'ids']);
    if (issue !== null) return fail('invalid_operations', `reorder: ${issue}`);
    const scope = parseScope(value.scope);
    if (scope === null) return fail('invalid_operations', 'reorder: escopo inválido.');
    if (
      !Array.isArray(value.ids) ||
      value.ids.length === 0 ||
      !value.ids.every((id: unknown) => isValidId(id)) ||
      new Set(value.ids as string[]).size !== value.ids.length
    ) {
      return fail('invalid_operations', 'reorder precisa de "ids" como lista não vazia de IDs distintos.');
    }
    return ok({ op: 'reorder', scope, ids: value.ids as string[] });
  }
  if (op === 'set_default_group_order') {
    const issue = exactKeys(value, ['op', 'value']);
    if (issue !== null) return fail('invalid_operations', `set_default_group_order: ${issue}`);
    if (!isSafeCounter(value.value)) {
      return fail('invalid_operations', 'set_default_group_order precisa de um inteiro finito seguro.');
    }
    return ok({ op: 'set_default_group_order', value: value.value });
  }
  if (op === 'set_material_image') {
    const issue = exactKeys(value, ['op', 'materialId', 'slot', 'image']);
    if (issue !== null) return fail('invalid_operations', `set_material_image: ${issue}`);
    if (!isValidId(value.materialId)) return fail('invalid_operations', 'set_material_image: "materialId" inválido.');
    const slot = parseImageSlot(value.slot);
    if (slot === null) return fail('invalid_operations', 'set_material_image: slot inválido.');
    const image = parseImageValue(value.image);
    if (image.ok === false) return fail('invalid_image', `set_material_image: ${image.message}`);
    return ok({ op: 'set_material_image', materialId: value.materialId, slot, image: image.value });
  }
  return fail('invalid_operations', `"op" inválido: ${String(op)}.`);
}

/** Parses an editorial operations envelope (V2, schema `2.0.0`). V1 input is rejected with `unsupported_schema`. */
export function parseOperationsEnvelope(input: unknown): OpResult<EditorialEnvelope> {
  if (typeof input === 'string') {
    if (utf8ByteLength(input) > MAX_OPERATIONS_ENVELOPE_BYTES) {
      return fail('invalid_operations', 'O envelope de operações excede 8 MiB.');
    }
    try {
      input = JSON.parse(input) as unknown;
    } catch {
      return fail('invalid_operations', 'O envelope de operações não é JSON válido.');
    }
  }
  if (!isRecordInput(input)) return fail('invalid_operations', 'O envelope de operações deve ser um objeto.');
  if (input.schemaVersion !== OPERATION_SCHEMA_VERSION) {
    return fail('unsupported_schema', `schemaVersion não suportado: esperado "${OPERATION_SCHEMA_VERSION}".`);
  }
  const issue = exactKeys(input, [
    'schemaVersion',
    'exportId',
    'baseGeneration',
    'baseDigest',
    'operations',
    'selfCheck',
  ]);
  if (issue !== null) return fail('invalid_operations', `Envelope: ${issue}`);
  if (!isValidId(input.exportId)) return fail('invalid_operations', 'Envelope: "exportId" inválido.');
  if (!isSafeCounter(input.baseGeneration)) return fail('invalid_operations', 'Envelope: "baseGeneration" inválido.');
  if (typeof input.baseDigest !== 'string' || !/^[0-9a-f]{64}$/.test(input.baseDigest)) {
    return fail('invalid_operations', 'Envelope: "baseDigest" deve ser SHA-256 em hex minúsculo.');
  }
  if (!Array.isArray(input.operations)) return fail('invalid_operations', 'Envelope: "operations" deve ser uma lista.');
  if (input.operations.length < MIN_OPERATIONS_PER_BATCH || input.operations.length > MAX_OPERATIONS_PER_BATCH) {
    return fail(
      'invalid_operations',
      `Envelope: o lote deve conter entre ${MIN_OPERATIONS_PER_BATCH} e ${MAX_OPERATIONS_PER_BATCH} operações.`,
    );
  }
  const selfCheck = input.selfCheck;
  if (!isRecordInput(selfCheck)) return fail('invalid_operations', 'Envelope: "selfCheck" deve ser um objeto.');
  const selfCheckIssue = exactKeys(selfCheck, [
    'reviewed',
    'noOutOfScopeChanges',
    'noUnrequestedDeletes',
    'noUnsupportedImagePaths',
    'notes',
  ]);
  if (selfCheckIssue !== null) return fail('invalid_operations', `selfCheck: ${selfCheckIssue}`);
  if (
    selfCheck.reviewed !== true ||
    selfCheck.noOutOfScopeChanges !== true ||
    selfCheck.noUnrequestedDeletes !== true ||
    selfCheck.noUnsupportedImagePaths !== true
  ) {
    return fail('invalid_operations', 'selfCheck: todas as verificações obrigatórias devem ser verdadeiras.');
  }
  if (
    !Array.isArray(selfCheck.notes) ||
    selfCheck.notes.length > MAX_SELF_CHECK_NOTES ||
    selfCheck.notes.some((note) => typeof note !== 'string' || note.length > MAX_SELF_CHECK_NOTE_LENGTH)
  ) {
    return fail(
      'invalid_operations',
      `selfCheck: "notes" deve ter até ${MAX_SELF_CHECK_NOTES} textos de 500 caracteres.`,
    );
  }
  for (const raw of input.operations) {
    const parsed = parseEditorialOperation(raw);
    if (parsed.ok === false) return parsed;
  }
  return ok(input as unknown as EditorialEnvelope);
}

// Model
export type { ContentStatus, ContentLocale, ReviewMetadata, ContentMetadata } from './model/content';
export type {
  EducationResourceAudience,
  EducationResourceFeaturedImage,
  EducationResourceBlockKind,
  EducationResourceBlock,
  EducationResourceEmbed,
  EducationResource,
  ResourcesContent,
} from './model/resources';
export type { ServiceLocation, ServiceDirectoryEntry, ServicesContent } from './model/services';
export {
  locationPairKey,
  deriveLocationsFromContacts,
  normalizeContactLocations,
  locationLabel,
  applyLocationSelection,
} from './model/locations';
export type { NormalizeContactLocationsOptions } from './model/locations';
export { parseYouTubeVideoId, getYouTubeEmbedUrl } from './model/youtube';
export type { EducationResourceGroup } from './model/groups';
export { DEFAULT_EDUCATION_GROUP_ID } from './model/groups';
export { FEATURED_IMAGE_IDS, isFeaturedImageId } from './model/featuredImageIds';
export type {
  FlowType,
  FlowPurpose,
  FlowNodeKind,
  ChatMessageSender,
  RuntimeOptionKind,
  GlobalActionTarget,
  ScoreFlowEffect,
  SafetyInterruptFlowEffect,
  DeferredSafetyFlowEffect,
  FlowStartFlowEffect,
  NavigateFlowEffect,
  EndFlowEffect,
  FlowEffect,
  FlowEntry,
  FlowOption,
  FreeTextFlowAdvance,
  OrientationVideo,
  OrientationVisual,
  FlowExercise,
  ChoiceFlowNode,
  ResultFlowNode,
  ScoreBranch,
  ScoreBranchFlowNode,
  FlowNode,
  GuidedFlow,
  ChatMessage,
  SuspendedFlowState,
  DeferredNavigationState,
  FlowRuntimeState,
  RuntimeNodeOption,
  RuntimeEntryOption,
  RuntimeGlobalAction,
  RuntimeResumeOption,
  RuntimeFlowStartOption,
  RuntimeOption,
  FlowValidationResult,
} from './model/flowTypes';
export {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
} from './model/publishedContent';
export type { PublishedContentPayload, PublishedContentSnapshot, PublishedContentRow } from './model/publishedContent';

// Validation
export { parseGuidedFlow } from './validation/parseFlow';
export { validateFlow } from './validation/validateFlow';
export { validateNodeVisuals, validateNodeVideos, validateNodeExercise } from './validation/flowNodeMediaValidation';
export { validateChoiceNode, validateScoreBranchNode } from './validation/flowNodeKindValidation';
export type {
  DashboardValidationLevel,
  DashboardValidationArea,
  DashboardValidationIssue,
  DashboardValidationResult,
} from './validation/validationTypes';
export { createValidationResult } from './validation/validationTypes';
export { findDuplicateIds } from './validation/duplicateIds';
export { isImageDataUrl } from './validation/imageDataUrl';
export { MAX_SERVICE_TYPE_LENGTH, validateDashboardContacts } from './validation/contactsValidation';
export { validateDashboardEducation } from './validation/educationValidation';
export { validateDashboardFlows } from './validation/flowValidation';
export { validateFlowEffect, collectScoringKeys, validateScoreBranch } from './validation/flowEffectValidation';
export { toStructuralIssue } from './validation/flowStructuralValidation';
export { translateStructuralChoiceIssue } from './validation/flowStructuralChoiceIssues';
export { translateStructuralCoreIssue } from './validation/flowStructuralCoreIssues';
export {
  createFlowValidationContext,
  isRecord,
  stringify,
  hasTextValue,
  nodeId,
  findNode,
  findNodeWithMissingId,
  nodePath,
  findOption,
  findOptionByIndex,
  optionPath,
  effectPath,
  findVideo,
  findVisual,
  findBranch,
  findBranchByIndex,
  countPreviousOccurrences,
} from './validation/flowStructuralValidationContext';
export type {
  UnknownRecord,
  FlowValidationContext,
  StructuralIssueDetails,
  NodeMatch,
  OptionMatch,
  IndexedRecord,
} from './validation/flowStructuralValidationContext';
export {
  parsePayload,
  parsePublishedContentRow,
  getPublishedPayloadSize,
  validatePublicationPayload,
} from './validation/publishedContent';
export { validateLocations, validateContactRecords, validateContacts } from './validation/publishedContentContacts';
export {
  validateFlows,
  validateEducationMaterials,
  validateEducationGroups,
} from './validation/publishedContentMaterials';
export { inspectContent } from './validation/inspectContent';
export type { ContentValidationIssue, ContentValidation, ContentInspection } from './validation/inspectContent';

// Contracts
export type {
  JsonValue,
  JsonRecord,
  Scope,
  EditorialOperation,
  ImageSlot,
  ImageValue,
  EditorialEnvelope,
} from './contracts/operations';
export type {
  Counter,
  Digest,
  Actor,
  DraftHead,
  ContentDraft,
  DraftMutationInput,
  DraftMutationResult,
} from './contracts/drafts';
// SemanticConflict is re-pointed to the canonical reconciliation type and
// exported once below from './content-reconciliation/semanticDiff'.
export type { ErrorCode, EditorialError, Result } from './contracts/errors';
export type { AgentConnection } from './contracts/connections';
export type { PublicationPreparation, PublishResult, PrepareInput } from './contracts/publication';
export type { EditExport } from './contracts/exports';

// Digest
export { sha256Text, sha256Bytes, verifySnapshot, sameContent } from './digest';

// Content reconciliation (semantic compare/merge)
export {
  assertComparable,
  compareContent,
  contentIdentity,
  describePath,
  reconcileContent,
} from './content-reconciliation/semanticDiff';
export type {
  ComparisonResult,
  ConflictDecisions,
  ContentPath,
  PathSegment,
  SemanticChange,
  SemanticConflict,
  SemanticMerge,
  ValueSlot,
} from './content-reconciliation/semanticDiff';

// Operations (V2 editorial protocol)
export {
  OPERATION_SCHEMA_VERSION,
  MIN_OPERATIONS_PER_BATCH,
  MAX_OPERATIONS_PER_BATCH,
  MAX_OPERATIONS_ENVELOPE_BYTES,
  MAX_SELF_CHECK_NOTES,
  MAX_SELF_CHECK_NOTE_LENGTH,
  MAX_ID_CODE_POINTS,
  MAX_COUNTER,
  MAX_JSON_DEPTH,
  PROTOTYPE_KEYS,
  EDITORIAL_SCOPES,
  ADD_ALLOWED_KEYS,
  UPDATE_PATCH_ALLOWED_KEYS,
  UPDATE_UNSET_ALLOWED_KEYS,
  PROTECTED_MATERIAL_IMAGE_KEYS,
  PROTECTED_IMAGE_BLOCK_KEYS,
  UPLOADED_IMAGE_MIMES,
  MAX_UPLOADED_IMAGE_DECODED_BYTES,
  MAX_IMAGE_FILE_NAME_LENGTH,
  MAX_IMAGE_ALT_LENGTH,
  MAX_EXTERNAL_IMAGE_URL_LENGTH,
} from './operations/allowlists';
export { parseOperationsEnvelope, parseEditorialOperation } from './operations/parseOperations';
export { applyOperations, validateBasePayload } from './operations/applyOperations';
export { encodeOperations } from './operations/encodeOperations';
export {
  checkFlowAddNodes,
  checkFlowNodesPatch,
  checkMaterialAddBody,
  checkMaterialBodyReplacement,
} from './operations/protectedImages';
export { applyMaterialImage, validateUploadedImage } from './operations/materialImageSlots';

// Images
export { decodeStrictBase64, parseImageDataUrl } from './images/base64';
export {
  inspectImage,
  MIN_IMAGE_DIMENSION,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_DIMENSION_PRODUCT,
  type InspectedImage,
} from './images/inspectImage';

// Conformance fixtures
export {
  PNG_1X1_BASE64,
  FIXTURE_EXPORT_ID,
  FIXTURE_BASE_GENERATION,
  FIXTURE_BASE_DIGEST,
  conformanceBasePayload,
  buildFixtureEnvelope,
  fixtureAddValues,
  fixtureUnsetOperations,
  fixtureImageActionOperations,
  fixtureNoopOperations,
  fixtureSemanticInvalidOperations,
  fixtureStaleGenerationEnvelope,
  serializeConformanceFixtures,
} from './fixtures/conformanceFixtures';

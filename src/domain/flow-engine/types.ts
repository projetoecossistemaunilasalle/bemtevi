import type { ContentLocale, ContentStatus } from '../content/types';

export type FlowType = 'guided_conversation';
export type FlowPurpose = 'orientation_entry' | 'post_flow_routing';
export type FlowNodeKind = 'choice' | 'result' | 'score_branch';
export type ChatMessageSender = 'bot' | 'user';
export type RuntimeOptionKind = 'node_option' | 'entry_phrase' | 'global_action' | 'resume_flow' | 'flow_start';
export type GlobalActionTarget = '/apoio' | '/contatos' | '/educacao' | 'end';

export interface ScoreFlowEffect {
  kind: 'score';
  scoreKey: string;
  value: number;
}

export interface SafetyInterruptFlowEffect {
  kind: 'safety_interrupt';
  message: string;
  destination: Exclude<GlobalActionTarget, 'end'>;
  blockResume: boolean;
}

export interface FlowStartFlowEffect {
  kind: 'flow_start';
  flowId: string;
}

export interface NavigateFlowEffect {
  kind: 'navigate';
  destination: Exclude<GlobalActionTarget, 'end'>;
}

export interface EndFlowEffect {
  kind: 'end_flow';
  message: string;
}

export type FlowEffect =
  | ScoreFlowEffect
  | SafetyInterruptFlowEffect
  | FlowStartFlowEffect
  | NavigateFlowEffect
  | EndFlowEffect;

export interface FlowEntry {
  nodeId: string;
  enteringPhrases: string[];
  transitionMessage: string;
}

export interface FlowOption {
  id: string;
  label: string;
  next: string;
  effects?: FlowEffect[];
}

export interface FreeTextFlowAdvance {
  next: string;
}

export interface ChoiceFlowNode {
  id: string;
  kind: 'choice';
  text: string;
  options: FlowOption[];
  freeText?: FreeTextFlowAdvance;
}

export interface ResultFlowNode {
  id: string;
  kind: 'result';
  text: string;
  recommendations?: string[];
}

export interface ScoreBranch {
  id: string;
  min: number;
  max: number;
  next: string;
}

export interface ScoreBranchFlowNode {
  id: string;
  kind: 'score_branch';
  text: string;
  scoreKey: string;
  branches: ScoreBranch[];
}

export type FlowNode = ChoiceFlowNode | ResultFlowNode | ScoreBranchFlowNode;

export interface GuidedFlow {
  id: string;
  version: string;
  locale: ContentLocale;
  title: string;
  type: FlowType;
  purpose?: FlowPurpose;
  status: ContentStatus;
  entry: FlowEntry;
  nodes: Record<string, FlowNode>;
}

export interface ChatMessage {
  id: string;
  sender: ChatMessageSender;
  text: string;
  flowId: string;
  nodeId?: string;
}

export interface SuspendedFlowState {
  flowId: string;
  nodeId: string;
  answers: Record<string, string>;
  transcript: ChatMessage[];
}

export interface FlowRuntimeState {
  activeFlowId?: string;
  activeNodeId?: string;
  transcript: ChatMessage[];
  suspendedFlows: Record<string, SuspendedFlowState>;
  answers: Record<string, string>;
  scores: Record<string, number>;
  safetyFlags: Record<string, boolean>;
  pendingNavigation?: Exclude<GlobalActionTarget, 'end'>;
}

export interface RuntimeNodeOption {
  kind: 'node_option';
  id: string;
  label: string;
  flowId: string;
  next: string;
  effects?: FlowEffect[];
}

export interface RuntimeEntryOption {
  kind: 'entry_phrase';
  id: string;
  label: string;
  flowId: string;
}

export interface RuntimeGlobalAction {
  kind: 'global_action';
  id: string;
  label: string;
  target: GlobalActionTarget;
}

export interface RuntimeResumeOption {
  kind: 'resume_flow';
  id: string;
  label: string;
  flowId: string;
}

export interface RuntimeFlowStartOption {
  kind: 'flow_start';
  id: string;
  label: string;
  flowId: string;
}

export type RuntimeOption =
  | RuntimeNodeOption
  | RuntimeEntryOption
  | RuntimeGlobalAction
  | RuntimeResumeOption
  | RuntimeFlowStartOption;

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
}

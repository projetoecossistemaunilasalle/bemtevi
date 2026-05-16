import type { ContentLocale, ContentStatus } from '../content/types';

export type FlowType = 'guided_conversation';
export type FlowNodeKind = 'choice' | 'result';
export type ChatMessageSender = 'bot' | 'user';
export type RuntimeOptionKind = 'node_option' | 'entry_phrase' | 'global_action';
export type GlobalActionTarget = '/apoio' | '/contatos' | '/educacao' | 'end';

export interface FlowEntry {
  nodeId: string;
  enteringPhrases: string[];
  transitionMessage: string;
}

export interface FlowOption {
  id: string;
  label: string;
  next: string;
}

export interface ChoiceFlowNode {
  id: string;
  kind: 'choice';
  text: string;
  options: FlowOption[];
}

export interface ResultFlowNode {
  id: string;
  kind: 'result';
  text: string;
  recommendations?: string[];
}

export type FlowNode = ChoiceFlowNode | ResultFlowNode;

export interface GuidedFlow {
  id: string;
  version: string;
  locale: ContentLocale;
  title: string;
  type: FlowType;
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
}

export interface RuntimeNodeOption {
  kind: 'node_option';
  id: string;
  label: string;
  flowId: string;
  next: string;
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

export type RuntimeOption = RuntimeNodeOption | RuntimeEntryOption | RuntimeGlobalAction;

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
}

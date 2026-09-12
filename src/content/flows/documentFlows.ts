import type { GuidedFlow } from '../../domain/flow-engine/types';
import { calmMomentFlow } from './document/calmMoment';
import { nextCareStepFlow } from './document/nextCareStep';
import { organizeExperienceFlow } from './document/organizeExperience';
import { postFlowNextStepFlow } from './document/postFlowNextStep';
import { understandFeelingsFlow } from './document/understandFeelings';

export const documentFlows = [
  understandFeelingsFlow,
  organizeExperienceFlow,
  nextCareStepFlow,
  calmMomentFlow,
  postFlowNextStepFlow,
] satisfies GuidedFlow[];

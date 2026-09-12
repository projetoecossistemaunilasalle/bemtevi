import type { GuidedFlow } from '../../domain/flow-engine/types';
import { calmMomentFlow } from './neutral/calmMoment';
import { nextCareStepFlow } from './neutral/nextCareStep';
import { postFlowNextStepFlow } from './neutral/postFlowNextStep';
import { talkThroughExperienceFlow } from './neutral/talkThroughExperience';
import { understandFeelingsFlow } from './neutral/understandFeelings';

export const neutralFlows = [
  understandFeelingsFlow,
  talkThroughExperienceFlow,
  nextCareStepFlow,
  calmMomentFlow,
  postFlowNextStepFlow,
] satisfies GuidedFlow[];

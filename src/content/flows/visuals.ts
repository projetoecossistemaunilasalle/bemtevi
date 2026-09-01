const visualPath = (name: string) => `/bemtevi/flow-visuals/${name}.png`;

export const flowVisuals = {
  emotions: visualPath('emotions'),
  firstSignal: visualPath('first-signal'),
  nextProblem: visualPath('next-problem'),
  difficultConversation: visualPath('difficult-conversation'),
  circleOfInfluence: visualPath('circle-of-influence'),
  actNow: visualPath('act-now'),
  supportNetwork: visualPath('support-network'),
  smallSteps: visualPath('small-steps'),
  professionalSupport: visualPath('professional-support'),
  butterflyBreathing: visualPath('butterfly-breathing'),
  sensesPause: visualPath('senses-pause'),
  bodyTensionRelease: visualPath('body-tension-release'),
  noticeLetPass: visualPath('notice-let-pass'),
} as const;

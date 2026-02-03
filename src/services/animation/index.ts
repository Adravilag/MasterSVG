/**
 * Animation services barrel export
 */
export { AnimationService, ANIMATION_KEYFRAMES } from './AnimationService';
export type { AnimationSettings, DetectedAnimation } from './AnimationService';
export { getAnimationService } from './AnimationAssignmentService';
export type { IconAnimation, AnimationsData } from './AnimationAssignmentService';
export {
  ANIMATION_KEYFRAMES as ANIMATION_KEYFRAMES_CSS,
  ANIMATION_CATEGORIES,
  ANIMATION_BUTTONS,
  getKeyframesForAnimation,
  getAllAnimationTypes,
} from './AnimationKeyframes';

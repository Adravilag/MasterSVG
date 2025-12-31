/**
 * Animation Service - Simplified
 * Provides animation settings types and utilities for SVG icons
 */

export interface AnimationSettings {
  duration: number;
  timing: string;
  iteration: string;
  direction?: string;
  delay?: number;
}

export interface DetectedAnimation {
  type: string;
  settings: AnimationSettings;
}

/**
 * Animation keyframes CSS definitions
 * Used by the web component (icon.js) which has these embedded
 */
export const ANIMATION_KEYFRAMES: Record<string, string> = {
  spin: '@keyframes spin { from { rotate: 0deg; } to { rotate: 360deg; } }',
  'spin-reverse': '@keyframes spin-reverse { from { rotate: 360deg; } to { rotate: 0deg; } }',
  pulse:
    '@keyframes pulse { 0%, 100% { scale: 1; opacity: 1; } 50% { scale: 1.1; opacity: 0.8; } }',
  'pulse-grow': '@keyframes pulse-grow { 0%, 100% { scale: 1; } 50% { scale: 1.3; } }',
  bounce: '@keyframes bounce { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }',
  'bounce-horizontal':
    '@keyframes bounce-horizontal { 0%, 100% { translate: 0 0; } 50% { translate: 4px 0; } }',
  shake:
    '@keyframes shake { 0%, 100% { translate: 0 0; } 25% { translate: -2px 0; } 75% { translate: 2px 0; } }',
  'shake-vertical':
    '@keyframes shake-vertical { 0%, 100% { translate: 0 0; } 25% { translate: 0 -2px; } 75% { translate: 0 2px; } }',
  fade: '@keyframes fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }',
  'fade-in': '@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }',
  'fade-out': '@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }',
  float: '@keyframes float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }',
  swing:
    '@keyframes swing { 0%, 100% { rotate: 0deg; } 20% { rotate: 15deg; } 40% { rotate: -10deg; } 60% { rotate: 5deg; } 80% { rotate: -5deg; } }',
  flip: '@keyframes flip { 0% { transform: perspective(400px) rotateY(0); } 100% { transform: perspective(400px) rotateY(360deg); } }',
  'flip-x':
    '@keyframes flip-x { 0% { transform: perspective(400px) rotateX(0); } 100% { transform: perspective(400px) rotateX(360deg); } }',
  heartbeat:
    '@keyframes heartbeat { 0%, 100% { scale: 1; } 14% { scale: 1.3; } 28% { scale: 1; } 42% { scale: 1.3; } 70% { scale: 1; } }',
  wiggle:
    '@keyframes wiggle { 0%, 100% { rotate: 0deg; } 25% { rotate: -10deg; } 75% { rotate: 10deg; } }',
  wobble:
    '@keyframes wobble { 0% { transform: translateX(0%); } 15% { transform: translateX(-25%) rotate(-5deg); } 30% { transform: translateX(20%) rotate(3deg); } 45% { transform: translateX(-15%) rotate(-3deg); } 60% { transform: translateX(10%) rotate(2deg); } 75% { transform: translateX(-5%) rotate(-1deg); } 100% { transform: translateX(0%); } }',
  'rubber-band':
    '@keyframes rubber-band { 0% { scale: 1 1; } 30% { scale: 1.25 0.75; } 40% { scale: 0.75 1.25; } 50% { scale: 1.15 0.85; } 65% { scale: 0.95 1.05; } 75% { scale: 1.05 0.95; } 100% { scale: 1 1; } }',
  jello:
    '@keyframes jello { 0%, 100% { transform: skewX(0deg) skewY(0deg); } 22% { transform: skewX(-12.5deg) skewY(-12.5deg); } 33% { transform: skewX(6.25deg) skewY(6.25deg); } 44% { transform: skewX(-3.125deg) skewY(-3.125deg); } 55% { transform: skewX(1.5625deg) skewY(1.5625deg); } 66% { transform: skewX(-0.78125deg) skewY(-0.78125deg); } 77% { transform: skewX(0.390625deg) skewY(0.390625deg); } 88% { transform: skewX(-0.1953125deg) skewY(-0.1953125deg); } }',
  tada: '@keyframes tada { 0% { scale: 1; rotate: 0deg; } 10%, 20% { scale: 0.9; rotate: -3deg; } 30%, 50%, 70%, 90% { scale: 1.1; rotate: 3deg; } 40%, 60%, 80% { scale: 1.1; rotate: -3deg; } 100% { scale: 1; rotate: 0deg; } }',
  blink: '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }',
  glow: '@keyframes glow { 0%, 100% { filter: drop-shadow(0 0 2px currentColor); } 50% { filter: drop-shadow(0 0 8px currentColor); } }',
  'zoom-in': '@keyframes zoom-in { from { scale: 0; opacity: 0; } to { scale: 1; opacity: 1; } }',
  'zoom-out': '@keyframes zoom-out { from { scale: 1; opacity: 1; } to { scale: 0; opacity: 0; } }',
  'slide-in-up':
    '@keyframes slide-in-up { from { translate: 0 100%; opacity: 0; } to { translate: 0 0; opacity: 1; } }',
  'slide-in-down':
    '@keyframes slide-in-down { from { translate: 0 -100%; opacity: 0; } to { translate: 0 0; opacity: 1; } }',
  'slide-in-left':
    '@keyframes slide-in-left { from { translate: -100% 0; opacity: 0; } to { translate: 0 0; opacity: 1; } }',
  'slide-in-right':
    '@keyframes slide-in-right { from { translate: 100% 0; opacity: 0; } to { translate: 0 0; opacity: 1; } }',
  draw: '@keyframes draw { to { stroke-dashoffset: 0; } }',
  'draw-reverse': '@keyframes draw-reverse { to { stroke-dashoffset: var(--path-length); } }',
  'draw-loop':
    '@keyframes draw-loop { 0% { stroke-dashoffset: var(--path-length); } 50% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: calc(var(--path-length) * -1); } }',
};

/**
 * Animation Service - Static utilities
 */
export class AnimationService {
  /**
   * Get keyframe CSS for an animation
   */
  public static getKeyframe(animationName: string): string | undefined {
    return ANIMATION_KEYFRAMES[animationName];
  }

  /**
   * Get all available animation names
   */
  public static getAnimationNames(): string[] {
    return Object.keys(ANIMATION_KEYFRAMES);
  }
}

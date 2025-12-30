/**
 * Animation Keyframes Data
 * 
 * CSS keyframes definitions for all supported icon animations.
 * Extracted from IconEditorPanel for better maintainability.
 */

export const ANIMATION_KEYFRAMES: Record<string, string> = {
  // Basic animations
  'spin': '@keyframes spin {\n  from { transform: rotate(0deg); }\n  to { transform: rotate(360deg); }\n}',
  'spin-reverse': '@keyframes spin-reverse {\n  from { transform: rotate(360deg); }\n  to { transform: rotate(0deg); }\n}',
  'pulse': '@keyframes pulse {\n  0%, 100% { transform: scale(1); opacity: 1; }\n  50% { transform: scale(1.1); opacity: 0.8; }\n}',
  'pulse-grow': '@keyframes pulse-grow {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.2); }\n}',
  'bounce': '@keyframes bounce {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-8px); }\n}',
  'bounce-horizontal': '@keyframes bounce-horizontal {\n  0%, 100% { transform: translateX(0); }\n  50% { transform: translateX(8px); }\n}',
  'shake': '@keyframes shake {\n  0%, 100% { transform: translateX(0); }\n  25% { transform: translateX(-4px); }\n  75% { transform: translateX(4px); }\n}',
  'shake-vertical': '@keyframes shake-vertical {\n  0%, 100% { transform: translateY(0); }\n  25% { transform: translateY(-4px); }\n  75% { transform: translateY(4px); }\n}',
  'fade': '@keyframes fade {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.3; }\n}',
  'fade-in': '@keyframes fade-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
  'fade-out': '@keyframes fade-out {\n  from { opacity: 1; }\n  to { opacity: 0; }\n}',
  'float': '@keyframes float {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-6px); }\n}',
  'blink': '@keyframes blink {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0; }\n}',
  'glow': '@keyframes glow {\n  0%, 100% { filter: drop-shadow(0 0 2px currentColor); }\n  50% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor); }\n}',

  // Attention seekers
  'swing': '@keyframes swing {\n  0%, 100% { transform: rotate(0deg); transform-origin: top center; }\n  25% { transform: rotate(15deg); }\n  75% { transform: rotate(-15deg); }\n}',
  'wobble': '@keyframes wobble {\n  0%, 100% { transform: translateX(0) rotate(0); }\n  15% { transform: translateX(-6px) rotate(-5deg); }\n  30% { transform: translateX(5px) rotate(3deg); }\n  45% { transform: translateX(-4px) rotate(-3deg); }\n  60% { transform: translateX(3px) rotate(2deg); }\n  75% { transform: translateX(-2px) rotate(-1deg); }\n}',
  'rubber-band': '@keyframes rubber-band {\n  0%, 100% { transform: scaleX(1); }\n  30% { transform: scaleX(1.25) scaleY(0.75); }\n  40% { transform: scaleX(0.75) scaleY(1.25); }\n  50% { transform: scaleX(1.15) scaleY(0.85); }\n  65% { transform: scaleX(0.95) scaleY(1.05); }\n  75% { transform: scaleX(1.05) scaleY(0.95); }\n}',
  'jello': '@keyframes jello {\n  0%, 11.1%, 100% { transform: skewX(0) skewY(0); }\n  22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); }\n  33.3% { transform: skewX(6.25deg) skewY(6.25deg); }\n  44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); }\n  55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); }\n}',
  'heartbeat': '@keyframes heartbeat {\n  0%, 100% { transform: scale(1); }\n  14% { transform: scale(1.15); }\n  28% { transform: scale(1); }\n  42% { transform: scale(1.15); }\n  70% { transform: scale(1); }\n}',
  'tada': '@keyframes tada {\n  0%, 100% { transform: scale(1) rotate(0); }\n  10%, 20% { transform: scale(0.9) rotate(-3deg); }\n  30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }\n  40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }\n}',

  // Entrance/Exit animations
  'zoom-in': '@keyframes zoom-in {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}',
  'zoom-out': '@keyframes zoom-out {\n  from { transform: scale(1); opacity: 1; }\n  to { transform: scale(0); opacity: 0; }\n}',
  'slide-in-up': '@keyframes slide-in-up {\n  from { transform: translateY(100%); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}',
  'slide-in-down': '@keyframes slide-in-down {\n  from { transform: translateY(-100%); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}',
  'slide-in-left': '@keyframes slide-in-left {\n  from { transform: translateX(-100%); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}',
  'slide-in-right': '@keyframes slide-in-right {\n  from { transform: translateX(100%); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}',
  'flip': '@keyframes flip {\n  0% { transform: perspective(400px) rotateY(0); }\n  100% { transform: perspective(400px) rotateY(360deg); }\n}',
  'flip-x': '@keyframes flip-x {\n  0% { transform: perspective(400px) rotateX(0); }\n  100% { transform: perspective(400px) rotateX(360deg); }\n}',

  // Draw animations (for stroke-based SVGs)
  'draw': '@keyframes draw {\n  from { stroke-dashoffset: var(--path-length, 1000); }\n  to { stroke-dashoffset: 0; }\n}',
  'draw-reverse': '@keyframes draw-reverse {\n  from { stroke-dashoffset: 0; }\n  to { stroke-dashoffset: var(--path-length, 1000); }\n}',
  'draw-loop': '@keyframes draw-loop {\n  0% { stroke-dashoffset: var(--path-length, 1000); }\n  45% { stroke-dashoffset: 0; }\n  55% { stroke-dashoffset: 0; }\n  100% { stroke-dashoffset: var(--path-length, 1000); }\n}',
};

/**
 * Animation categories for UI organization
 */
export const ANIMATION_CATEGORIES = {
  basic: ['none', 'spin', 'spin-reverse', 'pulse', 'pulse-grow', 'bounce', 'bounce-horizontal', 'shake', 'shake-vertical', 'fade', 'float', 'blink', 'glow'],
  attention: ['swing', 'wobble', 'rubber-band', 'jello', 'heartbeat', 'tada'],
  entrance: ['fade-in', 'fade-out', 'zoom-in', 'zoom-out', 'slide-in-up', 'slide-in-down', 'slide-in-left', 'slide-in-right', 'flip', 'flip-x'],
  draw: ['draw', 'draw-reverse', 'draw-loop'],
  custom: ['custom'],
};

/**
 * Animation button metadata for UI
 */
export const ANIMATION_BUTTONS: Record<string, { label: string; icon: string }> = {
  'none': { label: 'None', icon: 'circle-slash' },
  'spin': { label: 'Spin', icon: 'sync' },
  'spin-reverse': { label: 'Spin ↺', icon: 'sync' },
  'pulse': { label: 'Pulse', icon: 'pulse' },
  'pulse-grow': { label: 'Grow', icon: 'arrow-both' },
  'bounce': { label: 'Bounce', icon: 'triangle-up' },
  'bounce-horizontal': { label: 'Bounce H', icon: 'arrow-right' },
  'shake': { label: 'Shake', icon: 'arrow-swap' },
  'shake-vertical': { label: 'Shake V', icon: 'fold-up' },
  'fade': { label: 'Fade', icon: 'eye' },
  'fade-in': { label: 'Fade In', icon: 'eye' },
  'fade-out': { label: 'Fade Out', icon: 'eye-closed' },
  'float': { label: 'Float', icon: 'cloud' },
  'blink': { label: 'Blink', icon: 'lightbulb' },
  'glow': { label: 'Glow', icon: 'sparkle' },
  'swing': { label: 'Swing', icon: 'triangle-down' },
  'wobble': { label: 'Wobble', icon: 'symbol-event' },
  'rubber-band': { label: 'Rubber', icon: 'fold' },
  'jello': { label: 'Jello', icon: 'beaker' },
  'heartbeat': { label: 'Heartbeat', icon: 'heart' },
  'tada': { label: 'Tada', icon: 'megaphone' },
  'zoom-in': { label: 'Zoom In', icon: 'zoom-in' },
  'zoom-out': { label: 'Zoom Out', icon: 'zoom-out' },
  'slide-in-up': { label: 'Slide ↑', icon: 'arrow-up' },
  'slide-in-down': { label: 'Slide ↓', icon: 'arrow-down' },
  'slide-in-left': { label: 'Slide ←', icon: 'arrow-left' },
  'slide-in-right': { label: 'Slide →', icon: 'arrow-right' },
  'flip': { label: 'Flip Y', icon: 'refresh' },
  'flip-x': { label: 'Flip X', icon: 'fold-up' },
  'draw': { label: 'Draw', icon: 'edit' },
  'draw-reverse': { label: 'Undraw', icon: 'discard' },
  'draw-loop': { label: 'Draw Loop', icon: 'sync' },
  'custom': { label: 'Custom', icon: 'symbol-color' },
};

/**
 * Get keyframes CSS for an animation type
 */
export function getKeyframesForAnimation(animationType: string): string {
  return ANIMATION_KEYFRAMES[animationType] || `@keyframes ${animationType} {\n  /* Custom animation */\n}`;
}

/**
 * Get all animation types
 */
export function getAllAnimationTypes(): string[] {
  return Object.keys(ANIMATION_KEYFRAMES);
}


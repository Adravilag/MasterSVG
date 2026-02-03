/**
 * Draw Animation Builder
 *
 * Builds CSS and script content for draw-style SVG animations.
 * Extracted from SvgManipulationService for better SRP.
 */
import type { AnimationSettings } from '../animation/AnimationService';

export interface DrawAnimationContent {
  css: string;
  script: string;
}

const STROKE_ELEMENTS = 'path, line, polyline, polygon, circle, ellipse, rect';
const FILL_ELEMENTS = 'path[fill], circle[fill], ellipse[fill], rect[fill], polygon[fill]';

/**
 * Build script for calculating path lengths
 */
function buildPathLengthScript(): string {
  return `
    (function() {
      var svg = document.currentScript.parentElement;
      var elements = svg.querySelectorAll('${STROKE_ELEMENTS}');
      elements.forEach(function(el) {
        try {
          var len = el.getTotalLength ? el.getTotalLength() : 100;
          el.style.setProperty('--path-length', len);
        } catch(e) { el.style.setProperty('--path-length', '100'); }
      });
    })();
  `;
}

/**
 * Build draw animation CSS and script
 */
export function buildDrawAnimation(
  settings: AnimationSettings,
  reverse: boolean = false
): DrawAnimationContent {
  const duration = settings.duration || 2;
  const timing = settings.timing || 'ease-in-out';
  const delay = settings.delay || 0;
  const delayStr = delay > 0 ? ` ${delay}s` : '';

  const animName = reverse ? 'undraw' : 'draw';

  const drawKeyframes = reverse
    ? `@keyframes undraw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: var(--path-length); } }`
    : `@keyframes draw { from { stroke-dashoffset: var(--path-length); } to { stroke-dashoffset: 0; } }`;

  const fillKeyframes = reverse
    ? `@keyframes fill-out { 0%, 80% { fill-opacity: 1; } 100% { fill-opacity: 0; } }`
    : `@keyframes fill-in { 0%, 80% { fill-opacity: 0; } 100% { fill-opacity: 1; } }`;

  const fillAnimName = reverse ? 'fill-out' : 'fill-in';
  const initialFillOpacity = reverse ? '1' : '0';
  const initialOffset = reverse ? '0' : 'var(--path-length, 100)';

  const css = `
    ${drawKeyframes}
    ${fillKeyframes}
    svg ${STROKE_ELEMENTS.split(', ').map(s => `svg ${s}`).join(', ')} {
      stroke-dasharray: var(--path-length, 100);
      stroke-dashoffset: ${initialOffset};
      animation: ${animName} ${duration}s ${timing}${delayStr} forwards;
      fill-opacity: ${initialFillOpacity};
    }
    svg ${FILL_ELEMENTS.split(', ').map(s => `svg ${s}`).join(', ')} {
      animation: ${animName} ${duration}s ${timing}${delayStr} forwards, ${fillAnimName} ${duration * 1.2}s ${timing}${delayStr} forwards;
    }
  `;

  return { css, script: buildPathLengthScript() };
}

/**
 * Build draw-loop animation CSS and script
 */
export function buildDrawLoopAnimation(settings: AnimationSettings): DrawAnimationContent {
  const duration = settings.duration || 2;
  const timing = settings.timing || 'ease-in-out';
  const iteration = settings.iteration || 'infinite';
  const delay = settings.delay || 0;
  const delayStr = delay > 0 ? ` ${delay}s` : '';

  const css = `
    @keyframes draw-loop {
      0% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
      45% { stroke-dashoffset: 0; fill-opacity: 1; }
      55% { stroke-dashoffset: 0; fill-opacity: 1; }
      100% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
    }
    svg ${STROKE_ELEMENTS.split(', ').map(s => `svg ${s}`).join(', ')} {
      stroke-dasharray: var(--path-length, 100);
      stroke-dashoffset: var(--path-length, 100);
      fill-opacity: 0;
      animation: draw-loop ${duration}s ${timing}${delayStr} ${iteration};
    }
  `;

  return { css, script: buildPathLengthScript() };
}

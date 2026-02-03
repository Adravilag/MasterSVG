/**
 * Animation Detector
 *
 * Detects animations embedded in SVG content.
 * Extracted from SvgManipulationService for better SRP.
 */
import type { DetectedAnimation, AnimationSettings } from '../animation/AnimationService';

const DEFAULT_SETTINGS: AnimationSettings = {
  duration: 1,
  timing: 'ease',
  delay: 0,
  iteration: 'infinite',
  direction: 'normal',
};

/**
 * Detect native SMIL animations in SVG
 */
export function detectSmilAnimation(svg: string): DetectedAnimation | null {
  const hasAnimateTransform = /<animateTransform\b/i.test(svg);
  const hasAnimate = /<animate\b/i.test(svg);
  const hasAnimateMotion = /<animateMotion\b/i.test(svg);
  const hasSet = /<set\b/i.test(svg);

  if (!hasAnimateTransform && !hasAnimate && !hasAnimateMotion && !hasSet) {
    return null;
  }

  const duration = parseDuration(svg);
  const iteration = parseIteration(svg);
  const type = determineSmilType(svg, hasAnimateTransform, hasAnimateMotion, hasAnimate);

  return {
    type,
    settings: {
      duration,
      timing: 'linear',
      iteration,
      delay: 0,
      direction: 'normal',
    },
  };
}

/**
 * Parse duration from SMIL dur attribute
 */
function parseDuration(svg: string): number {
  const durMatch = svg.match(/\bdur=["']([^"']+)["']/i);
  if (!durMatch) return 1;

  const durStr = durMatch[1];
  if (durStr.endsWith('ms')) return parseFloat(durStr) / 1000;
  if (durStr.endsWith('s')) return parseFloat(durStr);
  return parseFloat(durStr) || 1;
}

/**
 * Parse iteration from SMIL repeatCount attribute
 */
function parseIteration(svg: string): string {
  const repeatMatch = svg.match(/\brepeatCount=["']([^"']+)["']/i);
  return repeatMatch ? repeatMatch[1] : 'infinite';
}

/**
 * Determine SMIL animation type
 */
function determineSmilType(
  svg: string,
  hasAnimateTransform: boolean,
  hasAnimateMotion: boolean,
  hasAnimate: boolean
): string {
  if (hasAnimateTransform) {
    const typeMatch = svg.match(/<animateTransform[^>]*type=["']([^"']+)["']/i);
    if (typeMatch) {
      const transformType = typeMatch[1].toLowerCase();
      return `native-${transformType}`;
    }
    return 'native-transform';
  }

  if (hasAnimateMotion) return 'native-motion';
  if (hasAnimate) return 'native-animate';
  return 'native';
}

/**
 * Analyze CSS content for animations
 */
export function analyzeCssContent(content: string): DetectedAnimation | null {
  // Check for draw animations first (they are special)
  const drawAnimation = detectDrawAnimation(content);
  if (drawAnimation) return drawAnimation;

  // Check for standard CSS animations
  return detectCssAnimation(content);
}

/**
 * Detect draw-style animations
 */
function detectDrawAnimation(content: string): DetectedAnimation | null {
  const drawSettings: AnimationSettings = {
    duration: 2,
    timing: 'ease-in-out',
    delay: 0,
    iteration: '1',
    direction: 'normal',
  };

  if (content.includes('@keyframes draw-loop')) {
    return { type: 'draw-loop', settings: { ...drawSettings, iteration: 'infinite' } };
  }

  if (content.includes('@keyframes draw-reverse') || content.includes('@keyframes undraw')) {
    return { type: 'draw-reverse', settings: drawSettings };
  }

  if (content.includes('@keyframes draw')) {
    return { type: 'draw', settings: drawSettings };
  }

  return null;
}

/**
 * Detect standard CSS animations
 */
function detectCssAnimation(content: string): DetectedAnimation | null {
  const nameMatch = content.match(/animation:\s*([\w-]+)/);
  if (!nameMatch) return null;

  const type = nameMatch[1];

  // Try to parse full settings
  const fullMatch = content.match(
    /(?:svg|\.icon-anim-\d+)\s*\{\s*animation:\s*([\w-]+)\s+([\d.]+)s\s+([^\s]+)(?:\s+([\d.]+)s)?\s+([^\s]+)\s+([^\s;}]+)/
  );

  if (fullMatch && fullMatch[1] === type) {
    return {
      type,
      settings: {
        duration: parseFloat(fullMatch[2]),
        timing: fullMatch[3],
        delay: fullMatch[4] ? parseFloat(fullMatch[4]) : 0,
        iteration: fullMatch[5],
        direction: fullMatch[6],
      },
    };
  }

  // Fallback: try to find duration at least
  const durationMatch = content.match(/animation:.*?([\d.]+)s/);

  return {
    type,
    settings: {
      ...DEFAULT_SETTINGS,
      duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
    },
  };
}

/**
 * Service for detecting animation types in SVG content.
 * Extracted from SvgItem to follow Single Responsibility Principle.
 */
export class SvgAnimationDetector {
  /**
   * Detect animation type from SVG content string.
   * Returns a human-readable animation type string or null if none detected.
   */
  static detectFromContent(svg: string): string | null {
    if (!svg) return null;

    // Check for CSS animations (in <style> tags)
    const hasStyleAnimation = /<style[^>]*>[\s\S]*@keyframes[\s\S]*<\/style>/i.test(svg);
    const hasInlineAnimation = /animation\s*:/i.test(svg);

    // Check for SMIL animations
    const hasAnimate = /<animate\b/i.test(svg);
    const hasAnimateTransform = /<animateTransform\b/i.test(svg);
    const hasAnimateMotion = /<animateMotion\b/i.test(svg);
    const hasSet = /<set\b/i.test(svg);

    // Determine animation type
    if (hasStyleAnimation || hasInlineAnimation) {
      return this.detectCssAnimationType(svg);
    }

    if (hasAnimateTransform) return 'SMIL transform';
    if (hasAnimateMotion) return 'SMIL motion';
    if (hasAnimate || hasSet) return 'SMIL';

    return null;
  }

  /**
   * Detect native SMIL animation from SVG content.
   * Returns animation type string or null.
   */
  static detectNativeAnimation(svg: string): string | null {
    const hasAnimateTransform = /<animateTransform\b/i.test(svg);
    const hasAnimate = /<animate\b/i.test(svg);
    const hasAnimateMotion = /<animateMotion\b/i.test(svg);
    const hasSet = /<set\b/i.test(svg);

    if (!hasAnimateTransform && !hasAnimate && !hasAnimateMotion && !hasSet) {
      return null;
    }

    if (hasAnimateTransform) {
      const typeMatch = svg.match(/<animateTransform[^>]*type=["']([^"']+)["']/i);
      if (typeMatch) {
        return `native-${typeMatch[1].toLowerCase()}`;
      }
      return 'native-transform';
    }
    if (hasAnimateMotion) return 'native-motion';
    if (hasAnimate) return 'native-animate';
    return 'native';
  }

  /**
   * Detect specific CSS animation type from SVG content.
   */
  private static detectCssAnimationType(svg: string): string {
    const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styleContent = styleMatch ? styleMatch[1] : '';
    const animationNameMatch = svg.match(/animation(?:-name)?\s*:\s*([^;}\s]+)/i);
    const animationName = animationNameMatch ? animationNameMatch[1] : '';
    const searchContext = styleContent + ' ' + animationName;

    if (/spin|rotate/i.test(searchContext)) return 'spin (CSS)';
    if (/pulse|scale/i.test(searchContext)) return 'pulse (CSS)';
    if (/fade/i.test(searchContext)) return 'fade (CSS)';
    if (/bounce/i.test(searchContext)) return 'bounce (CSS)';
    if (/shake/i.test(searchContext)) return 'shake (CSS)';
    if (/draw|stroke-dash/i.test(searchContext)) return 'draw (CSS)';
    if (/@keyframes[\s\S]*opacity/i.test(styleContent)) return 'fade (CSS)';
    return 'CSS';
  }
}

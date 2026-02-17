/**
 * Service for detecting rasterized SVGs (SVGs with too many colors for icon editing).
 * Extracted from SvgItem to follow Single Responsibility Principle.
 */
export class SvgRasterDetector {
  /**
   * Maximum number of unique colors allowed before an SVG is considered rasterized.
   */
  static readonly MAX_COLORS_FOR_ICONS = 50;

  /**
   * Count unique colors in SVG content.
   */
  static countColors(svg: string): number {
    const colorRegex =
      /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
    const colors = new Set<string>();
    let match;
    while ((match = colorRegex.exec(svg)) !== null) {
      colors.add(match[0].toLowerCase());
    }
    return colors.size;
  }

  /**
   * Check if SVG is a rasterized image (too many colors for icon editing).
   */
  static isRasterized(svg: string | undefined): boolean {
    if (!svg) return false;
    return this.countColors(svg) > this.MAX_COLORS_FOR_ICONS;
  }
}

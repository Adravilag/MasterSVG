/**
 * SVG validation and detection utilities
 */

/**
 * Regex patterns for SVG detection
 */
export const SVG_PATTERNS = {
  // Full SVG tag detection
  fullSvg: /<svg[^>]*>[\s\S]*?<\/svg>/gi,
  // SVG opening tag
  openingTag: /<svg\b[^>]*>/i,
  // SVG closing tag
  closingTag: /<\/svg>/i,
  // SVG namespace
  namespace: /xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i,
  // ViewBox attribute
  viewBox: /viewBox=["']([^"']+)["']/i,
  // Width attribute
  width: /\bwidth=["']([^"']+)["']/i,
  // Height attribute
  height: /\bheight=["']([^"']+)["']/i,
  // Fill attribute
  fill: /\bfill=["']([^"']+)["']/gi,
  // Stroke attribute
  stroke: /\bstroke=["']([^"']+)["']/gi,
  // Path element
  pathElement: /<path[^>]*>/gi,
  // Circle element
  circleElement: /<circle[^>]*>/gi,
  // Rect element
  rectElement: /<rect[^>]*>/gi,
  // Gradient definitions
  gradient: /<(linear|radial)Gradient/i,
  // Style element
  styleElement: /<style[^>]*>[\s\S]*?<\/style>/gi,
  // Class attribute
  classAttr: /\bclass=["']([^"']+)["']/gi,
  // ID attribute
  idAttr: /\bid=["']([^"']+)["']/i,
  // Title element
  titleElement: /<title[^>]*>([^<]*)<\/title>/i,
  // Desc element
  descElement: /<desc[^>]*>([^<]*)<\/desc>/i
};

/**
 * Color patterns for detection
 */
export const COLOR_PATTERNS = {
  // Hex colors (3 and 6 digit)
  hex: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
  // RGB colors
  rgb: /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi,
  // RGBA colors
  rgba: /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/gi,
  // HSL colors
  hsl: /hsl\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)/gi,
  // Named colors (common ones)
  named: /\b(black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|transparent|currentColor|none)\b/gi
};

/**
 * Checks if a string contains valid SVG content
 */
export function isValidSvg(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  return SVG_PATTERNS.openingTag.test(content) && SVG_PATTERNS.closingTag.test(content);
}

/**
 * Checks if SVG has namespace declaration
 */
export function hasNamespace(svg: string): boolean {
  return SVG_PATTERNS.namespace.test(svg);
}

/**
 * Checks if SVG has viewBox attribute
 */
export function hasViewBox(svg: string): boolean {
  return SVG_PATTERNS.viewBox.test(svg);
}

/**
 * Extracts viewBox value from SVG
 */
export function extractViewBox(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.viewBox);
  return match ? match[1] : null;
}

/**
 * Extracts width from SVG
 */
export function extractWidth(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.width);
  return match ? match[1] : null;
}

/**
 * Extracts height from SVG
 */
export function extractHeight(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.height);
  return match ? match[1] : null;
}

/**
 * Checks if SVG has explicit dimensions
 */
export function hasDimensions(svg: string): boolean {
  return SVG_PATTERNS.width.test(svg) && SVG_PATTERNS.height.test(svg);
}

/**
 * Checks if SVG contains gradients
 */
export function hasGradient(svg: string): boolean {
  return SVG_PATTERNS.gradient.test(svg);
}

/**
 * Checks if SVG contains style element
 */
export function hasStyleElement(svg: string): boolean {
  return SVG_PATTERNS.styleElement.test(svg);
}

/**
 * Checks if SVG contains class attributes
 */
export function hasClassAttributes(svg: string): boolean {
  return SVG_PATTERNS.classAttr.test(svg);
}

/**
 * Extracts ID from SVG
 */
export function extractId(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.idAttr);
  return match ? match[1] : null;
}

/**
 * Extracts title from SVG
 */
export function extractTitle(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.titleElement);
  return match ? match[1] : null;
}

/**
 * Extracts description from SVG
 */
export function extractDescription(svg: string): string | null {
  const match = svg.match(SVG_PATTERNS.descElement);
  return match ? match[1] : null;
}

/**
 * Counts path elements in SVG
 */
export function countPaths(svg: string): number {
  const matches = svg.match(SVG_PATTERNS.pathElement);
  return matches ? matches.length : 0;
}

/**
 * Counts all shape elements in SVG
 */
export function countShapes(svg: string): number {
  const paths = svg.match(SVG_PATTERNS.pathElement)?.length || 0;
  const circles = svg.match(SVG_PATTERNS.circleElement)?.length || 0;
  const rects = svg.match(SVG_PATTERNS.rectElement)?.length || 0;
  return paths + circles + rects;
}

/**
 * Extracts all colors from SVG
 */
export function extractColors(svg: string): string[] {
  const colors = new Set<string>();
  
  // Extract hex colors
  const hexMatches = svg.match(COLOR_PATTERNS.hex) || [];
  hexMatches.forEach(c => colors.add(c.toLowerCase()));
  
  // Extract rgb colors
  const rgbMatches = svg.match(COLOR_PATTERNS.rgb) || [];
  rgbMatches.forEach(c => colors.add(c.toLowerCase()));
  
  // Extract rgba colors
  const rgbaMatches = svg.match(COLOR_PATTERNS.rgba) || [];
  rgbaMatches.forEach(c => colors.add(c.toLowerCase()));
  
  // Extract named colors
  const namedMatches = svg.match(COLOR_PATTERNS.named) || [];
  namedMatches.forEach(c => colors.add(c.toLowerCase()));
  
  return Array.from(colors);
}

/**
 * Checks if SVG is monochrome (single color)
 */
export function isMonochrome(svg: string): boolean {
  const colors = extractColors(svg).filter(c => 
    c !== 'none' && c !== 'transparent' && c !== 'currentcolor'
  );
  return colors.length <= 1;
}

/**
 * Extracts fill colors from SVG
 */
export function extractFillColors(svg: string): string[] {
  const fills: string[] = [];
  const matches = svg.matchAll(SVG_PATTERNS.fill);
  for (const match of matches) {
    if (match[1] && match[1] !== 'none') {
      fills.push(match[1]);
    }
  }
  return [...new Set(fills)];
}

/**
 * Extracts stroke colors from SVG
 */
export function extractStrokeColors(svg: string): string[] {
  const strokes: string[] = [];
  const matches = svg.matchAll(SVG_PATTERNS.stroke);
  for (const match of matches) {
    if (match[1] && match[1] !== 'none') {
      strokes.push(match[1]);
    }
  }
  return [...new Set(strokes)];
}

/**
 * Validates SVG structure and returns issues
 */
export function validateSvg(svg: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!svg || typeof svg !== 'string') {
    return { valid: false, issues: ['SVG content is empty or invalid'] };
  }
  
  if (!SVG_PATTERNS.openingTag.test(svg)) {
    issues.push('Missing <svg> opening tag');
  }
  
  if (!SVG_PATTERNS.closingTag.test(svg)) {
    issues.push('Missing </svg> closing tag');
  }
  
  if (!hasViewBox(svg) && !hasDimensions(svg)) {
    issues.push('Missing viewBox or dimensions');
  }
  
  if (!hasNamespace(svg)) {
    issues.push('Missing xmlns namespace');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Calculates SVG complexity score
 */
export function calculateComplexity(svg: string): number {
  let score = 0;
  
  // Count shapes
  score += countShapes(svg) * 1;
  
  // Gradients add complexity
  if (hasGradient(svg)) score += 5;
  
  // Style elements add complexity
  if (hasStyleElement(svg)) score += 3;
  
  // Multiple colors add complexity
  const colors = extractColors(svg);
  score += colors.length;
  
  return score;
}

/**
 * Determines SVG category based on content
 */
export function categorizeIcon(svg: string): 'simple' | 'medium' | 'complex' {
  const complexity = calculateComplexity(svg);
  
  if (complexity <= 3) return 'simple';
  if (complexity <= 10) return 'medium';
  return 'complex';
}

/**
 * Normalizes hex color to 6-digit format
 */
export function normalizeHexColor(color: string): string {
  if (!color.startsWith('#')) return color;
  
  const hex = color.slice(1);
  if (hex.length === 3) {
    return '#' + hex.split('').map(c => c + c).join('');
  }
  return color.toLowerCase();
}

/**
 * Converts named color to hex (basic colors only)
 */
export function namedColorToHex(name: string): string | null {
  const colors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    gray: '#808080',
    grey: '#808080',
    cyan: '#00ffff',
    magenta: '#ff00ff'
  };
  
  return colors[name.toLowerCase()] || null;
}

/**
 * Checks if color is valid
 */
export function isValidColor(color: string): boolean {
  if (!color) return false;
  
  // Check special values
  if (['none', 'transparent', 'currentColor', 'inherit'].includes(color)) {
    return true;
  }
  
  // Check hex
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return true;
  }
  
  // Check rgb/rgba
  if (/^rgba?\(.+\)$/.test(color)) {
    return true;
  }
  
  // Check named color
  if (namedColorToHex(color) !== null) {
    return true;
  }
  
  return false;
}

/**
 * Estimates SVG file size in bytes
 */
export function estimateSize(svg: string): number {
  return new Blob([svg]).size;
}

/**
 * Formats bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

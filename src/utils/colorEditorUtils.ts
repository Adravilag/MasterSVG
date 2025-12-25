/**
 * Utility functions for SVG color manipulation and editing
 * Extracted from extension.ts for better testability
 */

/**
 * Color preset definition
 */
export interface SvgColorPreset {
  color: string;
  name: string;
  category?: 'basic' | 'brand' | 'pastel' | 'neutral';
}

/**
 * Color entry found in SVG
 */
export interface SvgColorEntry {
  color: string;
  attribute: 'fill' | 'stroke' | 'stop-color' | 'style';
  count: number;
  original?: string;
}

/**
 * Saved style configuration
 */
export interface SavedStyle {
  id: string;
  name: string;
  colors: Record<string, string>;
  isPrimary?: boolean;
  createdAt?: number;
}

/**
 * Default color presets for the color editor
 */
export const COLOR_EDITOR_PRESETS: SvgColorPreset[] = [
  // Basic colors
  { color: '#ffffff', name: 'White', category: 'basic' },
  { color: '#000000', name: 'Black', category: 'basic' },
  { color: '#ef4444', name: 'Red', category: 'basic' },
  { color: '#f97316', name: 'Orange', category: 'basic' },
  { color: '#eab308', name: 'Yellow', category: 'basic' },
  { color: '#22c55e', name: 'Green', category: 'basic' },
  { color: '#3b82f6', name: 'Blue', category: 'basic' },
  { color: '#8b5cf6', name: 'Purple', category: 'basic' },
  { color: '#ec4899', name: 'Pink', category: 'basic' },
  // Neutrals
  { color: '#f5f5f5', name: 'Gray 100', category: 'neutral' },
  { color: '#d4d4d4', name: 'Gray 300', category: 'neutral' },
  { color: '#737373', name: 'Gray 500', category: 'neutral' },
  { color: '#404040', name: 'Gray 700', category: 'neutral' },
  { color: '#171717', name: 'Gray 900', category: 'neutral' },
];

/**
 * Regex patterns for color detection
 */
export const COLOR_REGEX = {
  HEX_6: /#([0-9a-fA-F]{6})\b/g,
  HEX_3: /#([0-9a-fA-F]{3})\b/g,
  RGB: /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi,
  RGBA: /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*[\d.]+\s*\)/gi,
  FILL: /fill\s*=\s*["']([^"']+)["']/gi,
  STROKE: /stroke\s*=\s*["']([^"']+)["']/gi,
  STOP_COLOR: /stop-color\s*=\s*["']([^"']+)["']/gi,
  STYLE_FILL: /fill\s*:\s*([^;}"']+)/gi,
  STYLE_STROKE: /stroke\s*:\s*([^;}"']+)/gi,
};

/**
 * Named colors map for conversion
 */
export const NAMED_COLORS: Record<string, string> = {
  'black': '#000000',
  'white': '#ffffff',
  'red': '#ff0000',
  'green': '#008000',
  'blue': '#0000ff',
  'yellow': '#ffff00',
  'cyan': '#00ffff',
  'magenta': '#ff00ff',
  'gray': '#808080',
  'grey': '#808080',
  'orange': '#ffa500',
  'purple': '#800080',
  'pink': '#ffc0cb',
  'brown': '#a52a2a',
  'navy': '#000080',
  'teal': '#008080',
  'olive': '#808000',
  'maroon': '#800000',
  'lime': '#00ff00',
  'aqua': '#00ffff',
  'silver': '#c0c0c0',
  'fuchsia': '#ff00ff',
  'transparent': 'transparent',
  'none': 'none',
  'currentColor': 'currentColor',
  'inherit': 'inherit',
};

/**
 * Escape SVG content for embedding in HTML/JS
 */
export function escapeSvgForEmbedding(svg: string): string {
  return svg
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

/**
 * Escape SVG content for JSON
 */
export function escapeSvgForJson(svg: string): string {
  return svg
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Convert 3-digit hex to 6-digit hex
 */
export function expandHexColor(hex: string): string {
  if (!hex.startsWith('#')) return hex;
  const color = hex.slice(1);
  if (color.length === 3) {
    return '#' + color.split('').map(c => c + c).join('');
  }
  return hex;
}

/**
 * Convert named color to hex
 */
export function namedToHex(color: string): string {
  const lower = color.toLowerCase().trim();
  return NAMED_COLORS[lower] || color;
}

/**
 * Normalize color to hex format
 */
export function normalizeColor(color: string): string {
  if (!color) return color;
  
  // Handle special values
  const special = ['none', 'transparent', 'currentColor', 'inherit'];
  if (special.includes(color.toLowerCase())) {
    return color.toLowerCase();
  }
  
  // Handle named colors
  const hex = namedToHex(color);
  if (hex !== color) {
    return hex.toLowerCase();
  }
  
  // Expand 3-digit hex
  const expanded = expandHexColor(color);
  return expanded.toLowerCase();
}

/**
 * Extract all colors from SVG content
 */
export function extractColorsFromSvg(svg: string): SvgColorEntry[] {
  const colors: Map<string, SvgColorEntry> = new Map();
  
  // Helper to add color
  const addColor = (color: string, attribute: SvgColorEntry['attribute']) => {
    const normalized = normalizeColor(color);
    if (!normalized || normalized === 'none' || normalized === 'transparent') {
      return;
    }
    
    const key = `${normalized}-${attribute}`;
    const existing = colors.get(key);
    if (existing) {
      existing.count++;
    } else {
      colors.set(key, {
        color: normalized,
        attribute,
        count: 1,
        original: color,
      });
    }
  };
  
  // Extract fill colors
  let match;
  const fillRegex = /fill\s*=\s*["']([^"']+)["']/gi;
  while ((match = fillRegex.exec(svg)) !== null) {
    addColor(match[1], 'fill');
  }
  
  // Extract stroke colors
  const strokeRegex = /stroke\s*=\s*["']([^"']+)["']/gi;
  while ((match = strokeRegex.exec(svg)) !== null) {
    addColor(match[1], 'stroke');
  }
  
  // Extract stop-color (gradients)
  const stopColorRegex = /stop-color\s*=\s*["']([^"']+)["']/gi;
  while ((match = stopColorRegex.exec(svg)) !== null) {
    addColor(match[1], 'stop-color');
  }
  
  // Extract colors from style attributes
  const styleFillRegex = /style\s*=\s*["'][^"']*fill\s*:\s*([^;}"']+)/gi;
  while ((match = styleFillRegex.exec(svg)) !== null) {
    addColor(match[1].trim(), 'style');
  }
  
  const styleStrokeRegex = /style\s*=\s*["'][^"']*stroke\s*:\s*([^;}"']+)/gi;
  while ((match = styleStrokeRegex.exec(svg)) !== null) {
    addColor(match[1].trim(), 'style');
  }
  
  return Array.from(colors.values());
}

/**
 * Replace a specific color in SVG
 */
export function replaceColorInSvg(
  svg: string,
  oldColor: string,
  newColor: string,
  attribute?: SvgColorEntry['attribute']
): string {
  const normalizedOld = normalizeColor(oldColor);
  let result = svg;
  
  // Escape special regex characters in color
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedOld = escapeRegex(normalizedOld);
  const escapedOriginal = escapeRegex(oldColor);
  
  // Replace in fill attributes
  if (!attribute || attribute === 'fill') {
    result = result.replace(
      new RegExp(`(fill\\s*=\\s*["'])(${escapedOld}|${escapedOriginal})(["'])`, 'gi'),
      `$1${newColor}$3`
    );
  }
  
  // Replace in stroke attributes
  if (!attribute || attribute === 'stroke') {
    result = result.replace(
      new RegExp(`(stroke\\s*=\\s*["'])(${escapedOld}|${escapedOriginal})(["'])`, 'gi'),
      `$1${newColor}$3`
    );
  }
  
  // Replace in stop-color attributes
  if (!attribute || attribute === 'stop-color') {
    result = result.replace(
      new RegExp(`(stop-color\\s*=\\s*["'])(${escapedOld}|${escapedOriginal})(["'])`, 'gi'),
      `$1${newColor}$3`
    );
  }
  
  // Replace in style attributes (more complex)
  if (!attribute || attribute === 'style') {
    result = result.replace(
      new RegExp(`(fill\\s*:\\s*)(${escapedOld}|${escapedOriginal})([;}"'])`, 'gi'),
      `$1${newColor}$3`
    );
    result = result.replace(
      new RegExp(`(stroke\\s*:\\s*)(${escapedOld}|${escapedOriginal})([;}"'])`, 'gi'),
      `$1${newColor}$3`
    );
  }
  
  return result;
}

/**
 * Replace all colors in SVG with a single color
 */
export function applyColorToAll(svg: string, color: string): string {
  const colors = extractColorsFromSvg(svg);
  let result = svg;
  
  for (const entry of colors) {
    result = replaceColorInSvg(result, entry.color, color, entry.attribute);
  }
  
  return result;
}

/**
 * Apply color mapping to SVG
 */
export function applyColorMapping(
  svg: string,
  colorMap: Record<string, string>
): string {
  let result = svg;
  
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    result = replaceColorInSvg(result, oldColor, newColor);
  }
  
  return result;
}

/**
 * Add fill color to SVG if not present
 */
export function addFillToSvg(svg: string, color: string): string {
  // Check if SVG already has fill on root element
  if (/^<svg[^>]*\sfill\s*=/i.test(svg)) {
    return replaceColorInSvg(svg, extractRootFill(svg) || 'none', color, 'fill');
  }
  
  // Add fill attribute to SVG element
  return svg.replace(/<svg/i, `<svg fill="${color}"`);
}

/**
 * Extract fill color from root SVG element
 */
export function extractRootFill(svg: string): string | null {
  const match = svg.match(/^<svg[^>]*\sfill\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Remove fill attribute from root SVG element
 */
export function removeRootFill(svg: string): string {
  return svg.replace(/^(<svg[^>]*)\s+fill\s*=\s*["'][^"']*["']/i, '$1');
}

/**
 * Add stroke to SVG if not present
 */
export function addStrokeToSvg(svg: string, color: string, width: number = 1): string {
  // Check if SVG already has stroke on root element
  if (/^<svg[^>]*\sstroke\s*=/i.test(svg)) {
    return replaceColorInSvg(svg, extractRootStroke(svg) || 'none', color, 'stroke');
  }
  
  // Add stroke attributes to SVG element
  return svg.replace(/<svg/i, `<svg stroke="${color}" stroke-width="${width}"`);
}

/**
 * Extract stroke color from root SVG element
 */
export function extractRootStroke(svg: string): string | null {
  const match = svg.match(/^<svg[^>]*\sstroke\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Create a color swatch HTML element
 */
export function createColorSwatchHtml(
  color: string,
  size: number = 24,
  showBorder: boolean = true
): string {
  const borderStyle = showBorder ? 'border: 1px solid var(--vscode-panel-border);' : '';
  return `<div style="width: ${size}px; height: ${size}px; background: ${color}; border-radius: 4px; ${borderStyle}"></div>`;
}

/**
 * Generate unique ID for saved style
 */
export function generateStyleId(): string {
  return `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new saved style from current SVG colors
 */
export function createSavedStyle(
  name: string,
  svg: string,
  isPrimary: boolean = false
): SavedStyle {
  const colors = extractColorsFromSvg(svg);
  const colorMap: Record<string, string> = {};
  
  for (const entry of colors) {
    colorMap[entry.original || entry.color] = entry.color;
  }
  
  return {
    id: generateStyleId(),
    name,
    colors: colorMap,
    isPrimary,
    createdAt: Date.now(),
  };
}

/**
 * Apply a saved style to SVG
 */
export function applySavedStyle(svg: string, style: SavedStyle): string {
  return applyColorMapping(svg, style.colors);
}

/**
 * Invert colors in SVG (dark mode conversion)
 */
export function invertColors(svg: string): string {
  const colors = extractColorsFromSvg(svg);
  let result = svg;
  
  for (const entry of colors) {
    const inverted = invertHexColor(entry.color);
    if (inverted) {
      result = replaceColorInSvg(result, entry.color, inverted, entry.attribute);
    }
  }
  
  return result;
}

/**
 * Invert a hex color
 */
export function invertHexColor(hex: string): string | null {
  const normalized = normalizeColor(hex);
  if (!normalized.startsWith('#') || normalized.length !== 7) {
    return null;
  }
  
  const r = 255 - parseInt(normalized.slice(1, 3), 16);
  const g = 255 - parseInt(normalized.slice(3, 5), 16);
  const b = 255 - parseInt(normalized.slice(5, 7), 16);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeColor(hex);
  if (!normalized.startsWith('#') || normalized.length !== 7) {
    return null;
  }
  
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/**
 * Convert RGB values to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a color by percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

/**
 * Darken a color by percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = 1 - percent / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

/**
 * Calculate color luminance
 */
export function getColorLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Check if a color is considered light
 */
export function isLightColor(hex: string): boolean {
  return getColorLuminance(hex) > 0.5;
}

/**
 * Get contrasting text color (black or white)
 */
export function getContrastingColor(hex: string): string {
  return isLightColor(hex) ? '#000000' : '#ffffff';
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getColorLuminance(color1);
  const l2 = getColorLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standard
 */
export function meetsWcagAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if contrast ratio meets WCAG AAA standard
 */
export function meetsWcagAAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 7;
}

/**
 * Generate a color palette from a base color
 */
export function generateColorPalette(baseColor: string): string[] {
  return [
    lightenColor(baseColor, 80),
    lightenColor(baseColor, 60),
    lightenColor(baseColor, 40),
    lightenColor(baseColor, 20),
    baseColor,
    darkenColor(baseColor, 20),
    darkenColor(baseColor, 40),
    darkenColor(baseColor, 60),
    darkenColor(baseColor, 80),
  ];
}

/**
 * Count unique colors in SVG
 */
export function countUniqueColors(svg: string): number {
  const colors = extractColorsFromSvg(svg);
  const unique = new Set(colors.map(c => c.color));
  return unique.size;
}

/**
 * Check if SVG is monochrome (single color)
 */
export function isSvgMonochrome(svg: string): boolean {
  return countUniqueColors(svg) <= 1;
}

/**
 * Get dominant color in SVG (most used)
 */
export function getDominantColor(svg: string): string | null {
  const colors = extractColorsFromSvg(svg);
  if (colors.length === 0) return null;
  
  colors.sort((a, b) => b.count - a.count);
  return colors[0].color;
}

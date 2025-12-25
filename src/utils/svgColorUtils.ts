/**
 * SVG Color Utilities
 * Functions for detecting, extracting, and manipulating colors in SVG content
 */

/**
 * Color info extracted from SVG
 */
export interface SvgColorInfo {
  color: string;
  normalizedColor: string;
  fillCount: number;
  strokeCount: number;
  totalCount: number;
}

/**
 * Color replacement mapping
 */
export interface ColorReplacement {
  original: string;
  replacement: string;
}

/**
 * Named color to hex mapping (common web colors)
 */
export const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  navy: '#000080',
  teal: '#008080',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00ff00',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
  currentcolor: 'currentColor',
};

/**
 * Normalize a color value to hex format
 */
export function normalizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  
  const trimmed = color.trim().toLowerCase();
  
  // Handle special values
  if (trimmed === 'none' || trimmed === 'transparent' || trimmed === 'currentcolor') {
    return null;
  }
  
  // Handle named colors
  if (NAMED_COLORS[trimmed]) {
    return NAMED_COLORS[trimmed] === 'currentColor' ? null : NAMED_COLORS[trimmed];
  }
  
  // Handle hex colors
  if (trimmed.startsWith('#')) {
    // Expand 3-digit hex to 6-digit
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (trimmed.length === 7) {
      return trimmed;
    }
    return null;
  }
  
  // Handle rgb/rgba
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return rgbToHex(r, g, b);
  }
  
  // Handle hsl/hsla
  const hslMatch = trimmed.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10);
    const s = parseInt(hslMatch[2], 10);
    const l = parseInt(hslMatch[3], 10);
    return hslToHex(h, s, l);
  }
  
  return null;
}

/**
 * Convert RGB values to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeColor(hex);
  if (!normalized) return null;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!result) return null;
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
  
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  );
}

/**
 * Extract all colors from SVG content
 */
export function extractColorsFromSvg(svgContent: string): SvgColorInfo[] {
  const colorMap = new Map<string, { fills: number; strokes: number }>();
  
  // Match fill and stroke attributes
  const fillPattern = /fill=["']([^"']+)["']/gi;
  const strokePattern = /stroke=["']([^"']+)["']/gi;
  
  // Also check style attributes
  const stylePattern = /style=["']([^"']+)["']/gi;
  
  let match;
  
  // Extract fills
  while ((match = fillPattern.exec(svgContent)) !== null) {
    const normalized = normalizeColor(match[1]);
    if (normalized) {
      const existing = colorMap.get(normalized) || { fills: 0, strokes: 0 };
      existing.fills++;
      colorMap.set(normalized, existing);
    }
  }
  
  // Extract strokes
  while ((match = strokePattern.exec(svgContent)) !== null) {
    const normalized = normalizeColor(match[1]);
    if (normalized) {
      const existing = colorMap.get(normalized) || { fills: 0, strokes: 0 };
      existing.strokes++;
      colorMap.set(normalized, existing);
    }
  }
  
  // Extract from style attributes
  while ((match = stylePattern.exec(svgContent)) !== null) {
    const style = match[1];
    
    const styleFillMatch = style.match(/fill:\s*([^;]+)/i);
    if (styleFillMatch) {
      const normalized = normalizeColor(styleFillMatch[1]);
      if (normalized) {
        const existing = colorMap.get(normalized) || { fills: 0, strokes: 0 };
        existing.fills++;
        colorMap.set(normalized, existing);
      }
    }
    
    const styleStrokeMatch = style.match(/stroke:\s*([^;]+)/i);
    if (styleStrokeMatch) {
      const normalized = normalizeColor(styleStrokeMatch[1]);
      if (normalized) {
        const existing = colorMap.get(normalized) || { fills: 0, strokes: 0 };
        existing.strokes++;
        colorMap.set(normalized, existing);
      }
    }
  }
  
  return Array.from(colorMap.entries()).map(([color, counts]) => ({
    color,
    normalizedColor: color,
    fillCount: counts.fills,
    strokeCount: counts.strokes,
    totalCount: counts.fills + counts.strokes,
  }));
}

/**
 * Replace a color in SVG content
 */
export function replaceColorInSvg(svgContent: string, oldColor: string, newColor: string): string {
  const normalizedOld = normalizeColor(oldColor);
  if (!normalizedOld) return svgContent;
  
  let result = svgContent;
  
  // Create patterns for different color formats
  const patterns = [
    normalizedOld,
    oldColor,
  ];
  
  // Add 3-digit hex if applicable
  if (normalizedOld.length === 7) {
    const short = normalizedOld[1] + normalizedOld[3] + normalizedOld[5];
    if (normalizedOld === `#${normalizedOld[1]}${normalizedOld[1]}${normalizedOld[3]}${normalizedOld[3]}${normalizedOld[5]}${normalizedOld[5]}`) {
      patterns.push(`#${short}`);
    }
  }
  
  for (const pattern of patterns) {
    // Replace in fill attributes
    const fillRegex = new RegExp(`(fill=["'])${escapeRegex(pattern)}(["'])`, 'gi');
    result = result.replace(fillRegex, `$1${newColor}$2`);
    
    // Replace in stroke attributes
    const strokeRegex = new RegExp(`(stroke=["'])${escapeRegex(pattern)}(["'])`, 'gi');
    result = result.replace(strokeRegex, `$1${newColor}$2`);
    
    // Replace in style attributes
    const styleFillRegex = new RegExp(`(fill:\\s*)${escapeRegex(pattern)}`, 'gi');
    result = result.replace(styleFillRegex, `$1${newColor}`);
    
    const styleStrokeRegex = new RegExp(`(stroke:\\s*)${escapeRegex(pattern)}`, 'gi');
    result = result.replace(styleStrokeRegex, `$1${newColor}`);
  }
  
  return result;
}

/**
 * Replace all colors in SVG with a single color
 */
export function replaceAllColorsInSvg(svgContent: string, newColor: string): string {
  const colors = extractColorsFromSvg(svgContent);
  let result = svgContent;
  
  for (const colorInfo of colors) {
    result = replaceColorInSvg(result, colorInfo.color, newColor);
  }
  
  return result;
}

/**
 * Apply multiple color replacements to SVG
 */
export function applyColorReplacements(svgContent: string, replacements: ColorReplacement[]): string {
  let result = svgContent;
  
  for (const { original, replacement } of replacements) {
    result = replaceColorInSvg(result, original, replacement);
  }
  
  return result;
}

/**
 * Check if SVG is monochrome (has only one color)
 */
export function isSvgMonochrome(svgContent: string): boolean {
  const colors = extractColorsFromSvg(svgContent);
  return colors.length <= 1;
}

/**
 * Get primary color from SVG (most used color)
 */
export function getPrimaryColor(svgContent: string): string | null {
  const colors = extractColorsFromSvg(svgContent);
  if (colors.length === 0) return null;
  
  colors.sort((a, b) => b.totalCount - a.totalCount);
  return colors[0].color;
}

/**
 * Add fill color to SVG if none exists
 */
export function addFillToSvg(svgContent: string, color: string): string {
  const colors = extractColorsFromSvg(svgContent);
  
  // If already has colors, don't add
  if (colors.length > 0) {
    return svgContent;
  }
  
  // Add fill to the SVG root element
  return svgContent.replace(/<svg([^>]*)>/, `<svg$1 fill="${color}">`);
}

/**
 * Remove all fill and stroke colors from SVG
 */
export function removeColorsFromSvg(svgContent: string): string {
  let result = svgContent;
  
  // Remove fill attributes (except none)
  result = result.replace(/\s*fill=["'][^"']*["']/gi, (match) => {
    if (match.includes('none')) return match;
    return '';
  });
  
  // Remove stroke attributes (except none)
  result = result.replace(/\s*stroke=["'][^"']*["']/gi, (match) => {
    if (match.includes('none')) return match;
    return '';
  });
  
  return result;
}

/**
 * Calculate color contrast ratio
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 1;
  
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance
 */
export function getLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Check if a color is light
 */
export function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color);
  if (!rgb) return true;
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5;
}

/**
 * Get complementary color
 */
export function getComplementaryColor(color: string): string | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  
  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, percent: number): string | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  
  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, percent: number): string | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  
  const factor = 1 - percent / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

/**
 * Generate color variations for a base color
 */
export function generateColorVariations(baseColor: string): string[] {
  const variations: string[] = [baseColor];
  
  // Add lighter variations
  const light1 = lightenColor(baseColor, 20);
  const light2 = lightenColor(baseColor, 40);
  if (light1) variations.push(light1);
  if (light2) variations.push(light2);
  
  // Add darker variations
  const dark1 = darkenColor(baseColor, 20);
  const dark2 = darkenColor(baseColor, 40);
  if (dark1) variations.push(dark1);
  if (dark2) variations.push(dark2);
  
  // Add complementary
  const comp = getComplementaryColor(baseColor);
  if (comp) variations.push(comp);
  
  return variations;
}

/**
 * Escape string for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format color info for display
 */
export function formatColorInfo(info: SvgColorInfo): string {
  const details: string[] = [];
  if (info.fillCount > 0) {
    details.push(`${info.fillCount} fill${info.fillCount > 1 ? 's' : ''}`);
  }
  if (info.strokeCount > 0) {
    details.push(`${info.strokeCount} stroke${info.strokeCount > 1 ? 's' : ''}`);
  }
  return details.join(', ') || 'no uses';
}

/**
 * Sort colors by usage count
 */
export function sortColorsByUsage(colors: SvgColorInfo[]): SvgColorInfo[] {
  return [...colors].sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * Get unique colors from SVG
 */
export function getUniqueColors(svgContent: string): string[] {
  const colors = extractColorsFromSvg(svgContent);
  return colors.map(c => c.color);
}

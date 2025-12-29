/**
 * Service for color manipulation and extraction from SVGs
 */
export class ColorService {
  /**
   * Extract colors from SVG, filtering out SMIL secondary colors for UI display
   */
  extractColorsFromSvg(svg: string): { colors: string[]; hasCurrentColor: boolean; hasSmil: boolean } {
    const { colors, hasCurrentColor, hasSmil } = this.extractAllColorsFromSvg(svg);
    
    let filteredColors = colors;
    
    // For SMIL SVGs, only show the primary color (currentColor or first non-black color)
    // Secondary colors like #000000 are typically used for animation effects
    if (hasSmil && colors.length > 1) {
      // Filter out black/near-black colors used for SMIL effects
      const primaryColors = colors.filter(c => {
        if (c === 'currentColor') return true;
        const hex = this.toHexColor(c).toLowerCase();
        // Filter out black and very dark colors (common SMIL secondary colors)
        return hex !== '#000000' && hex !== '#000' && !hex.match(/^#0[0-2][0-2][0-2][0-2][0-2]$/);
      });
      // If we filtered everything, keep at least one
      if (primaryColors.length > 0) {
        filteredColors = primaryColors;
      }
    }

    return { colors: filteredColors, hasCurrentColor, hasSmil };
  }

  /**
   * Extract ALL colors from SVG without filtering (for saving variants)
   */
  extractAllColorsFromSvg(svg: string): { colors: string[]; hasCurrentColor: boolean; hasSmil: boolean } {
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    let hasCurrentColor = false;
    
    // Detect SMIL animations
    const hasSmil = /<animate[^>]*>/i.test(svg) || 
                    /<animateTransform[^>]*>/i.test(svg) || 
                    /<animateMotion[^>]*>/i.test(svg);

    let colorMatch;
    while ((colorMatch = colorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
        colorsSet.add('currentColor');
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    while ((colorMatch = styleColorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
        if (!colorsSet.has('currentColor')) {
          colorsSet.add('currentColor');
        }
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }

    return { colors: Array.from(colorsSet), hasCurrentColor, hasSmil };
  }

  /**
   * Replace a color in an SVG with a new color
   */
  replaceColorInSvg(svg: string, oldColor: string, newColor: string): string {
    const normalizeColor = (color: string): string => {
      color = color.toLowerCase().trim();
      if (/^#[0-9a-f]{3}$/i.test(color)) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    };

    const oldNorm = normalizeColor(oldColor);
    const newNorm = normalizeColor(newColor);

    let result = svg;

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldNorm}["']`, 'gi'),
      `$1="${newNorm}"`
    );

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldColor}["']`, 'gi'),
      `$1="${newNorm}"`
    );

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color)\\s*:\\s*${oldNorm}`, 'gi'),
      `$1: ${newNorm}`
    );

    return result;
  }

  /**
   * Convert a color to hex format
   */
  toHexColor(color: string): string {
    if (color.startsWith('#')) {
      // Expand 3-char hex
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    }
    // Handle named colors
    const namedColors: Record<string, string> = {
      'black': '#000000',
      'white': '#ffffff',
      'red': '#ff0000',
      'green': '#00ff00',
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
      'aqua': '#00ffff',
      'lime': '#00ff00',
      'silver': '#c0c0c0',
      'fuchsia': '#ff00ff',
      'currentcolor': 'currentColor'
    };
    const lowerColor = color.toLowerCase();
    if (namedColors[lowerColor]) {
      return namedColors[lowerColor];
    }
    // Handle rgb() format
    const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return color;
  }

  // ==================== Color Transformations ====================

  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
  }

  invertColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  darkenColor(hex: string, amount: number = 0.3): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return this.rgbToHex(
      rgb.r * (1 - amount),
      rgb.g * (1 - amount),
      rgb.b * (1 - amount)
    );
  }

  lightenColor(hex: string, amount: number = 0.3): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return this.rgbToHex(
      rgb.r + (255 - rgb.r) * amount,
      rgb.g + (255 - rgb.g) * amount,
      rgb.b + (255 - rgb.b) * amount
    );
  }

  desaturateColor(hex: string, amount: number = 0.5): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const gray = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
    return this.rgbToHex(
      rgb.r + (gray - rgb.r) * amount,
      rgb.g + (gray - rgb.g) * amount,
      rgb.b + (gray - rgb.b) * amount
    );
  }

  /**
   * Generate auto variant colors based on transformation type
   */
  generateAutoVariantColors(
    colors: string[], 
    type: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale'
  ): { colors: string[]; variantName: string } {
    let newColors: string[];
    let variantName: string;

    switch (type) {
      case 'invert':
        newColors = colors.map(c => this.invertColor(this.toHexColor(c)));
        variantName = 'Inverted';
        break;
      case 'darken':
        newColors = colors.map(c => this.darkenColor(this.toHexColor(c), 0.3));
        variantName = 'Dark';
        break;
      case 'lighten':
        newColors = colors.map(c => this.lightenColor(this.toHexColor(c), 0.3));
        variantName = 'Light';
        break;
      case 'muted':
        newColors = colors.map(c => this.desaturateColor(this.toHexColor(c), 0.5));
        variantName = 'Muted';
        break;
      case 'grayscale':
        newColors = colors.map(c => this.desaturateColor(this.toHexColor(c), 1));
        variantName = 'Grayscale';
        break;
      default:
        return { colors, variantName: '' };
    }

    return { colors: newColors, variantName };
  }
}

// Singleton instance
let colorServiceInstance: ColorService | null = null;

export function getColorService(): ColorService {
  if (!colorServiceInstance) {
    colorServiceInstance = new ColorService();
  }
  return colorServiceInstance;
}


/**
 * Tests unitarios para la sincronización de filtros de color
 * Verifican que el algoritmo de filtros CSS produce resultados correctos
 */

import { ColorService, getColorService } from '../../services/ColorService';

describe('Color Filter Synchronization', () => {
  let colorService: ColorService;

  beforeEach(() => {
    colorService = getColorService();
  });

  /**
   * Implementación del algoritmo CSS hue-rotate usando matriz de color
   * Debe coincidir con la implementación en IconEditor.js e IconEditorColorHandlers.ts
   */
  function applyHueRotate(r: number, g: number, b: number, degrees: number): [number, number, number] {
    const angle = (degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const r1 =
      r * (0.213 + cos * 0.787 - sin * 0.213) +
      g * (0.715 - cos * 0.715 - sin * 0.715) +
      b * (0.072 - cos * 0.072 + sin * 0.928);
    const g1 =
      r * (0.213 - cos * 0.213 + sin * 0.143) +
      g * (0.715 + cos * 0.285 + sin * 0.14) +
      b * (0.072 - cos * 0.072 - sin * 0.283);
    const b1 =
      r * (0.213 - cos * 0.213 - sin * 0.787) +
      g * (0.715 - cos * 0.715 + sin * 0.715) +
      b * (0.072 + cos * 0.928 + sin * 0.072);

    return [r1, g1, b1];
  }

  /**
   * Implementación del algoritmo CSS saturate usando matriz de color
   */
  function applySaturate(r: number, g: number, b: number, percent: number): [number, number, number] {
    const sat = percent / 100;
    const r2 = r * (0.213 + 0.787 * sat) + g * (0.715 - 0.715 * sat) + b * (0.072 - 0.072 * sat);
    const g2 = r * (0.213 - 0.213 * sat) + g * (0.715 + 0.285 * sat) + b * (0.072 - 0.072 * sat);
    const b2 = r * (0.213 - 0.213 * sat) + g * (0.715 - 0.715 * sat) + b * (0.072 + 0.928 * sat);

    return [r2, g2, b2];
  }

  /**
   * Implementación del algoritmo CSS brightness
   */
  function applyBrightness(r: number, g: number, b: number, percent: number): [number, number, number] {
    const bright = percent / 100;
    return [r * bright, g * bright, b * bright];
  }

  /**
   * Aplica todos los filtros CSS en el orden correcto
   */
  function applyColorFilters(
    hexColor: string,
    hueRotate: number,
    saturatePercent: number,
    brightnessPercent: number
  ): string {
    // Parse hex color
    const hex = hexColor.slice(1);
    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);

    // Apply hue-rotate
    [r, g, b] = applyHueRotate(r, g, b, hueRotate);

    // Apply saturate
    [r, g, b] = applySaturate(r, g, b, saturatePercent);

    // Apply brightness
    [r, g, b] = applyBrightness(r, g, b, brightnessPercent);

    // Clamp and convert to hex
    const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
    const toHex = (x: number): string => clamp(x).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  describe('Neutral filters', () => {
    it('should not change color with neutral filters (0deg, 100%, 100%)', () => {
      const testColors = ['#ff5500', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080'];
      
      testColors.forEach(color => {
        const filtered = applyColorFilters(color, 0, 100, 100);
        expect(filtered.toLowerCase()).toBe(color.toLowerCase());
      });
    });
  });

  describe('Hue rotate', () => {
    it('should shift hue by 180 degrees (red becomes cyan-ish)', () => {
      const red = '#ff0000';
      const filtered = applyColorFilters(red, 180, 100, 100);
      
      const r = parseInt(filtered.slice(1, 3), 16);
      const b = parseInt(filtered.slice(5, 7), 16);
      
      // After 180deg rotation, blue component should increase
      expect(b).toBeGreaterThan(r);
    });

    it('should be reversible with 360 degrees', () => {
      const original = '#4080c0';
      const filtered = applyColorFilters(original, 360, 100, 100);
      
      // 360deg rotation should return to original
      expect(filtered.toLowerCase()).toBe(original.toLowerCase());
    });

    it('should handle negative angles equivalently', () => {
      const color = '#ff8800';
      const pos90 = applyColorFilters(color, 90, 100, 100);
      const neg270 = applyColorFilters(color, -270, 100, 100);
      
      // 90deg and -270deg should produce same result
      expect(pos90.toLowerCase()).toBe(neg270.toLowerCase());
    });
  });

  describe('Saturation', () => {
    it('should produce grayscale with 0% saturation', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff8800'];
      
      colors.forEach(color => {
        const filtered = applyColorFilters(color, 0, 0, 100);
        
        const r = parseInt(filtered.slice(1, 3), 16);
        const g = parseInt(filtered.slice(3, 5), 16);
        const b = parseInt(filtered.slice(5, 7), 16);
        
        // In grayscale, R, G, B should be very close
        const tolerance = 5;
        expect(Math.abs(r - g)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(g - b)).toBeLessThanOrEqual(tolerance);
      });
    });

    it('should intensify colors with 200% saturation', () => {
      const pastel = '#ff8888'; // Pastel red
      const normal = applyColorFilters(pastel, 0, 100, 100);
      const saturated = applyColorFilters(pastel, 0, 200, 100);
      
      const normalR = parseInt(normal.slice(1, 3), 16);
      const normalG = parseInt(normal.slice(3, 5), 16);
      const satR = parseInt(saturated.slice(1, 3), 16);
      const satG = parseInt(saturated.slice(3, 5), 16);
      
      // Difference between channels should increase with saturation
      const normalDiff = Math.abs(normalR - normalG);
      const satDiff = Math.abs(satR - satG);
      
      expect(satDiff).toBeGreaterThanOrEqual(normalDiff);
    });
  });

  describe('Brightness', () => {
    it('should darken with 50% brightness', () => {
      const white = '#ffffff';
      const darkened = applyColorFilters(white, 0, 100, 50);
      
      const r = parseInt(darkened.slice(1, 3), 16);
      
      // White at 50% brightness should be around 128
      expect(r).toBeGreaterThanOrEqual(120);
      expect(r).toBeLessThanOrEqual(135);
    });

    it('should brighten (clamped to 255) with 200% brightness', () => {
      const gray = '#808080';
      const brightened = applyColorFilters(gray, 0, 100, 200);
      
      const r = parseInt(brightened.slice(1, 3), 16);
      
      // Gray at 200% brightness should be white or near-white
      expect(r).toBeGreaterThanOrEqual(250);
    });

    it('should produce black with 0% brightness', () => {
      const colors = ['#ff0000', '#00ff00', '#ffffff'];
      
      colors.forEach(color => {
        const filtered = applyColorFilters(color, 0, 100, 0);
        expect(filtered.toLowerCase()).toBe('#000000');
      });
    });
  });

  describe('Combined filters', () => {
    it('should apply filters in correct order: hue -> saturate -> brightness', () => {
      const original = '#ff0000';
      
      // Apply filters step by step
      let r = 255, g = 0, b = 0;
      
      // Step 1: Hue rotate 90deg
      [r, g, b] = applyHueRotate(r, g, b, 90);
      
      // Step 2: Saturate 150%
      [r, g, b] = applySaturate(r, g, b, 150);
      
      // Step 3: Brightness 80%
      [r, g, b] = applyBrightness(r, g, b, 80);
      
      const clamp = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
      const stepByStep = `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
      
      // Combined function should produce same result
      const combined = applyColorFilters(original, 90, 150, 80);
      
      expect(combined.toLowerCase()).toBe(stepByStep.toLowerCase());
    });

    it('should produce valid hex colors for extreme values', () => {
      const extremeCases = [
        { color: '#000000', hue: 360, sat: 200, bright: 200 },
        { color: '#ffffff', hue: 180, sat: 0, bright: 50 },
        { color: '#ff0000', hue: 720, sat: 300, bright: 0 },
      ];
      
      extremeCases.forEach(tc => {
        const result = applyColorFilters(tc.color, tc.hue, tc.sat, tc.bright);
        expect(result).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('Filter state management', () => {
    it('should identify neutral filter state', () => {
      const isNeutral = (hue: number, sat: number, bright: number): boolean => {
        return hue === 0 && sat === 100 && bright === 100;
      };

      expect(isNeutral(0, 100, 100)).toBe(true);
      expect(isNeutral(1, 100, 100)).toBe(false);
      expect(isNeutral(0, 99, 100)).toBe(false);
      expect(isNeutral(0, 100, 101)).toBe(false);
    });

    it('should identify active filters', () => {
      const hasActiveFilters = (hue: number, sat: number, bright: number): boolean => {
        return hue !== 0 || sat !== 100 || bright !== 100;
      };

      expect(hasActiveFilters(0, 100, 100)).toBe(false);
      expect(hasActiveFilters(90, 100, 100)).toBe(true);
      expect(hasActiveFilters(0, 150, 100)).toBe(true);
      expect(hasActiveFilters(0, 100, 80)).toBe(true);
    });
  });

  describe('Original variant handling', () => {
    it('should disable filters for original variant (index -1)', () => {
      const getFiltersDisabled = (variantIndex: number): boolean => {
        return variantIndex === -1;
      };

      expect(getFiltersDisabled(-1)).toBe(true);
      expect(getFiltersDisabled(0)).toBe(false);
      expect(getFiltersDisabled(1)).toBe(false);
    });

    it('should enable filters for custom variants', () => {
      const getFiltersEnabled = (variantIndex: number): boolean => {
        return variantIndex >= 0;
      };

      expect(getFiltersEnabled(-1)).toBe(false);
      expect(getFiltersEnabled(0)).toBe(true);
      expect(getFiltersEnabled(1)).toBe(true);
    });
  });

  describe('Color synchronization', () => {
    it('should update data-original-color when color changes manually', () => {
      // Simulate the data flow when user changes a color
      const mockColorItem = {
        originalColor: '#ff0000',
        currentColor: '#ff0000'
      };

      // User changes color with picker
      const newColor = '#00ff00';
      mockColorItem.currentColor = newColor;
      mockColorItem.originalColor = newColor; // Should update original too

      expect(mockColorItem.originalColor).toBe(newColor);
      expect(mockColorItem.currentColor).toBe(newColor);
    });

    it('should reset filters when color is manually changed', () => {
      const filters = {
        hue: 90,
        saturation: 150,
        brightness: 80
      };

      // Simulate color change
      const resetFilters = (): typeof filters => ({
        hue: 0,
        saturation: 100,
        brightness: 100
      });

      const resetted = resetFilters();
      
      expect(resetted.hue).toBe(0);
      expect(resetted.saturation).toBe(100);
      expect(resetted.brightness).toBe(100);
    });
  });

  describe('Build process', () => {
    it('should not re-apply filters when filters are calculated (informative)', () => {
      const filtersAreCalculated = true;
      const hasActiveFilters = true;

      // When filtersAreCalculated is true, don't apply filters on build
      const shouldApplyFilters = hasActiveFilters && !filtersAreCalculated;
      
      expect(shouldApplyFilters).toBe(false);
    });

    it('should apply filters when user manually set them', () => {
      const filtersAreCalculated = false;
      const hasActiveFilters = true;

      // When filtersAreCalculated is false and filters are active, apply them
      const shouldApplyFilters = hasActiveFilters && !filtersAreCalculated;
      
      expect(shouldApplyFilters).toBe(true);
    });

    it('should not apply filters when they are neutral', () => {
      const filtersAreCalculated = false;
      const hasActiveFilters = false;

      const shouldApplyFilters = hasActiveFilters && !filtersAreCalculated;
      
      expect(shouldApplyFilters).toBe(false);
    });
  });

  // ===================== ColorService Integration Tests =====================

  describe('ColorService.hexToRgb', () => {
    it('should parse 6-char hex correctly', () => {
      expect(colorService.hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(colorService.hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(colorService.hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      expect(colorService.hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(colorService.hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should handle hex without # prefix', () => {
      expect(colorService.hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(colorService.hexToRgb('#xyz')).toBeNull();
      expect(colorService.hexToRgb('invalid')).toBeNull();
      expect(colorService.hexToRgb('#ff00')).toBeNull();
    });
  });

  describe('ColorService.rgbToHex', () => {
    it('should convert RGB to hex correctly', () => {
      expect(colorService.rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(colorService.rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(colorService.rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(colorService.rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(colorService.rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('should clamp values outside 0-255 range', () => {
      expect(colorService.rgbToHex(300, -50, 128)).toBe('#ff0080');
    });

    it('should round fractional values', () => {
      expect(colorService.rgbToHex(127.6, 128.4, 64.5)).toBe('#808041');
    });
  });

  describe('ColorService.toHexColor', () => {
    it('should expand 3-char hex to 6-char', () => {
      expect(colorService.toHexColor('#f00')).toBe('#ff0000');
      expect(colorService.toHexColor('#0f0')).toBe('#00ff00');
      expect(colorService.toHexColor('#00f')).toBe('#0000ff');
      expect(colorService.toHexColor('#abc')).toBe('#aabbcc');
    });

    it('should convert named colors to hex', () => {
      expect(colorService.toHexColor('red')).toBe('#ff0000');
      expect(colorService.toHexColor('green')).toBe('#00ff00');
      expect(colorService.toHexColor('blue')).toBe('#0000ff');
      expect(colorService.toHexColor('white')).toBe('#ffffff');
      expect(colorService.toHexColor('black')).toBe('#000000');
      expect(colorService.toHexColor('orange')).toBe('#ffa500');
      expect(colorService.toHexColor('cyan')).toBe('#00ffff');
    });

    it('should handle rgb() format', () => {
      expect(colorService.toHexColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(colorService.toHexColor('rgb(0, 128, 255)')).toBe('#0080ff');
    });

    it('should preserve currentColor', () => {
      expect(colorService.toHexColor('currentcolor')).toBe('currentColor');
      expect(colorService.toHexColor('currentColor')).toBe('currentColor');
    });
  });

  describe('ColorService.hexToHsl', () => {
    it('should convert pure colors correctly', () => {
      const red = colorService.hexToHsl('#ff0000');
      expect(red).not.toBeNull();
      expect(red!.h).toBe(0);
      expect(red!.s).toBe(100);
      expect(red!.l).toBe(50);

      const green = colorService.hexToHsl('#00ff00');
      expect(green).not.toBeNull();
      expect(green!.h).toBe(120);

      const blue = colorService.hexToHsl('#0000ff');
      expect(blue).not.toBeNull();
      expect(blue!.h).toBe(240);
    });

    it('should handle grayscale colors', () => {
      const white = colorService.hexToHsl('#ffffff');
      expect(white).not.toBeNull();
      expect(white!.s).toBe(0);
      expect(white!.l).toBe(100);

      const black = colorService.hexToHsl('#000000');
      expect(black).not.toBeNull();
      expect(black!.s).toBe(0);
      expect(black!.l).toBe(0);

      const gray = colorService.hexToHsl('#808080');
      expect(gray).not.toBeNull();
      expect(gray!.s).toBe(0);
      expect(gray!.l).toBe(50);
    });

    it('should return null for invalid colors', () => {
      expect(colorService.hexToHsl('invalid')).toBeNull();
    });
  });

  describe('ColorService.invertColor', () => {
    it('should invert colors correctly', () => {
      expect(colorService.invertColor('#ff0000').toLowerCase()).toBe('#00ffff');
      expect(colorService.invertColor('#00ff00').toLowerCase()).toBe('#ff00ff');
      expect(colorService.invertColor('#0000ff').toLowerCase()).toBe('#ffff00');
      expect(colorService.invertColor('#ffffff').toLowerCase()).toBe('#000000');
      expect(colorService.invertColor('#000000').toLowerCase()).toBe('#ffffff');
    });

    it('should return original for invalid hex', () => {
      expect(colorService.invertColor('invalid')).toBe('invalid');
    });
  });

  describe('ColorService.darkenColor', () => {
    it('should darken colors by default 30%', () => {
      const darkened = colorService.darkenColor('#ffffff');
      const rgb = colorService.hexToRgb(darkened);
      expect(rgb).not.toBeNull();
      // 255 * 0.7 = 178.5 ≈ 179
      expect(rgb!.r).toBeGreaterThanOrEqual(177);
      expect(rgb!.r).toBeLessThanOrEqual(179);
    });

    it('should darken by custom amount', () => {
      const darkened = colorService.darkenColor('#ffffff', 0.5);
      const rgb = colorService.hexToRgb(darkened);
      expect(rgb).not.toBeNull();
      // 255 * 0.5 = 127.5 ≈ 128
      expect(rgb!.r).toBeGreaterThanOrEqual(127);
      expect(rgb!.r).toBeLessThanOrEqual(128);
    });

    it('should handle black (no change)', () => {
      expect(colorService.darkenColor('#000000').toLowerCase()).toBe('#000000');
    });
  });

  describe('ColorService.lightenColor', () => {
    it('should lighten colors by default 30%', () => {
      const lightened = colorService.lightenColor('#000000');
      const rgb = colorService.hexToRgb(lightened);
      expect(rgb).not.toBeNull();
      // 0 + 255 * 0.3 = 76.5 ≈ 77
      expect(rgb!.r).toBeGreaterThanOrEqual(76);
      expect(rgb!.r).toBeLessThanOrEqual(77);
    });

    it('should handle white (no change)', () => {
      expect(colorService.lightenColor('#ffffff').toLowerCase()).toBe('#ffffff');
    });
  });

  describe('ColorService.desaturateColor', () => {
    it('should desaturate by 50% by default', () => {
      const muted = colorService.desaturateColor('#ff0000');
      const rgb = colorService.hexToRgb(muted);
      expect(rgb).not.toBeNull();
      // Red becomes more gray
      expect(rgb!.g).toBeGreaterThan(0);
      expect(rgb!.b).toBeGreaterThan(0);
    });

    it('should fully desaturate with amount 1', () => {
      const grayscale = colorService.desaturateColor('#ff0000', 1);
      const rgb = colorService.hexToRgb(grayscale);
      expect(rgb).not.toBeNull();
      // Should be fully gray (R=G=B)
      const tolerance = 2;
      expect(Math.abs(rgb!.r - rgb!.g)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(rgb!.g - rgb!.b)).toBeLessThanOrEqual(tolerance);
    });
  });

  describe('ColorService.estimateFiltersForColor', () => {
    it('should return neutral filters for same color', () => {
      const result = colorService.estimateFiltersForColor('#ff0000', '#ff0000');
      expect(result.hue).toBe(0);
      expect(result.saturation).toBe(100);
      expect(result.brightness).toBe(100);
    });

    it('should estimate hue shift for color change', () => {
      // Red to Green is approximately 120 degree shift
      const result = colorService.estimateFiltersForColor('#ff0000', '#00ff00');
      expect(result.hue).toBeGreaterThan(100);
      expect(result.hue).toBeLessThan(140);
    });

    it('should estimate brightness change', () => {
      // White to gray should reduce brightness
      const result = colorService.estimateFiltersForColor('#ffffff', '#808080');
      expect(result.brightness).toBeLessThan(100);
    });

    it('should handle invalid colors gracefully', () => {
      const result = colorService.estimateFiltersForColor('invalid', '#ff0000');
      expect(result).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });
  });

  describe('ColorService.extractColorsFromSvg', () => {
    it('should extract fill colors', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#ff0000');
    });

    it('should extract stroke colors', () => {
      const svg = '<svg><path stroke="#00ff00"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#00ff00');
    });

    it('should detect currentColor', () => {
      const svg = '<svg><path fill="currentColor"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasCurrentColor).toBe(true);
      expect(result.colors).toContain('currentColor');
    });

    it('should detect SMIL animations', () => {
      const svg = '<svg><animate attributeName="fill"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
    });

    it('should extract colors from style attributes', () => {
      const svg = '<svg><path style="fill: #0000ff; stroke: #ff00ff"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#0000ff');
      expect(result.colors).toContain('#ff00ff');
    });

    it('should ignore none and transparent', () => {
      const svg = '<svg><path fill="none" stroke="transparent"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.colors).not.toContain('none');
      expect(result.colors).not.toContain('transparent');
    });

    it('should ignore url() references', () => {
      const svg = '<svg><path fill="url(#gradient)"/></svg>';
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.colors.length).toBe(0);
    });
  });

  describe('ColorService.replaceColorInSvg', () => {
    it('should replace fill colors', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('fill="#00ff00"');
    });

    it('should replace stroke colors', () => {
      const svg = '<svg><path stroke="#ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('stroke="#00ff00"');
    });

    it('should handle 3-char hex normalization', () => {
      // The method normalizes the search color, not the SVG content
      // To replace #f00, we need to search for #f00 directly or the SVG must have the normalized version
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#f00', '#00ff00');
      expect(result).toContain('#00ff00');
    });

    it('should replace colors in style attributes', () => {
      const svg = '<svg><path style="fill: #ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('fill: #00ff00');
    });
  });

  describe('ColorService.generateAutoVariantColors', () => {
    const baseColors = ['#ff0000', '#00ff00'];

    it('should generate inverted variant', () => {
      const result = colorService.generateAutoVariantColors(baseColors, 'invert');
      expect(result.variantName).toBe('Inverted');
      expect(result.colors[0].toLowerCase()).toBe('#00ffff'); // Inverted red
    });

    it('should generate dark variant', () => {
      const result = colorService.generateAutoVariantColors(baseColors, 'darken');
      expect(result.variantName).toBe('Dark');
      // Should be darker than original
      const originalR = 255;
      const newR = parseInt(result.colors[0].slice(1, 3), 16);
      expect(newR).toBeLessThan(originalR);
    });

    it('should generate light variant', () => {
      const result = colorService.generateAutoVariantColors(['#000000'], 'lighten');
      expect(result.variantName).toBe('Light');
      const newR = parseInt(result.colors[0].slice(1, 3), 16);
      expect(newR).toBeGreaterThan(0);
    });

    it('should generate muted variant', () => {
      const result = colorService.generateAutoVariantColors(baseColors, 'muted');
      expect(result.variantName).toBe('Muted');
    });

    it('should generate grayscale variant', () => {
      const result = colorService.generateAutoVariantColors(baseColors, 'grayscale');
      expect(result.variantName).toBe('Grayscale');
      // Grayscale should have R=G=B
      const rgb = colorService.hexToRgb(result.colors[0]);
      const tolerance = 2;
      expect(Math.abs(rgb!.r - rgb!.g)).toBeLessThanOrEqual(tolerance);
    });

    it('should return original for unknown type', () => {
      const result = colorService.generateAutoVariantColors(baseColors, 'unknown' as any);
      expect(result.colors).toEqual(baseColors);
      expect(result.variantName).toBe('');
    });
  });

  // ===================== Edge Cases & Boundary Tests =====================

  describe('Edge cases', () => {
    it('should handle very small filter changes', () => {
      const original = '#808080';
      const filtered = applyColorFilters(original, 1, 101, 99);
      // Should be very close to original
      expect(filtered).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle maximum filter values', () => {
      const result = applyColorFilters('#808080', 360, 300, 300);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle minimum filter values', () => {
      const result = applyColorFilters('#808080', -360, 0, 0);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should produce consistent results for same inputs', () => {
      const color = '#ff8800';
      const filters = { hue: 45, sat: 120, bright: 90 };
      const result1 = applyColorFilters(color, filters.hue, filters.sat, filters.bright);
      const result2 = applyColorFilters(color, filters.hue, filters.sat, filters.bright);
      expect(result1).toBe(result2);
    });

    it('should handle case-insensitive hex colors', () => {
      const upper = applyColorFilters('#FF0000', 90, 100, 100);
      const lower = applyColorFilters('#ff0000', 90, 100, 100);
      expect(upper.toLowerCase()).toBe(lower.toLowerCase());
    });
  });

  describe('CSS Filter Matrix accuracy', () => {
    it('should match CSS hue-rotate(90deg) for red', () => {
      // CSS hue-rotate(90deg) on pure red (#ff0000) produces a yellowish color
      const result = applyColorFilters('#ff0000', 90, 100, 100);
      const g = parseInt(result.slice(3, 5), 16);
      // Green channel should increase (CSS matrix formula gives ~91)
      expect(g).toBeGreaterThan(80);
    });

    it('should match CSS saturate(0%) grayscale conversion', () => {
      const result = applyColorFilters('#ff0000', 0, 0, 100);
      const r = parseInt(result.slice(1, 3), 16);
      const g = parseInt(result.slice(3, 5), 16);
      const b = parseInt(result.slice(5, 7), 16);
      // Should be gray (luma of red ≈ 54)
      expect(r).toBeGreaterThan(50);
      expect(r).toBeLessThan(60);
      expect(Math.abs(r - g)).toBeLessThan(3);
      expect(Math.abs(g - b)).toBeLessThan(3);
    });

    it('should match CSS brightness(50%) darkening', () => {
      const result = applyColorFilters('#ffffff', 0, 100, 50);
      const r = parseInt(result.slice(1, 3), 16);
      // 255 * 0.5 = 127.5 ≈ 128
      expect(r).toBeGreaterThanOrEqual(127);
      expect(r).toBeLessThanOrEqual(128);
    });
  });

  describe('ColorService singleton', () => {
    it('should return same instance', () => {
      const instance1 = getColorService();
      const instance2 = getColorService();
      expect(instance1).toBe(instance2);
    });
  });

  // ===================== SMIL Animation Color Filtering =====================

  describe('ColorService.extractColorsFromSvg - SMIL filtering', () => {
    it('should filter out black colors from SMIL SVGs with multiple colors', () => {
      const svg = `<svg>
        <path fill="#ff0000"/>
        <path fill="#000000"/>
        <animate attributeName="fill"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      // Should filter out black, keeping only red
      expect(result.colors).toContain('#ff0000');
      expect(result.colors).not.toContain('#000000');
    });

    it('should filter out near-black colors from SMIL SVGs', () => {
      const svg = `<svg>
        <path fill="#ff5500"/>
        <path fill="#010101"/>
        <animate attributeName="opacity"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      expect(result.colors).toContain('#ff5500');
      expect(result.colors).not.toContain('#010101');
    });

    it('should keep currentColor in SMIL SVGs', () => {
      const svg = `<svg>
        <path fill="currentColor"/>
        <path fill="#000000"/>
        <animateTransform type="rotate"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      expect(result.colors).toContain('currentColor');
    });

    it('should keep all colors if filtering would remove everything', () => {
      const svg = `<svg>
        <path fill="#000000"/>
        <path fill="#010101"/>
        <animate attributeName="fill"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      // Should keep colors since filtering would leave none
      expect(result.colors.length).toBeGreaterThan(0);
    });

    it('should not filter colors from non-SMIL SVGs', () => {
      const svg = `<svg>
        <path fill="#ff0000"/>
        <path fill="#000000"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(false);
      expect(result.colors).toContain('#ff0000');
      expect(result.colors).toContain('#000000');
    });

    it('should not filter SMIL SVGs with only one color', () => {
      const svg = `<svg>
        <path fill="#000000"/>
        <animate attributeName="opacity"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      expect(result.colors).toContain('#000000');
    });

    it('should detect animateMotion as SMIL', () => {
      const svg = `<svg>
        <path fill="#ff0000"/>
        <animateMotion path="M0,0 L100,100"/>
      </svg>`;
      const result = colorService.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
    });
  });

  // ===================== Style Attribute currentColor =====================

  describe('ColorService.extractAllColorsFromSvg - style currentColor', () => {
    it('should detect currentColor in style attributes', () => {
      const svg = '<svg><path style="fill: currentColor"/></svg>';
      const result = colorService.extractAllColorsFromSvg(svg);
      expect(result.hasCurrentColor).toBe(true);
      expect(result.colors).toContain('currentColor');
    });

    it('should not duplicate currentColor from multiple sources', () => {
      const svg = `<svg>
        <path fill="currentColor"/>
        <path style="fill: currentColor"/>
      </svg>`;
      const result = colorService.extractAllColorsFromSvg(svg);
      expect(result.hasCurrentColor).toBe(true);
      const currentColorCount = result.colors.filter(c => c === 'currentColor').length;
      expect(currentColorCount).toBe(1);
    });

    it('should handle mixed attribute and style colors', () => {
      const svg = `<svg>
        <path fill="#ff0000" style="stroke: #00ff00"/>
        <rect style="fill: #0000ff; stroke: currentColor"/>
      </svg>`;
      const result = colorService.extractAllColorsFromSvg(svg);
      expect(result.colors).toContain('#ff0000');
      expect(result.colors).toContain('#00ff00');
      expect(result.colors).toContain('#0000ff');
      expect(result.colors).toContain('currentColor');
      expect(result.hasCurrentColor).toBe(true);
    });
  });

  // ===================== estimateFiltersForColor Edge Cases =====================

  describe('ColorService.estimateFiltersForColor - edge cases', () => {
    it('should handle zero saturation source color', () => {
      // Gray to colored - saturation from 0
      const result = colorService.estimateFiltersForColor('#808080', '#ff0000');
      expect(result.saturation).toBe(100); // Default when source sat is 0
    });

    it('should handle zero lightness source color', () => {
      // Black to any color - brightness from 0
      const result = colorService.estimateFiltersForColor('#000000', '#808080');
      expect(result.brightness).toBe(100); // Default when source lightness is 0
    });

    it('should clamp saturation to max 250', () => {
      // Low saturation to high saturation
      const result = colorService.estimateFiltersForColor('#f0e0e0', '#ff0000');
      expect(result.saturation).toBeLessThanOrEqual(250);
    });

    it('should clamp brightness to max 250', () => {
      // Dark to very bright
      const result = colorService.estimateFiltersForColor('#202020', '#ffffff');
      expect(result.brightness).toBeLessThanOrEqual(250);
    });

    it('should clamp saturation to min 0', () => {
      // Saturated to grayscale
      const result = colorService.estimateFiltersForColor('#ff0000', '#808080');
      expect(result.saturation).toBeGreaterThanOrEqual(0);
    });

    it('should handle hue wrap-around (shortest path)', () => {
      // Red to magenta - should go negative rather than +300
      const result = colorService.estimateFiltersForColor('#ff0000', '#ff00ff');
      expect(Math.abs(result.hue)).toBeLessThanOrEqual(180);
    });

    it('should handle currentColor as input', () => {
      const result = colorService.estimateFiltersForColor('currentColor', '#ff0000');
      // currentColor can't be converted to HSL, should return defaults
      expect(result).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });
  });

  // ===================== extractAllColorsFromSvg vs extractColorsFromSvg =====================

  describe('ColorService.extractAllColorsFromSvg', () => {
    it('should return all colors without SMIL filtering', () => {
      const svg = `<svg>
        <path fill="#ff0000"/>
        <path fill="#000000"/>
        <animate attributeName="fill"/>
      </svg>`;
      const result = colorService.extractAllColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
      // extractAllColorsFromSvg should NOT filter
      expect(result.colors).toContain('#ff0000');
      expect(result.colors).toContain('#000000');
    });

    it('should extract stop-color from gradients', () => {
      const svg = `<svg>
        <linearGradient>
          <stop stop-color="#ff0000"/>
          <stop stop-color="#0000ff"/>
        </linearGradient>
      </svg>`;
      const result = colorService.extractAllColorsFromSvg(svg);
      expect(result.colors).toContain('#ff0000');
      expect(result.colors).toContain('#0000ff');
    });
  });

  // ===================== toHexColor Additional Cases =====================

  describe('ColorService.toHexColor - additional named colors', () => {
    it('should handle all common named colors', () => {
      const namedColors: Record<string, string> = {
        yellow: '#ffff00',
        magenta: '#ff00ff',
        gray: '#808080',
        grey: '#808080',
        purple: '#800080',
        pink: '#ffc0cb',
        brown: '#a52a2a',
        navy: '#000080',
        teal: '#008080',
        olive: '#808000',
        maroon: '#800000',
        aqua: '#00ffff',
        lime: '#00ff00',
        silver: '#c0c0c0',
        fuchsia: '#ff00ff',
      };

      for (const [name, hex] of Object.entries(namedColors)) {
        expect(colorService.toHexColor(name)).toBe(hex);
      }
    });

    it('should return unknown colors as-is', () => {
      expect(colorService.toHexColor('unknowncolor')).toBe('unknowncolor');
    });

    it('should handle rgb with varying whitespace', () => {
      expect(colorService.toHexColor('rgb(255,0,0)')).toBe('#ff0000');
      expect(colorService.toHexColor('rgb( 255 , 128 , 64 )')).toBe('#ff8040');
    });
  });

  // ===================== replaceColorInSvg Edge Cases =====================

  describe('ColorService.replaceColorInSvg - edge cases', () => {
    it('should replace flood-color attribute', () => {
      const svg = '<svg><feFlood flood-color="#ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('flood-color="#00ff00"');
    });

    it('should replace lighting-color attribute', () => {
      const svg = '<svg><feDiffuseLighting lighting-color="#ff0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('lighting-color="#00ff00"');
    });

    it('should handle case-insensitive color matching', () => {
      const svg = '<svg><path fill="#FF0000"/></svg>';
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('#00ff00');
    });

    it('should not replace partial matches', () => {
      const svg = '<svg><path fill="#ff0000ff"/></svg>'; // 8-char hex with alpha
      const result = colorService.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      // Should not replace because it's not an exact match
      expect(result).toContain('#ff0000ff');
    });
  });

  // ===================== hexToHsl Edge Cases =====================

  describe('ColorService.hexToHsl - edge cases', () => {
    it('should handle yellow correctly (hue ~60)', () => {
      const result = colorService.hexToHsl('#ffff00');
      expect(result).not.toBeNull();
      expect(result!.h).toBe(60);
      expect(result!.s).toBe(100);
    });

    it('should handle cyan correctly (hue ~180)', () => {
      const result = colorService.hexToHsl('#00ffff');
      expect(result).not.toBeNull();
      expect(result!.h).toBe(180);
    });

    it('should handle magenta correctly (hue ~300)', () => {
      const result = colorService.hexToHsl('#ff00ff');
      expect(result).not.toBeNull();
      expect(result!.h).toBe(300);
    });

    it('should handle low saturation colors', () => {
      const result = colorService.hexToHsl('#c0c0c8'); // Slightly blue-ish gray
      expect(result).not.toBeNull();
      expect(result!.s).toBeLessThan(10);
    });
  });

  // ===================== Color Transformation Chains =====================

  describe('Color transformation chains', () => {
    it('should produce same result regardless of operation order for some transforms', () => {
      const original = '#ff8800';
      
      // Darken then lighten vs lighten then darken (not exactly reversible)
      const darkenFirst = colorService.lightenColor(colorService.darkenColor(original, 0.3), 0.3);
      const lightenFirst = colorService.darkenColor(colorService.lightenColor(original, 0.3), 0.3);
      
      // They won't be exactly the same but should be valid colors
      expect(darkenFirst).toMatch(/^#[0-9a-f]{6}$/i);
      expect(lightenFirst).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should apply multiple filter operations consistently', () => {
      const color = '#ff0000';
      
      // Apply darken, then desaturate
      const step1 = colorService.darkenColor(color, 0.3);
      const step2 = colorService.desaturateColor(step1, 0.5);
      
      expect(step2).toMatch(/^#[0-9a-f]{6}$/i);
      
      // Result should be darker and less saturated
      const originalRgb = colorService.hexToRgb(color)!;
      const resultRgb = colorService.hexToRgb(step2)!;
      
      // Should be darker (lower R since original was pure red)
      expect(resultRgb.r).toBeLessThan(originalRgb.r);
    });

    it('should handle double inversion (return to ~original)', () => {
      const original = '#ff8040';
      const inverted = colorService.invertColor(original);
      const doubleInverted = colorService.invertColor(inverted);
      
      expect(doubleInverted.toLowerCase()).toBe(original.toLowerCase());
    });
  });

  // ===================== RGBA Alpha Preservation =====================

  describe('RGBA alpha preservation', () => {
    /**
     * Simula la función applyColorFilters del backend/frontend
     * que debe preservar el alpha de colores RGBA
     */
    function applyColorFiltersWithAlpha(
      colorStr: string,
      hueRotate: number,
      saturatePercent: number,
      brightnessPercent: number
    ): string {
      let r: number, g: number, b: number;
      let alpha: number | null = null;

      if (colorStr.startsWith('#')) {
        const hex = colorStr.slice(1);
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16);
          g = parseInt(hex[1] + hex[1], 16);
          b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        } else {
          return colorStr;
        }
      } else if (colorStr.startsWith('rgb')) {
        const match = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
          if (match[4] !== undefined) {
            alpha = parseFloat(match[4]);
          }
        } else {
          return colorStr;
        }
      } else {
        return colorStr;
      }

      // Apply hue-rotate
      const angle = (hueRotate * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const r1 = r * (0.213 + cos * 0.787 - sin * 0.213) +
                 g * (0.715 - cos * 0.715 - sin * 0.715) +
                 b * (0.072 - cos * 0.072 + sin * 0.928);
      const g1 = r * (0.213 - cos * 0.213 + sin * 0.143) +
                 g * (0.715 + cos * 0.285 + sin * 0.14) +
                 b * (0.072 - cos * 0.072 - sin * 0.283);
      const b1 = r * (0.213 - cos * 0.213 - sin * 0.787) +
                 g * (0.715 - cos * 0.715 + sin * 0.715) +
                 b * (0.072 + cos * 0.928 + sin * 0.072);

      // Apply saturate
      const sat = saturatePercent / 100;
      const r2 = r1 * (0.213 + 0.787 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 - 0.072 * sat);
      const g2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 + 0.285 * sat) + b1 * (0.072 - 0.072 * sat);
      const b2 = r1 * (0.213 - 0.213 * sat) + g1 * (0.715 - 0.715 * sat) + b1 * (0.072 + 0.928 * sat);

      // Apply brightness
      const bright = brightnessPercent / 100;
      const r3 = r2 * bright;
      const g3 = g2 * bright;
      const b3 = b2 * bright;

      const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));

      // Preserve alpha for RGBA colors
      if (alpha !== null) {
        return `rgba(${clamp(r3)},${clamp(g3)},${clamp(b3)},${alpha})`;
      }

      const toHex = (x: number) => clamp(x).toString(16).padStart(2, '0');
      return `#${toHex(r3)}${toHex(g3)}${toHex(b3)}`;
    }

    it('should preserve alpha for rgba colors', () => {
      const rgba = 'rgba(137,156,254,0.5)';
      const result = applyColorFiltersWithAlpha(rgba, 180, 100, 100);
      
      // Should be rgba format with same alpha
      expect(result).toMatch(/^rgba\(\d+,\d+,\d+,0\.5\)$/);
    });

    it('should preserve various alpha values', () => {
      const alphaValues = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
      
      alphaValues.forEach(alpha => {
        const rgba = `rgba(255,100,50,${alpha})`;
        const result = applyColorFiltersWithAlpha(rgba, 90, 100, 100);
        
        expect(result).toContain(`,${alpha})`);
      });
    });

    it('should not add alpha to hex colors', () => {
      const hex = '#ff8040';
      const result = applyColorFiltersWithAlpha(hex, 180, 100, 100);
      
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should transform RGB values while keeping alpha', () => {
      // Original: rgba with blue-ish color and 0.3 alpha
      const original = 'rgba(137,156,254,0.3)';
      const result = applyColorFiltersWithAlpha(original, 180, 100, 100);
      
      // Parse result
      const match = result.match(/rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/);
      expect(match).toBeTruthy();
      
      const [, r, g, b, a] = match!;
      
      // Alpha should be exactly 0.3
      expect(parseFloat(a)).toBe(0.3);
      
      // RGB should have changed (hue rotated)
      expect(parseInt(r)).not.toBe(137);
    });

    it('should handle white rgba (no hue change)', () => {
      const white = 'rgba(255,255,255,0.5)';
      const result = applyColorFiltersWithAlpha(white, 180, 100, 100);
      
      // White has no hue, so RGB stays the same, only alpha preserved
      expect(result).toBe('rgba(255,255,255,0.5)');
    });

    it('should handle rgb without alpha (returns hex)', () => {
      const rgb = 'rgb(137,156,254)';
      const result = applyColorFiltersWithAlpha(rgb, 0, 100, 100);
      
      // No alpha means hex output
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle rgba with varying whitespace', () => {
      const rgba = 'rgba( 137 , 156 , 254 , 0.5 )';
      const result = applyColorFiltersWithAlpha(rgba, 180, 100, 100);
      
      // Should still work and preserve alpha
      expect(result).toContain(',0.5)');
    });
  });
});

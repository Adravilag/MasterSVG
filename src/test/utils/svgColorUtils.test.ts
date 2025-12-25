/**
 * Tests for svgColorUtils.ts
 */

import {
  NAMED_COLORS,
  normalizeColor,
  rgbToHex,
  hexToRgb,
  hslToHex,
  extractColorsFromSvg,
  replaceColorInSvg,
  replaceAllColorsInSvg,
  applyColorReplacements,
  isSvgMonochrome,
  getPrimaryColor,
  addFillToSvg,
  removeColorsFromSvg,
  getContrastRatio,
  getLuminance,
  isLightColor,
  getComplementaryColor,
  lightenColor,
  darkenColor,
  generateColorVariations,
  formatColorInfo,
  sortColorsByUsage,
  getUniqueColors,
  SvgColorInfo,
} from '../../utils/svgColorUtils';

describe('svgColorUtils', () => {
  describe('NAMED_COLORS', () => {
    it('should have common named colors', () => {
      expect(NAMED_COLORS.black).toBe('#000000');
      expect(NAMED_COLORS.white).toBe('#ffffff');
      expect(NAMED_COLORS.red).toBe('#ff0000');
      expect(NAMED_COLORS.green).toBe('#008000');
      expect(NAMED_COLORS.blue).toBe('#0000ff');
    });

    it('should have gray/grey aliases', () => {
      expect(NAMED_COLORS.gray).toBe('#808080');
      expect(NAMED_COLORS.grey).toBe('#808080');
    });

    it('should have currentcolor mapped', () => {
      expect(NAMED_COLORS.currentcolor).toBe('currentColor');
    });
  });

  describe('normalizeColor', () => {
    it('should normalize 3-digit hex to 6-digit', () => {
      expect(normalizeColor('#fff')).toBe('#ffffff');
      expect(normalizeColor('#abc')).toBe('#aabbcc');
      expect(normalizeColor('#123')).toBe('#112233');
    });

    it('should keep 6-digit hex lowercase', () => {
      expect(normalizeColor('#FFFFFF')).toBe('#ffffff');
      expect(normalizeColor('#AbCdEf')).toBe('#abcdef');
    });

    it('should convert named colors to hex', () => {
      expect(normalizeColor('black')).toBe('#000000');
      expect(normalizeColor('WHITE')).toBe('#ffffff');
      expect(normalizeColor('Red')).toBe('#ff0000');
    });

    it('should return null for special values', () => {
      expect(normalizeColor('none')).toBeNull();
      expect(normalizeColor('transparent')).toBeNull();
      expect(normalizeColor('currentColor')).toBeNull();
    });

    it('should return null for null/undefined/empty', () => {
      expect(normalizeColor(null)).toBeNull();
      expect(normalizeColor(undefined)).toBeNull();
      expect(normalizeColor('')).toBeNull();
    });

    it('should convert rgb to hex', () => {
      expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(normalizeColor('rgb(0, 255, 0)')).toBe('#00ff00');
      expect(normalizeColor('rgb(0, 0, 255)')).toBe('#0000ff');
    });

    it('should convert rgba to hex', () => {
      expect(normalizeColor('rgba(255, 128, 0, 0.5)')).toBe('#ff8000');
    });

    it('should convert hsl to hex', () => {
      expect(normalizeColor('hsl(0, 100%, 50%)')).toBe('#ff0000');
      expect(normalizeColor('hsl(120, 100%, 25%)')).toBe('#008000');
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('should clamp values', () => {
      expect(rgbToHex(300, -50, 128)).toBe('#ff0080');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle 3-digit hex', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should return null for invalid', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('')).toBeNull();
    });
  });

  describe('hslToHex', () => {
    it('should convert HSL to hex', () => {
      expect(hslToHex(0, 100, 50)).toBe('#ff0000');  // red
      expect(hslToHex(120, 100, 50)).toBe('#00ff00');  // green
      expect(hslToHex(240, 100, 50)).toBe('#0000ff');  // blue
    });

    it('should handle gray (0 saturation)', () => {
      expect(hslToHex(0, 0, 50)).toBe('#808080');
    });
  });

  describe('extractColorsFromSvg', () => {
    it('should extract fill colors', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(2);
      expect(colors.find(c => c.color === '#ff0000')?.fillCount).toBe(1);
    });

    it('should extract stroke colors', () => {
      const svg = '<svg><path stroke="#ff0000"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(1);
      expect(colors[0].strokeCount).toBe(1);
    });

    it('should combine fill and stroke counts', () => {
      const svg = '<svg><path fill="#ff0000"/><rect stroke="#ff0000"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(1);
      expect(colors[0].fillCount).toBe(1);
      expect(colors[0].strokeCount).toBe(1);
      expect(colors[0].totalCount).toBe(2);
    });

    it('should extract from style attributes', () => {
      const svg = '<svg><path style="fill: #ff0000; stroke: #00ff00"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(2);
    });

    it('should ignore none values', () => {
      const svg = '<svg><path fill="none" stroke="#ff0000"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(1);
      expect(colors[0].color).toBe('#ff0000');
    });

    it('should return empty array for no colors', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      const colors = extractColorsFromSvg(svg);
      
      expect(colors).toHaveLength(0);
    });
  });

  describe('replaceColorInSvg', () => {
    it('should replace fill color', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = replaceColorInSvg(svg, '#ff0000', '#00ff00');
      
      expect(result).toContain('fill="#00ff00"');
      expect(result).not.toContain('#ff0000');
    });

    it('should replace stroke color', () => {
      const svg = '<svg><path stroke="#ff0000"/></svg>';
      const result = replaceColorInSvg(svg, '#ff0000', '#00ff00');
      
      expect(result).toContain('stroke="#00ff00"');
    });

    it('should replace color in style attribute', () => {
      const svg = '<svg><path style="fill: #ff0000"/></svg>';
      const result = replaceColorInSvg(svg, '#ff0000', '#00ff00');
      
      expect(result).toContain('fill: #00ff00');
    });

    it('should not replace if color not found', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = replaceColorInSvg(svg, '#0000ff', '#00ff00');
      
      expect(result).toBe(svg);
    });
  });

  describe('replaceAllColorsInSvg', () => {
    it('should replace all colors with single color', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>';
      const result = replaceAllColorsInSvg(svg, '#0000ff');
      
      expect(result).toContain('fill="#0000ff"');
      expect(result).not.toContain('#ff0000');
      expect(result).not.toContain('#00ff00');
    });
  });

  describe('applyColorReplacements', () => {
    it('should apply multiple replacements', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>';
      const result = applyColorReplacements(svg, [
        { original: '#ff0000', replacement: '#111111' },
        { original: '#00ff00', replacement: '#222222' },
      ]);
      
      expect(result).toContain('#111111');
      expect(result).toContain('#222222');
    });
  });

  describe('isSvgMonochrome', () => {
    it('should return true for single color', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#ff0000"/></svg>';
      expect(isSvgMonochrome(svg)).toBe(true);
    });

    it('should return false for multiple colors', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>';
      expect(isSvgMonochrome(svg)).toBe(false);
    });

    it('should return true for no colors', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      expect(isSvgMonochrome(svg)).toBe(true);
    });
  });

  describe('getPrimaryColor', () => {
    it('should return most used color', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#ff0000"/><circle fill="#00ff00"/></svg>';
      expect(getPrimaryColor(svg)).toBe('#ff0000');
    });

    it('should return null for no colors', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      expect(getPrimaryColor(svg)).toBeNull();
    });
  });

  describe('addFillToSvg', () => {
    it('should add fill to svg without colors', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      const result = addFillToSvg(svg, '#ff0000');
      
      expect(result).toContain('fill="#ff0000"');
    });

    it('should not add fill if already has colors', () => {
      const svg = '<svg><path fill="#00ff00"/></svg>';
      const result = addFillToSvg(svg, '#ff0000');
      
      expect(result).toBe(svg);
    });
  });

  describe('removeColorsFromSvg', () => {
    it('should remove fill attributes', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = removeColorsFromSvg(svg);
      
      expect(result).not.toContain('fill="#ff0000"');
    });

    it('should preserve fill="none"', () => {
      const svg = '<svg><path fill="none"/></svg>';
      const result = removeColorsFromSvg(svg);
      
      expect(result).toContain('fill="none"');
    });
  });

  describe('getLuminance', () => {
    it('should calculate luminance', () => {
      expect(getLuminance(255, 255, 255)).toBeCloseTo(1, 2);
      expect(getLuminance(0, 0, 0)).toBe(0);
    });
  });

  describe('getContrastRatio', () => {
    it('should calculate contrast between black and white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1 for invalid colors', () => {
      expect(getContrastRatio('invalid', '#ffffff')).toBe(1);
    });
  });

  describe('isLightColor', () => {
    it('should return true for white', () => {
      expect(isLightColor('#ffffff')).toBe(true);
    });

    it('should return false for black', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('should return true for invalid colors', () => {
      expect(isLightColor('invalid')).toBe(true);
    });
  });

  describe('getComplementaryColor', () => {
    it('should return complementary color', () => {
      expect(getComplementaryColor('#ff0000')).toBe('#00ffff');
      expect(getComplementaryColor('#00ff00')).toBe('#ff00ff');
    });

    it('should return null for invalid color', () => {
      expect(getComplementaryColor('invalid')).toBeNull();
    });
  });

  describe('lightenColor', () => {
    it('should lighten color', () => {
      const result = lightenColor('#000000', 50);
      expect(result).not.toBe('#000000');
    });

    it('should return null for invalid color', () => {
      expect(lightenColor('invalid', 50)).toBeNull();
    });
  });

  describe('darkenColor', () => {
    it('should darken color', () => {
      const result = darkenColor('#ffffff', 50);
      expect(result).not.toBe('#ffffff');
    });

    it('should return null for invalid color', () => {
      expect(darkenColor('invalid', 50)).toBeNull();
    });
  });

  describe('generateColorVariations', () => {
    it('should generate variations', () => {
      const variations = generateColorVariations('#ff0000');
      
      expect(variations.length).toBeGreaterThan(1);
      expect(variations).toContain('#ff0000');
    });
  });

  describe('formatColorInfo', () => {
    it('should format fill and stroke info', () => {
      const info: SvgColorInfo = {
        color: '#ff0000',
        normalizedColor: '#ff0000',
        fillCount: 2,
        strokeCount: 1,
        totalCount: 3,
      };
      
      expect(formatColorInfo(info)).toBe('2 fills, 1 stroke');
    });

    it('should handle singular', () => {
      const info: SvgColorInfo = {
        color: '#ff0000',
        normalizedColor: '#ff0000',
        fillCount: 1,
        strokeCount: 0,
        totalCount: 1,
      };
      
      expect(formatColorInfo(info)).toBe('1 fill');
    });

    it('should handle no uses', () => {
      const info: SvgColorInfo = {
        color: '#ff0000',
        normalizedColor: '#ff0000',
        fillCount: 0,
        strokeCount: 0,
        totalCount: 0,
      };
      
      expect(formatColorInfo(info)).toBe('no uses');
    });
  });

  describe('sortColorsByUsage', () => {
    it('should sort by total count descending', () => {
      const colors: SvgColorInfo[] = [
        { color: '#ff0000', normalizedColor: '#ff0000', fillCount: 1, strokeCount: 0, totalCount: 1 },
        { color: '#00ff00', normalizedColor: '#00ff00', fillCount: 3, strokeCount: 0, totalCount: 3 },
        { color: '#0000ff', normalizedColor: '#0000ff', fillCount: 2, strokeCount: 0, totalCount: 2 },
      ];
      
      const sorted = sortColorsByUsage(colors);
      
      expect(sorted[0].color).toBe('#00ff00');
      expect(sorted[1].color).toBe('#0000ff');
      expect(sorted[2].color).toBe('#ff0000');
    });

    it('should not mutate original array', () => {
      const colors: SvgColorInfo[] = [
        { color: '#ff0000', normalizedColor: '#ff0000', fillCount: 1, strokeCount: 0, totalCount: 1 },
      ];
      
      const sorted = sortColorsByUsage(colors);
      expect(sorted).not.toBe(colors);
    });
  });

  describe('getUniqueColors', () => {
    it('should return unique colors', () => {
      const svg = '<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>';
      const colors = getUniqueColors(svg);
      
      expect(colors).toHaveLength(2);
      expect(colors).toContain('#ff0000');
      expect(colors).toContain('#00ff00');
    });
  });
});

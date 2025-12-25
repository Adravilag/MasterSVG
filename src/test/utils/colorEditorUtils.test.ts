/**
 * Tests for colorEditorUtils.ts
 */

import {
  COLOR_EDITOR_PRESETS,
  NAMED_COLORS,
  escapeSvgForEmbedding,
  escapeSvgForJson,
  expandHexColor,
  namedToHex,
  normalizeColor,
  extractColorsFromSvg,
  replaceColorInSvg,
  applyColorToAll,
  applyColorMapping,
  addFillToSvg,
  extractRootFill,
  removeRootFill,
  addStrokeToSvg,
  extractRootStroke,
  createColorSwatchHtml,
  generateStyleId,
  createSavedStyle,
  applySavedStyle,
  invertColors,
  invertHexColor,
  hexToRgb,
  rgbToHex,
  lightenColor,
  darkenColor,
  getColorLuminance,
  isLightColor,
  getContrastingColor,
  getContrastRatio,
  meetsWcagAA,
  meetsWcagAAA,
  generateColorPalette,
  countUniqueColors,
  isSvgMonochrome,
  getDominantColor,
} from '../../utils/colorEditorUtils';

describe('colorEditorUtils', () => {
  // Sample SVG for testing
  const simpleSvg = '<svg fill="#ff0000"><path d="M0 0"/></svg>';
  const multiColorSvg = '<svg><path fill="#ff0000"/><path fill="#00ff00"/><circle stroke="#0000ff"/></svg>';
  const styleSvg = '<svg><path style="fill: #ff0000; stroke: #00ff00"/></svg>';

  describe('COLOR_EDITOR_PRESETS', () => {
    it('should have multiple presets', () => {
      expect(COLOR_EDITOR_PRESETS.length).toBeGreaterThan(10);
    });

    it('should have color and name for each preset', () => {
      COLOR_EDITOR_PRESETS.forEach(preset => {
        expect(preset).toHaveProperty('color');
        expect(preset).toHaveProperty('name');
        expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should include basic colors', () => {
      const colors = COLOR_EDITOR_PRESETS.map(p => p.color);
      expect(colors).toContain('#ffffff');
      expect(colors).toContain('#000000');
    });
  });

  describe('NAMED_COLORS', () => {
    it('should have common color names', () => {
      expect(NAMED_COLORS['black']).toBe('#000000');
      expect(NAMED_COLORS['white']).toBe('#ffffff');
      expect(NAMED_COLORS['red']).toBe('#ff0000');
    });

    it('should include special values', () => {
      expect(NAMED_COLORS['none']).toBe('none');
      expect(NAMED_COLORS['transparent']).toBe('transparent');
      expect(NAMED_COLORS['currentColor']).toBe('currentColor');
    });
  });

  describe('escapeSvgForEmbedding', () => {
    it('should escape backticks', () => {
      expect(escapeSvgForEmbedding('`test`')).toBe('\\`test\\`');
    });

    it('should escape dollar signs', () => {
      expect(escapeSvgForEmbedding('$var')).toBe('\\$var');
    });

    it('should handle empty string', () => {
      expect(escapeSvgForEmbedding('')).toBe('');
    });
  });

  describe('escapeSvgForJson', () => {
    it('should escape quotes', () => {
      expect(escapeSvgForJson('"test"')).toBe('\\"test\\"');
    });

    it('should escape newlines', () => {
      expect(escapeSvgForJson('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape backslashes', () => {
      expect(escapeSvgForJson('a\\b')).toBe('a\\\\b');
    });
  });

  describe('expandHexColor', () => {
    it('should expand 3-digit hex', () => {
      expect(expandHexColor('#fff')).toBe('#ffffff');
      expect(expandHexColor('#abc')).toBe('#aabbcc');
    });

    it('should keep 6-digit hex unchanged', () => {
      expect(expandHexColor('#ffffff')).toBe('#ffffff');
    });

    it('should return non-hex unchanged', () => {
      expect(expandHexColor('red')).toBe('red');
    });
  });

  describe('namedToHex', () => {
    it('should convert named colors', () => {
      expect(namedToHex('black')).toBe('#000000');
      expect(namedToHex('white')).toBe('#ffffff');
      expect(namedToHex('RED')).toBe('#ff0000');
    });

    it('should return unknown colors unchanged', () => {
      expect(namedToHex('#ff0000')).toBe('#ff0000');
      expect(namedToHex('unknown')).toBe('unknown');
    });
  });

  describe('normalizeColor', () => {
    it('should normalize hex colors', () => {
      expect(normalizeColor('#FFF')).toBe('#ffffff');
      expect(normalizeColor('#FF0000')).toBe('#ff0000');
    });

    it('should convert named colors', () => {
      expect(normalizeColor('black')).toBe('#000000');
    });

    it('should preserve special values', () => {
      expect(normalizeColor('none')).toBe('none');
      expect(normalizeColor('transparent')).toBe('transparent');
      expect(normalizeColor('currentColor')).toBe('currentcolor');
    });

    it('should handle empty input', () => {
      expect(normalizeColor('')).toBe('');
    });
  });

  describe('extractColorsFromSvg', () => {
    it('should extract fill colors', () => {
      const colors = extractColorsFromSvg(simpleSvg);
      expect(colors).toHaveLength(1);
      expect(colors[0].color).toBe('#ff0000');
      expect(colors[0].attribute).toBe('fill');
    });

    it('should extract multiple colors', () => {
      const colors = extractColorsFromSvg(multiColorSvg);
      expect(colors.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract stroke colors', () => {
      const svg = '<svg stroke="#0000ff"><path/></svg>';
      const colors = extractColorsFromSvg(svg);
      expect(colors.some(c => c.attribute === 'stroke')).toBe(true);
    });

    it('should extract colors from style attributes', () => {
      const colors = extractColorsFromSvg(styleSvg);
      expect(colors.some(c => c.attribute === 'style')).toBe(true);
    });

    it('should count occurrences', () => {
      const svg = '<svg><path fill="#ff0000"/><path fill="#ff0000"/></svg>';
      const colors = extractColorsFromSvg(svg);
      const red = colors.find(c => c.color === '#ff0000');
      expect(red?.count).toBe(2);
    });

    it('should ignore none and transparent', () => {
      const svg = '<svg fill="none"><path fill="transparent"/></svg>';
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(0);
    });
  });

  describe('replaceColorInSvg', () => {
    it('should replace fill color', () => {
      const result = replaceColorInSvg(simpleSvg, '#ff0000', '#00ff00');
      expect(result).toContain('#00ff00');
      expect(result).not.toContain('#ff0000');
    });

    it('should replace only specific attribute', () => {
      const result = replaceColorInSvg(multiColorSvg, '#ff0000', '#ffffff', 'fill');
      expect(result).toContain('fill="#ffffff"');
    });

    it('should handle normalized colors', () => {
      const svg = '<svg fill="#FF0000"></svg>';
      const result = replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('#00ff00');
    });
  });

  describe('applyColorToAll', () => {
    it('should replace all colors with single color', () => {
      const result = applyColorToAll(multiColorSvg, '#ffffff');
      const colors = extractColorsFromSvg(result);
      expect(colors.every(c => c.color === '#ffffff')).toBe(true);
    });
  });

  describe('applyColorMapping', () => {
    it('should apply color map', () => {
      const colorMap = {
        '#ff0000': '#ffffff',
        '#00ff00': '#000000',
      };
      const result = applyColorMapping(multiColorSvg, colorMap);
      expect(result).toContain('#ffffff');
      expect(result).toContain('#000000');
    });
  });

  describe('addFillToSvg', () => {
    it('should add fill attribute', () => {
      const svg = '<svg><path/></svg>';
      const result = addFillToSvg(svg, '#ff0000');
      expect(result).toContain('fill="#ff0000"');
    });

    it('should replace existing root fill', () => {
      const result = addFillToSvg(simpleSvg, '#00ff00');
      expect(result).toContain('#00ff00');
    });
  });

  describe('extractRootFill', () => {
    it('should extract root fill', () => {
      expect(extractRootFill(simpleSvg)).toBe('#ff0000');
    });

    it('should return null if no fill', () => {
      expect(extractRootFill('<svg><path/></svg>')).toBeNull();
    });
  });

  describe('removeRootFill', () => {
    it('should remove root fill', () => {
      const result = removeRootFill(simpleSvg);
      expect(result).not.toMatch(/^<svg[^>]*fill/);
    });
  });

  describe('addStrokeToSvg', () => {
    it('should add stroke attribute', () => {
      const svg = '<svg><path/></svg>';
      const result = addStrokeToSvg(svg, '#ff0000', 2);
      expect(result).toContain('stroke="#ff0000"');
      expect(result).toContain('stroke-width="2"');
    });
  });

  describe('extractRootStroke', () => {
    it('should extract root stroke', () => {
      const svg = '<svg stroke="#0000ff"><path/></svg>';
      expect(extractRootStroke(svg)).toBe('#0000ff');
    });

    it('should return null if no stroke', () => {
      expect(extractRootStroke('<svg><path/></svg>')).toBeNull();
    });
  });

  describe('createColorSwatchHtml', () => {
    it('should create swatch div', () => {
      const html = createColorSwatchHtml('#ff0000', 32);
      expect(html).toContain('background: #ff0000');
      expect(html).toContain('32px');
    });

    it('should include border when specified', () => {
      const html = createColorSwatchHtml('#ff0000', 24, true);
      expect(html).toContain('border:');
    });

    it('should exclude border when specified', () => {
      const html = createColorSwatchHtml('#ff0000', 24, false);
      expect(html).not.toContain('border:');
    });
  });

  describe('generateStyleId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateStyleId();
      const id2 = generateStyleId();
      expect(id1).not.toBe(id2);
    });

    it('should start with style_', () => {
      expect(generateStyleId()).toMatch(/^style_/);
    });
  });

  describe('createSavedStyle', () => {
    it('should create style with colors', () => {
      const style = createSavedStyle('Test', simpleSvg);
      expect(style.name).toBe('Test');
      expect(style.id).toMatch(/^style_/);
      expect(Object.keys(style.colors).length).toBeGreaterThan(0);
    });

    it('should mark as primary when specified', () => {
      const style = createSavedStyle('Primary', simpleSvg, true);
      expect(style.isPrimary).toBe(true);
    });
  });

  describe('applySavedStyle', () => {
    it('should apply style colors', () => {
      const style = {
        id: 'test',
        name: 'Test',
        colors: { '#ff0000': '#00ff00' },
      };
      const result = applySavedStyle(simpleSvg, style);
      expect(result).toContain('#00ff00');
    });
  });

  describe('invertHexColor', () => {
    it('should invert hex colors', () => {
      expect(invertHexColor('#000000')).toBe('#ffffff');
      expect(invertHexColor('#ffffff')).toBe('#000000');
      expect(invertHexColor('#ff0000')).toBe('#00ffff');
    });

    it('should return null for invalid colors', () => {
      expect(invertHexColor('invalid')).toBeNull();
      // 3-digit hex gets normalized to 6-digit, so it returns inverted color
      expect(invertHexColor('#fff')).toBe('#000000');
    });
  });

  describe('invertColors', () => {
    it('should invert all colors in SVG', () => {
      const result = invertColors(simpleSvg);
      expect(result).toContain('#00ffff'); // Inverted #ff0000
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    });

    it('should clamp values', () => {
      expect(rgbToHex(300, -50, 128)).toBe('#ff0080');
    });
  });

  describe('lightenColor', () => {
    it('should lighten a color', () => {
      const lighter = lightenColor('#000000', 50);
      expect(lighter).toBe('#808080');
    });

    it('should return original for invalid color', () => {
      expect(lightenColor('invalid', 50)).toBe('invalid');
    });
  });

  describe('darkenColor', () => {
    it('should darken a color', () => {
      const darker = darkenColor('#ffffff', 50);
      expect(darker).toBe('#808080');
    });

    it('should return original for invalid color', () => {
      expect(darkenColor('invalid', 50)).toBe('invalid');
    });
  });

  describe('getColorLuminance', () => {
    it('should return 0 for black', () => {
      expect(getColorLuminance('#000000')).toBeCloseTo(0);
    });

    it('should return 1 for white', () => {
      expect(getColorLuminance('#ffffff')).toBeCloseTo(1);
    });

    it('should return middle value for gray', () => {
      const lum = getColorLuminance('#808080');
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.5);
    });
  });

  describe('isLightColor', () => {
    it('should return true for white', () => {
      expect(isLightColor('#ffffff')).toBe(true);
    });

    it('should return false for black', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('should return true for light colors', () => {
      expect(isLightColor('#ffff00')).toBe(true);
    });
  });

  describe('getContrastingColor', () => {
    it('should return black for light colors', () => {
      expect(getContrastingColor('#ffffff')).toBe('#000000');
    });

    it('should return white for dark colors', () => {
      expect(getContrastingColor('#000000')).toBe('#ffffff');
    });
  });

  describe('getContrastRatio', () => {
    it('should return 21 for black and white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1 for same colors', () => {
      const ratio = getContrastRatio('#ff0000', '#ff0000');
      expect(ratio).toBeCloseTo(1);
    });
  });

  describe('meetsWcagAA', () => {
    it('should return true for black and white', () => {
      expect(meetsWcagAA('#000000', '#ffffff')).toBe(true);
    });

    it('should return false for low contrast', () => {
      expect(meetsWcagAA('#777777', '#888888')).toBe(false);
    });
  });

  describe('meetsWcagAAA', () => {
    it('should return true for black and white', () => {
      expect(meetsWcagAAA('#000000', '#ffffff')).toBe(true);
    });

    it('should be stricter than AA', () => {
      // Find a color combination that passes AA but not AAA
      // Gray on white might pass AA (4.5:1) but not AAA (7:1)
      const passesAA = meetsWcagAA('#767676', '#ffffff');
      const passesAAA = meetsWcagAAA('#767676', '#ffffff');
      expect(passesAA).toBe(true);
      expect(passesAAA).toBe(false);
    });
  });

  describe('generateColorPalette', () => {
    it('should generate 9 colors', () => {
      const palette = generateColorPalette('#ff0000');
      expect(palette).toHaveLength(9);
    });

    it('should include base color in middle', () => {
      const palette = generateColorPalette('#ff0000');
      expect(palette[4]).toBe('#ff0000');
    });

    it('should have lighter colors before base', () => {
      const palette = generateColorPalette('#808080');
      // First colors should be lighter (closer to white)
      expect(hexToRgb(palette[0])?.r).toBeGreaterThan(hexToRgb(palette[4])?.r || 0);
    });
  });

  describe('countUniqueColors', () => {
    it('should count unique colors', () => {
      expect(countUniqueColors(simpleSvg)).toBe(1);
      expect(countUniqueColors(multiColorSvg)).toBe(3);
    });

    it('should return 0 for no colors', () => {
      expect(countUniqueColors('<svg><path/></svg>')).toBe(0);
    });
  });

  describe('isSvgMonochrome', () => {
    it('should return true for single color', () => {
      expect(isSvgMonochrome(simpleSvg)).toBe(true);
    });

    it('should return false for multiple colors', () => {
      expect(isSvgMonochrome(multiColorSvg)).toBe(false);
    });

    it('should return true for no colors', () => {
      expect(isSvgMonochrome('<svg><path/></svg>')).toBe(true);
    });
  });

  describe('getDominantColor', () => {
    it('should return most used color', () => {
      const svg = '<svg><path fill="#ff0000"/><path fill="#ff0000"/><path fill="#00ff00"/></svg>';
      expect(getDominantColor(svg)).toBe('#ff0000');
    });

    it('should return null for no colors', () => {
      expect(getDominantColor('<svg><path/></svg>')).toBeNull();
    });
  });
});

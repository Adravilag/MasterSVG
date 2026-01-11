import { ColorService } from '../../services/ColorService';

describe('ColorService', () => {
  let service: ColorService;

  beforeEach(() => {
    service = new ColorService();
  });

  describe('extractColorsFromSvg', () => {
    it('should extract fill colors', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#ff0000');
    });

    it('should extract stroke colors', () => {
      const svg = '<svg><path stroke="#00ff00"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#00ff00');
    });

    it('should detect currentColor', () => {
      const svg = '<svg><path fill="currentColor"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.hasCurrentColor).toBe(true);
      expect(result.colors).toContain('currentColor');
    });

    it('should ignore none and transparent', () => {
      const svg = '<svg><path fill="none" stroke="transparent"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).not.toContain('none');
      expect(result.colors).not.toContain('transparent');
    });

    it('should ignore url() references', () => {
      const svg = '<svg><path fill="url(#gradient)"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).toHaveLength(0);
    });

    it('should detect SMIL animations', () => {
      const svg = '<svg><animate attributeName="fill"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.hasSmil).toBe(true);
    });

    it('should extract colors from style attributes', () => {
      const svg = '<svg><path style="fill: #0000ff; stroke: #ff00ff"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).toContain('#0000ff');
      expect(result.colors).toContain('#ff00ff');
    });

    it('should filter SMIL secondary colors', () => {
      const svg = '<svg><animate/><path fill="currentColor"/><path fill="#000000"/></svg>';
      const result = service.extractColorsFromSvg(svg);
      expect(result.colors).toContain('currentColor');
      expect(result.colors).not.toContain('#000000');
    });
  });

  describe('extractAllColorsFromSvg', () => {
    it('should return all colors without filtering', () => {
      const svg = '<svg><animate/><path fill="currentColor"/><path fill="#000000"/></svg>';
      const result = service.extractAllColorsFromSvg(svg);
      expect(result.colors).toContain('currentColor');
      expect(result.colors).toContain('#000000');
    });
  });

  describe('replaceColorInSvg', () => {
    it('should replace fill color', () => {
      const svg = '<svg><path fill="#ff0000"/></svg>';
      const result = service.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('fill="#00ff00"');
    });

    it('should replace stroke color', () => {
      const svg = '<svg><path stroke="#ff0000"/></svg>';
      const result = service.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('stroke="#00ff00"');
    });

    it('should normalize 3-char hex to 6-char', () => {
      const svg = '<svg><path fill="#f00"/></svg>';
      const result = service.replaceColorInSvg(svg, '#f00', '#00ff00');
      // The method normalizes colors
      expect(result).toContain('#00ff00');
    });

    it('should replace colors in style attributes', () => {
      const svg = '<svg><path style="fill: #ff0000"/></svg>';
      const result = service.replaceColorInSvg(svg, '#ff0000', '#00ff00');
      expect(result).toContain('fill: #00ff00');
    });
  });

  describe('toHexColor', () => {
    it('should return hex colors unchanged', () => {
      expect(service.toHexColor('#ff0000')).toBe('#ff0000');
    });

    it('should expand 3-char hex', () => {
      expect(service.toHexColor('#f00')).toBe('#ff0000');
    });

    it('should convert named colors', () => {
      expect(service.toHexColor('red')).toBe('#ff0000');
      expect(service.toHexColor('blue')).toBe('#0000ff');
      expect(service.toHexColor('white')).toBe('#ffffff');
      expect(service.toHexColor('black')).toBe('#000000');
    });

    it('should convert rgb() format', () => {
      expect(service.toHexColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(service.toHexColor('rgb(0, 255, 0)')).toBe('#00ff00');
    });

    it('should handle currentColor', () => {
      expect(service.toHexColor('currentColor')).toBe('currentColor');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB object', () => {
      expect(service.hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(service.hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(service.hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle hex without #', () => {
      expect(service.hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(service.hexToRgb('invalid')).toBeNull();
      expect(service.hexToRgb('#ff')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(service.rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(service.rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(service.rgbToHex(0, 0, 255)).toBe('#0000ff');
    });

    it('should clamp values', () => {
      expect(service.rgbToHex(300, -10, 128)).toBe('#ff0080');
    });
  });

  describe('invertColor', () => {
    it('should invert colors', () => {
      expect(service.invertColor('#ffffff')).toBe('#000000');
      expect(service.invertColor('#000000')).toBe('#ffffff');
      expect(service.invertColor('#ff0000')).toBe('#00ffff');
    });

    it('should return original for invalid hex', () => {
      expect(service.invertColor('invalid')).toBe('invalid');
    });
  });

  describe('darkenColor', () => {
    it('should darken colors', () => {
      const result = service.darkenColor('#ffffff', 0.5);
      expect(result).toBe('#808080');
    });

    it('should return original for invalid hex', () => {
      expect(service.darkenColor('invalid')).toBe('invalid');
    });
  });
});

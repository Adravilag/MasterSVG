import { SvgRasterDetector } from '../../services/svg/SvgRasterDetector';

describe('SvgRasterDetector', () => {
  describe('countColors', () => {
    it('should return 0 for SVG without colors', () => {
      const svg = '<svg><path d="M0 0h24v24H0z"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(0);
    });

    it('should count hex colors (6-digit)', () => {
      const svg = '<svg><path fill="#ff0000"/><circle fill="#00ff00"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(2);
    });

    it('should count hex colors (3-digit)', () => {
      const svg = '<svg><path fill="#f00"/><circle fill="#0f0"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(2);
    });

    it('should count rgb() colors', () => {
      const svg = '<svg><path fill="rgb(255, 0, 0)"/><circle fill="rgb(0, 255, 0)"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(2);
    });

    it('should count rgba() colors', () => {
      const svg = '<svg><path fill="rgba(255, 0, 0, 0.5)"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(1);
    });

    it('should count hsl() colors', () => {
      const svg = '<svg><path fill="hsl(0, 100%, 50%)"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(1);
    });

    it('should count hsla() colors', () => {
      const svg = '<svg><path fill="hsla(0, 100%, 50%, 0.5)"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(1);
    });

    it('should deduplicate identical colors', () => {
      const svg = '<svg><path fill="#ff0000"/><circle fill="#ff0000"/><rect fill="#ff0000"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(1);
    });

    it('should be case-insensitive for hex colors', () => {
      const svg = '<svg><path fill="#FF0000"/><circle fill="#ff0000"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(1);
    });

    it('should count mixed color formats', () => {
      const svg = '<svg><path fill="#ff0000"/><circle fill="rgb(0, 255, 0)"/><rect fill="hsl(240, 100%, 50%)"/></svg>';
      expect(SvgRasterDetector.countColors(svg)).toBe(3);
    });
  });

  describe('isRasterized', () => {
    it('should return false for undefined', () => {
      expect(SvgRasterDetector.isRasterized(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(SvgRasterDetector.isRasterized('')).toBe(false);
    });

    it('should return false for simple icon SVG', () => {
      const svg = '<svg><path fill="#333" d="M0 0h24v24H0z"/><circle fill="#666" cx="12" cy="12" r="5"/></svg>';
      expect(SvgRasterDetector.isRasterized(svg)).toBe(false);
    });

    it('should return true for SVG with more than 50 unique colors', () => {
      // Generate an SVG with 51 unique colors
      const colors = Array.from({ length: 51 }, (_, i) => {
        const hex = i.toString(16).padStart(2, '0');
        return `<rect fill="#${hex}${hex}${hex}"/>`;
      }).join('');
      const svg = `<svg>${colors}</svg>`;
      expect(SvgRasterDetector.isRasterized(svg)).toBe(true);
    });

    it('should return false for SVG with exactly 50 unique colors', () => {
      const colors = Array.from({ length: 50 }, (_, i) => {
        const hex = i.toString(16).padStart(2, '0');
        return `<rect fill="#${hex}${hex}${hex}"/>`;
      }).join('');
      const svg = `<svg>${colors}</svg>`;
      expect(SvgRasterDetector.isRasterized(svg)).toBe(false);
    });
  });

  describe('MAX_COLORS_FOR_ICONS', () => {
    it('should be 50', () => {
      expect(SvgRasterDetector.MAX_COLORS_FOR_ICONS).toBe(50);
    });
  });
});

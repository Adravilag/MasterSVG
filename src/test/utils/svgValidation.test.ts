import {
  SVG_PATTERNS,
  COLOR_PATTERNS,
  isValidSvg,
  hasNamespace,
  hasViewBox,
  extractViewBox,
  extractWidth,
  extractHeight,
  hasDimensions,
  hasGradient,
  hasStyleElement,
  hasClassAttributes,
  extractId,
  extractTitle,
  extractDescription,
  countPaths,
  countShapes,
  extractColors,
  isMonochrome,
  extractFillColors,
  extractStrokeColors,
  validateSvg,
  calculateComplexity,
  categorizeIcon,
  normalizeHexColor,
  namedColorToHex,
  isValidColor,
  estimateSize,
  formatBytes,
} from '../../utils/svgValidation';

describe('svgValidation', () => {
  const simpleSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 20"/></svg>';
  const complexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <defs>
      <linearGradient id="grad1">
        <stop offset="0%" style="stop-color:#ff0000"/>
        <stop offset="100%" style="stop-color:#0000ff"/>
      </linearGradient>
    </defs>
    <style>.cls { fill: #333; }</style>
    <path class="cls" d="M10 20" fill="#ff0000"/>
    <circle cx="12" cy="12" r="5" fill="#00ff00"/>
    <rect x="0" y="0" width="10" height="10" stroke="#0000ff"/>
  </svg>`;

  describe('SVG_PATTERNS', () => {
    it('should have all required patterns', () => {
      expect(SVG_PATTERNS.fullSvg).toBeInstanceOf(RegExp);
      expect(SVG_PATTERNS.openingTag).toBeInstanceOf(RegExp);
      expect(SVG_PATTERNS.closingTag).toBeInstanceOf(RegExp);
      expect(SVG_PATTERNS.viewBox).toBeInstanceOf(RegExp);
      expect(SVG_PATTERNS.gradient).toBeInstanceOf(RegExp);
    });
  });

  describe('COLOR_PATTERNS', () => {
    it('should match hex colors', () => {
      expect('#fff'.match(COLOR_PATTERNS.hex)).toBeTruthy();
      expect('#ffffff'.match(COLOR_PATTERNS.hex)).toBeTruthy();
      expect('#FF00FF'.match(COLOR_PATTERNS.hex)).toBeTruthy();
    });

    it('should match rgb colors', () => {
      expect('rgb(255, 0, 0)'.match(COLOR_PATTERNS.rgb)).toBeTruthy();
      expect('rgb(0,0,0)'.match(COLOR_PATTERNS.rgb)).toBeTruthy();
    });

    it('should match named colors', () => {
      expect('red'.match(COLOR_PATTERNS.named)).toBeTruthy();
      expect('currentColor'.match(COLOR_PATTERNS.named)).toBeTruthy();
    });
  });

  describe('isValidSvg', () => {
    it('should return true for valid SVG', () => {
      expect(isValidSvg(simpleSvg)).toBe(true);
    });

    it('should return false for invalid SVG', () => {
      expect(isValidSvg('<div></div>')).toBe(false);
      expect(isValidSvg('<svg>')).toBe(false);
      expect(isValidSvg('</svg>')).toBe(false);
    });

    it('should return false for empty/null', () => {
      expect(isValidSvg('')).toBe(false);
      expect(isValidSvg(null as any)).toBe(false);
      expect(isValidSvg(undefined as any)).toBe(false);
    });
  });

  describe('hasNamespace', () => {
    it('should detect namespace', () => {
      expect(hasNamespace(simpleSvg)).toBe(true);
    });

    it('should return false without namespace', () => {
      expect(hasNamespace('<svg viewBox="0 0 24 24"></svg>')).toBe(false);
    });
  });

  describe('hasViewBox', () => {
    it('should detect viewBox', () => {
      expect(hasViewBox(simpleSvg)).toBe(true);
    });

    it('should return false without viewBox', () => {
      expect(hasViewBox('<svg></svg>')).toBe(false);
    });
  });

  describe('extractViewBox', () => {
    it('should extract viewBox value', () => {
      expect(extractViewBox(simpleSvg)).toBe('0 0 24 24');
    });

    it('should return null if no viewBox', () => {
      expect(extractViewBox('<svg></svg>')).toBeNull();
    });

    it('should handle different viewBox formats', () => {
      expect(extractViewBox('<svg viewBox="0 0 16 16"></svg>')).toBe('0 0 16 16');
      expect(extractViewBox("<svg viewBox='0 0 32 32'></svg>")).toBe('0 0 32 32');
    });
  });

  describe('extractWidth and extractHeight', () => {
    it('should extract width', () => {
      expect(extractWidth('<svg width="24"></svg>')).toBe('24');
      expect(extractWidth('<svg width="100%"></svg>')).toBe('100%');
    });

    it('should extract height', () => {
      expect(extractHeight('<svg height="24"></svg>')).toBe('24');
    });

    it('should return null if not present', () => {
      expect(extractWidth('<svg></svg>')).toBeNull();
      expect(extractHeight('<svg></svg>')).toBeNull();
    });
  });

  describe('hasDimensions', () => {
    it('should return true when both dimensions present', () => {
      expect(hasDimensions('<svg width="24" height="24"></svg>')).toBe(true);
    });

    it('should return false when missing dimension', () => {
      expect(hasDimensions('<svg width="24"></svg>')).toBe(false);
      expect(hasDimensions('<svg height="24"></svg>')).toBe(false);
    });
  });

  describe('hasGradient', () => {
    it('should detect linear gradient', () => {
      expect(hasGradient('<svg><linearGradient></linearGradient></svg>')).toBe(true);
    });

    it('should detect radial gradient', () => {
      expect(hasGradient('<svg><radialGradient></radialGradient></svg>')).toBe(true);
    });

    it('should return false without gradient', () => {
      expect(hasGradient(simpleSvg)).toBe(false);
    });
  });

  describe('hasStyleElement', () => {
    it('should detect style element', () => {
      expect(hasStyleElement('<svg><style>.cls{}</style></svg>')).toBe(true);
    });

    it('should return false without style', () => {
      expect(hasStyleElement(simpleSvg)).toBe(false);
    });
  });

  describe('hasClassAttributes', () => {
    it('should detect class attributes', () => {
      expect(hasClassAttributes('<svg><path class="icon"/></svg>')).toBe(true);
    });

    it('should return false without classes', () => {
      expect(hasClassAttributes(simpleSvg)).toBe(false);
    });
  });

  describe('extractId', () => {
    it('should extract id', () => {
      expect(extractId('<svg id="my-icon"></svg>')).toBe('my-icon');
    });

    it('should return null if no id', () => {
      expect(extractId('<svg></svg>')).toBeNull();
    });
  });

  describe('extractTitle', () => {
    it('should extract title', () => {
      expect(extractTitle('<svg><title>My Icon</title></svg>')).toBe('My Icon');
    });

    it('should return null if no title', () => {
      expect(extractTitle('<svg></svg>')).toBeNull();
    });
  });

  describe('extractDescription', () => {
    it('should extract description', () => {
      expect(extractDescription('<svg><desc>Icon description</desc></svg>')).toBe(
        'Icon description'
      );
    });

    it('should return null if no desc', () => {
      expect(extractDescription('<svg></svg>')).toBeNull();
    });
  });

  describe('countPaths', () => {
    it('should count path elements', () => {
      expect(countPaths('<svg><path/><path/><path/></svg>')).toBe(3);
    });

    it('should return 0 for no paths', () => {
      expect(countPaths('<svg><circle/></svg>')).toBe(0);
    });
  });

  describe('countShapes', () => {
    it('should count all shape types', () => {
      const svg = '<svg><path/><circle/><rect/></svg>';
      expect(countShapes(svg)).toBe(3);
    });

    it('should return 0 for empty svg', () => {
      expect(countShapes('<svg></svg>')).toBe(0);
    });
  });

  describe('extractColors', () => {
    it('should extract hex colors', () => {
      const colors = extractColors('<svg fill="#ff0000" stroke="#00ff00"></svg>');
      expect(colors).toContain('#ff0000');
      expect(colors).toContain('#00ff00');
    });

    it('should extract named colors', () => {
      const colors = extractColors('<svg fill="red" stroke="blue"></svg>');
      expect(colors).toContain('red');
      expect(colors).toContain('blue');
    });

    it('should return unique colors', () => {
      const colors = extractColors('<svg fill="#fff" stroke="#fff"></svg>');
      expect(colors.filter(c => c === '#fff').length).toBe(1);
    });
  });

  describe('isMonochrome', () => {
    it('should return true for single color', () => {
      expect(isMonochrome('<svg fill="#000"></svg>')).toBe(true);
    });

    it('should return true for no colors', () => {
      expect(isMonochrome('<svg></svg>')).toBe(true);
    });

    it('should return false for multiple colors', () => {
      expect(isMonochrome('<svg fill="#000" stroke="#fff"></svg>')).toBe(false);
    });

    it('should ignore none and transparent', () => {
      expect(isMonochrome('<svg fill="#000" stroke="none"></svg>')).toBe(true);
    });
  });

  describe('extractFillColors', () => {
    it('should extract fill colors', () => {
      const fills = extractFillColors('<svg><path fill="#ff0000"/><rect fill="#00ff00"/></svg>');
      expect(fills).toContain('#ff0000');
      expect(fills).toContain('#00ff00');
    });

    it('should ignore fill="none"', () => {
      const fills = extractFillColors('<svg fill="none"></svg>');
      expect(fills).toHaveLength(0);
    });
  });

  describe('extractStrokeColors', () => {
    it('should extract stroke colors', () => {
      const strokes = extractStrokeColors('<svg><path stroke="#ff0000"/></svg>');
      expect(strokes).toContain('#ff0000');
    });

    it('should ignore stroke="none"', () => {
      const strokes = extractStrokeColors('<svg stroke="none"></svg>');
      expect(strokes).toHaveLength(0);
    });
  });

  describe('validateSvg', () => {
    it('should return valid for proper SVG', () => {
      const result = validateSvg(simpleSvg);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report missing opening tag', () => {
      const result = validateSvg('</svg>');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing <svg> opening tag');
    });

    it('should report missing closing tag', () => {
      const result = validateSvg('<svg>');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing </svg> closing tag');
    });

    it('should report missing viewBox/dimensions', () => {
      const result = validateSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(result.issues).toContain('Missing viewBox or dimensions');
    });

    it('should report missing namespace', () => {
      const result = validateSvg('<svg viewBox="0 0 24 24"></svg>');
      expect(result.issues).toContain('Missing xmlns namespace');
    });

    it('should handle empty input', () => {
      const result = validateSvg('');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('SVG content is empty or invalid');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate low complexity for simple SVG', () => {
      const complexity = calculateComplexity(simpleSvg);
      expect(complexity).toBeLessThan(5);
    });

    it('should calculate higher complexity for complex SVG', () => {
      const complexity = calculateComplexity(complexSvg);
      expect(complexity).toBeGreaterThan(5);
    });
  });

  describe('categorizeIcon', () => {
    it('should categorize simple icons', () => {
      expect(categorizeIcon(simpleSvg)).toBe('simple');
    });

    it('should categorize complex icons', () => {
      expect(categorizeIcon(complexSvg)).toBe('complex');
    });
  });

  describe('normalizeHexColor', () => {
    it('should expand 3-digit hex to 6-digit', () => {
      expect(normalizeHexColor('#fff')).toBe('#ffffff');
      expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    });

    it('should lowercase 6-digit hex', () => {
      expect(normalizeHexColor('#FFFFFF')).toBe('#ffffff');
    });

    it('should return non-hex colors unchanged', () => {
      expect(normalizeHexColor('red')).toBe('red');
    });
  });

  describe('namedColorToHex', () => {
    it('should convert named colors to hex', () => {
      expect(namedColorToHex('black')).toBe('#000000');
      expect(namedColorToHex('white')).toBe('#ffffff');
      expect(namedColorToHex('red')).toBe('#ff0000');
    });

    it('should be case insensitive', () => {
      expect(namedColorToHex('BLACK')).toBe('#000000');
      expect(namedColorToHex('White')).toBe('#ffffff');
    });

    it('should return null for unknown colors', () => {
      expect(namedColorToHex('unknowncolor')).toBeNull();
    });
  });

  describe('isValidColor', () => {
    it('should validate hex colors', () => {
      expect(isValidColor('#fff')).toBe(true);
      expect(isValidColor('#ffffff')).toBe(true);
    });

    it('should validate rgb colors', () => {
      expect(isValidColor('rgb(0,0,0)')).toBe(true);
      expect(isValidColor('rgba(0,0,0,0.5)')).toBe(true);
    });

    it('should validate special values', () => {
      expect(isValidColor('none')).toBe(true);
      expect(isValidColor('transparent')).toBe(true);
      expect(isValidColor('currentColor')).toBe(true);
      expect(isValidColor('inherit')).toBe(true);
    });

    it('should validate named colors', () => {
      expect(isValidColor('red')).toBe(true);
      expect(isValidColor('blue')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidColor('')).toBe(false);
      expect(isValidColor('notacolor')).toBe(false);
      expect(isValidColor('#gg0000')).toBe(false);
    });
  });

  describe('estimateSize', () => {
    it('should estimate SVG size in bytes', () => {
      const size = estimateSize(simpleSvg);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should return larger size for complex SVG', () => {
      const simpleSize = estimateSize(simpleSvg);
      const complexSize = estimateSize(complexSvg);
      expect(complexSize).toBeGreaterThan(simpleSize);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(100)).toBe('100 B');
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format with decimals', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });
});

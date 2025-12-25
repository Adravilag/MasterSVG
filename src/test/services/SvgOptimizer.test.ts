/**
 * Tests para SvgOptimizer
 * 
 * Requisitos cubiertos:
 * - RF-3.1: Optimización con SVGO
 */

// Mock de vscode antes de importar el módulo
import { SvgOptimizer } from '../../services/SvgOptimizer';

describe('SvgOptimizer', () => {
  let optimizer: SvgOptimizer;

  beforeEach(() => {
    optimizer = new SvgOptimizer();
  });

  // =====================================================
  // RF-3.1: Optimización con SVGO
  // =====================================================

  describe('optimize', () => {
    const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <metadata>Test metadata</metadata>
  <title>Test Icon</title>
  <desc>A test icon</desc>
  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#000000"/>
</svg>`;

    // CA-3.1.1: Ofrece presets: Minimal, Safe, Aggressive
    describe('CA-3.1.1: presets de optimización', () => {
      test('preset minimal debe ser conservador', () => {
        const presets = optimizer.getPresets();
        const result = optimizer.optimize(testSvg, presets.minimal);

        expect(result.svg).toBeDefined();
        expect(result.svg).not.toContain('<?xml');
        expect(result.svg).not.toContain('<!--');
      });

      test('preset safe debe optimizar de forma balanceada', () => {
        const presets = optimizer.getPresets();
        const result = optimizer.optimize(testSvg, presets.safe);

        expect(result.svg).toBeDefined();
        expect(result.svg).not.toContain('<metadata');
        expect(result.optimizedSize).toBeLessThan(result.originalSize);
      });

      test('preset aggressive debe maximizar compresión', () => {
        const presets = optimizer.getPresets();
        const result = optimizer.optimize(testSvg, presets.aggressive);

        expect(result.svg).toBeDefined();
        expect(result.optimizedSize).toBeLessThan(result.originalSize);
        // Aggressive debería tener mayor ahorro que minimal
      });
    });

    // CA-3.1.2: Muestra ahorro en bytes y porcentaje
    test('CA-3.1.2: debe calcular estadísticas de ahorro', () => {
      const presets = optimizer.getPresets();
      const result = optimizer.optimize(testSvg, presets.safe);

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.optimizedSize).toBeGreaterThan(0);
      expect(result.savings).toBeDefined();
      expect(result.savingsPercent).toBeDefined();
      expect(result.savings).toBe(result.originalSize - result.optimizedSize);
    });

    // CA-3.1.3: El SVG optimizado debe ser válido
    test('CA-3.1.3: el SVG resultante debe ser válido', () => {
      const presets = optimizer.getPresets();
      const result = optimizer.optimize(testSvg, presets.safe);

      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('</svg>');
      expect(result.svg).toContain('viewBox');
    });
  });

  describe('getPresets', () => {
    test('debe retornar los tres presets', () => {
      const presets = optimizer.getPresets();

      expect(presets).toHaveProperty('minimal');
      expect(presets).toHaveProperty('safe');
      expect(presets).toHaveProperty('aggressive');
    });
  });

  describe('formatSize', () => {
    test('debe formatear bytes correctamente', () => {
      expect(optimizer.formatSize(500)).toBe('500 B');
      expect(optimizer.formatSize(1024)).toBe('1.0 KB');
      expect(optimizer.formatSize(1536)).toBe('1.5 KB');
      expect(optimizer.formatSize(1048576)).toBe('1.0 MB');
    });
  });

  // =====================================================
  // Tests de opciones específicas
  // =====================================================

  describe('opciones de optimización', () => {
    const complexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <style>.cls-1{fill:#000}</style>
      <defs><linearGradient id="grad1"/></defs>
      <path class="cls-1" d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M0 0" fill="none"/>
    </svg>`;

    test('removeComments elimina comentarios', () => {
      const svgWithComments = `<svg><!-- comment --><path/></svg>`;
      const result = optimizer.optimize(svgWithComments, { removeComments: true });

      expect(result.svg).not.toContain('<!--');
    });

    test('removeMetadata elimina metadata', () => {
      const svgWithMeta = `<svg><metadata>data</metadata><path/></svg>`;
      const result = optimizer.optimize(svgWithMeta, { removeMetadata: true });

      expect(result.svg).not.toContain('<metadata');
    });

    test('convertColors convierte colores', () => {
      const svgWithColor = `<svg><path fill="#000000"/></svg>`;
      const result = optimizer.optimize(svgWithColor, { convertColors: true });

      // SVGO puede convertir #000000 a #000 o currentColor
      expect(result.svg).not.toContain('#000000');
    });

    test('sortAttrs ordena atributos', () => {
      const result = optimizer.optimize(complexSvg, { sortAttrs: true });

      expect(result.svg).toBeDefined();
    });
  });

  // =====================================================
  // Edge cases
  // =====================================================

  describe('edge cases', () => {
    test('debe manejar SVG vacío', () => {
      const result = optimizer.optimize('<svg></svg>', {});

      expect(result.svg).toContain('<svg');
    });

    test('debe manejar SVG ya optimizado', () => {
      const optimized = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
      const result = optimizer.optimize(optimized, { removeComments: true });

      expect(result.svg).toBeDefined();
      expect(result.savingsPercent).toBeLessThanOrEqual(100);
    });

    test('debe preservar viewBox', () => {
      const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
      const result = optimizer.optimize(svg, {});

      expect(result.svg).toContain('viewBox');
    });
  });
});


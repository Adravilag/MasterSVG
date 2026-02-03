/**
 * Tests para SpriteGenerator
 *
 * Requisitos cubiertos:
 * - RF-6.2: Generación de sprite.svg
 * - RF-6.3: Generación de Helper Component
 */

// Mock de vscode y fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { SpriteGenerator, SpriteIcon, SpriteOptions } from '../../services/svg/SpriteGenerator';

describe('SpriteGenerator', () => {
  let generator: SpriteGenerator;

  const testIcons: SpriteIcon[] = [
    {
      id: 'arrow-left',
      name: 'Arrow Left',
      svg: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    },
    {
      id: 'arrow-right',
      name: 'Arrow Right',
      svg: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    },
    {
      id: 'home',
      name: 'Home',
      svg: '<svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>',
    },
  ];

  const baseOptions: SpriteOptions = {
    outputPath: '/test/output',
    filename: 'sprite',
  };

  beforeEach(() => {
    generator = new SpriteGenerator();
    jest.clearAllMocks();
  });

  // =====================================================
  // RF-6.2: Generación de sprite.svg
  // =====================================================

  describe('generate', () => {
    // CA-6.2.1: Genera <symbol> por cada icono
    test('CA-6.2.1: debe generar un symbol por cada icono', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('<symbol id="arrow-left"');
      expect(result.sprite).toContain('<symbol id="arrow-right"');
      expect(result.sprite).toContain('<symbol id="home"');
      expect(result.iconIds).toHaveLength(3);
    });

    // CA-6.2.2: Incluye viewBox correcto
    test('CA-6.2.2: debe preservar viewBox de cada icono', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('viewBox="0 0 24 24"');
    });

    // CA-6.2.3: Opción de incluir título y descripción
    test('CA-6.2.3: debe incluir title cuando includeTitle es true', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        includeTitle: true,
      });

      expect(result.sprite).toContain('<title>');
    });

    test('CA-6.2.3: debe incluir desc cuando includeDesc es true', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        includeDesc: true,
      });

      expect(result.sprite).toContain('<desc>');
    });

    // CA-6.2.4: Genera archivo de tipos TypeScript
    test('CA-6.2.4: debe generar types cuando generateTypes es true', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toBeDefined();
      expect(result.typeDefinitions).toContain('IconName');
      expect(result.typeDefinitions).toContain("'arrow-left'");
      expect(result.typeDefinitions).toContain("'arrow-right'");
      expect(result.typeDefinitions).toContain("'home'");
    });
  });

  describe('sprite structure', () => {
    test('debe generar XML declaration', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('<?xml version="1.0"');
    });

    test('debe incluir namespace SVG', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    test('debe ocultar el sprite con style', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('style="display:none"');
    });

    test('debe incluir comentario con total de iconos', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.sprite).toContain('Total icons: 3');
    });
  });

  describe('stats', () => {
    test('debe calcular estadísticas correctas', () => {
      const result = generator.generate(testIcons, baseOptions);

      expect(result.stats.totalIcons).toBe(3);
      expect(result.stats.totalSize).toBeGreaterThan(0);
      expect(result.stats.averageSize).toBe(Math.round(result.stats.totalSize / 3));
    });
  });

  // =====================================================
  // RF-6.3: Generación de Helper Component
  // =====================================================

  describe('CA-6.3: helper components', () => {
    // CA-6.3.1: Soporta React
    test('CA-6.3.1: debe generar helper React', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toBeDefined();
      expect(result.helperComponent).toContain('React');
      expect(result.helperComponent).toContain('<svg');
      expect(result.helperComponent).toContain('<use');
    });

    // CA-6.3.2: Soporta Vue
    test('CA-6.3.2: debe generar helper Vue', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vue',
      });

      expect(result.helperComponent).toBeDefined();
      expect(result.helperComponent).toContain('<template>');
      expect(result.helperComponent).toContain('<script');
    });

    // CA-6.3.3: Soporta Svelte
    test('CA-6.3.3: debe generar helper Svelte', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'svelte',
      });

      expect(result.helperComponent).toBeDefined();
      expect(result.helperComponent).toContain('export let');
    });

    // CA-6.3.4: Soporta Vanilla JS
    test('CA-6.3.4: debe generar helper Vanilla JS', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vanilla',
      });

      expect(result.helperComponent).toBeDefined();
      expect(result.helperComponent).toContain('class IconComponent extends HTMLElement');
    });

    // CA-6.3.5: Incluye props para size, className, etc.
    test('CA-6.3.5: helper debe incluir props estándar', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toContain('size');
      expect(result.helperComponent).toContain('className');
    });
  });

  // =====================================================
  // Type definitions
  // =====================================================

  describe('type definitions', () => {
    test('debe generar union type de iconos', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('type IconName =');
      expect(result.typeDefinitions).toContain("'arrow-left' | 'arrow-right' | 'home'");
    });

    test('debe generar array de nombres', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('iconNames');
      expect(result.typeDefinitions).toContain('as const');
    });

    test('debe incluir función de validación', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('isValidIconName');
    });
  });

  // =====================================================
  // Edge cases
  // =====================================================

  describe('edge cases', () => {
    test('debe manejar array vacío', () => {
      const result = generator.generate([], baseOptions);

      expect(result.iconIds).toHaveLength(0);
      expect(result.stats.totalIcons).toBe(0);
    });

    test('debe sanitizar IDs con caracteres especiales', () => {
      const iconsWithSpecialChars: SpriteIcon[] = [
        {
          id: 'icon with spaces',
          name: 'Icon With Spaces',
          svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        },
      ];

      const result = generator.generate(iconsWithSpecialChars, baseOptions);

      // El ID debe estar sanitizado (sin espacios)
      expect(result.sprite).not.toContain('id="icon with spaces"');
    });

    test('debe extraer viewBox si no está en el icono', () => {
      const iconWithoutViewBox: SpriteIcon[] = [
        {
          id: 'no-viewbox',
          name: 'No ViewBox',
          svg: '<svg><path d="M0 0"/></svg>',
        },
      ];

      const result = generator.generate(iconWithoutViewBox, baseOptions);

      // Debe usar viewBox por defecto
      expect(result.sprite).toContain('viewBox="0 0 24 24"');
    });

    test('debe usar viewBox proporcionado en el icono', () => {
      const iconWithCustomViewBox: SpriteIcon[] = [
        {
          id: 'custom-viewbox',
          name: 'Custom ViewBox',
          svg: '<svg viewBox="0 0 16 16"><path d="M0 0"/></svg>',
          viewBox: '0 0 32 32',
        },
      ];

      const result = generator.generate(iconWithCustomViewBox, baseOptions);

      // Debe usar el viewBox del icono si está definido
      expect(result.sprite).toContain('viewBox="0 0 32 32"');
    });
  });

  // =====================================================
  // removeStyles option
  // =====================================================

  describe('removeStyles option', () => {
    test('debe eliminar estilos cuando removeStyles es true', () => {
      const iconWithStyle: SpriteIcon[] = [
        {
          id: 'styled',
          name: 'Styled',
          svg: '<svg viewBox="0 0 24 24"><style>.cls{fill:red}</style><path class="cls"/></svg>',
        },
      ];

      const result = generator.generate(iconWithStyle, {
        ...baseOptions,
        removeStyles: true,
      });

      expect(result.sprite).not.toContain('<style>');
    });

    test('debe preservar estilos cuando removeStyles es false', () => {
      const iconWithStyle: SpriteIcon[] = [
        {
          id: 'styled',
          name: 'Styled',
          svg: '<svg viewBox="0 0 24 24"><style>.cls{fill:red}</style><path class="cls"/></svg>',
        },
      ];

      const result = generator.generate(iconWithStyle, {
        ...baseOptions,
        removeStyles: false,
      });

      expect(result.sprite).toContain('<style>');
    });
  });

  // =====================================================
  // generateAndSave
  // =====================================================

  describe('generateAndSave', () => {
    const fs = require('fs');

    test('debe crear directorio si no existe', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      await generator.generateAndSave(testIcons, baseOptions);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output', { recursive: true });
    });

    test('debe guardar archivo sprite', async () => {
      await generator.generateAndSave(testIcons, baseOptions);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('sprite.svg'),
        expect.any(String),
        'utf-8'
      );
    });

    test('debe guardar archivo de tipos si generateTypes es true', async () => {
      await generator.generateAndSave(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('sprite.types.ts'),
        expect.any(String),
        'utf-8'
      );
    });

    test('debe guardar helper component si generateHelper es true', async () => {
      await generator.generateAndSave(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('Icon.tsx'),
        expect.any(String),
        'utf-8'
      );
    });

    test('debe usar extensión correcta para cada formato', async () => {
      const formats = [
        { format: 'react', ext: 'tsx' },
        { format: 'vue', ext: 'vue' },
        { format: 'svelte', ext: 'svelte' },
        { format: 'vanilla', ext: 'js' },
      ];

      for (const { format, ext } of formats) {
        fs.writeFileSync.mockClear();

        await generator.generateAndSave(testIcons, {
          ...baseOptions,
          generateHelper: true,
          helperFormat: format as any,
        });

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining(`Icon.${ext}`),
          expect.any(String),
          'utf-8'
        );
      }
    });
  });

  // =====================================================
  // Helper component contents
  // =====================================================

  describe('helper component contents', () => {
    test('React helper debe incluir forwardRef', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toContain('forwardRef');
    });

    test('React helper debe incluir displayName', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toContain('displayName');
    });

    test('Vue helper debe incluir withDefaults', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vue',
      });

      expect(result.helperComponent).toContain('withDefaults');
    });

    test('Svelte helper debe exportar iconNames', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'svelte',
      });

      expect(result.helperComponent).toContain('export const iconNames');
    });

    test('Vanilla helper debe incluir initIcons', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vanilla',
      });

      expect(result.helperComponent).toContain('connectedCallback');
    });

    test('Vanilla helper debe incluir createIcon', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vanilla',
      });

      expect(result.helperComponent).toContain('customElements.define');
    });

    test('Vanilla helper debe respetar webComponentName', () => {
      const customName = 'custom-icon-component';
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateHelper: true,
        helperFormat: 'vanilla',
        webComponentName: customName,
      });

      expect(result.helperComponent).toContain(`customElements.define('${customName}'`);
    });
  });

  // =====================================================
  // Type definitions contents
  // =====================================================

  describe('type definitions contents', () => {
    test('debe incluir isValidIconName function', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('isValidIconName');
    });

    test('debe incluir IconNameTuple type', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('IconNameTuple');
    });

    test('debe incluir comentario de auto-generación', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('Auto-generated');
    });
  });

  // =====================================================
  // ID sanitization
  // =====================================================

  describe('ID sanitization', () => {
    test('debe convertir caracteres especiales a guiones', () => {
      const iconWithSpecialChars: SpriteIcon[] = [
        {
          id: 'icon@2x',
          name: 'Icon 2x',
          svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        },
      ];

      const result = generator.generate(iconWithSpecialChars, baseOptions);

      expect(result.sprite).toContain('id="icon-2x"');
      expect(result.iconIds).toContain('icon-2x');
    });

    test('debe eliminar guiones al inicio y final', () => {
      const iconWithDashes: SpriteIcon[] = [
        {
          id: '-icon-name-',
          name: 'Icon Name',
          svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        },
      ];

      const result = generator.generate(iconWithDashes, baseOptions);

      expect(result.sprite).toContain('id="icon-name"');
    });

    test('debe convertir a minúsculas', () => {
      const iconUppercase: SpriteIcon[] = [
        {
          id: 'MyIcon',
          name: 'My Icon',
          svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        },
      ];

      const result = generator.generate(iconUppercase, baseOptions);

      expect(result.sprite).toContain('id="myicon"');
    });
  });

  // =====================================================
  // Custom filename
  // =====================================================

  describe('custom filename', () => {
    test('debe usar filename personalizado en sprite path', () => {
      const result = generator.generate(testIcons, {
        ...baseOptions,
        filename: 'icons',
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toContain('/icons.svg#');
    });

    test('debe usar filename por defecto si no se especifica', () => {
      const result = generator.generate(testIcons, {
        outputPath: '/test',
        generateHelper: true,
        helperFormat: 'react',
      });

      expect(result.helperComponent).toContain('/sprite.svg#');
    });
  });

  // =====================================================
  // getSpriteGenerator singleton
  // =====================================================

  describe('getSpriteGenerator', () => {
    test('debe importar y usar el singleton', async () => {
      const { getSpriteGenerator } = await import('../../services/svg/SpriteGenerator');

      const generator1 = getSpriteGenerator();
      const generator2 = getSpriteGenerator();

      expect(generator1).toBe(generator2);
    });
  });
});

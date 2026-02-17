/**
 * Tests para CssIconsGenerator
 *
 * Requisitos cubiertos:
 * - RF-6.4: Generación de CSS Icons (icons.css)
 * - RF-6.5: Detección monocolor/multicolor
 * - RF-6.6: Generación de TypeScript definitions
 */

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { CssIconsGenerator, CssIcon, CssIconsOptions } from '../../services/svg/CssIconsGenerator';

describe('CssIconsGenerator', () => {
  let generator: CssIconsGenerator;

  const monoIcons: CssIcon[] = [
    {
      name: 'arrow-left',
      svg: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    },
    {
      name: 'arrow-right',
      svg: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    },
    {
      name: 'home',
      svg: '<svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>',
    },
  ];

  const multiColorIcon: CssIcon = {
    name: 'colorful',
    svg: '<svg viewBox="0 0 24 24"><circle fill="#ff0000" cx="8" cy="12" r="4"/><circle fill="#00ff00" cx="16" cy="12" r="4"/></svg>',
  };

  const baseOptions: CssIconsOptions = {
    outputPath: '/test/output',
    prefix: 'icon',
    filename: 'icons',
  };

  beforeEach(() => {
    generator = new CssIconsGenerator();
    jest.clearAllMocks();
  });

  // =====================================================
  // RF-6.4: Generación de CSS Icons
  // =====================================================

  describe('generate', () => {
    test('should_GenerateBaseClass_When_CalledWithIcons', () => {
      const result = generator.generate(monoIcons, baseOptions);

      expect(result.css).toContain('.icon {');
      expect(result.css).toContain('display: inline-block');
      expect(result.css).toContain('vertical-align: middle');
    });

    test('should_GenerateOneClassPerIcon_When_CalledWithMultipleIcons', () => {
      const result = generator.generate(monoIcons, baseOptions);

      expect(result.css).toContain('.icon-arrow-left');
      expect(result.css).toContain('.icon-arrow-right');
      expect(result.css).toContain('.icon-home');
      expect(result.classNames).toHaveLength(3);
    });

    test('should_ReturnCorrectStats_When_Generated', () => {
      const result = generator.generate(monoIcons, baseOptions);

      expect(result.stats.totalIcons).toBe(3);
      expect(result.stats.totalSize).toBeGreaterThan(0);
    });

    test('should_UseCustomPrefix_When_Provided', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        prefix: 'svg',
      });

      expect(result.css).toContain('.svg {');
      expect(result.css).toContain('.svg-arrow-left');
      expect(result.classNames[0]).toBe('svg-arrow-left');
    });

    test('should_UseCustomDefaultSize_When_Provided', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        defaultSize: '24px',
      });

      expect(result.css).toContain('24px');
    });

    test('should_IncludeCustomProperties_When_Enabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        includeCustomProperties: true,
      });

      expect(result.css).toContain(':root');
      expect(result.css).toContain('--icon-size');
      expect(result.css).toContain('--icon-color');
    });

    test('should_ExcludeCustomProperties_When_Disabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        includeCustomProperties: false,
      });

      expect(result.css).not.toContain(':root');
      expect(result.css).not.toContain('--icon-size');
    });
  });

  // =====================================================
  // RF-6.5: Detección monocolor/multicolor
  // =====================================================

  describe('isMultiColorSvg', () => {
    test('should_ReturnFalse_When_SvgHasNoColors', () => {
      const svg = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
      expect(generator.isMultiColorSvg(svg)).toBe(false);
    });

    test('should_ReturnFalse_When_SvgHasSingleColor', () => {
      const svg = '<svg viewBox="0 0 24 24"><path fill="#000" d="M15 18l-6-6 6-6"/></svg>';
      expect(generator.isMultiColorSvg(svg)).toBe(false);
    });

    test('should_ReturnTrue_When_SvgHasMultipleColors', () => {
      expect(generator.isMultiColorSvg(multiColorIcon.svg)).toBe(true);
    });

    test('should_ReturnFalse_When_SvgUsesCurrentColor', () => {
      const svg = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 10"/></svg>';
      expect(generator.isMultiColorSvg(svg)).toBe(false);
    });

    test('should_ReturnFalse_When_ColorsAreNone', () => {
      const svg = '<svg viewBox="0 0 24 24"><path fill="none" stroke="none" d="M10 10"/></svg>';
      expect(generator.isMultiColorSvg(svg)).toBe(false);
    });

    test('should_ReturnTrue_When_StyleBlockHasMultipleColors', () => {
      const svg = '<svg viewBox="0 0 24 24"><style>.a{fill:#f00}.b{fill:#0f0}</style><circle class="a"/><circle class="b"/></svg>';
      expect(generator.isMultiColorSvg(svg)).toBe(true);
    });
  });

  describe('monocolor vs multicolor CSS rules', () => {
    test('should_UseMaskImage_When_IconIsMonoColor', () => {
      const result = generator.generate(monoIcons, baseOptions);

      expect(result.css).toContain('mask-image:');
      expect(result.css).toContain('-webkit-mask-image:');
      expect(result.css).toContain('background-color: currentColor');
      expect(result.stats.monoColorIcons).toBe(3);
      expect(result.stats.multiColorIcons).toBe(0);
    });

    test('should_UseBackgroundImage_When_IconIsMultiColor', () => {
      const result = generator.generate([multiColorIcon], baseOptions);

      expect(result.css).toContain('background-image:');
      expect(result.css).toContain('background-color: transparent');
      expect(result.stats.monoColorIcons).toBe(0);
      expect(result.stats.multiColorIcons).toBe(1);
    });

    test('should_MixBothFormats_When_IconsMixed', () => {
      const result = generator.generate([...monoIcons, multiColorIcon], baseOptions);

      expect(result.stats.monoColorIcons).toBe(3);
      expect(result.stats.multiColorIcons).toBe(1);
      expect(result.stats.totalIcons).toBe(4);
    });
  });

  // =====================================================
  // RF-6.6: TypeScript definitions
  // =====================================================

  describe('TypeScript definitions', () => {
    test('should_GenerateTypeDefinitions_When_Enabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toBeDefined();
      expect(result.typeDefinitions).toContain('export type IconName');
      expect(result.typeDefinitions).toContain("'arrow-left'");
      expect(result.typeDefinitions).toContain("'arrow-right'");
      expect(result.typeDefinitions).toContain("'home'");
    });

    test('should_IncludeHelperFunctions_When_TypesGenerated', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(result.typeDefinitions).toContain('getIconClass');
      expect(result.typeDefinitions).toContain('isValidIconName');
    });

    test('should_NotGenerateTypes_When_Disabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        generateTypes: false,
      });

      expect(result.typeDefinitions).toBeUndefined();
    });
  });

  // =====================================================
  // Data URI conversion
  // =====================================================

  describe('svgToDataUri', () => {
    test('should_ReturnDataUri_When_GivenSvg', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 10"/></svg>';
      const uri = generator.svgToDataUri(svg);

      expect(uri).toMatch(/^data:image\/svg\+xml,/);
      expect(uri).toContain('%3Csvg');
      expect(uri).toContain('%3C/svg%3E');
    });

    test('should_AddXmlns_When_Missing', () => {
      const svg = '<svg viewBox="0 0 24 24"><path d="M10 10"/></svg>';
      const uri = generator.svgToDataUri(svg);

      expect(uri).toContain('xmlns');
    });

    test('should_EscapeSpecialCharacters_When_Present', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 10" fill="#ff0000"/></svg>';
      const uri = generator.svgToDataUri(svg);

      expect(uri).toContain('%23ff0000'); // # encoded
      expect(uri).not.toContain('"'); // quotes converted to single
    });
  });

  // =====================================================
  // CSS minification
  // =====================================================

  describe('minification', () => {
    test('should_MinifyCss_When_MinifyEnabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        minify: true,
      });

      // Minified CSS should not contain comment blocks or excessive newlines
      expect(result.css).not.toContain('/*');
      expect(result.css).not.toContain('\n\n');
    });

    test('should_NotMinify_When_MinifyDisabled', () => {
      const result = generator.generate(monoIcons, {
        ...baseOptions,
        minify: false,
      });

      // Non-minified should have comments and formatting
      expect(result.css).toContain('/* Auto-generated by MasterSVG');
    });
  });

  // =====================================================
  // Class name sanitization
  // =====================================================

  describe('class name sanitization', () => {
    test('should_SanitizeClassName_When_NameHasSpecialChars', () => {
      const icons: CssIcon[] = [
        { name: 'mdi:home-outline', svg: '<svg viewBox="0 0 24 24"><path d="M10 10"/></svg>' },
      ];

      const result = generator.generate(icons, baseOptions);

      expect(result.css).toContain('.icon-mdi-home-outline');
      expect(result.css).not.toContain('.icon-mdi:home-outline');
    });

    test('should_HandleUpperCase_When_NameHasMixedCase', () => {
      const icons: CssIcon[] = [
        { name: 'ArrowRight', svg: '<svg viewBox="0 0 24 24"><path d="M10 10"/></svg>' },
      ];

      const result = generator.generate(icons, baseOptions);

      expect(result.css).toContain('.icon-arrowright');
    });
  });

  // =====================================================
  // File saving
  // =====================================================

  describe('generateAndSave', () => {
    test('should_WriteFiles_When_SaveCalled', async () => {
      const fs = require('fs');

      await generator.generateAndSave(monoIcons, {
        ...baseOptions,
        generateTypes: true,
      });

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // CSS + types
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('icons.css'),
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('icons.css.d.ts'),
        expect.any(String),
        'utf-8'
      );
    });

    test('should_CreateDirectory_When_NotExists', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);

      await generator.generateAndSave(monoIcons, baseOptions);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/output', { recursive: true });
    });
  });
});

/**
 * ConfigService Tests
 *
 * Tests for configuration loading, defaults, and merging.
 */

import {
  DEFAULT_CONFIG,
  mergeWithDefaults,
  createMinimalConfig,
  PartialMasterSvgConfig,
} from '../../config';

describe('ConfigService', () => {
  describe('DEFAULT_CONFIG', () => {
    it('debe tener valores por defecto válidos', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0');
      expect(DEFAULT_CONFIG.source.directories).toEqual(['src/assets/svg']);
      expect(DEFAULT_CONFIG.output.format).toBe('icons.ts');
      expect(DEFAULT_CONFIG.output.structure).toBe('flat');
      expect(DEFAULT_CONFIG.framework.type).toBe('react');
      expect(DEFAULT_CONFIG.framework.typescript).toBe(true);
    });

    it('debe tener configuración de optimización', () => {
      expect(DEFAULT_CONFIG.optimization?.svgo?.enabled).toBe(true);
      expect(DEFAULT_CONFIG.optimization?.svgo?.removeComments).toBe(true);
      expect(DEFAULT_CONFIG.optimization?.svgo?.removeMetadata).toBe(true);
    });

    it('debe tener presets de animación', () => {
      expect(DEFAULT_CONFIG.animations?.presets?.spin).toBeDefined();
      expect(DEFAULT_CONFIG.animations?.presets?.spin?.duration).toBe(1000);
      expect(DEFAULT_CONFIG.animations?.presets?.spin?.timing).toBe('linear');
      expect(DEFAULT_CONFIG.animations?.presets?.spin?.iteration).toBe('infinite');
    });
  });

  describe('mergeWithDefaults', () => {
    it('debe devolver config completa con defaults si se pasa objeto vacío', () => {
      const result = mergeWithDefaults({});
      
      expect(result.version).toBe(DEFAULT_CONFIG.version);
      expect(result.source.directories).toEqual(DEFAULT_CONFIG.source.directories);
      expect(result.output.format).toBe(DEFAULT_CONFIG.output.format);
      expect(result.framework.type).toBe(DEFAULT_CONFIG.framework.type);
    });

    it('debe respetar valores parciales del usuario', () => {
      const userConfig: PartialMasterSvgConfig = {
        source: { directories: ['custom/path'] },
        framework: { type: 'vue' },
      };

      const result = mergeWithDefaults(userConfig);

      expect(result.source.directories).toEqual(['custom/path']);
      expect(result.framework.type).toBe('vue');
      // Otros valores deben ser defaults
      expect(result.output.format).toBe('icons.ts');
      expect(result.framework.typescript).toBe(true);
    });

    it('debe hacer merge profundo de objetos anidados', () => {
      const userConfig: PartialMasterSvgConfig = {
        framework: {
          type: 'angular',
          component: { name: 'MyIcon' },
        },
      };

      const result = mergeWithDefaults(userConfig);

      expect(result.framework.type).toBe('angular');
      expect(result.framework.component?.name).toBe('MyIcon');
      // webComponentTag debe venir de defaults
      expect(result.framework.component?.webComponentTag).toBe('svg-icon');
    });

    it('debe manejar estructura separada correctamente', () => {
      const userConfig: PartialMasterSvgConfig = {
        output: {
          format: 'icons.ts',
          structure: 'separated',
          paths: {
            components: 'src/components/icons',
            assets: 'src/assets/icons',
            types: 'src/types/icons',
          },
        },
      };

      const result = mergeWithDefaults(userConfig);

      expect(result.output.structure).toBe('separated');
      expect(result.output.paths?.components).toBe('src/components/icons');
      expect(result.output.paths?.assets).toBe('src/assets/icons');
    });

    it('debe preservar configuración de optimización personalizada', () => {
      const userConfig: PartialMasterSvgConfig = {
        optimization: {
          svgo: {
            enabled: false,
            removeTitle: true,
          },
        },
      };

      const result = mergeWithDefaults(userConfig);

      expect(result.optimization?.svgo?.enabled).toBe(false);
      expect(result.optimization?.svgo?.removeTitle).toBe(true);
      // Otros valores deben ser defaults
      expect(result.optimization?.svgo?.removeComments).toBe(true);
    });

    it('debe agregar presets de animación personalizados', () => {
      const userConfig: PartialMasterSvgConfig = {
        animations: {
          presets: {
            custom: { duration: 2000, timing: 'ease', iteration: 2 },
          },
        },
      };

      const result = mergeWithDefaults(userConfig);

      expect(result.animations?.presets?.custom).toBeDefined();
      expect(result.animations?.presets?.custom?.duration).toBe(2000);
      // Presets por defecto deben mantenerse
      expect(result.animations?.presets?.spin).toBeDefined();
    });
  });

  describe('createMinimalConfig', () => {
    it('debe crear config mínima para React', () => {
      const config = createMinimalConfig('react');

      expect(config.framework?.type).toBe('react');
      expect(config.framework?.typescript).toBe(true);
      expect(config.source?.directories).toEqual(['src/assets/svg']);
    });

    it('debe crear config mínima para Vue', () => {
      const config = createMinimalConfig('vue');

      expect(config.framework?.type).toBe('vue');
      expect(config.framework?.typescript).toBe(true);
    });

    it('debe crear config mínima para Svelte', () => {
      const config = createMinimalConfig('svelte');

      expect(config.framework?.type).toBe('svelte');
      expect(config.framework?.typescript).toBe(false);
    });

    it('debe crear config mínima para HTML (sin TypeScript)', () => {
      const config = createMinimalConfig('html');

      expect(config.framework?.type).toBe('html');
      expect(config.framework?.typescript).toBe(false);
    });
  });

  describe('OutputStructure types', () => {
    it('flat debe usar directory', () => {
      const config: PartialMasterSvgConfig = {
        output: {
          format: 'icons.ts',
          structure: 'flat',
          directory: 'src/icons',
        },
      };

      const result = mergeWithDefaults(config);
      
      expect(result.output.structure).toBe('flat');
      expect(result.output.directory).toBe('src/icons');
    });

    it('separated debe usar paths', () => {
      const config: PartialMasterSvgConfig = {
        output: {
          format: 'icons.ts',
          structure: 'separated',
          paths: {
            components: 'src/components/icons',
            assets: 'src/assets/icons',
          },
        },
      };

      const result = mergeWithDefaults(config);
      
      expect(result.output.structure).toBe('separated');
      expect(result.output.paths?.components).toBe('src/components/icons');
    });
  });

  describe('Framework types', () => {
    const frameworks = ['html', 'react', 'vue', 'angular', 'svelte', 'solid', 'qwik', 'astro'] as const;

    frameworks.forEach((framework) => {
      it(`debe aceptar framework: ${framework}`, () => {
        const config: PartialMasterSvgConfig = {
          framework: { type: framework },
        };

        const result = mergeWithDefaults(config);
        
        expect(result.framework.type).toBe(framework);
      });
    });
  });
});

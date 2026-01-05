/**
 * Tests for iconBuildHelpers
 *
 * Tests helper functions for building and importing icons to the library
 */

import * as vscode from 'vscode';
import {
  BuildResult,
  BuildIconOptions,
  generateReplacement,
  createBuiltIcon,
} from '../../utils/iconBuildHelpers';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(false),
    }),
  },
  window: {
    showQuickPick: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  env: {
    language: 'en',
    clipboard: {
      writeText: jest.fn(),
    },
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(''),
}));

// Mock configHelper
jest.mock('../../utils/configHelper', () => ({
  getConfig: jest.fn().mockReturnValue({
    buildFormat: 'icons.js',
    webComponentName: 'svg-icon',
    outputDirectory: 'mastersvg-icons',
  }),
  getOutputPathOrWarn: jest.fn().mockReturnValue('/workspace/mastersvg-icons'),
  getFullOutputPath: jest.fn().mockReturnValue('/workspace/mastersvg-icons'),
}));

// Mock iconsFileManager
jest.mock('../../utils/iconsFileManager', () => ({
  addToIconsJs: jest.fn().mockResolvedValue(undefined),
  addToSpriteSvg: jest.fn().mockResolvedValue(undefined),
}));

describe('iconBuildHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BuildResult interface', () => {
    test('should have required fields', () => {
      const result: BuildResult = {
        success: true,
        iconName: 'test-icon',
        outputPath: '/output',
        format: 'icons',
      };

      expect(result.success).toBe(true);
      expect(result.iconName).toBe('test-icon');
      expect(result.outputPath).toBe('/output');
      expect(result.format).toBe('icons');
    });

    test('should support optional error field', () => {
      const result: BuildResult = {
        success: false,
        iconName: 'test-icon',
        outputPath: '/output',
        format: 'icons',
        error: 'Build failed',
      };

      expect(result.error).toBe('Build failed');
    });

    test('should support sprite format', () => {
      const result: BuildResult = {
        success: true,
        iconName: 'test-icon',
        outputPath: '/output',
        format: 'sprite',
      };

      expect(result.format).toBe('sprite');
    });
  });

  describe('BuildIconOptions interface', () => {
    test('should have required fields', () => {
      const options: BuildIconOptions = {
        iconName: 'arrow',
        svgContent: '<svg></svg>',
        svgTransformer: {} as any,
      };

      expect(options.iconName).toBe('arrow');
      expect(options.svgContent).toBe('<svg></svg>');
    });

    test('should support optional outputPath', () => {
      const options: BuildIconOptions = {
        iconName: 'arrow',
        svgContent: '<svg></svg>',
        svgTransformer: {} as any,
        outputPath: '/custom/path',
      };

      expect(options.outputPath).toBe('/custom/path');
    });
  });

  describe('generateReplacement', () => {
    const { getConfig } = require('../../utils/configHelper');

    beforeEach(() => {
      getConfig.mockReturnValue({
        buildFormat: 'icons.js',
        webComponentName: 'svg-icon',
        outputDirectory: 'mastersvg-icons',
      });
    });

    test('should generate web component for HTML', () => {
      const result = generateReplacement('arrow', 'html');
      expect(result).toBe('<svg-icon name="arrow"></svg-icon>');
    });

    test('should generate self-closing for JSX', () => {
      const result = generateReplacement('arrow', 'javascriptreact');
      expect(result).toBe('<svg-icon name="arrow" />');
    });

    test('should generate self-closing for TSX', () => {
      const result = generateReplacement('arrow', 'typescriptreact');
      expect(result).toBe('<svg-icon name="arrow" />');
    });

    test('should generate self-closing for Vue', () => {
      const result = generateReplacement('arrow', 'vue');
      expect(result).toBe('<svg-icon name="arrow" />');
    });

    test('should generate self-closing for Svelte', () => {
      const result = generateReplacement('arrow', 'svelte');
      expect(result).toBe('<svg-icon name="arrow" />');
    });

    test('should generate self-closing for Astro', () => {
      const result = generateReplacement('arrow', 'astro');
      expect(result).toBe('<svg-icon name="arrow" />');
    });

    test('should generate standard HTML for unknown language', () => {
      const result = generateReplacement('arrow', 'plaintext');
      expect(result).toBe('<svg-icon name="arrow"></svg-icon>');
    });

    test('should generate sprite reference for sprite format', () => {
      getConfig.mockReturnValue({
        buildFormat: 'sprite.svg',
        webComponentName: 'svg-icon',
      });

      const result = generateReplacement('arrow', 'html');
      expect(result).toContain('sprite.svg#arrow');
      expect(result).toContain('<use href=');
    });

    test('should use custom component name', () => {
      getConfig.mockReturnValue({
        buildFormat: 'icons.js',
        webComponentName: 'my-icon',
      });

      const result = generateReplacement('arrow', 'html');
      expect(result).toBe('<my-icon name="arrow"></my-icon>');
    });

    test('should handle icons with hyphens', () => {
      const result = generateReplacement('arrow-right', 'html');
      expect(result).toBe('<svg-icon name="arrow-right"></svg-icon>');
    });

    test('should handle icons with numbers', () => {
      const result = generateReplacement('icon-2', 'html');
      expect(result).toBe('<svg-icon name="icon-2"></svg-icon>');
    });
  });

  describe('createBuiltIcon', () => {
    test('should create WorkspaceIcon with basic properties', () => {
      const icon = createBuiltIcon('arrow', '<svg></svg>');

      expect(icon.name).toBe('arrow');
      expect(icon.svg).toBe('<svg></svg>');
      expect(icon.source).toBe('library');
      expect(icon.isBuilt).toBe(true);
    });

    test('should use output path', () => {
      const icon = createBuiltIcon('arrow', '<svg></svg>');

      expect(icon.path).toBe('/workspace/mastersvg-icons');
    });

    test('should use source path as fallback', () => {
      const { getFullOutputPath } = require('../../utils/configHelper');
      getFullOutputPath.mockReturnValue(undefined);

      const icon = createBuiltIcon('arrow', '<svg></svg>', '/source/icon.svg');

      expect(icon.path).toBe('/source/icon.svg');
    });

    test('should handle empty source path', () => {
      const { getFullOutputPath } = require('../../utils/configHelper');
      getFullOutputPath.mockReturnValue(undefined);

      const icon = createBuiltIcon('arrow', '<svg></svg>');

      expect(icon.path).toBe('');
    });

    test('should always set source to library', () => {
      const icon = createBuiltIcon('test', '<svg></svg>');

      expect(icon.source).toBe('library');
    });

    test('should always set isBuilt to true', () => {
      const icon = createBuiltIcon('test', '<svg></svg>');

      expect(icon.isBuilt).toBe(true);
    });
  });

  describe('error handling', () => {
    test('BuildResult should represent failed build', () => {
      const result: BuildResult = {
        success: false,
        iconName: 'failed-icon',
        outputPath: '',
        format: 'icons',
        error: 'No output path configured',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

import { FrameworkWrapperService } from '../../services/FrameworkWrapperService';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');

describe('FrameworkWrapperService', () => {
  let service: FrameworkWrapperService;
  const mockOutputPath = '/test/output';

  beforeEach(() => {
    // Reset singleton
    (FrameworkWrapperService as any).instance = undefined;
    service = FrameworkWrapperService.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FrameworkWrapperService.getInstance();
      const instance2 = FrameworkWrapperService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getWrapperFilename', () => {
    it('should return web-component.js for html', () => {
      expect(service.getWrapperFilename('html', 'svg-icon')).toBe('web-component.js');
    });

    it('should return .tsx for react', () => {
      expect(service.getWrapperFilename('react', 'Icon')).toBe('Icon.tsx');
    });

    it('should return .vue for vue', () => {
      expect(service.getWrapperFilename('vue', 'Icon')).toBe('Icon.vue');
    });

    it('should return .component.ts for angular', () => {
      expect(service.getWrapperFilename('angular', 'app-icon')).toBe('app-icon.component.ts');
    });

    it('should return .svelte for svelte', () => {
      expect(service.getWrapperFilename('svelte', 'Icon')).toBe('Icon.svelte');
    });

    it('should return .astro for astro', () => {
      expect(service.getWrapperFilename('astro', 'Icon')).toBe('Icon.astro');
    });

    it('should return .tsx for solid', () => {
      expect(service.getWrapperFilename('solid', 'Icon')).toBe('Icon.tsx');
    });

    it('should return .tsx for qwik', () => {
      expect(service.getWrapperFilename('qwik', 'Icon')).toBe('Icon.tsx');
    });

    it('should convert kebab-case to PascalCase for react', () => {
      expect(service.getWrapperFilename('react', 'icon-button')).toBe('IconButton.tsx');
    });

    it('should convert kebab-case to PascalCase for vue', () => {
      expect(service.getWrapperFilename('vue', 'my-icon')).toBe('MyIcon.vue');
    });

    it('should convert kebab-case to PascalCase for svelte', () => {
      expect(service.getWrapperFilename('svelte', 'icon-sg')).toBe('IconSg.svelte');
    });

    it('should convert kebab-case to PascalCase for solid', () => {
      expect(service.getWrapperFilename('solid', 'custom-icon')).toBe('CustomIcon.tsx');
    });

    it('should convert kebab-case to PascalCase for qwik', () => {
      expect(service.getWrapperFilename('qwik', 'svg-icon')).toBe('SvgIcon.tsx');
    });

    it('should keep kebab-case for angular (component selector)', () => {
      expect(service.getWrapperFilename('angular', 'AppIcon')).toBe('app-icon.component.ts');
    });
  });

  describe('getDefaultComponentName', () => {
    it('should return svg-icon for html', () => {
      expect(service.getDefaultComponentName('html')).toBe('svg-icon');
    });

    it('should return app-icon for angular', () => {
      expect(service.getDefaultComponentName('angular')).toBe('app-icon');
    });

    it('should return Icon for react', () => {
      expect(service.getDefaultComponentName('react')).toBe('Icon');
    });

    it('should return Icon for vue', () => {
      expect(service.getDefaultComponentName('vue')).toBe('Icon');
    });

    it('should return Icon for svelte', () => {
      expect(service.getDefaultComponentName('svelte')).toBe('Icon');
    });

    it('should return Icon for astro', () => {
      expect(service.getDefaultComponentName('astro')).toBe('Icon');
    });
  });

  describe('getUsageExample', () => {
    it('should return self-closing tag for react', () => {
      expect(service.getUsageExample('react', 'Icon')).toBe('<Icon name="home" />');
    });

    it('should return closing tag for html', () => {
      expect(service.getUsageExample('html', 'svg-icon')).toBe('<svg-icon name="home"></svg-icon>');
    });

    it('should return closing tag for angular', () => {
      expect(service.getUsageExample('angular', 'app-icon')).toBe('<app-icon name="home"></app-icon>');
    });
  });

  describe('requiresHyphen', () => {
    it('should return true for html', () => {
      expect(service.requiresHyphen('html')).toBe(true);
    });

    it('should return true for angular', () => {
      expect(service.requiresHyphen('angular')).toBe(true);
    });

    it('should return false for react', () => {
      expect(service.requiresHyphen('react')).toBe(false);
    });

    it('should return false for vue', () => {
      expect(service.requiresHyphen('vue')).toBe(false);
    });
  });

  describe('generateWrapper', () => {
    it('should generate web component for html', () => {
      service.generateWrapper(mockOutputPath, 'html', 'svg-icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'web-component.js'),
        expect.stringContaining('customElements.define'),
        'utf-8'
      );
    });

    it('should generate React component for react', () => {
      service.generateWrapper(mockOutputPath, 'react', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.tsx'),
        expect.stringContaining('export function Icon'),
        'utf-8'
      );
    });

    it('should generate Vue component for vue', () => {
      service.generateWrapper(mockOutputPath, 'vue', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.vue'),
        expect.stringContaining('<template>'),
        'utf-8'
      );
    });

    it('should generate Angular component for angular', () => {
      service.generateWrapper(mockOutputPath, 'angular', 'app-icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'app-icon.component.ts'),
        expect.stringContaining('@Component'),
        'utf-8'
      );
    });

    it('should generate Svelte component for svelte', () => {
      service.generateWrapper(mockOutputPath, 'svelte', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.svelte'),
        expect.stringContaining('<script'),
        'utf-8'
      );
    });

    it('should generate Astro component for astro', () => {
      service.generateWrapper(mockOutputPath, 'astro', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.astro'),
        expect.stringContaining('Astro.props'),
        'utf-8'
      );
    });

    it('should generate Solid component for solid', () => {
      service.generateWrapper(mockOutputPath, 'solid', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.tsx'),
        expect.stringContaining('solid-js'),
        'utf-8'
      );
    });

    it('should generate Qwik component for qwik', () => {
      service.generateWrapper(mockOutputPath, 'qwik', 'Icon');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockOutputPath, 'Icon.tsx'),
        expect.stringContaining('@builder.io/qwik'),
        'utf-8'
      );
    });
  });

  describe('generated content', () => {
    it('should include animation support in React component', () => {
      service.generateWrapper(mockOutputPath, 'react', 'Icon');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain('animation');
      expect(content).toContain('ANIMATION_KEYFRAMES');
      expect(content).toContain('spin');
      expect(content).toContain('pulse');
      expect(content).toContain('bounce');
    });

    it('should include variant support in Vue component', () => {
      service.generateWrapper(mockOutputPath, 'vue', 'Icon');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain('variant');
      expect(content).toContain('bodyWithVariant');
    });

    it('should include size and color props in Angular component', () => {
      service.generateWrapper(mockOutputPath, 'angular', 'app-icon');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain('@Input() size');
      expect(content).toContain('@Input() color');
      expect(content).toContain('@Input() name');
    });
  });
});

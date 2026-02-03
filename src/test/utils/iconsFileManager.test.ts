import * as fs from 'node:fs';
import {
  addToIconsJs,
  addToSpriteSvg,
  removeFromIconsJs,
  getIconNamesFromFile,
  generateWebComponent,
} from '../../utils/iconsFileManager';
import { SvgTransformer } from '../../services/svg/SvgTransformer';

// Mock fs module (using node: prefix to match source)
jest.mock('node:fs');
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultValue: any) => {
        const config: Record<string, any> = {
          componentName: 'Icon',
        };
        return config[key] ?? defaultValue;
      }),
    }),
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  env: {
    language: 'en',
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('iconsFileManager', () => {
  let mockTransformer: SvgTransformer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransformer = new SvgTransformer();
    jest.spyOn(mockTransformer, 'extractSvgBody').mockReturnValue('<path d="M0 0"/>');
    jest.spyOn(mockTransformer, 'extractSvgAttributes').mockReturnValue({ viewBox: '0 0 24 24' });
  });

  describe('addToIconsJs', () => {
    it('should create new icons.js file if it does not exist', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToIconsJs({ outputPath: '/output', iconName: 'home-icon', svgContent: '<svg><path/></svg>', transformer: mockTransformer });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('export const homeIcon');
      expect(writtenContent).toContain("name: 'home-icon'");
    });

    it('should add icon to existing icons.js file', async () => {
      const existingContent = `export const existingIcon = {
  name: 'existing',
  body: '<path/>',
  viewBox: '0 0 24 24'
};

export const icons = {
  existingIcon
};`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingContent);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToIconsJs({ outputPath: '/output', iconName: 'new-icon', svgContent: '<svg><path/></svg>', transformer: mockTransformer });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('export const newIcon');
    });

    it('should update existing icon if name matches', async () => {
      const existingContent = `export const homeIcon = {
  name: 'home-icon',
  body: '<old-path/>',
  viewBox: '0 0 16 16'
};`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingContent);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToIconsJs({ outputPath: '/output', iconName: 'home-icon', svgContent: '<svg><new-path/></svg>', transformer: mockTransformer });

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('export const homeIcon');
      expect(writtenContent).not.toContain('<old-path/>');
    });

    it('should create output directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToIconsJs({ outputPath: '/new/output/path', iconName: 'icon', svgContent: '<svg><path/></svg>', transformer: mockTransformer });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/new/output/path', { recursive: true });
    });

    it('should convert icon name to valid variable name', async () => {
      mockFs.existsSync.mockImplementation(p => p === '/output');
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToIconsJs({ outputPath: '/output', iconName: 'my-icon-name', svgContent: '<svg><path/></svg>', transformer: mockTransformer });

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('export const myIconName');
    });
  });

  describe('addToSpriteSvg', () => {
    it('should create new sprite.svg if it does not exist', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToSpriteSvg('/output', 'home', '<svg><path/></svg>', mockTransformer);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('<symbol id="home"');
      expect(writtenContent).toContain('viewBox="0 0 24 24"');
    });

    it('should add symbol to existing sprite.svg', async () => {
      const existingSprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
  <symbol id="existing" viewBox="0 0 24 24">
    <path/>
  </symbol>
</svg>`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingSprite);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToSpriteSvg('/output', 'new-icon', '<svg><path/></svg>', mockTransformer);

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('<symbol id="existing"');
      expect(writtenContent).toContain('<symbol id="new-icon"');
    });

    it('should update existing symbol if id matches', async () => {
      const existingSprite = `<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="home" viewBox="0 0 16 16">
    <old-path/>
  </symbol>
</svg>`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingSprite);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToSpriteSvg('/output', 'home', '<svg><new-path/></svg>', mockTransformer);

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('<symbol id="home"');
      expect(writtenContent).not.toContain('<old-path/>');
    });
  });

  describe('removeFromIconsJs', () => {
    it('should return false if icons.js does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = removeFromIconsJs('/output', ['icon1']);

      expect(result).toBe(false);
    });

    it('should remove specified icons from file', () => {
      const existingContent = `export const icon1 = {
  name: 'icon1',
  body: '<path1/>',
  viewBox: '0 0 24 24'
};

export const icon2 = {
  name: 'icon2',
  body: '<path2/>',
  viewBox: '0 0 24 24'
};

export const icons = {
  icon1,
  icon2
};`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingContent);
      mockFs.writeFileSync.mockImplementation(() => {});

      const result = removeFromIconsJs('/output', ['icon1']);

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).not.toContain('export const icon1');
      expect(writtenContent).toContain('export const icon2');
    });

    it('should remove multiple icons at once', () => {
      const existingContent = `export const icon1 = { name: 'icon1' };
export const icon2 = { name: 'icon2' };
export const icon3 = { name: 'icon3' };`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingContent);
      mockFs.writeFileSync.mockImplementation(() => {});

      removeFromIconsJs('/output', ['icon1', 'icon3']);

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).not.toContain('export const icon1');
      expect(writtenContent).toContain('export const icon2');
      expect(writtenContent).not.toContain('export const icon3');
    });
  });

  describe('getIconNamesFromFile', () => {
    it('should return empty array if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = getIconNamesFromFile('/output');

      expect(result).toEqual([]);
    });

    it('should extract icon names from file', () => {
      const content = `export const homeIcon = {
  name: 'home',
  body: '<path/>'
};

export const arrowLeft = {
  name: 'arrow-left',
  body: '<path/>'
};`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(content);

      const result = getIconNamesFromFile('/output');

      expect(result).toContain('home');
      expect(result).toContain('arrow-left');
    });

    it('should handle empty file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('');

      const result = getIconNamesFromFile('/output');

      expect(result).toEqual([]);
    });
  });

  describe('generateWebComponent', () => {
    it('should generate web component content', async () => {
      const result = await generateWebComponent('/output');

      expect(result.path).toContain('svg-element.js');
      expect(result.content).toContain('class IconElement extends HTMLElement');
      expect(result.content).toContain('customElements.define');
    });

    it('should include name, size, color attributes', async () => {
      const result = await generateWebComponent('/output');

      expect(result.content).toContain("'name'");
      expect(result.content).toContain("'size'");
      expect(result.content).toContain("'color'");
    });
  });

  // =====================================================
  // TDD: Animación - sprite.svg y icons.js
  // =====================================================

  describe('TDD: Animación en sprite.svg', () => {
    // Usar transformer REAL para estos tests (sin mock)
    let realTransformer: SvgTransformer;

    beforeEach(() => {
      realTransformer = new SvgTransformer();
      // NO hacer mock de extractSvgBody para estos tests
    });

    const svgWithAnimation = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <style id="icon-manager-animation">
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .icon-anim-123 { animation: spin 2s linear infinite; }
      </style>
      <g class="icon-anim-123">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      </g>
    </svg>`;

    it('addToSpriteSvg debe limpiar animación del SVG antes de guardar', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToSpriteSvg('/output', 'animated', svgWithAnimation, realTransformer);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];

      // El sprite NO debe contener estilos de animación
      expect(writtenContent).not.toContain('icon-manager-animation');
      expect(writtenContent).not.toContain('@keyframes');
      expect(writtenContent).not.toContain('icon-anim-');

      // Pero sí debe contener el path
      expect(writtenContent).toContain('path');
      expect(writtenContent).toContain('<symbol id="animated"');
    });

    it('addToSpriteSvg debe preservar el contenido del path al limpiar animación', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToSpriteSvg('/output', 'test', svgWithAnimation, realTransformer);

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('d="M12 2L2 7l10 5 10-5-10-5z"');
    });

    it('al actualizar símbolo existente con animación, debe limpiarla', async () => {
      const existingSprite = `<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="animated" viewBox="0 0 24 24">
    <path d="old"/>
  </symbol>
</svg>`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(existingSprite);
      mockFs.writeFileSync.mockImplementation(() => {});

      await addToSpriteSvg('/output', 'animated', svgWithAnimation, realTransformer);

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];

      // Debe actualizar pero sin animación
      expect(writtenContent).not.toContain('icon-manager-animation');
      expect(writtenContent).not.toContain('@keyframes');
      expect(writtenContent).toContain('d="M12 2L2 7l10 5 10-5-10-5z"');
    });
  });

  describe('TDD: Animación en icons.js', () => {
    // Usar transformer REAL para estos tests
    let realTransformer: SvgTransformer;

    beforeEach(() => {
      realTransformer = new SvgTransformer();
    });

    const svgWithAnimation = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <style id="icon-manager-animation">
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .icon-anim-456 { animation: pulse 1.5s ease-in-out infinite; }
      </style>
      <g class="icon-anim-456">
        <circle cx="12" cy="12" r="10"/>
      </g>
    </svg>`;

    it('addToIconsJs debe limpiar animación del body', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToIconsJs({ outputPath: '/output', iconName: 'pulsing', svgContent: svgWithAnimation, transformer: realTransformer });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];

      // El body NO debe contener estilos de animación
      expect(writtenContent).not.toContain('icon-manager-animation');
      expect(writtenContent).not.toContain('@keyframes');
      expect(writtenContent).not.toContain('icon-anim-');

      // Pero sí debe contener el circle
      expect(writtenContent).toContain('circle');
      expect(writtenContent).toContain('cx="12"');
    });

    it('addToIconsJs debe mantener el viewBox correcto', async () => {
      mockFs.existsSync.mockImplementation(p => {
        if (p === '/output') return true;
        return false;
      });
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await addToIconsJs({ outputPath: '/output', iconName: 'test-icon', svgContent: svgWithAnimation, transformer: realTransformer });

      const writtenContent = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain("viewBox: '0 0 24 24'");
    });
  });

  describe('TDD: Ciclo completo sin duplicación', () => {
    let realTransformer: SvgTransformer;

    beforeEach(() => {
      realTransformer = new SvgTransformer();
    });

    it('múltiples guardados del mismo icono con animación NO deben acumular estilos', async () => {
      const svgRound1 = `<svg viewBox="0 0 24 24">
        <style id="icon-manager-animation">@keyframes spin { }</style>
        <g class="icon-anim-1"><path d="M1"/></g>
      </svg>`;

      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);

      // Primer guardado
      await addToSpriteSvg('/output', 'test', svgRound1, realTransformer);

      const content1 = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
      const animCount1 = (content1.match(/icon-manager-animation/g) || []).length;

      // Segundo guardado con "nueva animación"
      const svgRound2 = `<svg viewBox="0 0 24 24">
        <style id="icon-manager-animation">@keyframes pulse { }</style>
        <g class="icon-anim-2"><path d="M1"/></g>
      </svg>`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(content1);

      await addToSpriteSvg('/output', 'test', svgRound2, realTransformer);

      const content2 = (mockFs.writeFileSync as jest.Mock).mock.calls[1][1];
      const animCount2 = (content2.match(/icon-manager-animation/g) || []).length;

      // Ninguno de los contenidos debe tener animación
      expect(animCount1).toBe(0);
      expect(animCount2).toBe(0);
    });
  });
});

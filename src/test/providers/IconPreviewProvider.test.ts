/**
 * Tests para IconPreviewProvider
 *
 * Requisitos cubiertos:
 * - RF-5.6: Vista de preview en sidebar
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { IconPreviewProvider } from '../../providers/IconPreviewProvider';

// Mock de svgo
jest.mock('svgo', () => ({
  optimize: jest.fn((svg: string) => ({
    data: svg.replace(/\s+/g, ' ').trim(),
  })),
}));

// Mock de fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn((filePath: string, encoding?: string) => {
    if (filePath.includes('IconPreview.css')) {
      return '/* Mock CSS */';
    }
    return jest.requireActual('fs').readFileSync(filePath, encoding);
  }),
}));

describe('IconPreviewProvider', () => {
  let provider: IconPreviewProvider;
  let mockExtensionUri: vscode.Uri;
  let mockWebviewView: any;
  let messageHandler: (message: any) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExtensionUri = vscode.Uri.file('/test/extension');
    provider = new IconPreviewProvider(mockExtensionUri);

    // Mock del WebviewView
    mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn((handler: any) => {
          messageHandler = handler;
          return { dispose: jest.fn() };
        }),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================
  // Propiedades estáticas
  // =====================================================

  describe('propiedades estáticas', () => {
    test('viewType debe ser "sageboxIconStudio.preview"', () => {
      expect(IconPreviewProvider.viewType).toBe('sageboxIconStudio.preview');
    });
  });

  // =====================================================
  // resolveWebviewView
  // =====================================================

  describe('resolveWebviewView', () => {
    test('debe configurar opciones del webview', () => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      expect(mockWebviewView.webview.options.enableScripts).toBe(true);
      expect(mockWebviewView.webview.options.localResourceRoots).toContain(mockExtensionUri);
    });

    test('debe establecer HTML inicial', () => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      expect(mockWebviewView.webview.html).toBeDefined();
      expect(typeof mockWebviewView.webview.html).toBe('string');
    });

    test('debe registrar listener de mensajes', () => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });

  // =====================================================
  // Manejo de mensajes
  // =====================================================

  describe('manejo de mensajes', () => {
    beforeEach(() => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
    });

    test('comando copyName debe copiar nombre al portapapeles', async () => {
      // Primero establecer el nombre actual mediante update
      (provider as any)._currentName = 'test-icon';

      await messageHandler({ command: 'copyName' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('test-icon');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('test-icon')
      );
    });

    test('comando copySvg debe copiar SVG al portapapeles', async () => {
      (provider as any)._currentSvg = '<svg><path/></svg>';

      await messageHandler({ command: 'copySvg' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('<svg><path/></svg>');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('SVG copied to clipboard');
    });

    test('comando copySvg con svg en mensaje debe usar ese svg', async () => {
      (provider as any)._currentSvg = '<svg>original</svg>';

      await messageHandler({ command: 'copySvg', svg: '<svg>modified</svg>' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('<svg>modified</svg>');
    });

    // Removed test for resetColors - command no longer exists in provider

    test('comando goToLocation debe abrir archivo en la posición', async () => {
      (provider as any)._currentLocation = { file: '/test/file.tsx', line: 10 };

      await messageHandler({ command: 'goToLocation' });

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('comando goToLocation sin location no debe hacer nada', async () => {
      (provider as any)._currentLocation = undefined;

      await messageHandler({ command: 'goToLocation' });

      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('comando optimizeSvg debe optimizar y enviar resultado', async () => {
      await messageHandler({
        command: 'optimizeSvg',
        svg: '<svg>  <path/>  </svg>',
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'svgOptimized',
        })
      );
    });

    test('comando goToUsage debe abrir archivo en posición especificada', async () => {
      await messageHandler({
        command: 'goToUsage',
        file: '/test/component.tsx',
        line: 25,
      });

      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('comando findUsages debe buscar usos del icono', async () => {
      (provider as any)._currentName = 'home-icon';

      await messageHandler({ command: 'findUsages' });

      // Debe enviar resultado de usages al webview
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
    });
  });

  // =====================================================
  // Update de preview
  // =====================================================

  describe('updatePreview', () => {
    beforeEach(() => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
    });

    test('debe actualizar HTML con nuevo SVG', () => {
      provider.updatePreview('test-icon', '<svg><path/></svg>');

      expect(mockWebviewView.webview.html).toContain('test-icon');
    });

    test('debe actualizar con location', () => {
      provider.updatePreview('test-icon', '<svg><path/></svg>', {
        file: '/test/icons.tsx',
        line: 15,
      });

      expect((provider as any)._currentLocation).toEqual({ file: '/test/icons.tsx', line: 15 });
    });

    test('debe actualizar con isBuilt flag', () => {
      provider.updatePreview('test-icon', '<svg><path/></svg>', undefined, true);

      expect((provider as any)._isBuilt).toBe(true);
    });
  });

  // =====================================================
  // Clear
  // =====================================================

  describe('clearPreview', () => {
    beforeEach(() => {
      provider.resolveWebviewView(
        mockWebviewView as vscode.WebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
    });

    test('debe limpiar el preview', () => {
      (provider as any)._currentSvg = '<svg/>';
      (provider as any)._currentName = 'test';

      provider.clearPreview();

      expect((provider as any)._currentSvg).toBeUndefined();
      expect((provider as any)._currentName).toBeUndefined();
    });
  });
});

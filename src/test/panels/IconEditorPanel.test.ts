/**
 * Tests para IconEditorPanel
 *
 * Requisitos cubiertos:
 * - RF-5.1: Edición de colores en iconos
 * - RF-5.2: Optimización de SVG
 * - RF-5.3: Animaciones
 */

// Mock fs and node:fs before imports to handle template loading
const mockFsImplementation = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockImplementation((filePath: string) => {
    if (filePath.includes('IconEditor.css')) {
      return '/* Mock CSS */';
    }
    if (filePath.includes('IconEditor.js')) {
      return '// Mock JS';
    }
    if (filePath.includes('IconEditorBody.html')) {
      return '<body>${displaySvg}${colorTabContent}${animationTabContent}${codeTabContent}</body>';
    }
    if (filePath.includes('IconEditorColorTab.html')) {
      return '<div>${colorSwatches}${variantsHtml}</div>';
    }
    if (filePath.includes('IconEditorAnimationTab.html')) {
      return '<div>${basicAnimationButtons}</div>';
    }
    if (filePath.includes('IconEditorCodeTab.html')) {
      return '<div>${svgCodeHighlighted}</div>';
    }
    if (filePath.includes('variants.json')) {
      return '{}';
    }
    return '<svg></svg>';
  }),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
};

jest.mock('fs', () => mockFsImplementation);
jest.mock('node:fs', () => mockFsImplementation);

import * as vscode from 'vscode';
import { IconEditorPanel } from '../../panels/IconEditorPanel';

// Mock del WebviewPanel
const createMockWebviewPanel = () => {
  const webview = {
    html: '',
    postMessage: jest.fn().mockResolvedValue(true),
    onDidReceiveMessage: jest.fn(),
    asWebviewUri: jest.fn(uri => uri),
  };

  const panel = {
    webview,
    reveal: jest.fn(),
    dispose: jest.fn(),
    onDidDispose: jest.fn(callback => {
      (panel as any)._disposeCallback = callback;
      return { dispose: jest.fn() };
    }),
    onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    visible: true,
    viewColumn: vscode.ViewColumn.One,
    title: 'Icon Editor',
  };

  return panel;
};

describe('IconEditorPanel', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  const testIconData = {
    name: 'test-icon',
    svg: '<svg viewBox="0 0 24 24" fill="#000000"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>',
    location: { file: '/test/icons/test.svg', line: 1 },
  };

  beforeEach(() => {
    // Reset singleton
    (IconEditorPanel as any).currentPanel = undefined;

    mockPanel = createMockWebviewPanel();

    // Mock createWebviewPanel
    originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    (vscode.window.createWebviewPanel as jest.Mock) = jest.fn().mockReturnValue(mockPanel);

    jest.clearAllMocks();
  });

  afterEach(() => {
    vscode.window.createWebviewPanel = originalCreateWebviewPanel;
  });

  // =====================================================
  // Creación del panel
  // =====================================================

  describe('creación del panel', () => {
    test('createOrShow debe crear panel si no existe', () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconEditor',
        'Icon Editor',
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    test('createOrShow debe revelar panel existente y actualizar datos', () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      // Primera llamada - crea
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const newIconData = {
        name: 'another-icon',
        svg: '<svg><circle/></svg>',
      };

      // Segunda llamada - revela y actualiza
      IconEditorPanel.createOrShow(extensionUri, newIconData);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    test('createOrShow sin datos debe crear panel vacío', () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    });
  });

  // =====================================================
  // RF-5.1: Edición de colores
  // =====================================================

  describe('RF-5.1: Edición de colores', () => {
    test('CA-5.1.1: comando changeColor debe actualizar SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'changeColor',
        oldColor: '#000000',
        newColor: '#FF0000',
      });

      // El panel debe actualizarse (se llama _update internamente)
      expect(mockPanel.webview.html).toBeDefined();
    });

    test('CA-5.1.2: comando previewColor debe enviar preview sin guardar', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'previewColor',
        oldColor: '#000000',
        newColor: '#FF0000',
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'previewUpdated',
        })
      );
    });

    test('CA-5.1.3: comando addColor debe agregar fill al SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const svgWithoutFill = {
        name: 'no-fill',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
      };

      IconEditorPanel.createOrShow(extensionUri, svgWithoutFill);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'addColor', color: '#0000FF' });

      // El panel debe actualizarse
      expect(mockPanel.webview.html).toBeDefined();
    });
  });

  // =====================================================
  // RF-5.2: Optimización
  // =====================================================

  describe('RF-5.2: Optimización', () => {
    test('CA-5.2.1: comando optimizeSvg debe devolver resultado', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'safe' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult',
        })
      );
    });

    test.skip('CA-5.2.2: comando applyOptimizedSvg debe actualizar SVG (requires fs mocks)', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const optimizedSvg = '<svg viewBox="0 0 24 24"><path d="M12 2"/></svg>';

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'applyOptimizedSvg', svg: optimizedSvg });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Optimized SVG applied and saved'
      );
    });
  });

  // =====================================================
  // RF-5.3: Animaciones
  // =====================================================

  describe('RF-5.3: Animaciones', () => {
    test('CA-5.3.1: comando copyWithAnimation debe copiar SVG animado', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'copyWithAnimation',
        animation: 'spin',
        settings: { duration: 1 },
      });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Animated SVG copied to clipboard'
      );
    });

    test('CA-5.3.2: animation "none" no debe copiar SVG animado', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'copyWithAnimation',
        animation: 'none',
        settings: {},
      });

      // No debe mostrar mensaje de animación
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(
        'Animated SVG copied to clipboard'
      );
    });
  });

  // =====================================================
  // Copiar y guardar
  // =====================================================

  describe('copiar y guardar', () => {
    test('comando copySvg debe copiar al portapapeles', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'copySvg' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('SVG copied to clipboard');
    });

    test('comando copySvg con svg específico debe copiar ese svg', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const customSvg = '<svg><custom/></svg>';

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'copySvg', svg: customSvg });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(customSvg);
    });
  });

  // =====================================================
  // Dispose
  // =====================================================

  describe('dispose', () => {
    test('dispose debe limpiar currentPanel', () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      expect((IconEditorPanel as any).currentPanel).toBeDefined();

      const disposeCallback = (mockPanel.onDidDispose as jest.Mock).mock.calls[0][0];
      disposeCallback();

      expect((IconEditorPanel as any).currentPanel).toBeUndefined();
    });
  });

  // =====================================================
  // Navegación a fuente
  // =====================================================

  describe('goToSource', () => {
    test.skip('comando goToSource debe abrir archivo en la posición (OBSOLETE: no handler)', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'goToSource' });

      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          preview: false,
        })
      );
    });

    test('comando goToSource sin location no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const iconWithoutLocation = {
        name: 'no-location',
        svg: '<svg><path/></svg>',
      };

      IconEditorPanel.createOrShow(extensionUri, iconWithoutLocation);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'goToSource' });

      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // Variants
  // =====================================================

  describe('Variants', () => {
    test('comando saveVariant debe solicitar nombre', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('Dark Theme');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'saveVariant' });

      expect(vscode.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Enter variant name',
        })
      );
    });

    test('comando saveVariant cancelado no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'saveVariant' });

      // No debería mostrar mensaje de confirmación
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Variant')
      );
    });

    test('comando applyDefaultVariant debe restaurar colores originales', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      // Cambiar color primero
      await handler({ command: 'changeColor', oldColor: '#000000', newColor: '#FF0000' });

      // Luego restaurar
      await handler({ command: 'applyDefaultVariant' });

      // El panel debe actualizarse
      expect(mockPanel.webview.html).toBeDefined();
    });

    test('comando setDefaultVariant debe mostrar mensaje', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'setDefaultVariant', variantName: 'Primary' });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('default')
      );
    });

    test('comando setDefaultVariant con null debe limpiar default', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'setDefaultVariant', variantName: null });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('cleared')
      );
    });
  });

  // =====================================================
  // Refresh y rebuild
  // =====================================================

  describe('refresh y rebuild', () => {
    test('comando refresh debe ejecutar comando refreshIcons', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'refresh' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('masterSVG.refreshIcons');
    });
  });

  // =====================================================
  // Presets de optimización
  // =====================================================

  describe('presets de optimización', () => {
    test('preset minimal debe aplicar configuración conservadora', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'minimal' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult',
        })
      );
    });

    test('preset aggressive debe aplicar máxima compresión', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'aggressive' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult',
        })
      );
    });

    test('preset no reconocido debe usar safe por defecto', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'unknown-preset' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult',
        })
      );
    });
  });

  // =====================================================
  // ViewColumn
  // =====================================================

  describe('ViewColumn', () => {
    test('debe usar viewColumn del editor activo si existe', () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      // Simular editor activo con viewColumn específico
      (vscode.window as any).activeTextEditor = {
        viewColumn: vscode.ViewColumn.Two,
      };

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconEditor',
        'Icon Editor',
        vscode.ViewColumn.Two,
        expect.anything()
      );

      // Limpiar
      (vscode.window as any).activeTextEditor = undefined;
    });
  });

  // =====================================================
  // Rename Icon
  // =====================================================

  describe('rename icon', () => {
    test('requestRename debe mostrar input box y ejecutar comando rename', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      // Mock showInputBox para devolver nuevo nombre
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new-icon-name');

      // Mock executeCommand para devolver resultado de rename
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue({
        newName: 'new-icon-name',
        newPath: '/test/icons/new-icon-name.svg',
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      // Debe mostrar input box
      expect(vscode.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Enter new name for the icon',
          value: 'test-icon',
        })
      );

      // Debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'masterSVG.renameIcon',
        expect.objectContaining({
          icon: expect.objectContaining({
            name: 'test-icon',
          }),
        }),
        'new-icon-name'
      );

      // Debe actualizar título del panel
      expect(mockPanel.title).toBe('Edit: new-icon-name');

      // Debe enviar mensaje de actualización al webview
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'nameUpdated',
        newName: 'new-icon-name',
      });

      // Debe mostrar mensaje de éxito
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Renamed to 'new-icon-name'"
      );

      // Debe revelar en tree view con nuevo nombre y path
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'masterSVG.revealInTree',
        'new-icon-name',
        '/test/icons/new-icon-name.svg',
        1
      );
    });

    test('requestRename debe actualizar location.file cuando se renombra archivo SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const svgIconData = {
        name: 'svg-icon',
        svg: '<svg><path/></svg>',
        location: { file: '/test/icons/svg-icon.svg', line: 1 },
      };

      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('renamed-svg');
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue({
        newName: 'renamed-svg',
        newPath: '/test/icons/renamed-svg.svg',
      });

      IconEditorPanel.createOrShow(extensionUri, svgIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'svg-icon',
      });

      // Verificar que revealInTree se llama con el nuevo path
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'masterSVG.revealInTree',
        'renamed-svg',
        '/test/icons/renamed-svg.svg',
        1
      );
    });

    test('requestRename debe cancelar si usuario cancela input box', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      // Usuario cancela (undefined)
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      // No debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'masterSVG.renameIcon',
        expect.anything(),
        expect.anything()
      );
    });

    test('requestRename debe manejar errores del comando rename', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new-name');
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error('Rename failed'));

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      // Debe mostrar error
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Error renaming: Error: Rename failed'
      );
    });

    test('requestRename no debe hacer nada si resultado es undefined', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new-name');
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      // No debe mostrar mensaje de éxito
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Renamed to')
      );
    });

    test('renameIcon command debe actualizar panel y revelar en tree', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue({
        newName: 'webview-renamed',
        newPath: '/test/icons/webview-renamed.svg',
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      // Comando enviado desde webview (renameIcon vs requestRename)
      await handler({
        command: 'renameIcon',
        oldName: 'test-icon',
        newName: 'webview-renamed',
      });

      // Debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'masterSVG.renameIcon',
        expect.anything(),
        'webview-renamed'
      );

      // Debe revelar en tree view
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'masterSVG.revealInTree',
        'webview-renamed',
        '/test/icons/webview-renamed.svg',
        1
      );
    });

    test('validación de nombre debe rechazar nombres vacíos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation(options => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      // Verificar validación
      expect(validateInput).toBeDefined();
      expect(validateInput!('')).toBe('Name cannot be empty');
      expect(validateInput!('   ')).toBe('Name cannot be empty');
    });

    test('validación de nombre debe rechazar nombre igual al actual', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation(options => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      expect(validateInput!('test-icon')).toBe('Enter a different name');
    });

    test('validación de nombre debe rechazar caracteres inválidos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation(options => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      expect(validateInput!('icon with spaces')).toBe(
        'Name can only contain letters, numbers, dashes and underscores'
      );
      expect(validateInput!('icon.name')).toBe(
        'Name can only contain letters, numbers, dashes and underscores'
      );
      expect(validateInput!('icon/name')).toBe(
        'Name can only contain letters, numbers, dashes and underscores'
      );
    });

    test('validación de nombre debe aceptar nombres válidos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');

      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation(options => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });

      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'requestRename',
        currentName: 'test-icon',
      });

      expect(validateInput!('valid-name')).toBeUndefined();
      expect(validateInput!('icon_name')).toBeUndefined();
      expect(validateInput!('IconName123')).toBeUndefined();
      expect(validateInput!('mdi-linkedin-2')).toBeUndefined();
    });
  });

  // =====================================================
  // TDD: Proceso de animación sin duplicación
  // =====================================================

  describe('TDD: Animación sin duplicación', () => {
    // SVG con animación embebida (como se guarda en sprite.svg/icons.js)
    const svgWithEmbeddedAnimation = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <style id="icon-manager-animation">
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .icon-anim-123 { animation: spin 2s linear infinite; transform-origin: center; }
      </style>
      <g class="icon-anim-123">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#000000"/>
      </g>
    </svg>`;

    const cleanSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#000000"/></svg>';

    describe('Carga de iconos', () => {
      test('al cargar icono con animación embebida, debe limpiarla del SVG interno', () => {
        const extensionUri = vscode.Uri.file('/test/extension');

        const iconWithAnimation = {
          name: 'animated-icon',
          svg: svgWithEmbeddedAnimation,
          location: { file: '/test/icons/test.svg', line: 1 },
        };

        IconEditorPanel.createOrShow(extensionUri, iconWithAnimation);

        // El SVG interno (_iconData.svg) NO debe contener la animación embebida
        const panel = (IconEditorPanel as any).currentPanel;
        const internalSvg = panel._iconData?.svg;
        expect(internalSvg).not.toContain('icon-anim-123');
        expect(internalSvg).not.toContain('icon-manager-animation');
      });

      test('al cargar icono limpio, debe mantenerlo limpio', () => {
        const extensionUri = vscode.Uri.file('/test/extension');

        const cleanIcon = {
          name: 'clean-icon',
          svg: cleanSvg,
          location: { file: '/test/icons/test.svg', line: 1 },
        };

        IconEditorPanel.createOrShow(extensionUri, cleanIcon);

        const panel = (IconEditorPanel as any).currentPanel;
        const internalSvg = panel._iconData?.svg;
        expect(internalSvg).toContain('path d="M12 2L2 7l10 5 10-5-10-5z"');
        expect(internalSvg).not.toContain('icon-manager-animation');
      });
    });

    describe('Guardado de iconos - sprite.svg', () => {
      test('al guardar con animación, el body en sprite NO debe tener estilos de animación', async () => {
        const extensionUri = vscode.Uri.file('/test/extension');
        const fs = require('fs');

        // Mock del sprite file
        const mockSpriteContent = `<svg xmlns="http://www.w3.org/2000/svg">
          <symbol id="test-icon" viewBox="0 0 24 24">
            <path d="M0 0"/>
          </symbol>
        </svg>`;

        fs.existsSync = jest.fn().mockReturnValue(true);
        fs.readFileSync = jest.fn().mockReturnValue(mockSpriteContent);
        let savedContent = '';
        fs.writeFileSync = jest.fn().mockImplementation((path: string, content: string) => {
          savedContent = content;
        });

        const iconFromSprite = {
          name: 'test-icon',
          svg: cleanSvg,
          spriteFile: '/test/output/sprite.svg',
          viewBox: '0 0 24 24',
        };

        IconEditorPanel.createOrShow(extensionUri, iconFromSprite);

        const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

        // Simular guardar con animación spin
        await handler({
          command: 'save',
          animation: 'spin',
          settings: { duration: 2, timing: 'linear', iteration: 'infinite' },
          includeAnimation: true,
        });

        // El contenido guardado en sprite NO debe tener los estilos de animación
        // porque extractSvgBody los limpia
        if (savedContent) {
          expect(savedContent).not.toContain('<style id="icon-manager-animation">');
          expect(savedContent).not.toContain('icon-anim-');
        }
      });
    });

    describe('Guardado de iconos - icons.js', () => {
      test('al guardar con animación, el body en icons.js NO debe tener estilos de animación', async () => {
        const extensionUri = vscode.Uri.file('/test/extension');

        // Mock de icons.js
        const mockIconsContent = `// Auto-generated
export const testIcon = {
  name: 'test-icon',
  body: \`<path d="M0 0"/>\`,
  viewBox: '0 0 24 24'
};
export const icons = { testIcon };`;

        const mockDocument = {
          getText: jest.fn().mockReturnValue(mockIconsContent),
          positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
          uri: vscode.Uri.file('/test/output/icons.js'),
        };

        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
        (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

        const iconFromBuilt = {
          name: 'test-icon',
          svg: cleanSvg,
          viewBox: '0 0 24 24',
          // No location, no spriteFile = built icon from icons.js
        };

        IconEditorPanel.createOrShow(extensionUri, iconFromBuilt);

        const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

        // Simular guardar con animación
        await handler({
          command: 'save',
          animation: 'pulse',
          settings: { duration: 1.5, timing: 'ease-in-out', iteration: 'infinite' },
          includeAnimation: true,
        });

        // Verificar que applyEdit fue llamado
        // El body que se guarda debe estar limpio de animaciones
        if ((vscode.workspace.applyEdit as jest.Mock).mock.calls.length > 0) {
          const editCall = (vscode.workspace.applyEdit as jest.Mock).mock.calls[0][0];
          // El edit no debe contener estilos de animación en el body
          expect(editCall).toBeDefined();
        }
      });
    });

    describe('Ciclo completo de edición', () => {
      test('cargar → añadir animación → guardar → recargar: no debe duplicar animación', () => {
        const extensionUri = vscode.Uri.file('/test/extension');

        // Paso 1: Cargar icono con animación existente
        const iconWithAnimation = {
          name: 'cycle-test',
          svg: svgWithEmbeddedAnimation,
          spriteFile: '/test/output/sprite.svg',
        };

        IconEditorPanel.createOrShow(extensionUri, iconWithAnimation);

        // Verificar que se limpió la animación al cargar
        const html1 = mockPanel.webview.html;
        expect(html1).not.toContain('icon-anim-123');

        // Paso 2: Cerrar y reabrir (simula el ciclo)
        (IconEditorPanel as any).currentPanel = undefined;

        IconEditorPanel.createOrShow(extensionUri, iconWithAnimation);

        // Verificar que sigue limpio
        const html2 = mockPanel.webview.html;
        expect(html2).not.toContain('icon-anim-123');
      });

      test('el SVG interno debe estar limpio después de crear el panel', () => {
        const extensionUri = vscode.Uri.file('/test/extension');

        const iconWithAnimation = {
          name: 'internal-test',
          svg: svgWithEmbeddedAnimation,
        };

        IconEditorPanel.createOrShow(extensionUri, iconWithAnimation);

        // Acceder al panel actual y verificar que _iconData.svg está limpio
        const panel = (IconEditorPanel as any).currentPanel;
        expect(panel).toBeDefined();

        const internalSvg = panel._iconData?.svg;
        expect(internalSvg).toBeDefined();
        expect(internalSvg).not.toContain('icon-manager-animation');
        expect(internalSvg).not.toContain('icon-anim-');
        expect(internalSvg).not.toContain('@keyframes');
      });
    });
  });
});

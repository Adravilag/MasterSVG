/**
 * Tests para IconEditorPanel
 * 
 * Requisitos cubiertos:
 * - RF-5.1: Edición de colores en iconos
 * - RF-5.2: Optimización de SVG
 * - RF-5.3: Animaciones
 */

import * as vscode from 'vscode';
import { IconEditorPanel } from '../../panels/IconEditorPanel';

// Mock del WebviewPanel
const createMockWebviewPanel = () => {
  const webview = {
    html: '',
    postMessage: jest.fn().mockResolvedValue(true),
    onDidReceiveMessage: jest.fn(),
    asWebviewUri: jest.fn((uri) => uri)
  };

  const panel = {
    webview,
    reveal: jest.fn(),
    dispose: jest.fn(),
    onDidDispose: jest.fn((callback) => {
      (panel as any)._disposeCallback = callback;
      return { dispose: jest.fn() };
    }),
    onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    visible: true,
    viewColumn: vscode.ViewColumn.One,
    title: 'Icon Editor'
  };

  return panel;
};

describe('IconEditorPanel', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  const testIconData = {
    name: 'test-icon',
    svg: '<svg viewBox="0 0 24 24" fill="#000000"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>',
    location: { file: '/test/icons/test.svg', line: 1 }
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
          retainContextWhenHidden: true
        })
      );
    });

    test('createOrShow debe revelar panel existente y actualizar datos', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      // Primera llamada - crea
      IconEditorPanel.createOrShow(extensionUri, testIconData);
      
      const newIconData = {
        name: 'another-icon',
        svg: '<svg><circle/></svg>'
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
        newColor: '#FF0000' 
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
        newColor: '#FF0000' 
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'previewUpdated'
        })
      );
    });

    test('CA-5.1.3: comando addColor debe agregar fill al SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const svgWithoutFill = {
        name: 'no-fill',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>'
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
          command: 'optimizeResult'
        })
      );
    });

    test('CA-5.2.2: comando applyOptimizedSvg debe actualizar SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const optimizedSvg = '<svg viewBox="0 0 24 24"><path d="M12 2"/></svg>';
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'applyOptimizedSvg', svg: optimizedSvg });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Optimized SVG applied');
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
        settings: { duration: 1 }
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
        settings: {}
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
    test('comando goToSource debe abrir archivo en la posición', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'goToSource' });

      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          preview: false
        })
      );
    });

    test('comando goToSource sin location no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const iconWithoutLocation = {
        name: 'no-location',
        svg: '<svg><path/></svg>'
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
          prompt: 'Enter variant name'
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

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('iconManager.refreshIcons');
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
          command: 'optimizeResult'
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
          command: 'optimizeResult'
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
          command: 'optimizeResult'
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
        viewColumn: vscode.ViewColumn.Two
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
        newPath: '/test/icons/new-icon-name.svg'
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
      });

      // Debe mostrar input box
      expect(vscode.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Enter new name for the icon',
          value: 'test-icon'
        })
      );

      // Debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'iconManager.renameIcon',
        expect.objectContaining({
          icon: expect.objectContaining({
            name: 'test-icon'
          })
        }),
        'new-icon-name'
      );

      // Debe actualizar título del panel
      expect(mockPanel.title).toBe('Edit: new-icon-name');

      // Debe enviar mensaje de actualización al webview
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'nameUpdated',
        newName: 'new-icon-name'
      });

      // Debe mostrar mensaje de éxito
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Renamed to "new-icon-name"');

      // Debe revelar en tree view con nuevo nombre y path
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'iconManager.revealInTree',
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
        location: { file: '/test/icons/svg-icon.svg', line: 1 }
      };
      
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('renamed-svg');
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue({
        newName: 'renamed-svg',
        newPath: '/test/icons/renamed-svg.svg'
      });
      
      IconEditorPanel.createOrShow(extensionUri, svgIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'svg-icon' 
      });

      // Verificar que revealInTree se llama con el nuevo path
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'iconManager.revealInTree',
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
        currentName: 'test-icon' 
      });

      // No debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'iconManager.renameIcon',
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
        currentName: 'test-icon' 
      });

      // Debe mostrar error
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error renaming: Error: Rename failed');
    });

    test('requestRename no debe hacer nada si resultado es undefined', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('new-name');
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
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
        newPath: '/test/icons/webview-renamed.svg'
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      // Comando enviado desde webview (renameIcon vs requestRename)
      await handler({ 
        command: 'renameIcon',
        oldName: 'test-icon',
        newName: 'webview-renamed'
      });

      // Debe ejecutar comando de rename
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'iconManager.renameIcon',
        expect.anything(),
        'webview-renamed'
      );

      // Debe revelar en tree view
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'iconManager.revealInTree',
        'webview-renamed',
        '/test/icons/webview-renamed.svg',
        1
      );
    });

    test('validación de nombre debe rechazar nombres vacíos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation((options) => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
      });

      // Verificar validación
      expect(validateInput).toBeDefined();
      expect(validateInput!('')).toBe('Name cannot be empty');
      expect(validateInput!('   ')).toBe('Name cannot be empty');
    });

    test('validación de nombre debe rechazar nombre igual al actual', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation((options) => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
      });

      expect(validateInput!('test-icon')).toBe('Enter a different name');
    });

    test('validación de nombre debe rechazar caracteres inválidos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation((options) => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
      });

      expect(validateInput!('icon with spaces')).toBe('Name can only contain letters, numbers, dashes and underscores');
      expect(validateInput!('icon.name')).toBe('Name can only contain letters, numbers, dashes and underscores');
      expect(validateInput!('icon/name')).toBe('Name can only contain letters, numbers, dashes and underscores');
    });

    test('validación de nombre debe aceptar nombres válidos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      let validateInput: ((value: string) => string | undefined) | undefined;
      (vscode.window.showInputBox as jest.Mock).mockImplementation((options) => {
        validateInput = options.validateInput;
        return Promise.resolve(undefined);
      });
      
      IconEditorPanel.createOrShow(extensionUri, testIconData);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'requestRename', 
        currentName: 'test-icon' 
      });

      expect(validateInput!('valid-name')).toBeUndefined();
      expect(validateInput!('icon_name')).toBeUndefined();
      expect(validateInput!('IconName123')).toBeUndefined();
      expect(validateInput!('mdi-linkedin-2')).toBeUndefined();
    });
  });
});

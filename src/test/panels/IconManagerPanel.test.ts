/**
 * Tests para IconManagerPanel
 * 
 * Requisitos cubiertos:
 * - RF-8.1: Panel principal de gestión de iconos
 * - RF-8.2: Comunicación webview-extension
 */

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('<svg></svg>'),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false })
}));

import * as vscode from 'vscode';
import { IconManagerPanel } from '../../panels/IconManagerPanel';

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
    viewColumn: vscode.ViewColumn.One
  };

  return panel;
};

// Mock del contexto de extensión
const createMockContext = (): Partial<vscode.ExtensionContext> => ({
  extensionUri: vscode.Uri.file('/test/extension'),
  globalState: {
    get: jest.fn().mockReturnValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockReturnValue([]),
    setKeysForSync: jest.fn()
  } as any,
  subscriptions: []
});

describe('IconManagerPanel', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let mockContext: Partial<vscode.ExtensionContext>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  beforeEach(() => {
    // Reset singleton
    (IconManagerPanel as any).currentPanel = undefined;
    
    mockPanel = createMockWebviewPanel();
    mockContext = createMockContext();
    
    // Mock createWebviewPanel
    originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    (vscode.window.createWebviewPanel as jest.Mock) = jest.fn().mockReturnValue(mockPanel);
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    vscode.window.createWebviewPanel = originalCreateWebviewPanel;
  });

  // =====================================================
  // RF-8.1: Panel principal
  // =====================================================

  describe('RF-8.1: Panel principal', () => {
    test('CA-8.1.1: createOrShow debe crear panel si no existe', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconManager',
        'Files',  // Uses t('treeView.files')
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });

    test('CA-8.1.2: createOrShow debe revelar panel existente', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      // Primera llamada - crea
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);
      
      // Segunda llamada - revela
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    test('CA-8.1.3: createOrShow con searchQuery debe enviar mensaje de búsqueda', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(
        extensionUri, 
        mockContext as vscode.ExtensionContext,
        'arrow'
      );

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'search',
        query: 'arrow'
      });
    });

    test('CA-8.1.4: viewType debe ser "iconManager"', () => {
      expect(IconManagerPanel.viewType).toBe('iconManager');
    });
  });

  // =====================================================
  // RF-8.2: Comunicación webview
  // =====================================================

  describe('RF-8.2: Comunicación webview', () => {
    test('CA-8.2.1: debe registrar listener de mensajes', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    test('CA-8.2.2: postMessage debe enviar mensaje al webview', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);
      
      // Acceder al panel actual y enviar mensaje
      const currentPanel = (IconManagerPanel as any).currentPanel;
      currentPanel.postMessage({ type: 'test', data: 'hello' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'test',
        data: 'hello'
      });
    });

    test('CA-8.2.3: debe manejar onDidDispose', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(mockPanel.onDidDispose).toHaveBeenCalled();
    });

    test('CA-8.2.4: dispose debe limpiar currentPanel', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);
      
      expect((IconManagerPanel as any).currentPanel).toBeDefined();
      
      // Simular dispose
      const currentPanel = (IconManagerPanel as any).currentPanel;
      currentPanel.dispose();
      
      expect((IconManagerPanel as any).currentPanel).toBeUndefined();
    });
  });

  // =====================================================
  // Manejo de mensajes
  // =====================================================

  describe('manejo de mensajes', () => {
    test('debe configurar manejador de mensajes del webview', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      // Verificar que se registró el handler
      expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledWith(
        expect.any(Function),
        null,
        expect.any(Array)
      );
    });

    test('mensaje copyToClipboard debe copiar al portapapeles', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      // Obtener el handler registrado
      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      // Simular mensaje
      await handler({ type: 'copyToClipboard', text: 'test text' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Copied to clipboard!');
    });

    test('mensaje getConfig debe devolver configuración', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'getConfig' });

      // Verificar que se envió respuesta de configuración con estructura esperada
      const call = (mockPanel.webview.postMessage as jest.Mock).mock.calls.find(
        (c: any[]) => c[0]?.type === 'config'
      );
      expect(call).toBeDefined();
      expect(call[0].data).toHaveProperty('componentName');
      expect(call[0].data).toHaveProperty('componentImport');
      expect(call[0].data).toHaveProperty('outputFormat');
      expect(call[0].data).toHaveProperty('iconNameAttribute');
      expect(call[0].data).toHaveProperty('autoImport');
    });

    test('mensaje showError debe mostrar error', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'showError', text: 'Error message' });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error message');
    });
  });

  // =====================================================
  // Cambios de estado
  // =====================================================

  describe('cambios de estado del panel', () => {
    test('debe registrar listener de onDidChangeViewState', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(mockPanel.onDidChangeViewState).toHaveBeenCalled();
    });
  });

  // =====================================================
  // Mensajes adicionales
  // =====================================================

  describe('mensajes adicionales', () => {
    test('mensaje showInfo debe mostrar información', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'showInfo', text: 'Information message' });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Information message');
    });

    test('mensaje scanWorkspace debe ejecutar comando', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'scanWorkspace' });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('iconManager.scanWorkspace');
    });

    test('mensaje openFile debe abrir documento', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const testPath = '/test/icons/arrow.svg';
      
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
        uri: vscode.Uri.file(testPath)
      });
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'openFile', path: testPath });

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(testPath);
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('mensaje getWorkspaceIcons debe enviar iconos', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'getWorkspaceIcons' });

      // Debe enviar mensaje con iconos (array vacío si no hay workspace)
      const call = (mockPanel.webview.postMessage as jest.Mock).mock.calls.find(
        (c: any[]) => c[0]?.type === 'workspaceIcons'
      );
      expect(call).toBeDefined();
      expect(call[0]).toHaveProperty('icons');
    });

    test('mensaje getLibraryIcons debe enviar iconos de librería', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'getLibraryIcons' });

      // Debe enviar mensaje con iconos de librería
      const call = (mockPanel.webview.postMessage as jest.Mock).mock.calls.find(
        (c: any[]) => c[0]?.type === 'libraryIcons'
      );
      expect(call).toBeDefined();
    });
  });

  // =====================================================
  // Insert icon
  // =====================================================

  describe('insert icon', () => {
    test('mensaje insertIcon debe insertar snippet en editor', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      // Mock editor activo
      const mockEditor = {
        insertSnippet: jest.fn().mockResolvedValue(true),
        document: { uri: vscode.Uri.file('/test/file.tsx') }
      };
      (vscode.window as any).activeTextEditor = mockEditor;
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'insertIcon', iconName: 'arrow' });

      expect(mockEditor.insertSnippet).toHaveBeenCalled();
      
      // Limpiar
      (vscode.window as any).activeTextEditor = undefined;
    });

    test('mensaje insertIcon sin editor activo debe mostrar error', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window as any).activeTextEditor = undefined;
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'insertIcon', iconName: 'arrow' });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active editor');
    });

    test('mensaje insertIcon con formato html debe generar iconify-icon', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      const mockEditor = {
        insertSnippet: jest.fn().mockResolvedValue(true),
        document: { uri: vscode.Uri.file('/test/file.html') }
      };
      (vscode.window as any).activeTextEditor = mockEditor;
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ type: 'insertIcon', iconName: 'arrow', format: 'html' });

      // Verificar que se insertó el snippet correcto
      const call = mockEditor.insertSnippet.mock.calls[0][0];
      expect(call.value).toContain('iconify-icon');
      expect(call.value).toContain('arrow');
      
      // Limpiar
      (vscode.window as any).activeTextEditor = undefined;
    });
  });

  // =====================================================
  // ViewColumn
  // =====================================================

  describe('ViewColumn', () => {
    test('debe usar viewColumn del editor activo si existe', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window as any).activeTextEditor = {
        viewColumn: vscode.ViewColumn.Two
      };
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconManager',
        'Files',  // Uses t('treeView.files')
        vscode.ViewColumn.Two,
        expect.anything()
      );
      
      (vscode.window as any).activeTextEditor = undefined;
    });

    test('debe usar ViewColumn.One si no hay editor activo', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window as any).activeTextEditor = undefined;
      
      IconManagerPanel.createOrShow(extensionUri, mockContext as vscode.ExtensionContext);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconManager',
        'Files',  // Uses t('treeView.files')
        vscode.ViewColumn.One,
        expect.anything()
      );
    });
  });
});


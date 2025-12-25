/**
 * Tests para IconCatalogPanel
 * 
 * Requisitos cubiertos:
 * - RF-7.1: Búsqueda en catálogo desde panel
 * - RF-7.2: Descarga de iconos
 */

import * as vscode from 'vscode';
import { IconCatalogPanel } from '../../panels/IconCatalogPanel';
import { IconCatalogService, CatalogIcon } from '../../services/IconCatalogService';

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

// Mock del servicio de catálogo
const createMockCatalogService = (): Partial<IconCatalogService> => ({
  searchIcons: jest.fn().mockResolvedValue([
    { name: 'arrow-left', collection: 'lucide', svg: '<svg></svg>' },
    { name: 'home', collection: 'lucide', svg: '<svg></svg>' }
  ]),
  fetchIconSvg: jest.fn().mockResolvedValue('<svg viewBox="0 0 24 24"><path/></svg>'),
  addIconToProject: jest.fn().mockReturnValue({
    name: 'test-icon',
    collection: 'lucide',
    svg: '<svg></svg>',
    license: 'ISC',
    addedAt: Date.now()
  }),
  getCollections: jest.fn().mockReturnValue([
    { id: 'lucide', name: 'Lucide Icons' }
  ])
});

describe('IconCatalogPanel', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let mockCatalogService: Partial<IconCatalogService>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  beforeEach(() => {
    // Reset singleton
    (IconCatalogPanel as any).currentPanel = undefined;
    
    mockPanel = createMockWebviewPanel();
    mockCatalogService = createMockCatalogService();
    
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
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconCatalog',
        'Icon Catalog',
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });

    test('createOrShow debe revelar panel existente', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      // Primera llamada - crea
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);
      
      // Segunda llamada - revela
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    test('viewType debe ser "iconCatalog"', () => {
      expect(IconCatalogPanel.viewType).toBe('iconCatalog');
    });
  });

  // =====================================================
  // Búsqueda de iconos
  // =====================================================

  describe('búsqueda de iconos', () => {
    test('comando search debe llamar a searchIcons del servicio', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'arrow', collection: 'lucide' });

      expect(mockCatalogService.searchIcons).toHaveBeenCalledWith('arrow', 'lucide');
    });

    test('búsqueda exitosa debe enviar resultados al webview', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'arrow' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        command: 'searchStart'
      });
      
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'searchResults',
          results: expect.any(Array)
        })
      );
    });

    test('búsqueda con error debe enviar mensaje de error', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (mockCatalogService.searchIcons as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'arrow' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'searchError'
        })
      );
    });
  });

  // =====================================================
  // Fetch de SVG
  // =====================================================

  describe('fetch de SVG', () => {
    test('comando fetchSvg debe obtener SVG del icono', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const testIcon: CatalogIcon = { name: 'test', collection: 'lucide', svg: '' };
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'fetchSvg', icon: testIcon });

      expect(mockCatalogService.fetchIconSvg).toHaveBeenCalledWith(testIcon);
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'svgFetched',
          icon: 'test',
          collection: 'lucide',
          svg: expect.any(String)
        })
      );
    });
  });

  // =====================================================
  // Copiar al portapapeles
  // =====================================================

  describe('copiar al portapapeles', () => {
    test('comando copyToClipboard debe copiar SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const svgContent = '<svg viewBox="0 0 24 24"><path/></svg>';
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'copyToClipboard', svg: svgContent });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(svgContent);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('SVG copied to clipboard');
    });
  });

  // =====================================================
  // Abrir colección externa
  // =====================================================

  describe('abrir colección externa', () => {
    test('comando openCollection debe abrir URL externa', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const collectionUrl = 'https://lucide.dev';
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'openCollection', url: collectionUrl });

      expect(vscode.env.openExternal).toHaveBeenCalled();
    });
  });

  // =====================================================
  // Dispose
  // =====================================================

  describe('dispose', () => {
    test('dispose debe limpiar currentPanel', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);
      
      expect((IconCatalogPanel as any).currentPanel).toBeDefined();
      
      // Simular dispose llamando al callback registrado
      const disposeCallback = (mockPanel.onDidDispose as jest.Mock).mock.calls[0][0];
      disposeCallback();
      
      expect((IconCatalogPanel as any).currentPanel).toBeUndefined();
    });
  });

  // =====================================================
  // Añadir al proyecto
  // =====================================================

  describe('addToProject', () => {
    test('comando addToProject debe añadir icono y mostrar opciones', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '📋 Copy to clipboard',
        value: 'copy'
      });
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'addToProject', 
        icon: { name: 'test-icon', collection: 'lucide' },
        svg: '<svg><path/></svg>'
      });

      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
    });

    test('addToProject cancelado no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'addToProject', 
        icon: { name: 'test-icon', collection: 'lucide' },
        svg: '<svg><path/></svg>'
      });

      // No debe copiar si se canceló
      expect(vscode.env.clipboard.writeText).not.toHaveBeenCalledWith('<svg><path/></svg>');
    });

    test('addToProject con opción save debe mostrar diálogo guardar', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '📁 Save to file',
        value: 'save'
      });
      (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue(undefined);
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'addToProject', 
        icon: { name: 'test-icon', collection: 'lucide' },
        svg: '<svg><path/></svg>'
      });

      expect(vscode.window.showSaveDialog).toHaveBeenCalled();
    });
  });

  // =====================================================
  // ViewColumn
  // =====================================================

  describe('ViewColumn', () => {
    test('debe usar viewColumn del editor activo', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      (vscode.window as any).activeTextEditor = {
        viewColumn: vscode.ViewColumn.Two
      };
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconCatalog',
        'Icon Catalog',
        vscode.ViewColumn.Two,
        expect.anything()
      );
      
      (vscode.window as any).activeTextEditor = undefined;
    });

    test('debe usar ViewColumn.One sin editor activo', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window as any).activeTextEditor = undefined;
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconCatalog',
        'Icon Catalog',
        vscode.ViewColumn.One,
        expect.anything()
      );
    });
  });

  // =====================================================
  // Search con colección específica
  // =====================================================

  describe('search con colección', () => {
    test('búsqueda con colección específica debe filtrar', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (mockCatalogService.searchIcons as jest.Mock).mockResolvedValue([]);
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'arrow', collection: 'heroicons' });

      expect(mockCatalogService.searchIcons).toHaveBeenCalledWith('arrow', 'heroicons');
    });

    test('búsqueda sin colección debe buscar en todas', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (mockCatalogService.searchIcons as jest.Mock).mockResolvedValue([]);
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'arrow' });

      expect(mockCatalogService.searchIcons).toHaveBeenCalledWith('arrow', undefined);
    });

    test('búsqueda debe limitar resultados a 100', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const manyResults = Array(200).fill({ name: 'icon', collection: 'lucide' });
      (mockCatalogService.searchIcons as jest.Mock).mockResolvedValue(manyResults);
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'search', query: 'icon' });

      const call = (mockPanel.webview.postMessage as jest.Mock).mock.calls.find(
        (c: any[]) => c[0]?.command === 'searchResults'
      );
      expect(call[0].results.length).toBeLessThanOrEqual(100);
    });
  });

  // =====================================================
  // fetchSvg manejo de errores
  // =====================================================

  describe('fetchSvg manejo de errores', () => {
    test('error en fetchSvg no debe fallar el panel', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (mockCatalogService.fetchIconSvg as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      IconCatalogPanel.createOrShow(extensionUri, mockCatalogService as IconCatalogService);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      // No debe lanzar error
      await expect(handler({ 
        command: 'fetchSvg', 
        icon: { name: 'test', collection: 'lucide' }
      })).resolves.not.toThrow();
    });
  });
});

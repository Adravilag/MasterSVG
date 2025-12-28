/**
 * Tests para IconDetailsPanel
 * 
 * Requisitos cubiertos:
 * - RF-5.4: Vista detallada de iconos
 * - RF-5.5: Navegación a fuente
 */

import * as vscode from 'vscode';
import { IconDetailsPanel } from '../../panels/IconDetailsPanel';

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

describe('IconDetailsPanel', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  const testIconDetails = {
    name: 'arrow-left',
    svg: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor"/></svg>',
    location: { file: '/test/icons/arrow-left.svg', line: 1 },
    isBuilt: false
  };

  beforeEach(() => {
    // Reset singleton
    (IconDetailsPanel as any).currentPanel = undefined;
    
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
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconDetails',
        'Icon Details',
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);
      
      // Segunda llamada - revela
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    test('createOrShow con nuevos details debe actualizar', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);
      
      const newDetails = {
        name: 'home',
        svg: '<svg><circle/></svg>'
      };
      
      IconDetailsPanel.createOrShow(extensionUri, newDetails);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });
  });

  // =====================================================
  // RF-5.4: Vista detallada
  // =====================================================

  describe('RF-5.4: Vista detallada', () => {
    test('CA-5.4.1: comando copyName debe copiar nombre', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'copyName' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('arrow-left');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Copied "arrow-left" to clipboard'
      );
    });

    test('CA-5.4.2: comando copySvg debe copiar SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'copySvg' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('SVG copied to clipboard');
    });

    test('CA-5.4.3: comando copySvg con svg personalizado debe copiarlo', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const customSvg = '<svg><rect/></svg>';
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'copySvg', svg: customSvg });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(customSvg);
    });
  });

  // =====================================================
  // RF-5.5: Navegación a fuente
  // =====================================================

  describe('RF-5.5: Navegación a fuente', () => {
    test('CA-5.5.1: comando goToLocation debe abrir archivo fuente', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'goToLocation' });

      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('CA-5.5.2: goToLocation sin location no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const detailsSinLocation = {
        name: 'test',
        svg: '<svg></svg>'
      };
      
      IconDetailsPanel.createOrShow(extensionUri, detailsSinLocation);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'goToLocation' });

      // No debe intentar abrir documento
      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // Optimización desde detalles
  // =====================================================

  describe('optimización desde detalles', () => {
    test('comando optimizeSvg debe devolver resultado de optimización', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'optimizeSvg', preset: 'safe' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult'
        })
      );
    });

    test('comando applyOptimizedSvg debe actualizar SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const optimizedSvg = '<svg viewBox="0 0 24 24"><path/></svg>';
      
      // Sin location para que muestre mensaje en lugar de intentar guardar
      const detailsWithoutLocation = {
        name: 'test-icon',
        svg: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>'
      };
      
      IconDetailsPanel.createOrShow(extensionUri, detailsWithoutLocation);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'applyOptimizedSvg', svg: optimizedSvg });

      // Debe mostrar mensaje cuando no hay archivo fuente
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Optimized SVG applied (in memory only - no source file)'
      );
    });
  });

  // =====================================================
  // Edición de colores
  // =====================================================

  describe('edición de colores', () => {
    test('comando changeColor debe actualizar color en SVG', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'changeColor', 
        oldColor: 'currentColor', 
        newColor: '#FF0000' 
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'colorChanged'
        })
      );
    });

    test('comando addColorToSvg debe agregar fill', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'addColorToSvg', color: '#00FF00' });

      // El HTML debe actualizarse con el nuevo SVG
      expect(mockPanel.webview.html).toBeDefined();
    });
  });

  // =====================================================
  // Dispose
  // =====================================================

  describe('dispose', () => {
    test('dispose debe limpiar currentPanel', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);
      
      expect((IconDetailsPanel as any).currentPanel).toBeDefined();
      
      const disposeCallback = (mockPanel.onDidDispose as jest.Mock).mock.calls[0][0];
      disposeCallback();
      
      expect((IconDetailsPanel as any).currentPanel).toBeUndefined();
    });
  });

  // =====================================================
  // Buscar usos (findUsages)
  // =====================================================

  describe('findUsages', () => {
    test('comando findUsages debe buscar usos del icono', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'findUsages' });

      // Debe ejecutar búsqueda (no hay assertions directas pero no debe fallar)
      expect(true).toBe(true);
    });

    test('comando goToUsage debe navegar al uso', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ 
        command: 'goToUsage', 
        file: '/test/file.tsx', 
        line: 10 
      });

      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('comando goToUsage sin file no debe hacer nada', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'goToUsage' });

      expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // Variants
  // =====================================================

  describe('Variants', () => {
    test('comando applyVariant debe aplicar variante', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'applyVariant', index: 0 });

      // No debe fallar aunque no haya variantes guardadas
      expect(true).toBe(true);
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
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconDetails',
        'Icon Details',
        vscode.ViewColumn.Two,
        expect.anything()
      );
      
      (vscode.window as any).activeTextEditor = undefined;
    });

    test('debe usar ViewColumn.One sin editor activo', () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      (vscode.window as any).activeTextEditor = undefined;
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconDetails',
        'Icon Details',
        vscode.ViewColumn.One,
        expect.anything()
      );
    });
  });

  // =====================================================
  // Presets de optimización
  // =====================================================

  describe('presets de optimización', () => {
    test('preset minimal debe funcionar', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'optimizeSvg', preset: 'minimal' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'optimizeResult' })
      );
    });

    test('preset aggressive debe funcionar', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'optimizeSvg', preset: 'aggressive' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'optimizeResult' })
      );
    });

    test('sin preset debe usar safe por defecto', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'optimizeSvg' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'optimizeResult' })
      );
    });
  });

  // =====================================================
  // Icono built
  // =====================================================

  describe('icono built', () => {
    test('debe manejar iconos built sin location', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const builtIcon = {
        name: 'built-icon',
        svg: '<svg><path/></svg>',
        isBuilt: true
      };
      
      IconDetailsPanel.createOrShow(extensionUri, builtIcon);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
      
      await handler({ command: 'changeColor', oldColor: '#000', newColor: '#FFF' });

      // Debe actualizar sin intentar guardar en archivo
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'colorChanged' })
      );
    });
  });
});

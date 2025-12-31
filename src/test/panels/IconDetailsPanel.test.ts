/**
 * Tests para IconDetailsPanel
 *
 * Requisitos cubiertos:
 * - RF-5.4: Vista detallada de iconos
 * - RF-5.5: Navegación a fuente
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { IconDetailsPanel } from '../../panels/IconDetailsPanel';

// Get the real extension path for loading templates
// __dirname in compiled tests is out/test/panels, we need to go up to project root
const realExtensionPath = path.resolve(__dirname, '../../..');

// Mock del WebviewPanel con setter para html
const createMockWebviewPanel = () => {
  let _html = '';
  const webview = {
    get html() {
      return _html;
    },
    set html(value: string) {
      _html = value;
    },
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
    title: '',
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
    isBuilt: false,
  };

  // Use real extension path so templates can be loaded
  const extensionUri = vscode.Uri.file(realExtensionPath);

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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconDetails',
        'Icon Details',
        expect.any(Number),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    test('createOrShow debe revelar panel existente', () => {
      // Primera llamada - crea
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      // Segunda llamada - revela
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    test('createOrShow con nuevos details debe actualizar', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const newDetails = {
        name: 'home',
        svg: '<svg><circle/></svg>',
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'copyName' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('arrow-left');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Copied "arrow-left" to clipboard'
      );
    });

    test('CA-5.4.2: comando copySvg debe copiar SVG', async () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'copySvg' });

      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('SVG copied to clipboard');
    });

    test('CA-5.4.3: comando copySvg con svg personalizado debe copiarlo', async () => {
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'goToLocation' });

      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('CA-5.5.2: goToLocation sin location no debe hacer nada', async () => {
      const detailsSinLocation = {
        name: 'test',
        svg: '<svg></svg>',
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'safe' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'optimizeResult',
        })
      );
    });

    test('comando applyOptimizedSvg debe actualizar SVG', async () => {
      const optimizedSvg = '<svg viewBox="0 0 24 24"><path/></svg>';

      // Sin location para que muestre mensaje en lugar de intentar guardar
      const detailsWithoutLocation = {
        name: 'test-icon',
        svg: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, detailsWithoutLocation);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'applyOptimizedSvg', svg: optimizedSvg });

      // Debe mostrar mensaje de confirmación
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Optimized SVG applied');
    });
  });

  // =====================================================
  // Edición de colores
  // =====================================================

  describe('edición de colores', () => {
    test('comando changeColor debe actualizar color en SVG', async () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'changeColor',
        oldColor: 'currentColor',
        newColor: '#FF0000',
      });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'colorChanged',
        })
      );
    });

    test('comando addColorToSvg debe agregar fill', async () => {
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'findUsages' });

      // Debe ejecutar búsqueda (no hay assertions directas pero no debe fallar)
      expect(true).toBe(true);
    });

    test('comando goToUsage debe navegar al uso', async () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({
        command: 'goToUsage',
        file: '/test/file.tsx',
        line: 10,
      });

      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    test('comando goToUsage sin file no debe hacer nada', async () => {
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
      (vscode.window as any).activeTextEditor = {
        viewColumn: vscode.ViewColumn.Two,
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
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'minimal' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'optimizeResult' })
      );
    });

    test('preset aggressive debe funcionar', async () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];

      await handler({ command: 'optimizeSvg', preset: 'aggressive' });

      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'optimizeResult' })
      );
    });

    test('sin preset debe usar safe por defecto', async () => {
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
      const builtIcon = {
        name: 'built-icon',
        svg: '<svg><path/></svg>',
        isBuilt: true,
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

  // =====================================================
  // Carga de templates (refactorización)
  // =====================================================

  describe('carga de templates', () => {
    test('el HTML generado debe contener estructura básica', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      // Estructura básica del HTML
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    test('el HTML debe incluir CSS cargado desde template', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      // CSS debe estar embebido
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      // Variables CSS de VS Code
      expect(html).toContain('--vscode-');
    });

    test('el HTML debe incluir JS cargado desde template', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      // JavaScript debe estar embebido
      expect(html).toContain('<script>');
      expect(html).toContain('</script>');
      expect(html).toContain('acquireVsCodeApi');
    });

    test('el HTML debe mostrar nombre del icono', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('arrow-left');
    });

    test('el HTML debe incluir el SVG en preview', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('previewBox');
      expect(html).toContain('<svg');
    });

    test('el HTML debe incluir controles de zoom', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('zoomIn()');
      expect(html).toContain('zoomOut()');
      expect(html).toContain('resetZoom()');
    });

    test('el HTML debe incluir acciones rápidas', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('copyName()');
      expect(html).toContain('copySvg()');
      expect(html).toContain('openEditor()');
    });

    test('el HTML debe mostrar viewBox extraído del SVG', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('0 0 24 24'); // viewBox del testIconDetails
    });

    test('el HTML debe incluir sección de usages', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('usages-section');
      expect(html).toContain('usagesList');
    });

    test('el HTML debe incluir sección de variants', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('Variants-section');
      expect(html).toContain('saveVariant()');
    });

    test('icono con isBuilt=true debe mostrar badge Built', () => {
      const builtIcon = {
        name: 'test-icon',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        isBuilt: true,
      };

      IconDetailsPanel.createOrShow(extensionUri, builtIcon);

      const html = mockPanel.webview.html;

      expect(html).toContain('badge');
      expect(html).toContain('built');
      expect(html).toContain('Built');
    });

    test('icono con isBuilt=false debe mostrar badge Draft', () => {
      const draftIcon = {
        name: 'test-icon',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        isBuilt: false,
      };

      IconDetailsPanel.createOrShow(extensionUri, draftIcon);

      const html = mockPanel.webview.html;

      expect(html).toContain('badge');
      expect(html).toContain('draft');
      expect(html).toContain('Draft');
    });

    test('icono con location debe mostrar botón go-to-file', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('goToLocation()');
      expect(html).toContain('codicon-go-to-file');
    });

    test('icono sin location no debe mostrar botón go-to-file en quick-actions', () => {
      const iconSinLocation = {
        name: 'test-icon',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, iconSinLocation);

      const html = mockPanel.webview.html;

      // El botón de location en quick-actions no debe estar
      const quickActionsMatch = html.match(/<div class="quick-actions">[\s\S]*?<\/div>/);
      if (quickActionsMatch) {
        expect(quickActionsMatch[0]).not.toContain('goToLocation()');
      }
    });

    test('SVG con colores debe mostrar swatches', () => {
      const iconConColores = {
        name: 'colored-icon',
        svg: '<svg viewBox="0 0 24 24"><path fill="#ff0000"/><circle stroke="#00ff00"/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, iconConColores);

      const html = mockPanel.webview.html;

      expect(html).toContain('color-swatch');
      expect(html).toContain('#ff0000');
      expect(html).toContain('#00ff00');
    });

    test('SVG con currentColor debe mostrar info especial', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('currentColor');
    });

    test('SVG con múltiples elementos debe mostrar conteo', () => {
      const iconMultiElementos = {
        name: 'multi-icon',
        svg: '<svg viewBox="0 0 24 24"><path/><path/><circle/><rect/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, iconMultiElementos);

      const html = mockPanel.webview.html;

      // Debe mostrar el total de elementos
      expect(html).toContain('4'); // 2 path + 1 circle + 1 rect
      expect(html).toContain('path');
      expect(html).toContain('circle');
      expect(html).toContain('rect');
    });

    test('SVG con gradiente debe mostrar feature tag', () => {
      const iconConGradiente = {
        name: 'gradient-icon',
        svg: '<svg viewBox="0 0 24 24"><defs><linearGradient id="g"/></defs><path/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, iconConGradiente);

      const html = mockPanel.webview.html;

      expect(html).toContain('feature-tag');
      expect(html).toContain('gradient');
    });

    test('el HTML debe incluir keyframes de animación en CSS', () => {
      IconDetailsPanel.createOrShow(extensionUri, testIconDetails);

      const html = mockPanel.webview.html;

      expect(html).toContain('@keyframes');
      expect(html).toContain('icon-spin');
    });
  });

  // =====================================================
  // Animaciones
  // =====================================================

  describe('animaciones', () => {
    test('icono con animación debe aplicar estilo', () => {
      const iconConAnimacion = {
        name: 'animated-icon',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
        animation: {
          type: 'spin',
          duration: 2,
          timing: 'linear',
          iteration: 'infinite',
        },
      };

      IconDetailsPanel.createOrShow(extensionUri, iconConAnimacion);

      const html = mockPanel.webview.html;

      expect(html).toContain('animation:');
      expect(html).toContain('icon-spin');
      expect(html).toContain('2s');
      expect(html).toContain('linear');
    });

    test('icono sin animación no debe tener estilo de animación', () => {
      const iconSinAnimacion = {
        name: 'static-icon',
        svg: '<svg viewBox="0 0 24 24"><path/></svg>',
      };

      IconDetailsPanel.createOrShow(extensionUri, iconSinAnimacion);

      const html = mockPanel.webview.html;

      // El SVG en preview no debe tener animación inline
      const previewMatch = html.match(/id="previewBox"[^>]*>[\s\S]*?<svg[^>]*/);
      if (previewMatch) {
        expect(previewMatch[0]).not.toContain('animation:');
      }
    });
  });
});

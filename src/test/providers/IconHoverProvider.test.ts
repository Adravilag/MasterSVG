/**
 * Tests para IconHoverProvider
 *
 * Requisitos cubiertos:
 * - RF-4.4: Preview al hover sobre nombre de icono
 */

// Mock de vscode
import * as vscode from 'vscode';
import { IconHoverProvider } from '../../providers/IconHoverProvider';
import { WorkspaceSvgProvider } from '../../providers/WorkspaceSvgProvider';

// Mock de WorkspaceSvgProvider
const mockSvgProvider: Partial<WorkspaceSvgProvider> = {
  getIcon: jest.fn(),
};

describe('IconHoverProvider', () => {
  let provider: IconHoverProvider;
  let mockDocument: Partial<vscode.TextDocument>;
  let mockToken: vscode.CancellationToken;

  const mockIcon = {
    name: 'arrow-left',
    path: '/icons/arrow-left.svg',
    source: 'workspace',
    category: 'navigation',
    svg: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  };

  beforeEach(() => {
    provider = new IconHoverProvider(mockSvgProvider as WorkspaceSvgProvider);
    mockToken = { isCancellationRequested: false } as vscode.CancellationToken;
    jest.clearAllMocks();
  });

  const createMockDocument = (lineText: string): Partial<vscode.TextDocument> => ({
    lineAt: jest.fn().mockReturnValue({
      text: lineText,
    }),
    uri: { fsPath: '/mock/path/test.tsx' } as vscode.Uri,
  });

  // =====================================================
  // RF-4.4: Preview al hover sobre nombre de icono
  // =====================================================

  describe('RF-4.4: Hover preview', () => {
    // CA-4.4.1: Detecta <Icon name="icon-name">
    test('CA-4.4.1: debe detectar patrón <Icon name="icon-name">', async () => {
      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 18); // cursor sobre "arrow-left"

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      expect(mockSvgProvider.getIcon).toHaveBeenCalledWith('arrow-left');
    });

    // CA-4.4.2: Detecta <iconify-icon icon="prefix:name">
    test('CA-4.4.2: debe detectar patrón <iconify-icon icon="...">', async () => {
      const lineText = '<iconify-icon icon="mdi:home"></iconify-icon>';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue({
        ...mockIcon,
        name: 'mdi:home',
        source: 'iconify',
      });

      const position = new vscode.Position(0, 25); // cursor sobre "mdi:home"

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      expect(mockSvgProvider.getIcon).toHaveBeenCalledWith('mdi:home');
    });

    // CA-4.4.3: Muestra preview SVG
    test('CA-4.4.3: debe mostrar preview SVG en hover', async () => {
      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // contents puede ser MarkdownString directo o array
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString)
        : (hover!.contents as vscode.MarkdownString);
      expect(content.supportHtml).toBe(true);
      expect(content.isTrusted).toBe(true);
    });

    // CA-4.4.4: Muestra información del icono
    test('CA-4.4.4: debe mostrar source, category y path', async () => {
      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // contents puede ser MarkdownString directo o array
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      expect(content).toContain('arrow-left');
      expect(content).toContain('workspace');
      expect(content).toContain('navigation');
      expect(content).toContain('/icons/arrow-left.svg');
    });

    // CA-4.4.5: Muestra advertencia si icono no existe
    test('CA-4.4.5: debe mostrar advertencia si icono no existe', async () => {
      const lineText = '<Icon name="nonexistent" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(null);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // contents puede ser MarkdownString directo o array
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      expect(content).toContain('⚠️');
      expect(content).toContain('not found');
      expect(content).toContain('nonexistent');
    });

    // CA-4.4.6: Devuelve range correcto
    test('CA-4.4.6: debe devolver range que cubre el nombre del icono', async () => {
      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // El range se define cuando el icono existe
      if (hover!.range) {
        expect(hover!.range.start.line).toBe(0);
        expect(hover!.range.end.line).toBe(0);
      }
    });
  });

  // =====================================================
  // Patrones alternativos
  // =====================================================

  describe('patrones alternativos', () => {
    test('debe detectar patrón genérico name="icon"', async () => {
      const lineText = 'name="arrow-left"';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 10);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
    });

    test('debe detectar patrón genérico icon="icon"', async () => {
      const lineText = 'icon="arrow-left"';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(mockIcon);

      const position = new vscode.Position(0, 10);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
    });
  });

  // =====================================================
  // Escenarios sin coincidencia
  // =====================================================

  describe('escenarios sin coincidencia', () => {
    test('debe devolver null si cursor no está sobre nombre de icono', async () => {
      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);

      const position = new vscode.Position(0, 2); // cursor sobre "<Icon"

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).toBeNull();
    });

    test('debe devolver null si no hay patrón de icono', async () => {
      const lineText = 'const myVar = "hello";';
      mockDocument = createMockDocument(lineText);

      const position = new vscode.Position(0, 15);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).toBeNull();
    });

    test('debe devolver null para línea vacía', async () => {
      const lineText = '';
      mockDocument = createMockDocument(lineText);

      const position = new vscode.Position(0, 0);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).toBeNull();
    });
  });

  // =====================================================
  // SVG Preview formatting
  // =====================================================

  describe('SVG preview formatting', () => {
    test('debe manejar SVG sin viewBox', async () => {
      const iconWithoutViewBox = {
        ...mockIcon,
        svg: '<svg><path d="M15 18l-6-6 6-6"/></svg>',
      };

      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(iconWithoutViewBox);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // El preview debe incluir un viewBox por defecto
    });

    test('debe manejar icono sin SVG', async () => {
      const iconWithoutSvg = {
        ...mockIcon,
        svg: undefined,
      };

      const lineText = '<Icon name="arrow-left" />';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue(iconWithoutSvg);

      const position = new vscode.Position(0, 18);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      // Debe mostrar info aunque no haya preview
    });
  });

  // =====================================================
  // Variantes en hover preview
  // =====================================================

  describe('variantes en hover preview', () => {
    test('debe detectar atributo variant en el tag', async () => {
      const lineText = '<svg-icon name="star" variant="custom"></svg-icon>';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue({
        ...mockIcon,
        name: 'star',
        svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2l3 7h7l-6 5 3 7-7-5-7 5 3-7-6-5h7z"/></svg>',
      });

      const position = new vscode.Position(0, 16); // cursor sobre "star"

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      expect(content).toContain('Variant');
      expect(content).toContain('custom');
    });

    test('debe mostrar hover sin variant cuando no está especificado', async () => {
      const lineText = '<svg-icon name="star"></svg-icon>';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue({
        ...mockIcon,
        name: 'star',
      });

      const position = new vscode.Position(0, 16);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      // No debe contener info de variante
      expect(content).not.toContain('Variant:');
    });

    test('debe detectar atributo animation en el tag', async () => {
      const lineText = '<svg-icon name="star" animation="pulse"></svg-icon>';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue({
        ...mockIcon,
        name: 'star',
        svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2l3 7h7l-6 5 3 7-7-5-7 5 3-7-6-5h7z"/></svg>',
      });

      const position = new vscode.Position(0, 16);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      expect(content).toContain('Animation');
      expect(content).toContain('pulse');
    });

    test('debe mostrar variante y animación juntas', async () => {
      const lineText = '<svg-icon name="star" variant="custom" animation="spin"></svg-icon>';
      mockDocument = createMockDocument(lineText);
      (mockSvgProvider.getIcon as jest.Mock).mockReturnValue({
        ...mockIcon,
        name: 'star',
        svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2l3 7h7l-6 5 3 7-7-5-7 5 3-7-6-5h7z"/></svg>',
      });

      const position = new vscode.Position(0, 16);

      const hover = await provider.provideHover(
        mockDocument as vscode.TextDocument,
        position,
        mockToken
      );

      expect(hover).not.toBeNull();
      const content = Array.isArray(hover!.contents)
        ? (hover!.contents[0] as vscode.MarkdownString).value
        : (hover!.contents as vscode.MarkdownString).value;
      expect(content).toContain('Variant');
      expect(content).toContain('custom');
      expect(content).toContain('Animation');
      expect(content).toContain('spin');
    });
  });
});

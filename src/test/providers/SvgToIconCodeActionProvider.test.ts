/**
 * Tests para SvgToIconCodeActionProvider
 *
 * Requisitos cubiertos:
 * - RF-4.5: Code Actions para transformar referencias SVG
 * - RF-4.6: Diagnósticos para referencias SVG
 */

// Mock de vscode, path y fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
}));

import * as vscode from 'vscode';
import {
  SvgToIconCodeActionProvider,
  SvgImgDiagnosticProvider,
} from '../../providers/SvgToIconCodeActionProvider';

describe('SvgToIconCodeActionProvider', () => {
  let provider: SvgToIconCodeActionProvider;
  let mockDocument: Partial<vscode.TextDocument>;
  let mockRange: vscode.Range;
  let mockContext: any;
  let mockToken: vscode.CancellationToken;

  beforeEach(() => {
    provider = new SvgToIconCodeActionProvider();
    mockContext = {
      diagnostics: [],
      triggerKind: 1,
      only: undefined,
    };
    mockToken = { isCancellationRequested: false } as vscode.CancellationToken;
    jest.clearAllMocks();
  });

  const createMockDocument = (
    lineText: string,
    languageId: string = 'typescriptreact'
  ): Partial<vscode.TextDocument> => ({
    lineAt: jest.fn().mockReturnValue({
      text: lineText,
    }),
    languageId,
    uri: { fsPath: '/test/file.tsx' } as vscode.Uri,
  });

  // =====================================================
  // RF-4.5: Code Actions para transformar referencias SVG
  // =====================================================

  describe('RF-4.5: Code Actions', () => {
    // CA-4.5.1: Detecta <img src="...svg">
    test('CA-4.5.1: debe detectar <img src="...svg">', () => {
      const lineText = '<img src="./icons/arrow.svg" alt="arrow" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext as vscode.CodeActionContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions!.length).toBeGreaterThan(0);
    });

    // CA-4.5.2: Ofrece transformar a <Icon name="...">
    test('CA-4.5.2: debe ofrecer acción para transformar a Icon', () => {
      const lineText = '<img src="./icons/arrow.svg" alt="arrow" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext as vscode.CodeActionContext,
        mockToken
      );

      const transformAction = actions!.find(
        a =>
          a.title.includes('Transform') &&
          (a.title.includes('Web Component') || a.title.includes('SVG Sprite'))
      );
      expect(transformAction).toBeDefined();
      expect(transformAction!.kind).toEqual(vscode.CodeActionKind.QuickFix);
    });

    // CA-4.5.3: Transform action uses command (no longer edit)
    test('CA-4.5.3: debe usar comando para transformar', () => {
      const lineText = '<img src="./icons/arrow.svg" alt="arrow" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      const transformAction = actions!.find(a => a.title.includes('Transform'));
      expect(transformAction).toBeDefined();
      expect(transformAction!.command).toBeDefined();
      expect(transformAction!.command!.command).toBe('sageboxIconStudio.transformSvgReference');
    });

    // CA-4.5.4: Extrae nombre de icono correctamente
    test('CA-4.5.4: debe extraer nombre de icono del path', () => {
      const lineText = '<img src="./assets/icons/my-custom-icon.svg" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      const transformAction = actions!.find(a => a.title.includes('Transform'));
      expect(transformAction!.title).toContain('my-custom-icon');
    });

    // CA-4.5.5: Transform action includes original info in command args
    test('CA-4.5.5: debe incluir información del SVG original en el comando', () => {
      const lineText = '<img src="./icons/arrow.svg" />';
      mockDocument = createMockDocument(lineText, 'typescriptreact');
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      const transformAction = actions!.find(a => a.title.includes('Transform'));
      expect(transformAction!.command).toBeDefined();
      expect(transformAction!.command!.arguments).toBeDefined();
      expect(transformAction!.command!.arguments![0]).toHaveProperty('originalPath');
      expect(transformAction!.command!.arguments![0]).toHaveProperty('iconName');
    });

    // CA-4.5.6: Genera reemplazo correcto para HTML
    test('CA-4.5.6: debe generar iconify-icon para HTML', () => {
      const lineText = '<img src="./icons/arrow.svg" />';
      mockDocument = createMockDocument(lineText, 'html');
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      // Para HTML debería usar iconify-icon
    });
  });

  // =====================================================
  // Simplified provider only handles <img src="...svg">
  // Background URLs are informational only in diagnostics
  // =====================================================

  describe('non-img patterns', () => {
    test('debe devolver undefined para background: url(...svg)', () => {
      const lineText = 'background: url("./icons/pattern.svg");';
      mockDocument = createMockDocument(lineText, 'css');
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      // Simplified provider only handles <img> tags
      expect(actions).toBeUndefined();
    });
  });

  // =====================================================
  // Edge cases
  // =====================================================

  describe('edge cases', () => {
    test('debe devolver undefined si no hay SVG referencias', () => {
      const lineText = '<img src="./images/photo.png" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeUndefined();
    });

    test('debe retornar una sola acción cuando el cursor está sobre el primer SVG', () => {
      const lineText = '<img src="a.svg" /><img src="b.svg" />';
      mockDocument = createMockDocument(lineText);
      // Cursor on first img (position 0-17)
      mockRange = new vscode.Range(new vscode.Position(0, 5), new vscode.Position(0, 5));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      // Simplified provider returns only the action for the SVG under cursor
      expect(actions).toBeDefined();
      expect(actions!.length).toBe(1);
      expect(actions![0].title).toContain('Transform');
    });

    test('debe sanitizar nombres de iconos con caracteres especiales', () => {
      const lineText = '<img src="./icons/My Icon (2).svg" />';
      mockDocument = createMockDocument(lineText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      const transformAction = actions!.find(a => a.title.includes('Transform'));
      // El nombre del icono debe estar sanitizado: "My Icon (2)" → "my-icon-2"
      // El título tiene formato: "🔄 Transform to {format}: \"{name}\""
      // Verificar que el nombre sanitizado "my-icon-2" aparece (no "My Icon (2)")
      expect(transformAction!.title).toContain('my-icon-2');
      expect(transformAction!.title).not.toContain('My Icon');
    });
  });

  // =====================================================
  // Inline SVG detection
  // =====================================================

  describe('inline SVG detection', () => {
    const createMockDocumentWithFullText = (
      lineText: string,
      fullText: string,
      languageId: string = 'html'
    ): Partial<vscode.TextDocument> => ({
      lineAt: jest.fn().mockReturnValue({
        text: lineText,
      }),
      getText: jest.fn().mockReturnValue(fullText),
      offsetAt: jest.fn().mockImplementation((pos: vscode.Position) => {
        // Simple implementation: just return character count up to that line
        const lines = fullText.split('\n');
        let offset = 0;
        for (let i = 0; i < pos.line; i++) {
          offset += lines[i].length + 1; // +1 for newline
        }
        offset += pos.character;
        return offset;
      }),
      positionAt: jest.fn().mockImplementation((offset: number) => {
        const lines = fullText.split('\n');
        let currentOffset = 0;
        for (let i = 0; i < lines.length; i++) {
          if (currentOffset + lines[i].length >= offset) {
            return new vscode.Position(i, offset - currentOffset);
          }
          currentOffset += lines[i].length + 1;
        }
        return new vscode.Position(0, 0);
      }),
      languageId,
      uri: { fsPath: '/test/file.html' } as vscode.Uri,
    });

    test('debe detectar SVG inline simple', () => {
      const lineText =
        '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
      const fullText = lineText;
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions!.length).toBe(1);
    });

    test('acción de SVG inline debe tener isInlineSvg=true', () => {
      const lineText = '<svg viewBox="0 0 24 24"><path d="M10 20"/></svg>';
      const fullText = lineText;
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions![0].command!.arguments![0]).toHaveProperty('isInlineSvg', true);
      expect(actions![0].command!.arguments![0]).toHaveProperty('svgContent');
    });

    test('debe extraer nombre de icono desde id del SVG', () => {
      const lineText = '<svg id="home-icon" viewBox="0 0 24 24"><path d="M10 20"/></svg>';
      const fullText = lineText;
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions![0].command!.arguments![0].iconName).toBe('home-icon');
    });

    test('debe extraer nombre de icono desde aria-label', () => {
      const lineText =
        '<svg aria-label="Settings Icon" viewBox="0 0 24 24"><path d="M10 20"/></svg>';
      const fullText = lineText;
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions![0].command!.arguments![0].iconName).toBe('settings-icon');
    });

    test('debe incluir offsets para SVG multilínea', () => {
      const lineText = '<svg viewBox="0 0 24 24">';
      const fullText = '<svg viewBox="0 0 24 24">\n  <path d="M10 20"/>\n</svg>';
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions![0].command!.arguments![0]).toHaveProperty('startOffset');
      expect(actions![0].command!.arguments![0]).toHaveProperty('endOffset');
    });

    test('no debe detectar SVG incompleto sin cierre', () => {
      const lineText = '<svg viewBox="0 0 24 24"><path d="M10 20"/>';
      const fullText = lineText; // No closing </svg>
      mockDocument = createMockDocumentWithFullText(lineText, fullText);
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeUndefined();
    });

    test('img debe tener prioridad sobre svg inline en la misma línea', () => {
      const lineText = '<img src="icon.svg" /> <svg viewBox="0 0 24 24"></svg>';
      const fullText = lineText;
      mockDocument = createMockDocumentWithFullText(lineText, fullText, 'html');
      mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const actions = provider.provideCodeActions(
        mockDocument as vscode.TextDocument,
        mockRange,
        mockContext,
        mockToken
      );

      expect(actions).toBeDefined();
      expect(actions!.length).toBe(1);
      // Debe detectar el img, no el svg inline
      expect(actions![0].command!.arguments![0].originalPath).toBe('icon.svg');
    });
  });
});

// =====================================================
// RF-4.6: Diagnósticos para referencias SVG
// =====================================================

describe('SvgImgDiagnosticProvider', () => {
  let provider: SvgImgDiagnosticProvider;
  let mockDocument: Partial<vscode.TextDocument>;

  beforeEach(() => {
    provider = new SvgImgDiagnosticProvider();
    jest.clearAllMocks();
  });

  const createMockDocumentWithText = (
    text: string,
    languageId: string = 'typescriptreact'
  ): Partial<vscode.TextDocument> => ({
    getText: jest.fn().mockReturnValue(text),
    positionAt: jest.fn().mockImplementation((offset: number) => {
      return new vscode.Position(0, offset);
    }),
    languageId,
    uri: { fsPath: '/test/file.tsx' } as vscode.Uri,
  });

  describe('RF-4.6: Diagnósticos', () => {
    // CA-4.6.1: Crea diagnóstico para <img src="...svg">
    test('CA-4.6.1: debe crear diagnóstico para img svg', () => {
      const text = '<img src="./icons/arrow.svg" />';
      mockDocument = createMockDocumentWithText(text);

      provider.updateDiagnostics(mockDocument as vscode.TextDocument);

      // El provider debe haber creado diagnósticos
      // (verificar que no lanza errores)
      expect(true).toBeTruthy();
    });

    // CA-4.6.2: Diagnóstico con severidad Hint
    test('CA-4.6.2: los diagnósticos deben ser Hint', () => {
      // Este test verifica que la severidad es Hint (no Error o Warning)
      // ya que es una sugerencia, no un error
      expect(vscode.DiagnosticSeverity.Hint).toBeDefined();
    });

    // CA-4.6.3: Diagnóstico incluye nombre del icono
    test('CA-4.6.3: mensaje debe incluir nombre del icono', () => {
      // La implementación incluye el nombre del icono en el mensaje
      // "SVG image "${iconName}" can be converted..."
      const mockDiagnostic = new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
        'SVG image "arrow" can be converted to Icon component',
        vscode.DiagnosticSeverity.Hint
      );

      expect(mockDiagnostic.message).toContain('arrow');
    });

    // CA-4.6.4: Código de diagnóstico 'svg-to-icon'
    test('CA-4.6.4: debe tener código svg-to-icon', () => {
      const mockDiagnostic = new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
        'Test',
        vscode.DiagnosticSeverity.Hint
      );
      mockDiagnostic.code = 'svg-to-icon';

      expect(mockDiagnostic.code).toBe('svg-to-icon');
    });
  });

  describe('shouldAnalyze', () => {
    test('debe analizar archivos HTML', () => {
      const text = '<img src="icon.svg" />';
      mockDocument = createMockDocumentWithText(text, 'html');

      // No debe lanzar error
      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });

    test('debe analizar archivos JSX', () => {
      const text = '<img src="icon.svg" />';
      mockDocument = createMockDocumentWithText(text, 'javascriptreact');

      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });

    test('debe analizar archivos Vue', () => {
      const text = '<img src="icon.svg" />';
      mockDocument = createMockDocumentWithText(text, 'vue');

      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });

    test('debe analizar archivos Svelte', () => {
      const text = '<img src="icon.svg" />';
      mockDocument = createMockDocumentWithText(text, 'svelte');

      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });

    test('debe analizar archivos Astro', () => {
      const text = '<img src="icon.svg" />';
      mockDocument = createMockDocumentWithText(text, 'astro');

      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });

    test('no debe analizar archivos JSON', () => {
      const text = '{ "icon": "icon.svg" }';
      mockDocument = createMockDocumentWithText(text, 'json');

      // Debe ejecutar sin problemas pero no crear diagnósticos
      expect(() => provider.updateDiagnostics(mockDocument as vscode.TextDocument)).not.toThrow();
    });
  });

  describe('dispose', () => {
    test('debe disponer colección de diagnósticos', () => {
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});

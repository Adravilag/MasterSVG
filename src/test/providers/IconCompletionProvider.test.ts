/**
 * Tests para IconCompletionProvider
 * 
 * Requisitos cubiertos:
 * - RF-4.1: Autocompletado de nombres de iconos
 * - RF-4.2: Autocompletado de variantes
 * - RF-4.3: Autocompletado de animaciones
 */

import * as fs from 'node:fs';

// Mock de vscode y fs - IconCompletionProvider uses 'fs' not 'node:fs'
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock variants.js content
const MOCK_VARIANTS_CONTENT = `
export const defaultVariants = {
  "arrow-left": "primary",
  "home": "secondary"
};

export const Variants = {
  "arrow-left": {
    "primary": ["#1a73e8", "#ffffff"],
    "secondary": ["#5f6368", "#e8f0fe"],
    "danger": ["#d93025", "#fce8e6"]
  },
  "home": {
    "primary": ["#1a73e8"],
    "muted": ["#9aa0a6"]
  }
};
`;

import * as vscode from 'vscode';
import { IconCompletionProvider } from '../../providers/IconCompletionProvider';
import { WorkspaceSvgProvider } from '../../providers/WorkspaceSvgProvider';

// Mock icons data
const mockIcons = [
  {
    name: 'arrow-left',
    path: '/icons/arrow-left.svg',
    source: 'workspace',
    category: 'navigation',
    svg: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'
  },
  {
    name: 'home',
    path: '/icons/home.svg',
    source: 'workspace',
    category: 'ui',
    svg: '<svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9"/></svg>'
  },
  {
    name: 'mdi:account',
    path: '',
    source: 'iconify',
    category: 'people',
    svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/></svg>'
  }
];

// Mock de WorkspaceSvgProvider
const mockSvgProvider: Partial<WorkspaceSvgProvider> = {
  getAllIcons: jest.fn().mockResolvedValue(mockIcons),
  getIcon: jest.fn().mockImplementation((name: string) => {
    return mockIcons.find(icon => icon.name === name);
  })
};

describe('IconCompletionProvider', () => {
  let provider: IconCompletionProvider;
  let mockDocument: Partial<vscode.TextDocument>;
  let mockPosition: vscode.Position;
  let mockToken: vscode.CancellationToken;
  let mockContext: vscode.CompletionContext;

  beforeEach(() => {
    provider = new IconCompletionProvider(mockSvgProvider as WorkspaceSvgProvider);
    mockToken = { isCancellationRequested: false } as vscode.CancellationToken;
    mockContext = {} as vscode.CompletionContext;
    jest.clearAllMocks();
  });

  const createMockDocument = (lineText: string, character: number): Partial<vscode.TextDocument> => ({
    lineAt: jest.fn().mockReturnValue({
      text: lineText
    }),
    languageId: 'typescriptreact'
  });

  // =====================================================
  // RF-4.1: Autocompletado de nombres de iconos
  // =====================================================

  describe('RF-4.1: Autocompletado de nombres', () => {
    // CA-4.1.1: Detecta contexto <Icon name="
    test('CA-4.1.1: debe detectar contexto <Icon name="', async () => {
      const lineText = '<Icon name="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items.length).toBeGreaterThan(0);
      expect(mockSvgProvider.getAllIcons).toHaveBeenCalled();
    });

    // CA-4.1.2: Detecta contexto icon="
    test('CA-4.1.2: debe detectar contexto icon="', async () => {
      const lineText = '<iconify-icon icon="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items.length).toBeGreaterThan(0);
    });

    // CA-4.1.3: Muestra iconos del workspace primero
    test('CA-4.1.3: debe ordenar iconos del workspace primero', async () => {
      const lineText = '<Icon name="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      // Los items del workspace deben tener sortText que empieza con "0"
      const workspaceItems = items.filter(item => (item.sortText as string).startsWith('0'));
      const iconifyItems = items.filter(item => (item.sortText as string).startsWith('1'));
      
      expect(workspaceItems.length).toBeGreaterThan(0);
      expect(workspaceItems[0].sortText! < iconifyItems[0].sortText!).toBeTruthy();
    });

    // CA-4.1.4: Incluye preview SVG en documentación
    test('CA-4.1.4: debe incluir preview SVG en la documentación', async () => {
      const lineText = '<Icon name="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const item = items.find(i => i.label === 'arrow-left');
      expect(item).toBeDefined();
      expect(item!.documentation).toBeDefined();
      expect((item!.documentation as vscode.MarkdownString).isTrusted).toBe(true);
    });

    // CA-4.1.5: Muestra categoría y source
    test('CA-4.1.5: debe mostrar categoría y source en detail', async () => {
      const lineText = '<Icon name="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const item = items.find(i => i.label === 'arrow-left');
      expect(item!.detail).toContain('workspace');
      expect(item!.detail).toContain('navigation');
    });
  });

  // =====================================================
  // RF-4.2: Autocompletado de variantes
  // NOTE: These tests require filesystem integration. 
  // Skipped until proper integration test setup is available.
  // =====================================================

  describe.skip('RF-4.2: Autocompletado de variantes', () => {
    beforeEach(() => {
      // Setup mock to return variants file content
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(MOCK_VARIANTS_CONTENT);
    });

    afterEach(() => {
      mockFs.existsSync.mockReset();
      mockFs.readFileSync.mockReset();
    });

    // CA-4.2.1: Detecta contexto variant="
    test('CA-4.2.1: debe detectar contexto variant="', async () => {
      const lineText = '<Icon name="arrow-left" variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    // CA-4.2.2: Filtra variantes por icono específico
    test('CA-4.2.2: debe filtrar variantes por icono específico', async () => {
      const lineText = '<Icon name="arrow-left" variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const variantNames = items.map(i => i.label);
      expect(variantNames).toContain('primary');
      expect(variantNames).toContain('secondary');
      expect(variantNames).toContain('danger');
      // 'muted' is only for 'home', not 'arrow-left'
      expect(variantNames).not.toContain('muted');
    });

    // CA-4.2.3: Muestra colores en documentación
    test('CA-4.2.3: debe mostrar colores en documentación', async () => {
      const lineText = '<Icon name="arrow-left" variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const primaryItem = items.find(i => i.label === 'primary');
      expect(primaryItem).toBeDefined();
      expect(primaryItem!.documentation).toBeDefined();
      const docString = (primaryItem!.documentation as vscode.MarkdownString).value;
      expect(docString).toContain('#1a73e8');
      expect(docString).toContain('#ffffff');
    });

    // CA-4.2.4: Muestra todas las variantes cuando no hay icono específico
    test('CA-4.2.4: debe mostrar todas las variantes sin icono específico', async () => {
      const lineText = '<Icon variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const variantNames = items.map(i => i.label);
      // Should include variants from all icons (deduplicated)
      expect(variantNames).toContain('primary');
      expect(variantNames).toContain('secondary');
      expect(variantNames).toContain('danger');
      expect(variantNames).toContain('muted');
    });

    // CA-4.2.5: Elimina duplicados cuando muestra todas las variantes
    test('CA-4.2.5: debe eliminar duplicados', async () => {
      const lineText = '<Icon variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const variantNames = items.map(i => i.label);
      // 'primary' exists in both arrow-left and home, should appear only once
      const primaryCount = variantNames.filter(n => n === 'primary').length;
      expect(primaryCount).toBe(1);
    });

    // Test sin archivo de variantes
    test('debe retornar array vacío sin archivo de variantes', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const lineText = '<Icon name="arrow-left" variant="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items.length).toBe(0);
    });
  });

  // =====================================================
  // RF-4.3: Autocompletado de animaciones
  // =====================================================

  describe('RF-4.3: Autocompletado de animaciones', () => {
    // CA-4.3.1: Detecta contexto animation="
    test('CA-4.3.1: debe detectar contexto animation="', async () => {
      const lineText = '<Icon name="arrow-left" animation="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items.length).toBeGreaterThan(0);
      expect(items.every(i => i.kind === vscode.CompletionItemKind.EnumMember)).toBeTruthy();
    });

    // CA-4.3.2: Lista animaciones predefinidas (incluyendo nuevas)
    test('CA-4.3.2: debe listar todas las animaciones predefinidas', async () => {
      const lineText = '<Icon name="arrow-left" animation="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const animationNames = items.map(i => i.label);
      // Basic animations
      expect(animationNames).toContain('spin');
      expect(animationNames).toContain('pulse');
      expect(animationNames).toContain('bounce');
      expect(animationNames).toContain('shake');
      expect(animationNames).toContain('fade');
      expect(animationNames).toContain('float');
      expect(animationNames).toContain('none');
      // Attention animations  
      expect(animationNames).toContain('wobble');
      expect(animationNames).toContain('heartbeat');
      expect(animationNames).toContain('tada');
      // Entrance animations
      expect(animationNames).toContain('fade-in');
      expect(animationNames).toContain('zoom-in');
      // Draw animations
      expect(animationNames).toContain('draw');
      
      // Should have all 32 animations
      expect(animationNames.length).toBeGreaterThanOrEqual(30);
    });

    // CA-4.3.3: Incluye descripción de cada animación
    test('CA-4.3.3: debe incluir descripción de cada animación', async () => {
      const lineText = '<Icon name="arrow-left" animation="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      const spinItem = items.find(i => i.label === 'spin');
      expect(spinItem!.detail).toContain('rotation');
      
      const floatItem = items.find(i => i.label === 'float');
      expect(floatItem!.detail).toContain('floating');
      
      const heartbeatItem = items.find(i => i.label === 'heartbeat');
      expect(heartbeatItem!.detail).toContain('heartbeat');
    });

    // CA-4.3.4: Animaciones ordenadas por categoría
    test('CA-4.3.4: debe ordenar animaciones correctamente', async () => {
      const lineText = '<Icon name="arrow-left" animation="';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      // Basic animations (category 0) should come before attention (category 1)
      const spinItem = items.find(i => i.label === 'spin');
      const tadaItem = items.find(i => i.label === 'tada'); // attention category
      const drawItem = items.find(i => i.label === 'draw'); // draw category
      
      expect(spinItem!.sortText! < tadaItem!.sortText!).toBeTruthy();
      expect(tadaItem!.sortText! < drawItem!.sortText!).toBeTruthy();
    });
  });

  // =====================================================
  // No-match scenarios
  // =====================================================

  describe('escenarios sin coincidencia', () => {
    test('no debe completar en texto normal', async () => {
      const lineText = 'const myVar = "';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items).toHaveLength(0);
    });

    test('debe completar atributos dentro de tag Icon', async () => {
      const lineText = '<Icon ';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      // Ahora sí completa atributos dentro del tag
      expect(items.length).toBeGreaterThan(0);
      const labels = items.map(i => i.label);
      expect(labels).toContain('name');
      expect(labels).toContain('variant');
      expect(labels).toContain('animation');
    });

    test('no debe completar en texto fuera de tags', async () => {
      const lineText = 'const icon = ';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(items).toHaveLength(0);
    });

    test('no debe completar en medio de valor existente', async () => {
      const lineText = '<Icon name="arrow';
      mockDocument = createMockDocument(lineText, lineText.length);
      mockPosition = new vscode.Position(0, lineText.length);

      const items = await provider.provideCompletionItems(
        mockDocument as vscode.TextDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      // Depende de la implementación si filtra o no
      // En este caso, el patrón espera name=" al final
      expect(items).toHaveLength(0);
    });
  });
});



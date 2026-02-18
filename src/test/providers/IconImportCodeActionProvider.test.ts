/**
 * Tests para IconImportCodeActionProvider
 */

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  mkdirSync: jest.fn(),
}));

jest.mock('../../services', () => ({
  getComponentExporter: jest.fn().mockReturnValue({
    export: jest.fn().mockReturnValue({ filename: 'Icon.tsx', code: 'export default function Icon() { return null }' }),
  }),
}));

import * as vscode from 'vscode';
import * as fs from 'fs';
import { IconImportCodeActionProvider } from '../../providers/IconImportCodeActionProvider';

describe('IconImportCodeActionProvider', () => {
  let provider: IconImportCodeActionProvider;
  let mockDocument: Partial<vscode.TextDocument>;
  let mockRange: vscode.Range;
  let mockContext: any;
  let mockToken: vscode.CancellationToken;

  beforeEach(() => {
    provider = new IconImportCodeActionProvider();
    mockContext = { diagnostics: [], triggerKind: 1, only: undefined };
    mockToken = { isCancellationRequested: false } as vscode.CancellationToken;
    jest.clearAllMocks();
  });

  const createMockDocument = (lineText: string): Partial<vscode.TextDocument> => ({
    lineAt: jest.fn().mockReturnValue({ text: lineText }),
    languageId: 'typescriptreact',
    uri: { fsPath: '/test/file.tsx' } as vscode.Uri,
    getText: jest.fn().mockReturnValue(lineText),
  });

  test('ofrece import cuando detecta componente JSX sin import', () => {
    const lineText = '<div>\n  <MyIcon name="cloud" />\n</div>';
    mockDocument = createMockDocument(lineText);
    mockRange = new vscode.Range(new vscode.Position(1, 2), new vscode.Position(1, 2));

    const actions = provider.provideCodeActions(mockDocument as vscode.TextDocument, mockRange);

    expect(actions).toBeDefined();
    const importAction = actions!.find(a => a.title.includes('Importar icono'));
    expect(importAction).toBeDefined();
  });

  test('ofrece crear icono y escritura de archivos', () => {
    // Simular que no existe index ni componente
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const lineText = '<MyNewIcon />';
    mockDocument = createMockDocument(lineText);
    mockRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    // Espiar showInformationMessage
    const infoSpy = jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation(() => undefined as any);

    const actions = provider.provideCodeActions(mockDocument as vscode.TextDocument, mockRange);

    expect(actions).toBeDefined();
    const createAction = actions!.find(a => a.title.includes('Crear icono'));
    expect(createAction).toBeDefined();

    // verify files written via fs.writeFileSync
    expect((fs.writeFileSync as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect(infoSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
  });
});

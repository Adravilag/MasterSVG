import * as vscode from 'vscode';
import { IconEditorPanel } from '../../panels/IconEditorPanel';
import { SvgManipulationService } from '../../services/SvgManipulationService';

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

describe.skip('IconEditorPanel - Save Flow Integration (OBSOLETE: no save command)', () => {
  let mockPanel: ReturnType<typeof createMockWebviewPanel>;
  let originalCreateWebviewPanel: typeof vscode.window.createWebviewPanel;

  const testIconData = {
    name: 'test-icon',
    svg: '<svg viewBox="0 0 24 24"><path d="M10 10"/></svg>',
    location: { file: '/test/icons/test.svg', line: 1 }
  };

  beforeEach(() => {
    // Reset singleton
    (IconEditorPanel as any).currentPanel = undefined;
    
    mockPanel = createMockWebviewPanel();
    
    // Mock createWebviewPanel
    originalCreateWebviewPanel = vscode.window.createWebviewPanel;
    (vscode.window.createWebviewPanel as jest.Mock) = jest.fn().mockReturnValue(mockPanel);
    
    // Mock openTextDocument
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
      getText: jest.fn().mockReturnValue('<svg>original</svg>'),
      positionAt: jest.fn().mockReturnValue(new vscode.Position(0, 0)),
      save: jest.fn().mockResolvedValue(true),
      uri: vscode.Uri.file(testIconData.location.file)
    });

    // Mock applyEdit
    (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

    jest.clearAllMocks();
  });

  afterEach(() => {
    vscode.window.createWebviewPanel = originalCreateWebviewPanel;
  });

  test('comando save debe limpiar, namespacing y guardar el archivo usando WorkspaceEdit', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    
    IconEditorPanel.createOrShow(extensionUri, testIconData);

    const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
    
    // Simulate save command
    await handler({ 
      command: 'save',
      animation: 'none',
      settings: {},
      includeAnimation: false
    });

    // Verify applyEdit was called
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    
    // Verify content
    const editCall = (vscode.workspace.applyEdit as jest.Mock).mock.calls[0];
    const workspaceEdit = editCall[0];
    
    // Access private edits map from mock
    const edits = (workspaceEdit as any).edits;
    const fileEdits = edits.get(testIconData.location.file);
    
    expect(fileEdits).toBeDefined();
    expect(fileEdits.length).toBeGreaterThan(0);
    
    const newText = fileEdits[0].newText;
    
    // Should have namespace added by SvgManipulationService
    expect(newText).toContain('xmlns="http://www.w3.org/2000/svg"');
    // Should contain original path
    expect(newText).toContain('<path d="M10 10"/>');
  });

  test('comando save con animación debe inyectar estilos y guardar', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    
    IconEditorPanel.createOrShow(extensionUri, testIconData);

    const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
    
    // Simulate save command with animation
    await handler({ 
      command: 'save',
      animation: 'spin',
      settings: { duration: 2, timing: 'linear' },
      includeAnimation: true
    });

    // Verify applyEdit was called
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    
    const editCall = (vscode.workspace.applyEdit as jest.Mock).mock.calls[0];
    const workspaceEdit = editCall[0];
    const edits = (workspaceEdit as any).edits;
    const fileEdits = edits.get(testIconData.location.file);
    const newText = fileEdits[0].newText;

    // Should contain animation styles
    expect(newText).toContain('@keyframes spin');
    expect(newText).toContain('animation: spin 2s linear');
    expect(newText).toContain('id="icon-manager-animation"');
  });

  test('comando save debe manejar errores de escritura', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    
    IconEditorPanel.createOrShow(extensionUri, testIconData);

    // Mock applyEdit failure
    (vscode.workspace.applyEdit as jest.Mock).mockRejectedValue(new Error('Edit failed'));

    const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
    
    await handler({ 
      command: 'save',
      animation: 'none'
    });

    // Should show error message
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Edit failed'));
  });

  test('comando save debe limpiar animaciones previas antes de guardar nueva', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const dirtyIconData = {
      ...testIconData,
      svg: '<svg><style id="icon-manager-animation">old</style><path/></svg>'
    };
    
    IconEditorPanel.createOrShow(extensionUri, dirtyIconData);

    const handler = (mockPanel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
    
    await handler({ 
      command: 'save',
      animation: 'pulse',
      settings: { duration: 1 },
      includeAnimation: true
    });

    const editCall = (vscode.workspace.applyEdit as jest.Mock).mock.calls[0];
    const workspaceEdit = editCall[0];
    const edits = (workspaceEdit as any).edits;
    const fileEdits = edits.get(testIconData.location.file);
    const newText = fileEdits[0].newText;

    expect(newText).not.toContain('old');
    expect(newText).toContain('@keyframes pulse');
  });
});


import * as vscode from 'vscode';
import { WelcomePanel } from '../../panels/WelcomePanel';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn()
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn()
    }),
    activeTextEditor: undefined,
    showOpenDialog: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(''),
      update: jest.fn()
    }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  env: {
    language: 'en'
  },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Workspace: 1 },
  Uri: {
    file: jest.fn((p) => ({ fsPath: p }))
  },
  commands: {
    executeCommand: jest.fn()
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockImplementation((filePath: string) => {
    if (filePath.includes('Welcome.css')) {
      return '/* Welcome CSS */';
    }
    if (filePath.includes('Welcome.js')) {
      return '// Welcome JS';
    }
    if (filePath.includes('Welcome.html')) {
      return '<div class="welcome-container">${headerIcons}</div>';
    }
    return '';
  })
}));

describe('WelcomePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the static currentPanel
    (WelcomePanel as any).currentPanel = undefined;
  });

  describe('isConfigured', () => {
    it('should return false when outputDirectory is empty', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('')
      });
      
      expect(WelcomePanel.isConfigured()).toBe(false);
    });

    it('should return true when outputDirectory is set', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('src/icons')
      });
      
      expect(WelcomePanel.isConfigured()).toBe(true);
    });
  });

  describe('createOrShow', () => {
    it('should create a new panel when none exists', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      
      WelcomePanel.createOrShow(extensionUri);
      
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'iconManager.welcome',
        'Welcome to Bezier SVG',
        expect.anything(),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });

    it('should reveal existing panel if one exists', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn()
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      };
      
      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);
      
      // Create first panel
      WelcomePanel.createOrShow(extensionUri);
      
      // Try to create second panel - should reveal existing
      WelcomePanel.createOrShow(extensionUri);
      
      expect(mockPanel.reveal).toHaveBeenCalled();
    });
  });
});

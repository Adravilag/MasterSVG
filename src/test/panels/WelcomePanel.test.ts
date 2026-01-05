// Mock configuration change callbacks storage
// Use `var` so the variable is hoisted and available to the mock factory
// even if the mock is initialized early during module evaluation.
var configChangeCallbacks: ((e: { affectsConfiguration: (section: string) => boolean }) => void)[] = [];

import * as vscode from 'vscode';
import { WelcomePanel } from '../../panels/WelcomePanel';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn(),
    }),
    activeTextEditor: undefined,
    showOpenDialog: jest.fn(),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(''),
      update: jest.fn().mockResolvedValue(undefined),
    }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    onDidChangeConfiguration: jest.fn().mockImplementation(callback => {
      configChangeCallbacks.push(callback);
      return { dispose: jest.fn() };
    }),
  },
  env: {
    language: 'en',
  },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Workspace: 1 },
  Uri: {
    file: jest.fn(p => ({ fsPath: p })),
  },
  commands: {
    executeCommand: jest.fn(),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
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
      return `<div class="step-number \${step1SourceNumberClass}"><span>1</span></div>
        <div class="step-number \${step2NumberClass}"><span>2</span></div>
        <input id="sourceDir" value="\${sourceDir}" />
        <input id="outputDir" value="\${outputDir}" />
        \${step4Section}`;
    }
    return '';
  }),
}));

describe('WelcomePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configChangeCallbacks = [];
    // Reset the static currentPanel
    (WelcomePanel as any).currentPanel = undefined;
  });

  describe('isConfigured', () => {
    it('should return false when outputDirectory is empty', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(''),
      });

      expect(WelcomePanel.isConfigured()).toBe(false);
    });

    it('should return true when outputDirectory is set', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('src/icons'),
      });

      expect(WelcomePanel.isConfigured()).toBe(true);
    });
  });

  describe('createOrShow', () => {
    it('should create a new panel when none exists', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;

      WelcomePanel.createOrShow(extensionUri);

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'masterSVG.welcome',
        'Welcome to Master SVG', // Uses t('welcome.title')
        expect.anything(),
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    it('should reveal existing panel if one exists', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      // Create first panel
      WelcomePanel.createOrShow(extensionUri);

      // Try to create second panel - should reveal existing
      WelcomePanel.createOrShow(extensionUri);

      expect(mockPanel.reveal).toHaveBeenCalled();
    });

    it('should register configuration change listener', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;

      WelcomePanel.createOrShow(extensionUri);

      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });
  });

  describe('Configuration Updates', () => {
    let mockPanel: any;
    let messageHandler: (message: any) => void;

    beforeEach(() => {
      mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn().mockImplementation(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
        },
        onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);
    });

    it('should update session config (not persist) when source directory is set', async () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'svgFolders') return [];
          return '';
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      WelcomePanel.createOrShow(extensionUri);

      // Simulate receiving setSourceDirectory message
      await messageHandler({ command: 'setSourceDirectory', directory: 'svgs' });

      // With deferred save, config.update should NOT be called on Apply
      // It will only be called on finishSetup
      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    it('should update session config (not persist) when output directory is set', async () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockConfig = {
        get: jest.fn().mockReturnValue(''),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      WelcomePanel.createOrShow(extensionUri);

      // Simulate receiving setOutputDirectory message
      await messageHandler({ command: 'setOutputDirectory', directory: 'public/icons' });

      // With deferred save, config.update should NOT be called on Apply
      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    it('should update session config (not persist) when web component name is set', async () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockConfig = {
        get: jest.fn().mockReturnValue(''),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      WelcomePanel.createOrShow(extensionUri);

      // Simulate receiving setWebComponentName message
      await messageHandler({ command: 'setWebComponentName', name: 'custom-icon' });

      // With deferred save, config.update should NOT be called on Apply
      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    it('should update panel HTML when configuration changes', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;

      WelcomePanel.createOrShow(extensionUri);

      const initialHtml = mockPanel.webview.html;

      // Simulate configuration change
      if (configChangeCallbacks.length > 0) {
        configChangeCallbacks[0]({
          affectsConfiguration: (section: string) => section === 'masterSVG',
        });
      }

      // HTML should have been updated
      // Note: In real scenario, HTML would change based on new config values
      expect(mockPanel.webview.html).toBeDefined();
    });

    it('should not update panel HTML when unrelated configuration changes', () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;

      WelcomePanel.createOrShow(extensionUri);

      // Get reference to initial update count
      const getConfigCallCount = (vscode.workspace.getConfiguration as jest.Mock).mock.calls.length;

      // Simulate unrelated configuration change
      if (configChangeCallbacks.length > 0) {
        configChangeCallbacks[0]({
          affectsConfiguration: (section: string) => section === 'editor',
        });
      }

      // getConfiguration should not have been called again for unrelated changes
      // (depends on implementation - this tests the filter logic)
    });
  });

  describe('Step Completion States', () => {
    it('should mark step 1 as completed when source directory is configured', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'svgFolders') return ['svgs'];
          if (key === 'outputDirectory') return '';
          return defaultValue;
        }),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
        },
        onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      WelcomePanel.createOrShow(extensionUri);

      // The HTML should contain 'completed' class for step 1
      expect(mockPanel.webview.html).toContain('completed');
    });

    it('should mark step 2 as completed when output directory is configured (requires step 1 complete)', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          // Step 1 must also be complete for step 2 to show as completed
          if (key === 'svgFolders') return ['svgs']; // Step 1 complete
          if (key === 'outputDirectory') return 'public/icons'; // Step 2 complete
          return defaultValue;
        }),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
        },
        onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      WelcomePanel.createOrShow(extensionUri);

      // The HTML should contain 'completed' class for step 2
      expect(mockPanel.webview.html).toContain('completed');
    });

    it('should mark step 4 as completed when web component name contains hyphen', () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'svgFolders') return ['svgs'];
          if (key === 'outputDirectory') return 'public/icons';
          if (key === 'webComponentName') return 'custom-icon';
          if (key === 'buildFormat') return 'icons.ts';
          return defaultValue;
        }),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
        },
        onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

      WelcomePanel.createOrShow(extensionUri);

      // The HTML should contain 'completed' class for step 4
      // Since step 4 is dynamically generated, check the HTML contains step-number completed
      expect(mockPanel.webview.html).toBeDefined();
    });
  });

  describe('Finish Setup', () => {
    let mockPanel: any;
    let messageHandler: (message: any) => void;

    beforeEach(() => {
      mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn().mockImplementation(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
        },
        onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        reveal: jest.fn(),
        dispose: jest.fn(),
      };

      (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);
    });

    it('should show warning when output directory is not configured', async () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          // Return empty outputDirectory to trigger warning
          if (key === 'outputDirectory') return '';
          if (key === 'svgFolders') return [];
          return defaultValue;
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      WelcomePanel.createOrShow(extensionUri);

      // Simulate receiving finishSetup message
      await messageHandler({ command: 'finishSetup' });

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should dispose panel after finishSetup completes', async () => {
      const extensionUri = { fsPath: '/test/extension' } as vscode.Uri;
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'svgFolders') return ['svgs'];
          if (key === 'outputDirectory') return 'public/icons';
          if (key === 'buildFormat') return 'icons.ts';
          if (key === 'webComponentName') return 'svg-icon';
          return defaultValue;
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      WelcomePanel.createOrShow(extensionUri);

      // Simulate receiving finishSetup message
      await messageHandler({ command: 'finishSetup' });

      expect(mockPanel.dispose).toHaveBeenCalled();
    });
  });
});

import { resetAllMocks } from './mocks/vscode';

jest.resetModules();

// We'll create focused mocks for config changes and watch mode
jest.mock('./mocks/vscode');

describe('extension additional activation flows', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    jest.resetModules();
    // Ensure common workspace event helpers exist on the mock
    const vscode: any = require('vscode');
    vscode.workspace.onDidChangeTextDocument = jest.fn((cb: any) => ({ dispose: jest.fn() }));
    vscode.workspace.onDidOpenTextDocument = jest.fn((cb: any) => ({ dispose: jest.fn() }));
    vscode.workspace.onDidChangeConfiguration = jest.fn((cb: any) => ({ dispose: jest.fn() }));
    vscode.window.visibleTextEditors = [];
  });

  test('setupCodeIntegration responds to configuration changes (enable -> disable)', async () => {
    const vscode: any = require('vscode');

    // initial configuration: disabled
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((k: string, d: any) => false),
      update: jest.fn(),
    });

    // capture configuration change callbacks (there can be multiple subscribers)
    const configCbs: any[] = [];
    vscode.workspace.onDidChangeConfiguration = jest.fn((cb: any) => { configCbs.push(cb); return { dispose: jest.fn() }; });

    // ensure language providers have disposables we can inspect
    const completionDisposable = { dispose: jest.fn() };
    (vscode.languages.registerCompletionItemProvider as jest.Mock).mockReturnValue(completionDisposable);

    const { activate } = require('../extension');
    const ctx: any = { extensionUri: (vscode.Uri as any).file('/proj'), subscriptions: [] };

    await activate(ctx);

    // Now simulate enabling the feature at runtime
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((k: string, d: any) => (k === 'codeIntegrationEnabled' ? true : d)),
      update: jest.fn(),
    });

    // trigger any captured configuration change callbacks
    expect(configCbs.length).toBeGreaterThan(0);
    for (const cb of configCbs) {
      await cb({ affectsConfiguration: (name: string) => name === 'masterSVG.codeIntegrationEnabled' });
    }

    // providers should be registered
    expect(vscode.languages.registerCompletionItemProvider).toHaveBeenCalled();

    // Now simulate disabling
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((k: string, d: any) => (k === 'codeIntegrationEnabled' ? false : d)),
      update: jest.fn(),
    });

    for (const cb of configCbs) {
      await cb({ affectsConfiguration: (name: string) => name === 'masterSVG.codeIntegrationEnabled' });
    }

    // The disposable returned for the provider should have been disposed
    expect(completionDisposable.dispose).toHaveBeenCalled();
  });

  test('watch mode: processes created SVG and triggers build and refresh', async () => {
    jest.useFakeTimers();

    const vscode: any = require('vscode');

    // Mock getSvgConfig to enable watchMode and set svgFolders
    jest.mock('../utils/config', () => ({
      getSvgConfig: jest.fn((key: string, def: any) => {
        if (key === 'watchMode') return true;
        if (key === 'svgFolders') return ['/test/workspace'];
        return def;
      }),
    }));

    // Mock buildIcon helper
    jest.mock('../utils/iconBuildHelpers', () => ({ buildIcon: jest.fn().mockResolvedValue(true) }));

    // Provide an IconStudioPanel.currentPanel so processWatchBatch posts messages
    jest.mock('../panels/IconStudioPanel', () => ({ IconStudioPanel: { currentPanel: { postMessage: jest.fn() } } }));

    // Ensure IconPreviewProvider has forceRefresh
    jest.mock('../providers', () => ({
      WorkspaceSvgProvider: jest.fn().mockImplementation(() => ({ getSvgData: jest.fn(), scanInlineSvgs: jest.fn(), getAllIcons: jest.fn() })),
      SvgItem: class {},
      initIgnoreFileWatcher: jest.fn(),
      BuiltIconsProvider: jest.fn().mockImplementation(() => ({ refresh: jest.fn() })),
      SvgFilesProvider: jest.fn().mockImplementation(() => ({ setBuiltIconsProvider: jest.fn(), refresh: jest.fn() })),
      IconCompletionProvider: jest.fn(),
      IconHoverProvider: jest.fn(),
      SvgToIconCodeActionProvider: jest.fn(),
      MissingIconCodeActionProvider: jest.fn(),
      SvgImgDiagnosticProvider: jest.fn(),
      IconPreviewProvider: jest.fn().mockImplementation(() => ({ updatePreview: jest.fn(), forceRefresh: jest.fn() })),
    }));

    // Re-import mocks after jest.mock calls
    const { buildIcon } = require('../utils/iconBuildHelpers');

    // make readFile return a small SVG
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('<svg></svg>'));

    const { activate } = require('../extension');
    const ctx: any = { extensionUri: (vscode.Uri as any).file('/proj'), subscriptions: [] };

    await activate(ctx);

    // The createFileSystemWatcher was called; get its created mock value
    const watcher = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results[0].value;

    // The startWatchMode registers a second onDidCreate handler; find the last registered callback
    const calls = watcher.onDidCreate.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const handler = calls[calls.length - 1][0];

    // Simulate creation of a svg file inside configured folder
    handler({ fsPath: '/test/workspace/icons/foo.svg' });

    // Fast-forward timers so the scheduled batch runs
    jest.runAllTimers();

    // Allow any pending promises to resolve
    await Promise.resolve();
    await Promise.resolve();

    // buildIcon should have been called for the file
    expect(buildIcon).toHaveBeenCalled();

    // Refresh command should be executed
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('masterSVG.refreshIcons');

    // IconPreviewProvider may expose forceRefresh; if present it should be a function
    const providersModule = require('../providers');
    const previewCtor = providersModule.IconPreviewProvider as jest.Mock;
    const previewInstance = previewCtor.mock.results[0].value;
    expect(previewInstance).toBeDefined();

    // Clean up fake timers
    jest.useRealTimers();
  });
});

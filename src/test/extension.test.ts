import { resetAllMocks } from './mocks/vscode';

// Mock providers and panels before importing extension
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
  IconPreviewProvider: jest.fn().mockImplementation(() => ({ updatePreview: jest.fn() })),
}));

jest.mock('../panels/WelcomePanel', () => ({
  WelcomePanel: { isConfigured: jest.fn().mockReturnValue(false), createOrShow: jest.fn() },
}));

jest.mock('./mocks/vscode');

jest.mock('../utils/configHelper', () => ({ updateIconsJsContext: jest.fn() }));

// Mock command registration modules to track calls
const noopDisposable = { dispose: jest.fn() };
function makeRegister() {
  return jest.fn().mockReturnValue([noopDisposable]);
}

jest.mock('../commands/treeViewCommands', () => ({ registerTreeViewCommands: makeRegister() }));
jest.mock('../commands/refreshCommands', () => ({ registerRefreshCommands: makeRegister() }));
jest.mock('../commands/buildCommands', () => ({ registerBuildCommands: makeRegister() }));
jest.mock('../commands/navigationCommands', () => ({ registerNavigationCommands: makeRegister() }));
jest.mock('../commands/panelCommands', () => ({ registerPanelCommands: makeRegister() }));
jest.mock('../commands/referenceCommands', () => ({ registerReferenceCommands: makeRegister() }));
jest.mock('../commands/configCommands', () => ({ registerConfigCommands: makeRegister() }));
jest.mock('../commands/iconCommands', () => ({ registerIconCommands: makeRegister() }));
jest.mock('../commands/transformCommands', () => ({ registerTransformCommands: makeRegister() }));
jest.mock('../commands/iconifyCommands', () => ({ registerIconifyCommands: makeRegister() }));
jest.mock('../commands/editorCommands', () => ({ registerEditorCommands: makeRegister() }));
jest.mock('../commands/spriteCommands', () => ({ registerSpriteCommands: makeRegister() }));
jest.mock('../commands/miscCommands', () => ({ registerMiscCommands: makeRegister() }));
jest.mock('../commands/importCommands', () => ({ registerImportCommands: makeRegister() }));
jest.mock('../commands/licenseCommands', () => ({ registerLicenseCommands: makeRegister() }));
jest.mock('../commands/libraryCommands', () => ({ registerLibraryCommands: makeRegister() }));

import * as vscode from 'vscode';

describe('extension activation', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('activate registers providers and commands', async () => {
    const { activate } = require('../extension');

    // prepare fake context
    const ctx: any = { extensionUri: (vscode.Uri as any).file('C:/project'), subscriptions: [] };
    // Ensure workspaceFolders present so onboarding is triggered
    const vscodeMock: any = require('vscode');
    vscodeMock.workspace.workspaceFolders = [{ uri: (vscode.Uri as any).file('C:/project') }];

    // Mock onDidChangeConfiguration so activate can subscribe
    vscodeMock.workspace.onDidChangeConfiguration = jest.fn(() => ({ dispose: jest.fn() }));

    await activate(ctx);

    const configHelper = require('../utils/configHelper');
    expect(configHelper.updateIconsJsContext).toHaveBeenCalled();

    const treeViewCommands = require('../commands/treeViewCommands');
    expect(treeViewCommands.registerTreeViewCommands).toHaveBeenCalled();

    const configCommands = require('../commands/configCommands');
    expect(configCommands.registerConfigCommands).toHaveBeenCalledWith(expect.any(Object));
  });
});

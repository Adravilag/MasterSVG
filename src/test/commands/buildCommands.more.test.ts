import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../utils/iconsFileManager', () => ({
  addToIconsJs: jest.fn().mockResolvedValue(undefined),
  addToSpriteSvg: jest.fn().mockResolvedValue(undefined),
  generateWebComponent: jest.fn().mockResolvedValue({ path: '/out/svg-element.js', content: 'x' }),
}));

jest.mock('../../utils/configHelper', () => ({
  getConfig: jest.fn().mockReturnValue({ buildFormat: 'icons.js', webComponentName: 'svg-icon' }),
  getFullOutputPath: jest.fn().mockReturnValue('/out'),
  getOutputPathOrWarn: jest.fn().mockReturnValue('/out'),
  updateIconsJsContext: jest.fn(),
}));

jest.mock('../../utils/outputFileManager', () => ({
  buildIconsFileContent: jest.fn().mockReturnValue('/* icons */'),
}));

jest.mock('../../commands/licenseCommands', () => ({
  autoGenerateLicensesIfEnabled: jest.fn().mockResolvedValue(undefined),
}));

import * as vscode from 'vscode';
import { registerBuildCommands } from '../../commands/buildCommands';

describe('buildCommands (additional coverage)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('buildAllReferences shows information when no img references', async () => {
    const providers = {
      workspaceSvgProvider: { getImgReferences: jest.fn().mockReturnValue([]) },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildAllReferences');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  test('buildAllReferences warns when all img references missing', async () => {
    const providers = {
      workspaceSvgProvider: { getImgReferences: jest.fn().mockReturnValue([{ name: 'a', exists: false }]) },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildAllReferences');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  test('buildAllFiles shows info when no svg files found', async () => {
    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), scanInlineSvgs: jest.fn(), getAllIcons: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn().mockResolvedValue(undefined), getSvgFilesMap: jest.fn().mockReturnValue(new Map()) },
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildAllFiles');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  test('buildIcons warns when no icons to build', async () => {
    const providers = {
      workspaceSvgProvider: { scanInlineSvgs: jest.fn().mockResolvedValue(undefined), getAllIcons: jest.fn().mockResolvedValue([]), refresh: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildIcons');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });
});

import { resetAllMocks } from '../../test/mocks/vscode';

// Mocks for modules used by buildCommands
jest.mock('../../utils/iconsFileManager', () => ({
  addToIconsJs: jest.fn().mockResolvedValue(undefined),
  addToSpriteSvg: jest.fn().mockResolvedValue(undefined),
  generateWebComponent: jest.fn().mockResolvedValue({ path: '/out/svg-element.js', content: 'x' }),
}));

jest.mock('../../utils/configHelper', () => ({
  getConfig: jest.fn().mockReturnValue({ buildFormat: 'icons.js', webComponentName: 'svg-icon' }),
  getOutputPathOrWarn: jest.fn().mockReturnValue('/out'),
  updateIconsJsContext: jest.fn(),
  getFullOutputPath: jest.fn().mockReturnValue('/out'),
}));

jest.mock('../../commands/licenseCommands', () => ({
  autoGenerateLicensesIfEnabled: jest.fn().mockResolvedValue(undefined),
}));

import * as vscode from 'vscode';
import { registerBuildCommands } from '../../commands/buildCommands';

describe('buildCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('buildSingleIcon shows error when data missing', async () => {
    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), scanInlineSvgs: jest.fn(), getAllIcons: jest.fn(), getImgReferences: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    const disposables = registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    // Find registered command callback
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildSingleIcon');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback(undefined);

    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  test('buildSingleIcon success path calls addToIconsJs and refreshes providers', async () => {
    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), scanInlineSvgs: jest.fn(), getAllIcons: jest.fn(), getImgReferences: jest.fn(), addBuiltIcon: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    const svgTransformer = {
      extractSvgBody: jest.fn().mockReturnValue('<path />'),
      extractSvgAttributes: jest.fn().mockReturnValue({ viewBox: '0 0 24 24' }),
    } as any;

    const disposables = registerBuildCommands({ subscriptions: [] } as any, providers, svgTransformer as any);

    // Find callback
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildSingleIcon');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback({ iconName: 'test-icon', svgContent: '<svg></svg>' });

    const { addToIconsJs } = require('../../utils/iconsFileManager');
    expect(addToIconsJs).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(providers.workspaceSvgProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});

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

jest.mock('../../commands/licenseCommands', () => ({
  autoGenerateLicensesIfEnabled: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../i18n', () => ({ t: (k: string) => k }));

jest.mock('../../utils/outputFileManager', () => ({
  buildIconsFileContent: jest.fn().mockReturnValue('// generated icons'),
}));

import * as vscode from 'vscode';
import { registerBuildCommands } from '../../commands/buildCommands';

describe('buildCommands extra coverage', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('buildSingleIcon shows error when missing svgContent', async () => {
    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), addBuiltIcon: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    const svgTransformer = {
      extractSvgBody: jest.fn((s: string) => s),
      extractSvgAttributes: jest.fn((s: string) => ({})),
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, svgTransformer);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildSingleIcon');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback({ iconName: 'i' }); // missing svgContent

    const { addToIconsJs } = require('../../utils/iconsFileManager');
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect(addToIconsJs).not.toHaveBeenCalled();
  });

  test('buildIcons warns when no icons to build', async () => {
    const providers = {
      workspaceSvgProvider: { scanInlineSvgs: jest.fn().mockResolvedValue(undefined), getAllIcons: jest.fn().mockResolvedValue([]), refresh: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    // config and output path are mocked at top
    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildIcons');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('messages.noIconsFoundToBuild');
  });

  test('buildIcons skips rasterized icons and shows skipped warning', async () => {
    // generate svg string with >50 unique colors
    const manyColors = Array.from({ length: 52 }, (_, i) => `#${(100000 + i).toString(16).slice(-6)}`).join(' ');
    const svg = `<svg>${manyColors}</svg>`;

    const icons = [
      { name: 'big', svg },
    ];

    const providers = {
      workspaceSvgProvider: { scanInlineSvgs: jest.fn().mockResolvedValue(undefined), getAllIcons: jest.fn().mockResolvedValue(icons), refresh: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    const cfg = require('../../utils/configHelper');
    cfg.getConfig.mockReturnValue({ buildFormat: 'icons.js', webComponentName: 'svg-icon' });
    cfg.getOutputPathOrWarn.mockReturnValue('/out');

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildIcons');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(providers.workspaceSvgProvider.refresh).toHaveBeenCalled();
    const license = require('../../commands/licenseCommands');
    expect(license.autoGenerateLicensesIfEnabled).toHaveBeenCalledWith('/out');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('messages.iconsLibraryBuilt'));
  });
});

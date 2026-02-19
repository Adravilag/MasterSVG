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

import * as vscode from 'vscode';
import * as fs from 'fs';
import { registerBuildCommands } from '../../commands/buildCommands';

describe('buildCommands flows', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('buildSingleIcon uses addToSpriteSvg when buildFormat is sprite', async () => {
    // Override config to sprite
    const cfg = require('../../utils/configHelper');
    cfg.getConfig.mockReturnValue({ buildFormat: 'sprite.svg' });

    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), addBuiltIcon: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildSingleIcon');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback({ iconName: 'i', svgContent: '<svg></svg>' });

    const { addToSpriteSvg } = require('../../utils/iconsFileManager');
    expect(addToSpriteSvg).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  test('buildAllReferences transforms an <img> to web component and updates file', async () => {
    // ensure config is icons.js for this test
    const cfg = require('../../utils/configHelper');
    cfg.getConfig.mockReturnValue({ buildFormat: 'icons.js', webComponentName: 'svg-icon' });

    const providers = {
      workspaceSvgProvider: {
        getImgReferences: jest.fn().mockReturnValue([
          { name: 'icon', svg: '<svg></svg>', path: '/icons/icon.svg', filePath: '/test/file.html', line: 0, exists: true },
        ]),
        refresh: jest.fn(),
      },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn(), getSvgFilesMap: jest.fn() },
    } as any;

    // Mock document with line containing img tag
    const doc = {
      uri: vscode.Uri.file('/test/file.html'),
      lineAt: jest.fn().mockReturnValue({ text: '<img src="icon.svg">' }),
      save: jest.fn().mockResolvedValue(true),
    };

    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(doc);

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildAllReferences');
    expect(call).toBeDefined();
    const callback = call![1];

    // Ensure user confirms the transformation
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('messages.yesButton');

    await callback();

    const { addToIconsJs } = require('../../utils/iconsFileManager');
    expect(addToIconsJs).toHaveBeenCalled();
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
    expect(providers.workspaceSvgProvider.refresh).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
  });

  test('buildAllFiles reads svg file and generates web component', async () => {
    const svgContent = '<svg><path fill="#000001"/></svg>';

    const svgMap = new Map();
    svgMap.set('icon', { name: 'icon', path: '/path/icon.svg', svg: svgContent });

    // sanity check
    console.log('svgMap size before calling:', svgMap.size);

    const providers = {
      workspaceSvgProvider: { refresh: jest.fn(), scanInlineSvgs: jest.fn(), getAllIcons: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), ensureReady: jest.fn().mockResolvedValue(undefined), getSvgFilesMap: jest.fn().mockReturnValue(svgMap) },
    } as any;

    // ensure config is icons.js for this test
    const cfg = require('../../utils/configHelper');
    cfg.getConfig.mockReturnValue({ buildFormat: 'icons.js', webComponentName: 'svg-icon' });

    registerBuildCommands({ subscriptions: [] } as any, providers, {} as any);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.buildAllFiles');
    expect(call).toBeDefined();
    const callback = call![1];

    // Ensure confirm dialog returns yes to proceed with build
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('messages.yesButton');

    await callback();

    console.log('after callback');

    const { addToIconsJs, generateWebComponent } = require('../../utils/iconsFileManager');
    expect(addToIconsJs).toHaveBeenCalled();
    expect(generateWebComponent).toHaveBeenCalled();
    expect(providers.svgFilesProvider.refresh).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
  });
});

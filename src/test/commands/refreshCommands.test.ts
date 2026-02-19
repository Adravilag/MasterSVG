import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../i18n', () => ({ t: (k: string) => k }));

import * as vscode from 'vscode';
import { registerRefreshCommands } from '../../commands/refreshCommands';

describe('refreshCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('refreshIcons calls all providers and await ensureReady', async () => {
    const providers = {
      builtIconsProvider: { refresh: jest.fn(), ensureReady: jest.fn().mockResolvedValue(undefined) },
      svgFilesProvider: { refresh: jest.fn(), refreshFile: jest.fn(), refreshItemByName: jest.fn() },
      workspaceSvgProvider: { refresh: jest.fn() },
      iconPreviewProvider: { forceRefresh: jest.fn() },
    } as any;

    const disposables = registerRefreshCommands(providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.refreshIcons');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(providers.svgFilesProvider.refresh).toHaveBeenCalled();
    expect(providers.workspaceSvgProvider.refresh).toHaveBeenCalled();
    expect(providers.builtIconsProvider.ensureReady).toHaveBeenCalled();
  });

  test('addIconToBuiltAndRefresh delegates to provider', () => {
    const providers = {
      builtIconsProvider: { refresh: jest.fn(), addIconAndRefresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), refreshFile: jest.fn(), refreshItemByName: jest.fn() },
      workspaceSvgProvider: { refresh: jest.fn() },
      iconPreviewProvider: { forceRefresh: jest.fn() },
    } as any;

    registerRefreshCommands(providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.addIconToBuiltAndRefresh');
    expect(call).toBeDefined();
    const callback = call![1];

    callback('icon-name', '<svg/>', '/out/icons.js');

    expect(providers.builtIconsProvider.addIconAndRefresh).toHaveBeenCalledWith(
      'icon-name',
      '<svg/>',
      '/out/icons.js',
      undefined
    );
  });

  test('devRefreshAll triggers preview refresh and shows message', () => {
    const providers = {
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), refreshFile: jest.fn(), refreshItemByName: jest.fn() },
      workspaceSvgProvider: { refresh: jest.fn() },
      iconPreviewProvider: { forceRefresh: jest.fn() },
    } as any;

    registerRefreshCommands(providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.devRefreshAll');
    expect(call).toBeDefined();
    const callback = call![1];

    callback();

    expect(providers.iconPreviewProvider!.forceRefresh).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});

import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../i18n', () => ({ t: (k: string) => k }));
jest.mock('../../utils/configHelper', () => ({ getFullOutputPath: jest.fn().mockReturnValue('/out'), updateIconsJsContext: jest.fn() }));
jest.mock('../../utils/iconsFileManager', () => ({ removeFromIconsJs: jest.fn().mockReturnValue(true) }));
jest.mock('../../services', () => ({ VariantsService: jest.fn().mockImplementation(() => ({ removeIconData: jest.fn(), persistToFile: jest.fn(), resetCache: jest.fn() })) }));

import * as vscode from 'vscode';
import { registerIconCommands } from '../../commands/iconCommands';

describe('iconCommands extra', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('removeFromBuilt success path refreshes providers and shows info', async () => {
    const providers: any = {
      workspaceSvgProvider: { refresh: jest.fn() },
      builtIconsProvider: { refresh: jest.fn() },
      svgFilesProvider: { refresh: jest.fn(), removeItem: jest.fn() },
    };

    registerIconCommands({ subscriptions: [] } as any, providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.removeFromBuilt');
    const cb = call![1];

    // confirm dialog returns removeButton
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('messages.removeButton');

    const item = { icon: { name: 'x' }, label: 'x' };
    await cb(item);

    const iconsFile = require('../../utils/iconsFileManager');
    expect(iconsFile.removeFromIconsJs).toHaveBeenCalledWith('/out', ['x']);
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});

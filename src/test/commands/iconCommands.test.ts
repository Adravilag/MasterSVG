import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import * as vscode from 'vscode';
import { resetAllMocks } from '../../test/mocks/vscode';
import { registerIconCommands } from '../../commands/iconCommands';

// 1. Configuración de Mocks Globales
jest.mock('../../utils/iconsFileManager', () => ({
  removeFromIconsJs: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/configHelper', () => ({
  getFullOutputPath: jest.fn().mockReturnValue('/out'),
  updateIconsJsContext: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  t: (k: string) => k
}));

jest.mock('../../services', () => ({
  VariantsService: jest.fn().mockImplementation(() => ({
    removeIconData: jest.fn(),
    persistToFile: jest.fn(),
    resetCache: jest.fn(),
  })),
}));

// Definición de tipos para callbacks
type CommandCallback = (...args: any[]) => Promise<any> | any;

describe('iconCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  const createMockProviders = () => ({
    workspaceSvgProvider: {
      refresh: jest.fn(),
      renameBuiltIcon: jest.fn(),
      renameSvgFile: jest.fn()
    },
    builtIconsProvider: { refresh: jest.fn() },
    svgFilesProvider: { refresh: jest.fn(), removeItem: jest.fn() },
  } as any);

  test('removeFromBuilt shows warning when no items', async () => {
    const providers = createMockProviders();
    registerIconCommands({ subscriptions: [] } as any, providers);

    // Casting simple a jest.Mock para acceder a .calls
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.removeFromBuilt');

    expect(call).toBeDefined();

    const callback = call![1] as CommandCallback;
    await callback(undefined, undefined);

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  test('removeFromBuilt success removes icons and refreshes providers', async () => {
    const providers = createMockProviders();
    registerIconCommands({ subscriptions: [] } as any, providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.removeFromBuilt');

    const callback = call![1] as CommandCallback;

    const items = [
      { icon: { name: 'a' }, label: 'a' },
      { icon: { name: 'b' }, label: 'b' }
    ];

    (vscode.window.showWarningMessage as any).mockResolvedValue('messages.removeButton');

    await callback(items[0], items);

    const { removeFromIconsJs } = require('../../utils/iconsFileManager');

    expect(removeFromIconsJs).toHaveBeenCalled();
    expect(providers.builtIconsProvider.refresh).toHaveBeenCalled();
    expect(providers.workspaceSvgProvider.refresh).toHaveBeenCalled();
    expect(providers.svgFilesProvider.refresh).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});

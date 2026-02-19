import { resetAllMocks } from '../mocks/vscode';

jest.mock('../../utils/iconifyService', () => ({
  fetchIconSvg: jest.fn(),
  searchIconify: jest.fn().mockResolvedValue([]),
  searchInCollection: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../utils/iconsFileManager', () => ({ addToIconsJs: jest.fn(), addToSpriteSvg: jest.fn() }));
jest.mock('../../utils/configHelper', () => ({ getConfig: jest.fn().mockReturnValue({}), getOutputPathOrWarn: jest.fn().mockReturnValue('/out') }));

import * as vscode from 'vscode';
import { handleDuplicateIconName, showIconifyReplacementPicker } from '../../commands/iconifyCommands';

describe('iconifyCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('handleDuplicateIconName', () => {
    test('returns name when not existing', async () => {
      const provider: any = { getIcon: jest.fn().mockReturnValue(undefined) };
      const result = await handleDuplicateIconName('foo', provider);
      expect(result).toBe('foo');
    });

    test('returns undefined when user cancels', async () => {
      const provider: any = { getIcon: jest.fn().mockReturnValue({ name: 'foo' }) };
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'cancel' });
      const result = await handleDuplicateIconName('foo', provider);
      expect(result).toBeUndefined();
    });

    test('returns same name when user chooses replace', async () => {
      const provider: any = { getIcon: jest.fn().mockReturnValue({ name: 'foo' }) };
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'replace' });
      const result = await handleDuplicateIconName('foo', provider);
      expect(result).toBe('foo');
    });

    test('prompts for new name when user chooses rename', async () => {
      const provider: any = { getIcon: jest.fn().mockImplementation((name: string) => (name === 'foo' ? { name: 'foo' } : undefined)) };
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'rename' });
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('foo-2');
      const result = await handleDuplicateIconName('foo', provider);
      expect(result).toBe('foo-2');
    });
  });

});

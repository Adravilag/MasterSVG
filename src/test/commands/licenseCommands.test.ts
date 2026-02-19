import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../i18n', () => ({ t: (k: string) => k }));
jest.mock('../../utils/configHelper', () => ({ getFullOutputPath: jest.fn().mockReturnValue('/out') }));
jest.mock('../../services', () => ({ generateLicenseFiles: jest.fn(), getLicenseSummary: jest.fn() }));

import * as vscode from 'vscode';
import { autoGenerateLicensesIfEnabled, registerLicenseCommands } from '../../commands/licenseCommands';

describe('licenseCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('autoGenerateLicensesIfEnabled not enabled does nothing', async () => {
    // config default mock in vscode returns autoGenerate false
    await autoGenerateLicensesIfEnabled('/out');
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  test('generateLicenses command runs and opens folder when requested', async () => {
    const services = require('../../services');
    services.generateLicenseFiles.mockResolvedValue({ success: true, files: ['a'], message: 'done' });

    // ensure output path present
    const ctx: any = { subscriptions: [] };
    registerLicenseCommands(ctx);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.generateLicenses');
    const cb = call![1];

    // select option then select Open Folder action
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ value: 'combined' });
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Open Folder');

    await cb();

    expect(services.generateLicenseFiles).toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalled();
  });
});

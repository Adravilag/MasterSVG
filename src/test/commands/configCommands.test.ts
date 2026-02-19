import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../i18n', () => ({ t: (k: string) => k }));

import * as vscode from 'vscode';
// Mock fs early so the module under test picks up the mock
jest.mock('fs', () => ({ existsSync: jest.fn(), writeFileSync: jest.fn() }));
import * as fs from 'fs';
import { registerConfigCommands } from '../../commands/configCommands';

describe('configCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('registers configureProject and handles openWelcome selection', async () => {
    const ctx: any = { subscriptions: [] };
    registerConfigCommands(ctx);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.configureProject');
    expect(call).toBeDefined();
    const callback = call![1];

    // simulate quick pick selection to open welcome
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ label: `$(gear) ui.labels.openWelcome` });

    await callback();

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('masterSVG.showWelcome');
  });

  test('editIgnoreFile creates file when missing and opens it', async () => {
    const ctx: any = { subscriptions: [] };

    // Provide a workspace folder
    (vscode.workspace as any).workspaceFolders = [{ uri: (vscode.Uri as any).file('C:/proj') }];

    // Mock fs to pretend file doesn't exist and capture write
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const writeSpy = (fs.writeFileSync as jest.Mock).mockImplementation(() => undefined as any);
    const doc = { uri: (vscode.Uri as any).file('C:/proj/.msignore') } as any;
    (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(doc);

    registerConfigCommands(ctx);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.editIgnoreFile');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(writeSpy).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(doc);
  });

  test('configureSvgFolder warns when no workspace', async () => {
    const ctx: any = { subscriptions: [] };
    (vscode.workspace as any).workspaceFolders = undefined;

    registerConfigCommands(ctx);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.configureSvgFolder');
    expect(call).toBeDefined();
    const callback = call![1];

    await callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('messages.noWorkspace');
  });
});

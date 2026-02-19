import { resetAllMocks } from '../../test/mocks/vscode';

jest.mock('../../i18n', () => ({ t: (k: string) => k }));

jest.mock('../../panels/IconEditorPanel', () => ({ IconEditorPanel: { createOrShow: jest.fn() } }));
jest.mock('../../panels/IconDetailsPanel', () => ({ IconDetailsPanel: { createOrShow: jest.fn() } }));
jest.mock('../../services', () => ({ getComponentExporter: jest.fn().mockReturnValue({ export: jest.fn().mockReturnValue({ code: 'exported' }) }) }));

import * as vscode from 'vscode';
import { registerEditorCommands } from '../../commands/editorCommands';

describe('editorCommands', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  test('previewIcon updates preview when svg present', () => {
    const providers: any = {
      workspaceSvgProvider: { getSvgData: jest.fn().mockReturnValue({ name: 'i', svg: '<svg/>', location: { file: '/a', line: 1 } }) },
      iconPreviewProvider: { updatePreview: jest.fn() },
    };

    registerEditorCommands({ subscriptions: [] } as any, providers);

    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.previewIcon');
    const cb = call![1];

    cb({ icon: { svg: '<svg/>' }, contextValue: 'builtIcon' });

    expect(providers.workspaceSvgProvider.getSvgData).toHaveBeenCalled();
    expect(providers.iconPreviewProvider.updatePreview).toHaveBeenCalled();
  });

  test('exportComponent opens document with exported code', async () => {
    const exporter = require('../../services').getComponentExporter();

    const providers: any = {
      workspaceSvgProvider: { getSvgData: jest.fn() },
      iconPreviewProvider: { updatePreview: jest.fn() },
    };

    registerEditorCommands({ subscriptions: [] } as any, providers);

    // prepare command callback
    const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
    const call = calls.find((c: any[]) => c[0] === 'masterSVG.exportComponent');
    const cb = call![1];

    // select React format
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ label: 'React', value: 'react' });
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({ get: jest.fn().mockReturnValue(true) });

    const item = { icon: { svg: '<svg/>', name: 'icon-name' } };

    await cb(item);

    expect(exporter.export).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });
});

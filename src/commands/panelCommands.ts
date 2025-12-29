import * as vscode from 'vscode';
import { IconManagerPanel } from '../panels/IconManagerPanel';
import { WelcomePanel } from '../panels/WelcomePanel';

/**
 * Interface for provider that can scan SVGs
 */
export interface ScanProvider {
  scanFolder(folder: string): Promise<void>;
  scanInlineSvgs(): Promise<void>;
  scanIconUsages(): Promise<void>;
}

/**
 * Registers panel and scan-related commands
 */
export function registerPanelCommands(
  context: vscode.ExtensionContext,
  workspaceSvgProvider: ScanProvider
): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  // Command: Open main panel
  commands.push(
    vscode.commands.registerCommand('iconManager.openPanel', () => {
      IconManagerPanel.createOrShow(context.extensionUri, context);
    })
  );

  // Command: Open welcome/setup panel
  commands.push(
    vscode.commands.registerCommand('iconManager.openWelcome', () => {
      WelcomePanel.createOrShow(context.extensionUri);
    })
  );

  // Command: Scan workspace for SVGs
  commands.push(
    vscode.commands.registerCommand('iconManager.scanWorkspace', async (uri?: vscode.Uri) => {
      const folder = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (folder) {
        await workspaceSvgProvider.scanFolder(folder);
        await workspaceSvgProvider.scanInlineSvgs();
        await workspaceSvgProvider.scanIconUsages();
        vscode.window.showInformationMessage('SVG scan complete!');
      }
    })
  );

  // Command: Scan for icon usages
  commands.push(
    vscode.commands.registerCommand('iconManager.scanUsages', async () => {
      await workspaceSvgProvider.scanIconUsages();
      vscode.window.showInformationMessage('Usage scan complete!');
    })
  );

  return commands;
}

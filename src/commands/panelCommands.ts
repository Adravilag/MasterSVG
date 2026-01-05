import * as vscode from 'vscode';
import { IconStudioPanel } from '../panels/IconStudioPanel';
import { WelcomePanel } from '../panels/WelcomePanel';
import { t } from '../i18n';

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
    vscode.commands.registerCommand('masterSVG.openPanel', () => {
      IconStudioPanel.createOrShow(context.extensionUri, context);
    })
  );

  // Command: Open welcome/setup panel
  commands.push(
    vscode.commands.registerCommand('masterSVG.openWelcome', () => {
      WelcomePanel.createOrShow(context.extensionUri);
    })
  );

  // Backward-compatible alias used in some providers
  commands.push(
    vscode.commands.registerCommand('masterSVG.showWelcome', () => {
      WelcomePanel.createOrShow(context.extensionUri);
    })
  );

  // Command: Scan workspace for SVGs
  commands.push(
    vscode.commands.registerCommand('masterSVG.scanWorkspace', async (uri?: vscode.Uri) => {
      const folder = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (folder) {
        await workspaceSvgProvider.scanFolder(folder);
        await workspaceSvgProvider.scanInlineSvgs();
        await workspaceSvgProvider.scanIconUsages();
        vscode.window.showInformationMessage(t('messages.svgScanComplete'));
      }
    })
  );

  // Command: Scan for icon usages
  commands.push(
    vscode.commands.registerCommand('masterSVG.scanUsages', async () => {
      await workspaceSvgProvider.scanIconUsages();
      vscode.window.showInformationMessage(t('messages.usageScanComplete'));
    })
  );

  return commands;
}

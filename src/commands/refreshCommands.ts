/**
 * Refresh Commands
 * Commands for refreshing different views
 */
import * as vscode from 'vscode';

export interface RefreshableProviders {
  workspaceSvgProvider: { refresh(): void };
  builtIconsProvider: { refresh(): void };
  svgFilesProvider: { refresh(): void; refreshFile(filePath: string): void };
}

/**
 * Registers all refresh-related commands
 */
export function registerRefreshCommands(
  providers: RefreshableProviders
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Command: Refresh all views
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshIcons', () => {
      // Refresh builtIconsProvider first so svgFilesProvider can get build status
      providers.builtIconsProvider.refresh();
      providers.svgFilesProvider.refresh();
      providers.workspaceSvgProvider.refresh();
    })
  );

  // Command: Refresh FILES view only
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshFiles', () => {
      providers.svgFilesProvider.refresh();
    })
  );

  // Command: Refresh CODE view only
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshCode', () => {
      providers.workspaceSvgProvider.refresh();
    })
  );

  // Command: Refresh BUILT view only
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshBuilt', () => {
      providers.builtIconsProvider.refresh();
    })
  );

  // Command: Partial refresh for a single SVG file (after save/edit)
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshSvgFile', (filePath: string) => {
      if (filePath) {
        providers.svgFilesProvider.refreshFile(filePath);
      }
    })
  );

  return disposables;
}

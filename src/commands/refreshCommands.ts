/**
 * Refresh Commands
 * Commands for refreshing different views
 */
import * as vscode from 'vscode';

export interface RefreshableProviders {
  workspaceSvgProvider: { refresh(): void };
  builtIconsProvider: { refresh(): void; refreshItemByName?(name: string): void; addIconAndRefresh?(name: string, svg: string, iconsFilePath: string): void };
  svgFilesProvider: { refresh(): void; refreshFile(filePath: string): void; refreshItemByName?(name: string): void };
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

  // Command: Partial refresh FILES view by icon name (preserves tree expansion state)
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshFilesItemByName', (iconName: string) => {
      if (iconName) {
        providers.svgFilesProvider.refreshItemByName?.(iconName);
      }
    })
  );

  // Command: Add icon to BUILT and refresh without collapsing tree
  disposables.push(
    vscode.commands.registerCommand('iconManager.addIconToBuiltAndRefresh', (iconName: string, svg: string, iconsFilePath: string) => {
      if (iconName && svg && iconsFilePath) {
        providers.builtIconsProvider.addIconAndRefresh?.(iconName, svg, iconsFilePath);
      }
    })
  );

  // Command: Partial refresh by icon name in both views (preserves tree expansion state)
  disposables.push(
    vscode.commands.registerCommand('iconManager.refreshIconByName', (iconName: string) => {
      if (iconName) {
        // Refresh only the specific icon item without collapsing tree
        providers.svgFilesProvider.refreshItemByName?.(iconName);
        providers.builtIconsProvider.refreshItemByName?.(iconName);
      }
    })
  );

  return disposables;
}


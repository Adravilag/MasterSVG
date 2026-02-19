/**
 * Refresh Commands
 * Commands for refreshing different views
 */
import * as vscode from 'vscode';
import { IconAnimation } from '../types/icons';

export interface RefreshableProviders {
  workspaceSvgProvider: { refresh(): void };
  builtIconsProvider: {
    refresh(): void;
    refreshItemByName?(name: string): void;
    addIconAndRefresh?(name: string, svg: string, iconsFilePath: string, animation?: IconAnimation): void;
    ensureReady?(): Promise<void>;
  };
  svgFilesProvider: {
    refresh(): void;
    refreshFile(filePath: string): void;
    refreshItemByName?(name: string): void;
  };
  iconPreviewProvider?: {
    forceRefresh(): void;
  };
}

/**
 * Registers all refresh-related commands
 */
export function registerRefreshCommands(providers: RefreshableProviders): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Command: Refresh all views
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshIcons', async () => {
      // Refresh builtIconsProvider first so svgFilesProvider can get build status
      providers.builtIconsProvider.refresh();
      providers.svgFilesProvider.refresh();
      providers.workspaceSvgProvider.refresh();
      // Wait until built icons provider finished scanning/loading so callers can rely on ready state
      try {
        await providers.builtIconsProvider.ensureReady?.();
      } catch (e) {
        // ignore errors during ensure
      }
    })
  );

  // Command: Refresh FILES view only
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshFiles', () => {
      providers.svgFilesProvider.refresh();
    })
  );

  // Command: Refresh CODE view only
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshCode', () => {
      providers.workspaceSvgProvider.refresh();
    })
  );

  // Command: Refresh BUILT view only
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshBuilt', () => {
      providers.builtIconsProvider.refresh();
    })
  );

  // Command: Partial refresh for a single SVG file (after save/edit)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshSvgFile', (filePath: string) => {
      if (filePath) {
        providers.svgFilesProvider.refreshFile(filePath);
      }
    })
  );

  // Command: Partial refresh FILES view by icon name (preserves tree expansion state)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshFilesItemByName', (iconName: string) => {
      if (iconName) {
        providers.svgFilesProvider.refreshItemByName?.(iconName);
      }
    })
  );

  // Command: Add icon to BUILT and refresh without collapsing tree
  disposables.push(
    vscode.commands.registerCommand(
      'masterSVG.addIconToBuiltAndRefresh',
      (iconName: string, svg: string, iconsFilePath: string, animation?: any) => {
        if (iconName && svg && iconsFilePath) {
          providers.builtIconsProvider.addIconAndRefresh?.(iconName, svg, iconsFilePath, animation);
        }
      }
    )
  );

  // Command: Partial refresh by icon name in both views (preserves tree expansion state)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.refreshIconByName', (iconName: string) => {
      if (iconName) {
        // Refresh only the specific icon item without collapsing tree
        providers.svgFilesProvider.refreshItemByName?.(iconName);
        providers.builtIconsProvider.refreshItemByName?.(iconName);
      }
    })
  );

  // Command: Force refresh preview (clears CSS cache - useful for development)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.forceRefreshPreview', () => {
      providers.iconPreviewProvider?.forceRefresh();
    })
  );

  // Command: Full dev refresh (all views + preview cache clear)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.devRefreshAll', () => {
      // Clear preview cache first
      providers.iconPreviewProvider?.forceRefresh();
      // Then refresh all tree views
      providers.builtIconsProvider.refresh();
      providers.svgFilesProvider.refresh();
      providers.workspaceSvgProvider.refresh();
      vscode.window.showInformationMessage('All views and caches refreshed');
    })
  );

  return disposables;
}

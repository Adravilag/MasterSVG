/**
 * Tree View Commands
 * Commands for managing expand/collapse state of tree views
 */
import * as vscode from 'vscode';
import type { SvgItem } from '../providers';

export interface TreeViews {
  workspace: vscode.TreeView<SvgItem>;
  builtIcons: vscode.TreeView<SvgItem>;
  svgFiles: vscode.TreeView<SvgItem>;
}

export interface TreeProviders {
  workspaceSvgProvider: { getChildren(): Thenable<SvgItem[]> };
  builtIconsProvider: { getChildren(): Thenable<SvgItem[]> };
  svgFilesProvider: { getChildren(): Thenable<SvgItem[]> };
}

/**
 * Expands all items in a tree view by focusing it and using keyboard expand
 */
async function expandAllItems(
  treeView: vscode.TreeView<SvgItem>,
  provider: { getChildren(element?: SvgItem): Thenable<SvgItem[]> },
  treeViewId: string
): Promise<void> {
  // First, focus the tree view
  await vscode.commands.executeCommand(`${treeViewId}.focus`);

  // Get root elements
  const roots = await provider.getChildren();

  // Expand each root element with maximum depth
  for (const root of roots) {
    try {
      // reveal with expand: 3 expands the item and descendants up to 3 levels
      await treeView.reveal(root, { expand: 3, focus: false, select: false });
    } catch (e) {
      // Log error for debugging
      console.log('[MasterSVG] Failed to reveal:', root.label, e);
    }
  }
}

/**
 * Registers all tree view expand/collapse commands
 */
export function registerTreeViewCommands(
  _context: vscode.ExtensionContext,
  treeViews: TreeViews,
  providers: TreeProviders
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Expand All (workspace icons)
  disposables.push(
    vscode.commands.registerCommand('masterSVG.expandAll', async () => {
      await expandAllItems(
        treeViews.workspace,
        providers.workspaceSvgProvider as { getChildren(element?: SvgItem): Thenable<SvgItem[]> },
        'masterSVG.workspaceIcons'
      );
    })
  );

  // Expand All SVG Files
  disposables.push(
    vscode.commands.registerCommand('masterSVG.expandSvgFiles', async () => {
      await expandAllItems(
        treeViews.svgFiles,
        providers.svgFilesProvider as { getChildren(element?: SvgItem): Thenable<SvgItem[]> },
        'masterSVG.svgFiles'
      );
    })
  );

  // Expand All Built Icons
  disposables.push(
    vscode.commands.registerCommand('masterSVG.expandBuiltIcons', async () => {
      await expandAllItems(
        treeViews.builtIcons,
        providers.builtIconsProvider as { getChildren(element?: SvgItem): Thenable<SvgItem[]> },
        'masterSVG.builtIcons'
      );
    })
  );

  return disposables;
}

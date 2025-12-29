/**
 * Tree View Commands
 * Commands for managing expand/collapse state of tree views
 */
import * as vscode from 'vscode';
import type { SvgItem } from '../providers/WorkspaceSvgProvider';

export interface TreeViewState {
  workspaceExpanded: boolean;
  builtExpanded: boolean;
  svgFilesExpanded: boolean;
}

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
 * Registers all tree view expand/collapse commands
 */
export function registerTreeViewCommands(
  context: vscode.ExtensionContext,
  treeViews: TreeViews,
  providers: TreeProviders
): vscode.Disposable[] {
  const state: TreeViewState = {
    workspaceExpanded: false,
    builtExpanded: false,
    svgFilesExpanded: false
  };

  // Set initial context
  vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', false);
  vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', false);
  vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', false);

  const disposables: vscode.Disposable[] = [];

  // Expand All (workspace icons - Code view)
  disposables.push(
    vscode.commands.registerCommand('iconManager.expandAll', async () => {
      const roots = await providers.workspaceSvgProvider.getChildren();
      for (const root of roots) {
        try {
          await treeViews.workspace.reveal(root, { expand: 2, focus: false, select: false });
        } catch {
          // Ignore errors
        }
      }
      state.workspaceExpanded = true;
      vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', true);
    })
  );

  // Collapse All (workspace icons - Code view)
  disposables.push(
    vscode.commands.registerCommand('iconManager.collapseAll', async () => {
      await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.workspaceIcons.collapseAll');
      state.workspaceExpanded = false;
      vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', false);
    })
  );

  // Expand All SVG Files
  disposables.push(
    vscode.commands.registerCommand('iconManager.expandSvgFiles', async () => {
      const roots = await providers.svgFilesProvider.getChildren();
      for (const root of roots) {
        try {
          await treeViews.svgFiles.reveal(root, { expand: 2, focus: false, select: false });
        } catch {
          // Ignore errors
        }
      }
      state.svgFilesExpanded = true;
      vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', true);
    })
  );

  // Collapse All SVG Files
  disposables.push(
    vscode.commands.registerCommand('iconManager.collapseSvgFiles', async () => {
      await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.svgFiles.collapseAll');
      state.svgFilesExpanded = false;
      vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', false);
    })
  );

  // Expand All Built Icons
  disposables.push(
    vscode.commands.registerCommand('iconManager.expandBuiltIcons', async () => {
      const roots = await providers.builtIconsProvider.getChildren();
      for (const root of roots) {
        try {
          await treeViews.builtIcons.reveal(root, { expand: 2, focus: false, select: false });
        } catch {
          // Ignore errors
        }
      }
      state.builtExpanded = true;
      vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', true);
    })
  );

  // Collapse All Built Icons
  disposables.push(
    vscode.commands.registerCommand('iconManager.collapseBuiltIcons', async () => {
      await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.builtIcons.collapseAll');
      state.builtExpanded = false;
      vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', false);
    })
  );

  return disposables;
}


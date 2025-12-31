import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceSvgProvider, SvgItem } from '../providers/WorkspaceSvgProvider';
import { searchIconify } from '../utils/iconifyService';
import { showIconifyReplacementPicker } from './iconifyCommands';
import { t } from '../i18n';

/**
 * Providers interface for reference commands
 */
export interface ReferenceCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  workspaceTreeView: vscode.TreeView<SvgItem>;
}

/**
 * Register reference management commands (remove reference, find & replace, reveal in tree)
 */
export function registerReferenceCommands(
  context: vscode.ExtensionContext,
  providers: ReferenceCommandProviders
): vscode.Disposable[] {
  const { workspaceSvgProvider, workspaceTreeView } = providers;

  // Command: Remove missing reference (delete the <img> tag)
  const removeReferenceCmd = vscode.commands.registerCommand(
    'sageboxIconStudio.removeReference',
    async (item: any) => {
      if (!item?.icon?.filePath || item.icon.line === undefined) {
        vscode.window.showWarningMessage(t('messages.cannotFindRefLocation'));
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove reference to "${item.icon.name}.svg"?`,
        { modal: true },
        'Remove'
      );

      if (confirm !== 'Remove') return;

      try {
        const document = await vscode.workspace.openTextDocument(item.icon.filePath);
        const line = document.lineAt(item.icon.line);
        const text = line.text;

        // Find the <img> tag in this line
        const imgMatch = text.match(/<img\s+[^>]*src=["'][^"']*\.svg["'][^>]*>/i);

        if (imgMatch) {
          const edit = new vscode.WorkspaceEdit();
          const startIndex = text.indexOf(imgMatch[0]);
          const startPos = new vscode.Position(item.icon.line, startIndex);
          const endPos = new vscode.Position(item.icon.line, startIndex + imgMatch[0].length);

          edit.delete(document.uri, new vscode.Range(startPos, endPos));
          await vscode.workspace.applyEdit(edit);
          await document.save();

          vscode.window.showInformationMessage(
            t('messages.removedReference', { name: `${item.icon.name}.svg` })
          );
          workspaceSvgProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          t('messages.errorRemovingReference', { error: String(error) })
        );
      }
    }
  );

  // Command: Find and replace path for missing reference
  const findAndReplaceCmd = vscode.commands.registerCommand(
    'sageboxIconStudio.findAndReplace',
    async (item: any) => {
      if (!item?.icon?.filePath || item.icon.line === undefined) {
        vscode.window.showWarningMessage(t('messages.cannotFindRefLocation'));
        return;
      }

      // Get the current path from the reference
      const currentPath = item.icon.path;
      const currentName = item.icon.name;

      // Offer options: browse for file, search workspace, Iconify, or enter path manually
      const choice = await vscode.window.showQuickPick(
        [
          { label: `$(file-directory) ${t('ui.labels.browseForSvgFile')}`, value: 'browse' },
          { label: `$(search) ${t('ui.labels.searchWorkspaceSvg')}`, value: 'search' },
          { label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`, value: 'iconify' },
          { label: `$(edit) ${t('ui.labels.enterNewPathManually')}`, value: 'manual' },
        ],
        {
          placeHolder: t('ui.placeholders.howToFindReplacement'),
        }
      );

      if (!choice) return;

      let newPath: string | undefined;

      if (choice.value === 'browse') {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'SVG Files': ['svg'] },
          title: t('ui.titles.selectSvgFile'),
        });

        if (fileUri && fileUri[0]) {
          // Make path relative to the file containing the reference
          const refFileDir = path.dirname(item.icon.filePath);
          newPath = './' + path.relative(refFileDir, fileUri[0].fsPath).replace(/\\/g, '/');
        }
      } else if (choice.value === 'search') {
        // Search for SVG files in workspace
        const svgFiles = await vscode.workspace.findFiles('**/*.svg', '**/node_modules/**', 100);

        if (svgFiles.length === 0) {
          vscode.window.showWarningMessage(t('messages.noSvgFilesFound'));
          return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const items = svgFiles.map(f => {
          const relativePath = path.relative(workspaceRoot, f.fsPath).replace(/\\/g, '/');
          return {
            label: path.basename(f.fsPath),
            description: relativePath,
            fsPath: f.fsPath,
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Search for replacement SVG (current: ${currentName}.svg)`,
          matchOnDescription: true,
        });

        if (selected) {
          const refFileDir = path.dirname(item.icon.filePath);
          newPath = './' + path.relative(refFileDir, selected.fsPath).replace(/\\/g, '/');
        }
      } else if (choice.value === 'iconify') {
        // Search Iconify for a replacement icon
        const query = await vscode.window.showInputBox({
          prompt: t('ui.prompts.searchIconify'),
          value: currentName,
          placeHolder: t('ui.placeholders.enterSearchTerm'),
        });

        if (!query) return;

        const results = await searchIconify(query);

        if (results.length === 0) {
          vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query }));
          return;
        }

        // Show webview picker with icon previews
        const selectedIcon = await showIconifyReplacementPicker(
          context,
          results,
          query,
          currentName
        );

        if (!selectedIcon) return;

        // Ask where to save the icon
        const saveChoice = await vscode.window.showQuickPick(
          [
            { label: `$(file-add) ${t('ui.labels.saveNextToFile')}`, value: 'same-dir' },
            { label: `$(folder) ${t('ui.labels.chooseFolder')}`, value: 'choose' },
          ],
          {
            placeHolder: t('ui.placeholders.whereToSaveSvg'),
          }
        );

        if (!saveChoice) return;

        let savePath: string;
        const iconFileName = `${selectedIcon.prefix}-${selectedIcon.name}.svg`;
        const refFileDir = path.dirname(item.icon.filePath);

        if (saveChoice.value === 'same-dir') {
          savePath = path.join(refFileDir, iconFileName);
        } else {
          const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: t('ui.titles.selectFolderToSave'),
          });

          if (!folderUri || !folderUri[0]) return;
          savePath = path.join(folderUri[0].fsPath, iconFileName);
        }

        // Save the SVG file
        fs.writeFileSync(savePath, selectedIcon.svg);
        vscode.window.showInformationMessage(
          t('messages.savedIconTo', { name: path.basename(savePath) })
        );

        // Set the new path relative to the reference file
        newPath = './' + path.relative(refFileDir, savePath).replace(/\\/g, '/');
      } else {
        newPath = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterNewSvgPath'),
          value: currentPath,
          placeHolder: t('ui.placeholders.svgPathExample'),
        });
      }

      if (!newPath) return;

      try {
        const document = await vscode.workspace.openTextDocument(item.icon.filePath);
        const line = document.lineAt(item.icon.line);
        const text = line.text;

        // Find the src attribute and replace the path
        const imgMatch = text.match(/<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/i);

        if (imgMatch) {
          const oldSrc = imgMatch[1];
          const newText = text.replace(oldSrc, newPath);

          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, line.range, newText);
          await vscode.workspace.applyEdit(edit);
          await document.save();

          vscode.window.showInformationMessage(
            t('messages.updatedPath', { oldPath: oldSrc, newPath })
          );
          workspaceSvgProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(t('messages.errorUpdatingPath', { error: String(error) }));
      }
    }
  );

  // Command: Reveal icon in tree view
  const revealInTreeCmd = vscode.commands.registerCommand(
    'sageboxIconStudio.revealInTree',
    async (iconName: string, filePath?: string, lineNumber?: number) => {
      if (!iconName && !filePath) return;

      

      try {
        // Ensure the tree is initialized before searching
        await workspaceSvgProvider.ensureInitialized();

        // First try to find a cached item (already rendered in tree)
        let item = workspaceSvgProvider.findItemByIconNameOrPath(iconName, filePath, lineNumber);
        

        if (!item) {
          // If not cached, try to find the icon and create an item
          let icon = workspaceSvgProvider.getIconByName(iconName);
          

          if (!icon && filePath) {
            icon = workspaceSvgProvider.getIconByPath(filePath);
          }

          if (icon) {
            item = workspaceSvgProvider.createSvgItemFromIcon(icon);
          }
        }

        if (item && workspaceTreeView) {
          try {
            // Use focus: true to ensure the treeview gets focus
            await workspaceTreeView.reveal(item, { select: true, focus: true, expand: true });
          } catch (revealError) {
            // If reveal fails, the item might not be in the visible tree yet
            // This can happen if the parent sections are collapsed
            
          }
        }
      } catch (error) {
        // Silently fail - this is a nice-to-have feature
      }
    }
  );

  return [removeReferenceCmd, findAndReplaceCmd, revealInTreeCmd];
}

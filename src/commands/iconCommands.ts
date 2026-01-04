import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFullOutputPath, updateIconsJsContext } from '../utils/configHelper';
import { removeFromIconsJs } from '../utils/iconsFileManager';
import { VariantsService } from '../services/VariantsService';
import { t } from '../i18n';

/**
 * Interface for providers needed by icon commands
 */
export interface IconCommandProviders {
  workspaceSvgProvider: {
    refresh(): void;
    renameBuiltIcon(oldName: string, newName: string): void;
    renameSvgFile(oldName: string, newName: string, newPath: string): void;
  };
  builtIconsProvider: {
    refresh(): void;
  };
  svgFilesProvider: {
    refresh(): void;
    removeItem(filePath: string): void;
  };
}

/**
 * Registers icon management commands (delete, remove from built, rename)
 */
export function registerIconCommands(
  context: vscode.ExtensionContext,
  providers: IconCommandProviders
): vscode.Disposable[] {
  const { workspaceSvgProvider, builtIconsProvider, svgFilesProvider } = providers;
  const commands: vscode.Disposable[] = [];

  // Command: Delete icons
  commands.push(
    vscode.commands.registerCommand(
      'sageboxIconStudio.deleteIcons',
      async (item: any, selectedItems?: any[]) => {
        const itemsToDelete = selectedItems && selectedItems.length > 0 ? selectedItems : [item];

        if (itemsToDelete.length === 0) {
          vscode.window.showWarningMessage(t('messages.noIconsSelectedForDeletion'));
          return;
        }

        const names = itemsToDelete
          .map((i: any) => (typeof i.label === 'string' ? i.label : ''))
          .filter(Boolean);

        const confirm = await vscode.window.showWarningMessage(
          t('messages.confirmDeleteIcons', { count: names.length, names: names.join(', ') }),
          { modal: true },
          t('messages.deleteButton')
        );

        if (confirm !== t('messages.deleteButton')) return;

        const fullOutputPath = getFullOutputPath();
        let deletedCount = 0;
        const builtIconsToDelete: string[] = [];
        const svgFilesToRemove: { name: string; path: string }[] = [];

        for (const item of itemsToDelete) {
          if (
            (item.contextValue === 'svgIcon' ||
              item.contextValue === 'svgIconBuilt' ||
              item.contextValue === 'svgIconRasterized' ||
              item.contextValue === 'svgIconRasterizedBuilt') &&
            item.resourceUri
          ) {
            // Delete physical file
            try {
              await vscode.workspace.fs.delete(item.resourceUri);
              deletedCount++;
              // Track for cache removal with path
              if (typeof item.label === 'string') {
                svgFilesToRemove.push({
                  name: item.label,
                  path: item.resourceUri.fsPath,
                });
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                t('messages.failedToDelete', { name: item.label, error: String(error) })
              );
            }
          } else if (
            item.contextValue === 'builtIcon' ||
            item.contextValue === 'builtIconRasterized'
          ) {
            // Collect built icons to delete from icons.js
            if (typeof item.label === 'string') {
              builtIconsToDelete.push(item.label);
            }
          }
        }

        // Process built icons deletion
        if (builtIconsToDelete.length > 0 && fullOutputPath) {
          const removed = removeFromIconsJs(fullOutputPath, builtIconsToDelete);
          if (removed) {
            deletedCount += builtIconsToDelete.length;
          }
        }

        // Remove from cache and do partial refresh for each deleted file
        for (const { name: iconName, path: filePath } of svgFilesToRemove) {
          // removeItem handles both cache removal and partial view refresh
          svgFilesProvider.removeItem(filePath);
          // Also clean variants cache for deleted icon
          const variantsService = new VariantsService();
          variantsService.removeIconData(iconName);
          variantsService.persistToFile();
          variantsService.resetCache();
        }

        // Full refresh for built icons (they're in a different file)
        if (builtIconsToDelete.length > 0) {
          builtIconsProvider.refresh();
        }

        if (deletedCount > 0) {
          vscode.window.showInformationMessage(t('messages.deletedCount', { count: deletedCount }));
        }
      }
    )
  );

  // Command: Remove from Built (unbuild icon without deleting file)
  // Supports multiple selection
  commands.push(
    vscode.commands.registerCommand(
      'sageboxIconStudio.removeFromBuilt',
      async (item: any, selectedItems?: any[]) => {
        // Handle multiple selection
        const items =
          selectedItems && selectedItems.length > 0 ? selectedItems : item ? [item] : [];

        if (items.length === 0 || !items[0]?.icon) {
          vscode.window.showWarningMessage(t('messages.selectIconsToRemoveFromBuilt'));
          return;
        }

        // Extract icon names from all selected items
        const iconNames = items
          .filter((i: any) => i?.icon)
          .map((i: any) => (typeof i.label === 'string' ? i.label : i.icon?.name))
          .filter((name: string | undefined): name is string => !!name);

        if (iconNames.length === 0) {
          vscode.window.showWarningMessage(t('messages.couldNotDetermineIconNames'));
          return;
        }

        const fullOutputPath = getFullOutputPath();
        if (!fullOutputPath) {
          vscode.window.showWarningMessage(t('messages.outputDirectoryNotConfigured'));
          return;
        }

        const message =
          iconNames.length === 1
            ? t('messages.removeIconFromBuilt', { name: iconNames[0] })
            : t('messages.removeIconsFromBuilt', { count: iconNames.length });

        const confirm = await vscode.window.showWarningMessage(
          message,
          { modal: true },
          t('messages.removeButton')
        );

        if (confirm !== t('messages.removeButton')) {
          return;
        }

        const removed = removeFromIconsJs(fullOutputPath, iconNames);
        if (removed) {
          // Also remove variants/colorMappings configuration
          const variantsService = new VariantsService();
          for (const name of iconNames) {
            variantsService.removeIconData(name);
          }
          variantsService.persistToFile();
          variantsService.resetCache(); // Clean cache after removing icons

          // Update context for icons.js existence
          updateIconsJsContext();

          // Refresh all tree views
          builtIconsProvider.refresh();
          workspaceSvgProvider.refresh();
          svgFilesProvider.refresh();

          const infoMsg =
            iconNames.length === 1
              ? t('messages.removedIconFromBuilt', { name: iconNames[0] })
              : t('messages.removedIconsFromBuilt', { count: iconNames.length });
          vscode.window.showInformationMessage(infoMsg);
        } else {
          vscode.window.showErrorMessage(t('messages.failedToRemoveFromBuilt'));
        }
      }
    )
  );

  // Command: Rename icon
  commands.push(
    vscode.commands.registerCommand(
      'sageboxIconStudio.renameIcon',
      async (item: any, providedNewName?: string) => {
        if (!item?.icon) {
          vscode.window.showWarningMessage(t('messages.selectIconToRename'));
          return;
        }

        const icon = item.icon;
        const oldName = icon.name;
        const isBuiltIcon = item.contextValue === 'builtIcon';
        const isSvgFile = item.contextValue === 'svgIcon';

        // Use provided name or prompt for new name
        let newName = providedNewName;
        if (!newName) {
          newName = await vscode.window.showInputBox({
            prompt: t('ui.prompts.enterNewIconName'),
            value: oldName,
            placeHolder: t('ui.placeholders.iconName'),
            validateInput: value => {
              if (!value || value.trim() === '') {
                return t('editor.nameCannotBeEmpty');
              }
              if (value === oldName) {
                return t('editor.enterDifferentName');
              }
              // Basic validation: no special characters except dash and underscore
              if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return t('editor.nameValidation');
              }
              return undefined;
            },
          });
        }

        if (!newName) return;

        try {
          let newPath: string | undefined;

          if (isSvgFile && icon.path) {
            // Rename the actual SVG file
            const oldPath = icon.path;
            const dir = path.dirname(oldPath);
            newPath = path.join(dir, `${newName}.svg`);

            if (fs.existsSync(newPath)) {
              vscode.window.showErrorMessage(
                t('messages.fileAlreadyExists', { name: `${newName}.svg` })
              );
              return;
            }

            fs.renameSync(oldPath, newPath);

            // Update references to this SVG file in the workspace
            const oldFileName = `${oldName}.svg`;
            const newFileName = `${newName}.svg`;
            let referencesUpdated = 0;

            // Search for files that reference this SVG
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
              const filesToSearch = await vscode.workspace.findFiles(
                '**/*.{html,htm,jsx,tsx,js,ts,vue,svelte,css,scss,md}',
                '**/node_modules/**'
              );

              for (const fileUri of filesToSearch) {
                try {
                  const content = fs.readFileSync(fileUri.fsPath, 'utf-8');

                  // Create patterns to match various reference styles
                  const escapedOldFileName = oldFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                  // Single comprehensive pattern that matches:
                  // src="./filename.svg", src="../path/filename.svg", src="filename.svg"
                  // Also handles single quotes
                  const srcPattern = new RegExp(
                    `(src\\s*=\\s*["'])([^"']*?)${escapedOldFileName}(["'])`,
                    'g'
                  );

                  // URL pattern for CSS: url('./filename.svg'), url(filename.svg), etc.
                  const urlPattern = new RegExp(
                    `(url\\s*\\(\\s*["']?)([^)"']*?)${escapedOldFileName}(["']?\\s*\\))`,
                    'g'
                  );

                  // Import patterns
                  const importFromPattern = new RegExp(
                    `(from\\s+["'])([^"']*?)${escapedOldFileName}(["'])`,
                    'g'
                  );
                  const importDirectPattern = new RegExp(
                    `(import\\s+["'])([^"']*?)${escapedOldFileName}(["'])`,
                    'g'
                  );
                  const requirePattern = new RegExp(
                    `(require\\s*\\(\\s*["'])([^"']*?)${escapedOldFileName}(["']\\s*\\))`,
                    'g'
                  );

                  // href patterns for <a>, <link>, etc.
                  const hrefPattern = new RegExp(
                    `(href\\s*=\\s*["'])([^"']*?)${escapedOldFileName}(["'])`,
                    'g'
                  );

                  let newContent = content;
                  let fileModified = false;

                  const patterns = [
                    srcPattern,
                    urlPattern,
                    importFromPattern,
                    importDirectPattern,
                    requirePattern,
                    hrefPattern,
                  ];

                  for (const pattern of patterns) {
                    const matches = newContent.match(pattern);
                    if (matches && matches.length > 0) {
                      newContent = newContent.replace(pattern, `$1$2${newFileName}$3`);
                      fileModified = true;
                    }
                  }

                  if (fileModified) {
                    fs.writeFileSync(fileUri.fsPath, newContent);
                    referencesUpdated++;
                  }
                } catch (err) {
                  // Skip files that can't be read/written
                  
                }
              }
            }

            if (referencesUpdated > 0) {
              vscode.window.showInformationMessage(
                t('messages.renamedWithReferences', {
                  oldName: `${oldName}.svg`,
                  newName: `${newName}.svg`,
                  count: referencesUpdated,
                })
              );
            } else {
              vscode.window.showInformationMessage(
                t('messages.renamedTo', { name: `${newName}.svg` })
              );
            }
          } else if (isBuiltIcon) {
            // Rename in icons.js, icons.js, sprite.svg, etc.
            const fullOutputPath = getFullOutputPath();
            if (!fullOutputPath) return;

            const iconsBzJsPath = path.join(fullOutputPath, 'icons.js');
            const iconsJsPath = path.join(fullOutputPath, 'icons.js');
            const iconsDtsPath = path.join(fullOutputPath, 'icons.d.ts');
            const spritePath = path.join(fullOutputPath, 'sprite.svg');

            const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let foundInAnyFile = false;
            let filesUpdated = 0;

            // Update icons.js (format: name: 'icon-name' inside export const iconName = { ... })
            if (fs.existsSync(iconsBzJsPath)) {
              let content = fs.readFileSync(iconsBzJsPath, 'utf-8');

              // Pattern for name property: name: 'old-name' or name: "old-name"
              const testPattern = new RegExp(`name:\\s*['"]${escapedOldName}['"]`);

              if (testPattern.test(content)) {
                foundInAnyFile = true;
                content = content.replace(
                  new RegExp(`(name:\\s*['"])${escapedOldName}(['"])`, 'g'),
                  `$1${newName}$2`
                );
                fs.writeFileSync(iconsBzJsPath, content);
                filesUpdated++;
              }
            }

            // Update icons.js (has ICON_NAMES array and sprite uses)
            if (fs.existsSync(iconsJsPath)) {
              let content = fs.readFileSync(iconsJsPath, 'utf-8');

              // Pattern for array items: 'old-name' or "old-name"
              // Use non-global regex for test
              const testPattern = new RegExp(`(['"])${escapedOldName}\\1`);

              if (testPattern.test(content)) {
                foundInAnyFile = true;
                content = content.replace(
                  new RegExp(`(['"])${escapedOldName}\\1`, 'g'),
                  `$1${newName}$1`
                );
                fs.writeFileSync(iconsJsPath, content);
                filesUpdated++;
              }
            }

            // Update icons.d.ts (TypeScript types)
            if (fs.existsSync(iconsDtsPath)) {
              let content = fs.readFileSync(iconsDtsPath, 'utf-8');
              // Use non-global regex for test
              const testPattern = new RegExp(`(['"])${escapedOldName}\\1`);

              if (testPattern.test(content)) {
                foundInAnyFile = true;
                content = content.replace(
                  new RegExp(`(['"])${escapedOldName}\\1`, 'g'),
                  `$1${newName}$1`
                );
                fs.writeFileSync(iconsDtsPath, content);
                filesUpdated++;
              }
            }

            // Update sprite.svg (symbol ids)
            if (fs.existsSync(spritePath)) {
              let content = fs.readFileSync(spritePath, 'utf-8');

              // Pattern: id="old-name" in symbol tags - use non-global for test
              const testPattern = new RegExp(`<symbol[^>]*id=["']${escapedOldName}["']`);

              if (testPattern.test(content)) {
                foundInAnyFile = true;
                content = content.replace(
                  new RegExp(`(<symbol[^>]*id=["'])${escapedOldName}(["'])`, 'g'),
                  `$1${newName}$2`
                );
                fs.writeFileSync(spritePath, content);
                filesUpdated++;
              }
            }

            if (!foundInAnyFile) {
              vscode.window.showErrorMessage(
                t('messages.iconNotFoundInBuildFiles', { name: oldName })
              );
              return;
            }

            // Partial refresh for built icons - update both providers
            
            workspaceSvgProvider.renameBuiltIcon(oldName, newName);
            builtIconsProvider.refresh(); // Refresh the BuiltIconsProvider tree view

            vscode.window.showInformationMessage(
              t('messages.renamedFilesUpdated', { oldName, newName, count: filesUpdated })
            );
          }

          // For SVG files, use partial refresh if we have the new path
          if (isSvgFile && newPath) {
            workspaceSvgProvider.renameSvgFile(oldName, newName, newPath);
            svgFilesProvider.refresh(); // Refresh the SvgFilesProvider tree view
          } else if (!isBuiltIcon) {
            // Fallback to full refresh for other cases
            workspaceSvgProvider.refresh();
          }

          // Return the new path for SVG files so callers can update their references
          return { newName, newPath };
        } catch (error) {
          vscode.window.showErrorMessage(t('messages.errorRenamingIcon', { error: String(error) }));
          return undefined;
        }
      }
    )
  );

  return commands;
}

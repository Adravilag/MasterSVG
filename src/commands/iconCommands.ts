import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFullOutputPath } from '../utils/configHelper';
import { removeFromIconsJs } from '../utils/iconsFileManager';

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
    vscode.commands.registerCommand('iconManager.deleteIcons', async (item: any, selectedItems?: any[]) => {
      const itemsToDelete = selectedItems && selectedItems.length > 0 ? selectedItems : [item];
      
      if (itemsToDelete.length === 0) {
        vscode.window.showWarningMessage('No icons selected for deletion');
        return;
      }

      const names = itemsToDelete.map((i: any) => typeof i.label === 'string' ? i.label : '').filter(Boolean);
      
      const confirm = await vscode.window.showWarningMessage(
        `Delete ${names.length} icon(s): ${names.join(', ')}?`,
        { modal: true },
        'Delete'
      );

      if (confirm !== 'Delete') return;

      const fullOutputPath = getFullOutputPath();
      let deletedCount = 0;
      const builtIconsToDelete: string[] = [];
      const svgFilesToRemove: { name: string; path: string }[] = [];

      for (const item of itemsToDelete) {
        if ((item.contextValue === 'svgIcon' || item.contextValue === 'svgIconBuilt' || 
             item.contextValue === 'svgIconRasterized' || item.contextValue === 'svgIconRasterizedBuilt') && item.resourceUri) {
          // Delete physical file
          try {
            await vscode.workspace.fs.delete(item.resourceUri);
            deletedCount++;
            // Track for cache removal with path
            if (typeof item.label === 'string') {
              svgFilesToRemove.push({ 
                name: item.label, 
                path: item.resourceUri.fsPath 
              });
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete ${item.label}: ${error}`);
          }
        } else if (item.contextValue === 'builtIcon' || item.contextValue === 'builtIconRasterized') {
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
      for (const { path: filePath } of svgFilesToRemove) {
        // removeItem handles both cache removal and partial view refresh
        svgFilesProvider.removeItem(filePath);
      }
      
      // Full refresh for built icons (they're in a different file)
      if (builtIconsToDelete.length > 0) {
        builtIconsProvider.refresh();
      }
      
      if (deletedCount > 0) {
        vscode.window.showInformationMessage(`Deleted ${deletedCount} icon(s)`);
      }
    })
  );

  // Command: Remove from Built (unbuild icon without deleting file)
  commands.push(
    vscode.commands.registerCommand('iconManager.removeFromBuilt', async (item: any) => {
      if (!item?.icon) {
        vscode.window.showWarningMessage('Select an icon to remove from built');
        return;
      }

      const iconName = typeof item.label === 'string' ? item.label : item.icon?.name;
      if (!iconName) {
        vscode.window.showWarningMessage('Could not determine icon name');
        return;
      }

      const fullOutputPath = getFullOutputPath();
      if (!fullOutputPath) {
        vscode.window.showWarningMessage('Output directory not configured');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove "${iconName}" from built icons library?`,
        { modal: true },
        'Remove'
      );

      if (confirm !== 'Remove') {
        return;
      }

      const removed = removeFromIconsJs(fullOutputPath, [iconName]);
      if (removed) {
        builtIconsProvider.refresh();
        workspaceSvgProvider.refresh();
        vscode.window.showInformationMessage(`Removed "${iconName}" from built icons`);
      } else {
        vscode.window.showErrorMessage(`Failed to remove "${iconName}" from built icons`);
      }
    })
  );

  // Command: Rename icon
  commands.push(
    vscode.commands.registerCommand('iconManager.renameIcon', async (item: any, providedNewName?: string) => {
      if (!item?.icon) {
        vscode.window.showWarningMessage('Select an icon to rename');
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
          prompt: 'Enter new name for the icon',
          value: oldName,
          placeHolder: 'icon-name',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'Name cannot be empty';
            }
            if (value === oldName) {
              return 'Enter a different name';
            }
            // Basic validation: no special characters except dash and underscore
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
              return 'Name can only contain letters, numbers, dashes and underscores';
            }
            return undefined;
          }
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
            vscode.window.showErrorMessage(`A file named "${newName}.svg" already exists`);
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
                
                const patterns = [srcPattern, urlPattern, importFromPattern, importDirectPattern, requirePattern, hrefPattern];
                
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
                console.log(`[IconWrap] Could not update references in ${fileUri.fsPath}: ${err}`);
              }
            }
          }
          
          if (referencesUpdated > 0) {
            vscode.window.showInformationMessage(`Renamed "${oldName}.svg" to "${newName}.svg" and updated ${referencesUpdated} file(s) with references`);
          } else {
            vscode.window.showInformationMessage(`Renamed "${oldName}.svg" to "${newName}.svg"`);
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
              content = content.replace(new RegExp(`(['"])${escapedOldName}\\1`, 'g'), `$1${newName}$1`);
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
              content = content.replace(new RegExp(`(['"])${escapedOldName}\\1`, 'g'), `$1${newName}$1`);
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
              content = content.replace(new RegExp(`(<symbol[^>]*id=["'])${escapedOldName}(["'])`, 'g'), `$1${newName}$2`);
              fs.writeFileSync(spritePath, content);
              filesUpdated++;
            }
          }

          if (!foundInAnyFile) {
            vscode.window.showErrorMessage(`Could not find icon "${oldName}" in build files`);
            return;
          }

          // Partial refresh for built icons - update both providers
          console.log(`[IconWrap] Calling renameBuiltIcon("${oldName}", "${newName}")`);
          workspaceSvgProvider.renameBuiltIcon(oldName, newName);
          builtIconsProvider.refresh(); // Refresh the BuiltIconsProvider tree view
          
          vscode.window.showInformationMessage(`Renamed "${oldName}" to "${newName}" (${filesUpdated} file${filesUpdated > 1 ? 's' : ''} updated)`);
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
        vscode.window.showErrorMessage(`Error renaming icon: ${error}`);
        return undefined;
      }
    })
  );

  return commands;
}

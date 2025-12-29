import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../utils/configHelper';

/**
 * Registers configuration-related commands
 */
export function registerConfigCommands(
  context: vscode.ExtensionContext
): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  // Command: Configure icon manager for project
  commands.push(
    vscode.commands.registerCommand('iconManager.configureProject', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');

      const items: vscode.QuickPickItem[] = [
        {
          label: 'Output Directory',
          description: config.get<string>('outputDirectory'),
          detail: 'Directory where icons.ts or sprite.svg will be generated'
        },
        {
          label: 'SVG Folders',
          description: (config.get<string[]>('svgFolders') || []).join(', '),
          detail: 'Folders to scan for SVG files'
        },
        {
          label: 'Component Name',
          description: config.get<string>('componentName'),
          detail: 'Name of the Icon component (e.g. Icon)'
        },
        {
          label: 'Output Format',
          description: config.get<string>('outputFormat'),
          detail: 'Default output format (jsx, vue, svelte, etc.)'
        },
        {
          label: 'Web Component Name',
          description: config.get<string>('webComponentName'),
          detail: 'Name for the custom element (e.g. bezier-icon)'
        }
      ];

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a setting to configure'
      });

      if (!selection) {
        return;
      }

      if (selection.label === 'Output Directory') {
        const outputDir = await vscode.window.showInputBox({
          prompt: 'Enter the output directory for generated icons',
          value: config.get('outputDirectory') || 'bezier-icons',
          placeHolder: 'e.g., src/icons, assets/icons'
        });

        if (outputDir !== undefined) {
          await config.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Workspace);
          ensureOutputDirectory();
          vscode.window.showInformationMessage(`Output directory set to: ${outputDir}`);
        }
      } else if (selection.label === 'SVG Folders') {
        const currentFolders = config.get<string[]>('svgFolders') || [];
        const foldersStr = await vscode.window.showInputBox({
          prompt: 'Enter SVG folders to scan (comma separated)',
          value: currentFolders.join(', '),
          placeHolder: 'src/icons, assets/svg'
        });
        if (foldersStr !== undefined) {
          const folders = foldersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          await config.update('svgFolders', folders, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(`SVG folders updated`);
          vscode.commands.executeCommand('iconManager.refreshIcons');
        }
      } else if (selection.label === 'Component Name') {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter the component name',
          value: config.get('componentName') || 'Icon'
        });
        if (name) {
          await config.update('componentName', name, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(`Component name set to: ${name}`);
        }
      } else if (selection.label === 'Output Format') {
        const format = await vscode.window.showQuickPick(['jsx', 'vue', 'svelte', 'astro', 'html'], {
          placeHolder: 'Select output format'
        });
        if (format) {
          await config.update('outputFormat', format, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(`Output format set to: ${format}`);
        }
      } else if (selection.label === 'Web Component Name') {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter the web component name',
          value: config.get('webComponentName') || 'bezier-icon'
        });
        if (name) {
          await config.update('webComponentName', name, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(`Web component name set to: ${name}`);
        }
      }
    })
  );

  // Command: Edit .bezierignore file
  commands.push(
    vscode.commands.registerCommand('iconManager.editIgnoreFile', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const ignoreFilePath = path.join(workspaceFolder.uri.fsPath, '.bezierignore');

      // Create file with template if it doesn't exist
      if (!fs.existsSync(ignoreFilePath)) {
        const template = `# Bezier - Ignore File
# This file works similar to .gitignore
# Patterns listed here will be excluded from scanning

# Examples:

# Ignore entire directories
# bak/
# temp/

# Ignore specific files  
# svgs/old-icon.svg

# Ignore by pattern (** matches any path)
# **/backup/**
# **/*-old.svg

# Ignore files starting with underscore
# _*.svg

# Ignore node_modules (already ignored by default)
# node_modules/
`;
        fs.writeFileSync(ignoreFilePath, template, 'utf-8');
      }

      // Open the file
      const doc = await vscode.workspace.openTextDocument(ignoreFilePath);
      await vscode.window.showTextDocument(doc);
    })
  );

  // Command: Configure SVG Folder (quick folder picker)
  commands.push(
    vscode.commands.registerCommand('iconManager.configureSvgFolder', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const config = vscode.workspace.getConfiguration('iconManager');
      const currentFolders = config.get<string[]>('svgFolders') || [];

      const options: vscode.QuickPickItem[] = [
        {
          label: '$(folder-opened) Browse for folder...',
          description: 'Select a folder from the workspace',
          alwaysShow: true
        },
        {
          label: '$(edit) Enter path manually...',
          description: 'Type a relative path',
          alwaysShow: true
        }
      ];

      // Add current folders as removable options
      if (currentFolders.length > 0) {
        options.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
        options.push({
          label: '$(list-unordered) Current folders:',
          description: currentFolders.join(', '),
          alwaysShow: true
        });
        for (const folder of currentFolders) {
          options.push({
            label: `$(trash) Remove: ${folder}`,
            description: 'Click to remove this folder',
            alwaysShow: true
          });
        }
      }

      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Configure SVG folders to scan',
        title: 'SVG Folders Configuration'
      });

      if (!selection) return;

      if (selection.label.startsWith('$(folder-opened)')) {
        // Browse for folder
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: workspaceFolder.uri,
          openLabel: 'Select SVG Folder'
        });

        if (folderUri && folderUri[0]) {
          const relativePath = path.relative(workspaceFolder.uri.fsPath, folderUri[0].fsPath);
          if (relativePath && !relativePath.startsWith('..')) {
            const newFolders = [...new Set([...currentFolders, relativePath])];
            await config.update('svgFolders', newFolders, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Added SVG folder: ${relativePath}`);
            vscode.commands.executeCommand('iconManager.refreshIcons');
          } else {
            vscode.window.showWarningMessage('Please select a folder inside the workspace');
          }
        }
      } else if (selection.label.startsWith('$(edit)')) {
        // Manual input
        const foldersStr = await vscode.window.showInputBox({
          prompt: 'Enter SVG folders to scan (comma separated, relative to workspace)',
          value: currentFolders.join(', '),
          placeHolder: 'e.g., src/icons, assets/svg, public/images'
        });

        if (foldersStr !== undefined) {
          const folders = foldersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          await config.update('svgFolders', folders, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(`SVG folders updated: ${folders.join(', ') || '(none - will scan all)'}`);
          vscode.commands.executeCommand('iconManager.refreshIcons');
        }
      } else if (selection.label.startsWith('$(trash)')) {
        // Remove folder
        const folderToRemove = selection.label.replace('$(trash) Remove: ', '');
        const newFolders = currentFolders.filter(f => f !== folderToRemove);
        await config.update('svgFolders', newFolders, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Removed SVG folder: ${folderToRemove}`);
        vscode.commands.executeCommand('iconManager.refreshIcons');
      }
    })
  );

  return commands;
}

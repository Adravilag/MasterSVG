import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../utils/configHelper';
import { t } from '../i18n';

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
          label: t('ui.labels.outputDirectory'),
          description: config.get<string>('outputDirectory'),
          detail: t('ui.details.outputDirectoryDesc')
        },
        {
          label: t('ui.labels.svgFolders'),
          description: (config.get<string[]>('svgFolders') || []).join(', '),
          detail: t('ui.details.svgFoldersDesc')
        },
        {
          label: t('ui.labels.componentName'),
          description: config.get<string>('componentName'),
          detail: t('ui.details.componentNameDesc')
        },
        {
          label: t('ui.labels.outputFormat'),
          description: config.get<string>('outputFormat'),
          detail: t('ui.details.outputFormatDesc')
        },
        {
          label: t('ui.labels.webComponentName'),
          description: config.get<string>('webComponentName'),
          detail: t('ui.details.webComponentNameDesc')
        }
      ];

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: t('ui.placeholders.selectSettingToConfigure')
      });

      if (!selection) {
        return;
      }

      if (selection.label === t('ui.labels.outputDirectory')) {
        const outputDir = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterOutputDirectory'),
          value: config.get('outputDirectory') || 'bezier-icons',
          placeHolder: t('ui.placeholders.outputDirectoryExample')
        });

        if (outputDir !== undefined) {
          await config.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Workspace);
          ensureOutputDirectory();
          vscode.window.showInformationMessage(t('messages.outputDirectorySet', { path: outputDir }));
        }
      } else if (selection.label === t('ui.labels.svgFolders')) {
        const currentFolders = config.get<string[]>('svgFolders') || [];
        const foldersStr = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterSvgFolders'),
          value: currentFolders.join(', '),
          placeHolder: t('ui.placeholders.svgFoldersExample')
        });
        if (foldersStr !== undefined) {
          const folders = foldersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          await config.update('svgFolders', folders, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(t('messages.svgFoldersUpdated'));
          vscode.commands.executeCommand('iconManager.refreshIcons');
        }
      } else if (selection.label === t('ui.labels.componentName')) {
        const name = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterComponentName'),
          value: config.get('componentName') || 'Icon'
        });
        if (name) {
          await config.update('componentName', name, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(t('messages.componentNameSet', { name }));
        }
      } else if (selection.label === t('ui.labels.outputFormat')) {
        const format = await vscode.window.showQuickPick(['jsx', 'vue', 'svelte', 'astro', 'html'], {
          placeHolder: t('ui.placeholders.selectOutputFormat')
        });
        if (format) {
          await config.update('outputFormat', format, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(t('messages.outputFormatSet', { format }));
        }
      } else if (selection.label === t('ui.labels.webComponentName')) {
        const name = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterWebComponentName'),
          value: config.get('webComponentName') || 'bezier-icon'
        });
        if (name) {
          await config.update('webComponentName', name, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(t('messages.componentNameSet', { name }));
        }
      }
    })
  );

  // Command: Edit .bezierignore file
  commands.push(
    vscode.commands.registerCommand('iconManager.editIgnoreFile', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage(t('messages.noWorkspace'));
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
        vscode.window.showWarningMessage(t('messages.noWorkspace'));
        return;
      }

      const config = vscode.workspace.getConfiguration('iconManager');
      const currentFolders = config.get<string[]>('svgFolders') || [];

      const options: vscode.QuickPickItem[] = [
        {
          label: `$(folder-opened) ${t('ui.labels.browseForFolder')}`,
          description: t('ui.labels.selectFolderFromWorkspace'),
          alwaysShow: true
        },
        {
          label: `$(edit) ${t('ui.labels.enterPathManually')}`,
          description: t('ui.labels.typeRelativePath'),
          alwaysShow: true
        }
      ];

      // Add current folders as removable options
      if (currentFolders.length > 0) {
        options.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
        options.push({
          label: `$(list-unordered) ${t('ui.labels.currentFolders')}`,
          description: currentFolders.join(', '),
          alwaysShow: true
        });
        for (const folder of currentFolders) {
          options.push({
            label: `$(trash) ${t('ui.labels.removeFolder', { folder })}`,
            description: folder, // Store folder path in description for easy extraction
            alwaysShow: true
          });
        }
      }

      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: t('ui.placeholders.configureSvgFolders'),
        title: t('ui.titles.svgFoldersConfiguration')
      });

      if (!selection) return;

      if (selection.label.startsWith('$(folder-opened)')) {
        // Browse for folder
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: workspaceFolder.uri,
          openLabel: t('ui.labels.selectSvgFolder')
        });

        if (folderUri && folderUri[0]) {
          const relativePath = path.relative(workspaceFolder.uri.fsPath, folderUri[0].fsPath);
          if (relativePath && !relativePath.startsWith('..')) {
            const newFolders = [...new Set([...currentFolders, relativePath])];
            await config.update('svgFolders', newFolders, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(t('messages.addedSvgFolder', { path: relativePath }));
            vscode.commands.executeCommand('iconManager.refreshIcons');
          } else {
            vscode.window.showWarningMessage(t('messages.selectFolderInsideWorkspace'));
          }
        }
      } else if (selection.label.startsWith('$(edit)')) {
        // Manual input
        const foldersStr = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterSvgFoldersRelative'),
          value: currentFolders.join(', '),
          placeHolder: t('ui.placeholders.svgFoldersExampleLong')
        });

        if (foldersStr !== undefined) {
          const folders = foldersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
          await config.update('svgFolders', folders, vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(
            folders.length > 0 
              ? t('messages.svgFoldersUpdatedList', { folders: folders.join(', ') })
              : t('messages.svgFoldersUpdatedNone')
          );
          vscode.commands.executeCommand('iconManager.refreshIcons');
        }
      } else if (selection.label.startsWith('$(trash)')) {
        // Remove folder - folder path is stored in description
        const folderToRemove = selection.description || '';
        const newFolders = currentFolders.filter(f => f !== folderToRemove);
        await config.update('svgFolders', newFolders, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(t('messages.removedSvgFolder', { folder: folderToRemove }));
        vscode.commands.executeCommand('iconManager.refreshIcons');
      }
    })
  );

  return commands;
}

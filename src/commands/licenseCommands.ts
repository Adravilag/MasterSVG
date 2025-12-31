/**
 * License Commands
 * Commands for generating license files for Iconify icons
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getFullOutputPath } from '../utils/configHelper';
import {
  generateLicenseFiles,
  getLicenseSummary,
} from '../services/LicenseService';
import { t } from '../i18n';

/**
 * Get license-related configuration
 */
export function getLicenseConfig() {
  const config = vscode.workspace.getConfiguration('sageboxIconStudio');
  return {
    format: config.get<string>('licenseFormat', 'combined'),
    autoGenerate: config.get<boolean>('autoGenerateLicenses', true),
    folder: config.get<string>('licensesFolder', 'icon-licenses'),
  };
}

/**
 * Auto-generate licenses if enabled in configuration
 * Called after build completes successfully
 */
export async function autoGenerateLicensesIfEnabled(outputPath: string): Promise<void> {
  const licenseConfig = getLicenseConfig();

  if (!licenseConfig.autoGenerate) {
    
    return;
  }

  

  try {
    const result = await generateLicenseFiles(outputPath, {
      combined: licenseConfig.format === 'combined' || licenseConfig.format === 'both',
      perCollection: licenseConfig.format === 'perCollection' || licenseConfig.format === 'both',
      licensesFolder: licenseConfig.folder,
    });

    if (result.success && result.files.length > 0) {
      vscode.window.showInformationMessage(`📄 ${result.message}`);
    } else if (!result.success) {
      // Only log - don't show message for "no Iconify icons" case
      
    }
  } catch (error) {
    // Log but don't interrupt workflow
  }
}

/**
 * Register license-related commands
 */
export function registerLicenseCommands(_context: vscode.ExtensionContext): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  // Command: Generate license files
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.generateLicenses', async () => {
      const outputPath = getFullOutputPath();
      const licenseConfig = getLicenseConfig();

      if (!outputPath) {
        vscode.window.showWarningMessage(
          t('messages.noOutputPath') ||
            'No output path configured. Configure it in settings or use the Welcome panel.'
        );
        return;
      }

      // Build options with configured default highlighted
      const formatOptions = [
        {
          label: '$(file-text) Combined License File',
          description: 'Generate a single LICENSES.md with all attributions',
          value: 'combined',
          picked: licenseConfig.format === 'combined',
        },
        {
          label: '$(files) Per-Collection License Files',
          description: 'Generate separate LICENSE-{prefix}.md for each collection',
          value: 'perCollection',
          picked: licenseConfig.format === 'perCollection',
        },
        {
          label: '$(checklist) Both',
          description: 'Generate combined and per-collection files',
          value: 'both',
          picked: licenseConfig.format === 'both',
        },
      ];

      // Sort to show default first
      formatOptions.sort((a, b) => (b.picked ? 1 : 0) - (a.picked ? 1 : 0));

      // Show options dialog
      const options = await vscode.window.showQuickPick(formatOptions, {
        placeHolder: `Select license file generation option (default: ${licenseConfig.format})`,
        title: '📄 Generate Icon Licenses',
      });

      if (!options) return;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating license files...',
            cancellable: false,
          },
          async () => {
            const result = await generateLicenseFiles(outputPath, {
              combined: options.value === 'combined' || options.value === 'both',
              perCollection: options.value === 'perCollection' || options.value === 'both',
              licensesFolder: licenseConfig.folder,
            });

            if (result.success) {
              const action = await vscode.window.showInformationMessage(
                result.message,
                'Open Folder',
                'Open LICENSES.md'
              );

              if (action === 'Open Folder') {
                const licensesPath = path.join(outputPath, licenseConfig.folder);
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(licensesPath));
              } else if (action === 'Open LICENSES.md') {
                const licensePath = path.join(outputPath, licenseConfig.folder, 'LICENSES.md');
                const doc = await vscode.workspace.openTextDocument(licensePath);
                await vscode.window.showTextDocument(doc);
              }
            } else {
              vscode.window.showWarningMessage(result.message);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate licenses: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Command: Show license summary (quick overview)
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.showLicenseSummary', async () => {
      const outputPath = getFullOutputPath();

      if (!outputPath) {
        vscode.window.showWarningMessage(
          t('messages.noOutputPath') || 'No output path configured.'
        );
        return;
      }

      try {
        const summary = await getLicenseSummary(outputPath);

        if (summary.collections.length === 0) {
          vscode.window.showInformationMessage('No Iconify icons detected in your icon library.');
          return;
        }

        // Build summary items for QuickPick
        const items = summary.collections.map(col => ({
          label: `$(law) ${col.name}`,
          description: `${col.license}`,
          detail: `${col.iconCount} icon(s) • Prefix: ${col.prefix}`,
        }));

        // Add header item
        items.unshift({
          label: `$(info) License Summary`,
          description: `${summary.totalIcons} total Iconify icons`,
          detail: `From ${summary.collections.length} collection(s)`,
        });

        // Show as QuickPick for viewing
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'License summary for Iconify icons',
          title: '📋 Icon License Summary',
          canPickMany: false,
        });

        // If header selected, offer to generate licenses
        if (selected?.label.includes('License Summary')) {
          const generate = await vscode.window.showInformationMessage(
            `You have ${summary.totalIcons} icons from ${summary.collections.length} Iconify collection(s). Would you like to generate license files?`,
            'Generate Licenses',
            'Cancel'
          );

          if (generate === 'Generate Licenses') {
            vscode.commands.executeCommand('sageboxIconStudio.generateLicenses');
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to get license summary: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  return commands;
}

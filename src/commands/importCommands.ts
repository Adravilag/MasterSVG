import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceSvgProvider, WorkspaceIcon, BuiltIconsProvider, SvgFilesProvider } from '../providers/WorkspaceSvgProvider';
import { SvgTransformer } from '../services/SvgTransformer';
import { getFullOutputPath } from '../utils/configHelper';
import { 
  buildIcon, 
  showDeleteOriginalPrompt, 
  showBuildSuccess
} from '../utils/iconBuildHelpers';
import { t } from '../i18n';

/**
 * Providers interface for import commands
 */
export interface ImportCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
  svgFilesProvider: SvgFilesProvider;
  svgTransformer: SvgTransformer;
}

/**
 * Register import-related commands (import SVG to library, check inline SVGs, add to collection)
 */
export function registerImportCommands(
  context: vscode.ExtensionContext,
  providers: ImportCommandProviders
): vscode.Disposable[] {
  const { 
    workspaceSvgProvider, 
    builtIconsProvider, 
    svgFilesProvider, 
    svgTransformer 
  } = providers;

  // Command: Import SVG to library
  const importSvgToLibraryCmd = vscode.commands.registerCommand('iconManager.importSvgToLibrary', async (item?: any) => {
    let svgPath: string | undefined;
    let svgContent: string | undefined;
    let iconName: string | undefined;

    if (item?.resourceUri) {
      svgPath = item.resourceUri.fsPath;
      svgContent = fs.readFileSync(svgPath as string, 'utf-8');
      iconName = path.basename(svgPath as string, '.svg');
    } else {
      const files = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] }
      });

      if (!files || files.length === 0) return;
      svgPath = files[0].fsPath;
      svgContent = fs.readFileSync(svgPath, 'utf-8');
      iconName = path.basename(svgPath, '.svg');
    }

    if (!svgContent) return;

    const result = await buildIcon({
      iconName: iconName!,
      svgContent,
      svgTransformer
    });

    if (result.success) {
      workspaceSvgProvider.refresh();
      builtIconsProvider.refresh();
      showBuildSuccess(result);
    } else {
      vscode.window.showErrorMessage(t('messages.failedToImportIcon', { error: result.error || '' }));
    }
  });

  // Command: Check and import inline SVG
  const checkAndImportSvgCmd = vscode.commands.registerCommand('iconManager.checkAndImportSvg', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const text = editor.document.getText();
    const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
    const matches = [...text.matchAll(svgRegex)];

    if (matches.length === 0) {
      vscode.window.showInformationMessage(t('messages.noInlineSvgsFound'));
      return;
    }

    const items = matches.map((match, index) => ({
      label: `SVG #${index + 1}`,
      description: match[0].substring(0, 50) + '...',
      svgContent: match[0],
      index: match.index
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('editor.selectSvgToImport')
    });

    if (!selected) return;

    const iconName = await vscode.window.showInputBox({
      prompt: t('editor.enterIconName'),
      placeHolder: t('ui.placeholders.iconName')
    });

    if (!iconName) return;

    const result = await buildIcon({
      iconName,
      svgContent: selected.svgContent,
      svgTransformer
    });

    if (result.success) {
      workspaceSvgProvider.refresh();
      builtIconsProvider.refresh();
      showBuildSuccess(result);
    } else {
      vscode.window.showErrorMessage(t('messages.failedToImportIcon', { error: result.error || '' }));
    }
  });

  // Command: Add SVG to build (uses buildFormat from config)
  const addSvgToCollectionCmd = vscode.commands.registerCommand('iconManager.addSvgToCollection', async (item: any) => {
    const icon = item?.icon;
    if (!icon) {
      vscode.window.showWarningMessage(t('messages.noIconSelected'));
      return;
    }

    const deleteOriginal = await showDeleteOriginalPrompt();

    try {
      // Read SVG content if not already loaded
      let svgContent = icon.svg;
      if (!svgContent && icon.path) {
        svgContent = fs.readFileSync(icon.path, 'utf-8');
      }

      if (!svgContent) {
        vscode.window.showErrorMessage(t('messages.couldNotReadSvg'));
        return;
      }

      const result = await buildIcon({ iconName: icon.name, svgContent, svgTransformer });
      if (!result.success) {
        vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: result.error || '' }));
        return;
      }

      const extras: string[] = [];

      // Delete original file if requested
      if (deleteOriginal && icon.path && fs.existsSync(icon.path)) {
        fs.unlinkSync(icon.path);
        extras.push('original deleted');
        svgFilesProvider.removeItem(icon.path);
      }

      // Add new built icon to cache and refresh
      const outputPath = getFullOutputPath();
      const builtIcon: WorkspaceIcon = { 
        name: icon.name, 
        svg: svgContent, 
        path: outputPath || icon.path,
        source: 'library',
        isBuilt: true
      };
      workspaceSvgProvider.addBuiltIcon(icon.name, builtIcon);
      builtIconsProvider.refreshFile(path.basename(builtIcon.path));
      
      if (!deleteOriginal) {
        svgFilesProvider.refreshFile(icon.path);
      }

      vscode.window.showInformationMessage(t('messages.iconImported', { name: icon.name, targets: result.format === 'sprite' ? 'sprite.svg' : 'icons.js' }));
    } catch (error: any) {
      vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: error.message }));
    }
  });

  return [
    importSvgToLibraryCmd,
    checkAndImportSvgCmd,
    addSvgToCollectionCmd
  ];
}

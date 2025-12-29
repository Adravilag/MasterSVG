import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceSvgProvider, SvgItem, BuiltIconsProvider, SvgFilesProvider } from '../providers/WorkspaceSvgProvider';
import { SvgTransformer } from '../services/SvgTransformer';
import { searchIconify } from '../utils/iconifyService';
import { getConfig } from '../utils/configHelper';
import { showIconifyReplacementPicker } from './iconifyCommands';
import { TransformOptions } from '../providers/SvgToIconCodeActionProvider';
import { 
  buildIcon, 
  showDeleteOriginalPrompt, 
  generateReplacement, 
  checkScriptImport
} from '../utils/iconBuildHelpers';
import { t } from '../i18n';

// Re-export from split files for backward compatibility
export { registerImportCommands, ImportCommandProviders } from './importCommands';
export { registerReferenceCommands, ReferenceCommandProviders } from './referenceCommands';

/**
 * Providers interface for misc commands
 */
export interface MiscCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
  svgFilesProvider: SvgFilesProvider;
  svgTransformer: SvgTransformer;
  workspaceTreeView: vscode.TreeView<SvgItem>;
}

/**
 * Register transform command (SVG reference to web component)
 * 
 * Note: Import and reference commands have been moved to:
 * - importCommands.ts (importSvgToLibrary, checkAndImportSvg, addSvgToCollection)
 * - referenceCommands.ts (removeReference, findAndReplace, revealInTree)
 */
export function registerMiscCommands(
  context: vscode.ExtensionContext,
  providers: MiscCommandProviders
): vscode.Disposable[] {
  const { 
    workspaceSvgProvider, 
    builtIconsProvider, 
    svgTransformer
  } = providers;

  // Command: Transform SVG reference to web component (unified flow)
  const transformSvgReferenceCmd = vscode.commands.registerCommand('iconManager.transformSvgReference', async (options: TransformOptions) => {
    const { originalPath, iconName, documentUri, line, originalHtml } = options;
    const docDir = path.dirname(documentUri);
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';
    const componentName = config.webComponentName || 'bz-icon';

    // Show source selection menu
    const sourceChoice = await vscode.window.showQuickPick([
      { 
        label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`, 
        description: t('ui.labels.findBuildIconify'),
        value: 'iconify' 
      },
      { 
        label: `$(file-media) ${t('ui.labels.useReferencedSvg')}`, 
        description: `Build from: ${originalPath}`,
        value: 'current' 
      },
      { 
        label: `$(library) ${t('ui.labels.browseBuiltIcons')}`, 
        description: t('ui.labels.selectIconFromLibrary'),
        value: 'built' 
      }
    ], {
      placeHolder: `Transform to ${isSprite ? 'SVG Sprite' : 'Web Component'} - Select icon source`,
      title: `🔄 Transform: ${iconName}`
    });

    if (!sourceChoice) return;

    let svgContent: string | undefined;
    let finalIconName = iconName;
    let skipBuild = false;

    if (sourceChoice.value === 'iconify') {
      const query = await vscode.window.showInputBox({
        prompt: t('ui.prompts.searchIconify'),
        value: iconName,
        placeHolder: t('ui.placeholders.enterSearchTerm')
      });
      if (!query) return;

      const results = await searchIconify(query);
      if (results.length === 0) {
        vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query }));
        return;
      }

      const selectedIcon = await showIconifyReplacementPicker(context, results, query, iconName);
      if (!selectedIcon) return;

      svgContent = selectedIcon.svg;
      finalIconName = selectedIcon.name;

    } else if (sourceChoice.value === 'current') {
      const fullSvgPath = path.isAbsolute(originalPath) ? originalPath : path.resolve(docDir, originalPath);
      if (!fs.existsSync(fullSvgPath)) {
        vscode.window.showErrorMessage(t('messages.svgFileNotFound', { path: originalPath }));
        return;
      }

      svgContent = fs.readFileSync(fullSvgPath, 'utf-8');
      const deleteOriginal = await showDeleteOriginalPrompt();
      if (deleteOriginal) {
        try { fs.unlinkSync(fullSvgPath); } catch (e) { console.error('Failed to delete:', e); }
      }

    } else if (sourceChoice.value === 'built') {
      await builtIconsProvider.ensureReady();
      const builtIcons = builtIconsProvider.getBuiltIconsList();
      
      if (builtIcons.length === 0) {
        vscode.window.showWarningMessage(t('messages.noBuiltIconsFound'));
        return;
      }

      const items = builtIcons.map(icon => ({
        label: icon.name,
        description: icon.animation ? `🎬 ${icon.animation.type}` : '',
        icon
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('ui.placeholders.selectBuiltIcon'),
        matchOnDescription: true
      });

      if (!selected) return;
      finalIconName = selected.label;
      skipBuild = true;
    }

    if (!svgContent && !skipBuild) return;

    // Build the icon (skip if already built)
    if (!skipBuild) {
      const result = await buildIcon({ iconName: finalIconName, svgContent: svgContent!, svgTransformer });
      if (!result.success) {
        vscode.window.showErrorMessage(t('messages.failedToBuildIcon', { error: result.error || '' }));
        return;
      }
    }

    // Replace in document
    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      const lineText = document.lineAt(line).text;
      const replacement = generateReplacement(finalIconName, document.languageId);
      const newText = lineText.replace(originalHtml, replacement);
      
      if (newText !== lineText) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
        await vscode.workspace.applyEdit(edit);
      }

      await checkScriptImport(document, documentUri);
    } catch (e) {
      console.error('Failed to replace in document:', e);
    }

    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    vscode.window.showInformationMessage(t('messages.iconTransformed', { name: finalIconName, component: componentName }));
  });

  return [
    transformSvgReferenceCmd
  ];
}


import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceSvgProvider, SvgItem, WorkspaceIcon, BuiltIconsProvider, SvgFilesProvider } from '../providers/WorkspaceSvgProvider';
import { SvgTransformer } from '../services/SvgTransformer';
import { searchIconify } from '../utils/iconifyService';
import { getConfig, getFullOutputPath, getOutputPathOrWarn } from '../utils/configHelper';
import { showIconifyReplacementPicker } from './iconifyCommands';
import { TransformOptions } from '../providers/SvgToIconCodeActionProvider';
import { 
  buildIcon, 
  showDeleteOriginalPrompt, 
  generateReplacement, 
  checkScriptImport,
  showBuildSuccess
} from '../utils/iconBuildHelpers';
import { t } from '../i18n';

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
 * Register miscellaneous commands (import, transform, collection, reference management)
 */
export function registerMiscCommands(
  context: vscode.ExtensionContext,
  providers: MiscCommandProviders
): vscode.Disposable[] {
  const { 
    workspaceSvgProvider, 
    builtIconsProvider, 
    svgFilesProvider, 
    svgTransformer,
    workspaceTreeView 
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

  // Command: Remove missing reference (delete the <img> tag)
  const removeReferenceCmd = vscode.commands.registerCommand('iconManager.removeReference', async (item: any) => {
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
        
        vscode.window.showInformationMessage(t('messages.removedReference', { name: `${item.icon.name}.svg` }));
        workspaceSvgProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(t('messages.errorRemovingReference', { error: String(error) }));
    }
  });

  // Command: Find and replace path for missing reference
  const findAndReplaceCmd = vscode.commands.registerCommand('iconManager.findAndReplace', async (item: any) => {
    if (!item?.icon?.filePath || item.icon.line === undefined) {
      vscode.window.showWarningMessage(t('messages.cannotFindRefLocation'));
      return;
    }

    // Get the current path from the reference
    const currentPath = item.icon.path;
    const currentName = item.icon.name;

    // Offer options: browse for file, search workspace, Iconify, or enter path manually
    const choice = await vscode.window.showQuickPick([
      { label: `$(file-directory) ${t('ui.labels.browseForSvgFile')}`, value: 'browse' },
      { label: `$(search) ${t('ui.labels.searchWorkspaceSvg')}`, value: 'search' },
      { label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`, value: 'iconify' },
      { label: `$(edit) ${t('ui.labels.enterNewPathManually')}`, value: 'manual' }
    ], {
      placeHolder: t('ui.placeholders.howToFindReplacement')
    });

    if (!choice) return;

    let newPath: string | undefined;

    if (choice.value === 'browse') {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] },
        title: t('ui.titles.selectSvgFile')
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
          fsPath: f.fsPath
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Search for replacement SVG (current: ${currentName}.svg)`,
        matchOnDescription: true
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
        placeHolder: t('ui.placeholders.enterSearchTerm')
      });

      if (!query) return;

      const results = await searchIconify(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query }));
        return;
      }

      // Show webview picker with icon previews
      const selectedIcon = await showIconifyReplacementPicker(context, results, query, currentName);

      if (!selectedIcon) return;

      // Ask where to save the icon
      const saveChoice = await vscode.window.showQuickPick([
        { label: `$(file-add) ${t('ui.labels.saveNextToFile')}`, value: 'same-dir' },
        { label: `$(folder) ${t('ui.labels.chooseFolder')}`, value: 'choose' }
      ], {
        placeHolder: t('ui.placeholders.whereToSaveSvg')
      });

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
          title: t('ui.titles.selectFolderToSave')
        });

        if (!folderUri || !folderUri[0]) return;
        savePath = path.join(folderUri[0].fsPath, iconFileName);
      }

      // Save the SVG file
      fs.writeFileSync(savePath, selectedIcon.svg);
      vscode.window.showInformationMessage(t('messages.savedIconTo', { name: path.basename(savePath) }));

      // Set the new path relative to the reference file
      newPath = './' + path.relative(refFileDir, savePath).replace(/\\/g, '/');
    } else {
      newPath = await vscode.window.showInputBox({
        prompt: t('ui.prompts.enterNewSvgPath'),
        value: currentPath,
        placeHolder: t('ui.placeholders.svgPathExample')
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
        
        vscode.window.showInformationMessage(t('messages.updatedPath', { oldPath: oldSrc, newPath }));
        workspaceSvgProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(t('messages.errorUpdatingPath', { error: String(error) }));
    }
  });

  // Command: Reveal icon in tree view
  const revealInTreeCmd = vscode.commands.registerCommand('iconManager.revealInTree', async (iconName: string, filePath?: string, lineNumber?: number) => {
    if (!iconName && !filePath) return;

    console.log(`[IconWrap] revealInTree: name="${iconName}", path="${filePath}", line=${lineNumber}`);

    try {
      // Ensure the tree is initialized before searching
      await workspaceSvgProvider.ensureInitialized();
      
      // First try to find a cached item (already rendered in tree)
      let item = workspaceSvgProvider.findItemByIconNameOrPath(iconName, filePath, lineNumber);
      console.log(`[IconWrap] findItemByIconNameOrPath:`, item?.label, item?.icon?.name, item?.icon?.path);
      
      if (!item) {
        // If not cached, try to find the icon and create an item
        let icon = workspaceSvgProvider.getIconByName(iconName);
        console.log(`[IconWrap] getIconByName:`, icon?.name, icon?.path);
        
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
          console.log('[IconWrap] Reveal failed, item may not be visible:', revealError);
        }
      }
    } catch (error) {
      // Silently fail - this is a nice-to-have feature
      console.log('[IconWrap] Could not reveal in tree:', error);
    }
  });

  return [
    importSvgToLibraryCmd,
    checkAndImportSvgCmd,
    transformSvgReferenceCmd,
    addSvgToCollectionCmd,
    removeReferenceCmd,
    findAndReplaceCmd,
    revealInTreeCmd
  ];
}

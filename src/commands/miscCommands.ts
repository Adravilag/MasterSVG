import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  WorkspaceSvgProvider,
  SvgItem,
  BuiltIconsProvider,
  SvgFilesProvider,
} from '../providers/WorkspaceSvgProvider';
import { SvgTransformer } from '../services/SvgTransformer';
import { searchIconify } from '../utils/iconifyService';
import { getConfig } from '../utils/configHelper';
import { showIconifyReplacementPicker, handleDuplicateIconName } from './iconifyCommands';
import { TransformOptions } from '../providers/SvgToIconCodeActionProvider';
import {
  buildIcon,
  showDeleteOriginalPrompt,
  generateReplacement,
  checkScriptImport,
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
  const { workspaceSvgProvider, builtIconsProvider, svgTransformer } = providers;

  // Command: Transform SVG reference to web component (unified flow)
  const transformSvgReferenceCmd = vscode.commands.registerCommand(
    'sageboxIconStudio.transformSvgReference',
    async (options: TransformOptions) => {
      const {
        originalPath,
        iconName,
        documentUri,
        line,
        originalHtml,
        isInlineSvg,
        svgContent: inlineSvgContent,
      } = options;
      const docDir = path.dirname(documentUri);
      const config = getConfig();
      const isSprite = config.buildFormat === 'sprite.svg';
      const componentName = config.webComponentName || 'sg-icon';

      // Build different menu options based on whether it's inline SVG or img reference
      const menuOptions = [
        {
          label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`,
          description: t('ui.labels.findBuildIconify'),
          value: 'iconify',
        },
      ];

      if (isInlineSvg) {
        // For inline SVG, offer to use the current SVG content
        menuOptions.push({
          label: `$(file-code) ${t('ui.labels.useInlineSvg') || 'Use this inline SVG'}`,
          description: t('ui.labels.extractAndBuild') || 'Extract and build as icon',
          value: 'current',
        });
      } else {
        // For img reference, check if file exists first
        const fullSvgPath = path.isAbsolute(originalPath)
          ? originalPath
          : path.resolve(docDir, originalPath);
        const fileExists = fs.existsSync(fullSvgPath);
        
        if (fileExists) {
          menuOptions.push({
            label: `$(file-media) ${t('ui.labels.useReferencedSvg')}`,
            description: `Build from: ${originalPath}`,
            value: 'current',
          });
        } else {
          // Show disabled option with warning
          menuOptions.push({
            label: `$(warning) ${t('ui.labels.useReferencedSvg')}`,
            description: `⚠️ ${t('messages.fileNotFound', { path: originalPath }) || `File not found: ${originalPath}`}`,
            value: 'file_not_found',
          });
        }
      }

      menuOptions.push({
        label: `$(library) ${t('ui.labels.browseBuiltIcons')}`,
        description: t('ui.labels.selectIconFromLibrary'),
        value: 'built',
      });

      // Show source selection menu
      const sourceChoice = await vscode.window.showQuickPick(menuOptions, {
        placeHolder: `Transform to ${isSprite ? 'SVG Sprite' : 'Web Component'} - Select icon source`,
        title: `🔄 Transform: ${iconName}`,
      });

      if (!sourceChoice) return;

      // Handle file not found case - show helpful message
      if (sourceChoice.value === 'file_not_found') {
        vscode.window.showWarningMessage(
          t('messages.svgFileNotFoundSuggestion', { path: originalPath }) ||
          `File "${originalPath}" not found. Try "Search in Iconify" or "Browse built icons" instead.`
        );
        return;
      }

      let svgContent: string | undefined;
      let finalIconName = iconName;
      let skipBuild = false;

      if (sourceChoice.value === 'iconify') {
        const query = await vscode.window.showInputBox({
          prompt: t('ui.prompts.searchIconify'),
          value: iconName,
          placeHolder: t('ui.placeholders.enterSearchTerm'),
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
        finalIconName = `${selectedIcon.prefix}-${selectedIcon.name}`;

        // Check for duplicate name
        const resolvedName = await handleDuplicateIconName(finalIconName, workspaceSvgProvider);
        if (!resolvedName) return;
        finalIconName = resolvedName;
      } else if (sourceChoice.value === 'current') {
        if (isInlineSvg && inlineSvgContent) {
          // Use the inline SVG content directly
          svgContent = inlineSvgContent;

          // Ask for icon name (with duplicate check built into validation)
          const newName = await vscode.window.showInputBox({
            prompt: t('ui.prompts.enterIconName') || 'Enter a name for this icon',
            value: finalIconName,
            placeHolder: t('ui.placeholders.iconName') || 'icon-name',
          });
          if (!newName) return;
          finalIconName = newName;
        } else {
          // Load from file path
          const fullSvgPath = path.isAbsolute(originalPath)
            ? originalPath
            : path.resolve(docDir, originalPath);
          if (!fs.existsSync(fullSvgPath)) {
            vscode.window.showErrorMessage(t('messages.svgFileNotFound', { path: originalPath }));
            return;
          }

          svgContent = fs.readFileSync(fullSvgPath, 'utf-8');

          // Check for duplicate name
          const resolvedName = await handleDuplicateIconName(finalIconName, workspaceSvgProvider);
          if (!resolvedName) return;
          finalIconName = resolvedName;

          const deleteOriginal = await showDeleteOriginalPrompt();
          if (deleteOriginal) {
            try {
              fs.unlinkSync(fullSvgPath);
            } catch (deleteError) {
              console.error('Failed to delete:', deleteError);
            }
          }
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
          icon,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: t('ui.placeholders.selectBuiltIcon'),
          matchOnDescription: true,
        });

        if (!selected) return;
        finalIconName = selected.label;
        skipBuild = true;
      }

      if (!svgContent && !skipBuild) return;

      // Build the icon (skip if already built)
      if (!skipBuild) {
        const result = await buildIcon({
          iconName: finalIconName,
          svgContent: svgContent!,
          svgTransformer,
        });
        if (!result.success) {
          vscode.window.showErrorMessage(
            t('messages.failedToBuildIcon', { error: result.error || '' })
          );
          return;
        }

        // Add icon directly to cache for immediate detection
        const config = getConfig();
        const outputPath = config.outputDirectory || 'src/icons';
        const builtIcon = {
          name: finalIconName,
          svg: svgContent!,
          path: outputPath,
          source: 'library' as const,
          category: 'built',
          isBuilt: true,
        };
        workspaceSvgProvider.addBuiltIcon(finalIconName, builtIcon);
      }

      // Replace in document
      try {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const replacement = generateReplacement(finalIconName, document.languageId);
        const edit = new vscode.WorkspaceEdit();

        if (isInlineSvg && options.startOffset !== undefined && options.endOffset !== undefined) {
          // For inline SVG, use offsets for multi-line replacement
          const startPos = document.positionAt(options.startOffset);
          const endPos = document.positionAt(options.endOffset);
          edit.replace(document.uri, new vscode.Range(startPos, endPos), replacement);
        } else {
          // For single line (img reference)
          const lineText = document.lineAt(line).text;
          const newText = lineText.replace(originalHtml, replacement);

          if (newText !== lineText) {
            edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
          }
        }

        await vscode.workspace.applyEdit(edit);
        await checkScriptImport(document, documentUri);
      } catch (replaceError) {
        console.error('Failed to replace in document:', replaceError);
      }

      // Soft refresh to update tree without clearing cache
      workspaceSvgProvider.softRefresh();
      builtIconsProvider.refresh();
      vscode.window.showInformationMessage(
        t('messages.iconTransformed', { name: finalIconName, component: componentName })
      );
    }
  );

  return [transformSvgReferenceCmd];
}

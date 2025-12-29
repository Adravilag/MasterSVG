/**
 * Icon Build Helpers
 * 
 * Helper functions for building and importing icons to the library.
 * Extracted from miscCommands.ts to reduce duplication.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SvgTransformer } from '../services/SvgTransformer';
import { addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn, getFullOutputPath } from '../utils/configHelper';
import { WorkspaceIcon } from '../providers/WorkspaceSvgProvider';
import { t } from '../i18n';

/**
 * Result of a build operation
 */
export interface BuildResult {
  success: boolean;
  iconName: string;
  outputPath: string;
  format: 'sprite' | 'icons';
  error?: string;
}

/**
 * Options for building an icon
 */
export interface BuildIconOptions {
  iconName: string;
  svgContent: string;
  svgTransformer: SvgTransformer;
  outputPath?: string;  // If not provided, uses configured output path
}

/**
 * Build an icon to the configured format (sprite.svg or icons.js).
 * This is the main function for adding icons to the build output.
 */
export async function buildIcon(options: BuildIconOptions): Promise<BuildResult> {
  const { iconName, svgContent, svgTransformer, outputPath: customPath } = options;
  
  const outputPath = customPath || getOutputPathOrWarn();
  if (!outputPath) {
    return {
      success: false,
      iconName,
      outputPath: '',
      format: 'icons',
      error: 'No output path configured'
    };
  }

  const config = getConfig();
  const isSprite = config.buildFormat === 'sprite.svg';

  try {
    if (isSprite) {
      await addToSpriteSvg(outputPath, iconName, svgContent, svgTransformer);
    } else {
      await addToIconsJs(outputPath, iconName, svgContent, svgTransformer);
    }

    return {
      success: true,
      iconName,
      outputPath,
      format: isSprite ? 'sprite' : 'icons'
    };
  } catch (error: any) {
    return {
      success: false,
      iconName,
      outputPath,
      format: isSprite ? 'sprite' : 'icons',
      error: error.message
    };
  }
}

/**
 * Options for showing delete original prompt
 */
export interface DeletePromptOptions {
  /** Title shown in quick pick */
  title?: string;
  /** Default value if user cancels */
  defaultValue?: boolean;
}

/**
 * Show a prompt asking whether to delete the original file.
 * Returns the user's choice or the default value if cancelled.
 */
export async function showDeleteOriginalPrompt(options?: DeletePromptOptions): Promise<boolean> {
  const config = getConfig();
  const isSprite = config.buildFormat === 'sprite.svg';
  const defaultDelete = vscode.workspace.getConfiguration('iconManager').get<boolean>('deleteAfterBuild', false);
  
  const choice = await vscode.window.showQuickPick([
    { 
      label: `$(trash) ${t('editor.deleteOriginalSvg')}`, 
      description: t('editor.deleteOriginalSvgDesc'),
      value: true 
    },
    { 
      label: `$(file) ${t('editor.keepOriginalSvg')}`, 
      description: t('editor.keepOriginalSvgDesc'),
      value: false 
    }
  ], {
    placeHolder: t('editor.whatToDoWithOriginal'),
    title: options?.title || `${t('editor.addTo')} ${isSprite ? 'Sprite' : t('editor.iconsLibrary')}`
  });

  return choice?.value ?? options?.defaultValue ?? defaultDelete;
}

/**
 * Generate a replacement string for a web component or sprite reference.
 */
export function generateReplacement(iconName: string, languageId: string): string {
  const config = getConfig();
  const isSprite = config.buildFormat === 'sprite.svg';
  const componentName = config.webComponentName || 'bz-icon';

  if (isSprite) {
    return `<svg class="icon" aria-hidden="true"><use href="sprite.svg#${iconName}"></use></svg>`;
  }

  // For web component, use self-closing in JSX-like languages
  if (['javascriptreact', 'typescriptreact', 'vue', 'svelte', 'astro'].includes(languageId)) {
    return `<${componentName} name="${iconName}" />`;
  }
  
  return `<${componentName} name="${iconName}"></${componentName}>`;
}

/**
 * Check if script import is needed and show warning if missing.
 */
export async function checkScriptImport(
  document: vscode.TextDocument,
  documentUri: string
): Promise<void> {
  const config = getConfig();
  const isSprite = config.buildFormat === 'sprite.svg';
  
  // Only needed for web component format and HTML files
  if (isSprite) return;
  
  const ext = path.extname(documentUri).slice(1).toLowerCase();
  if (!['html', 'htm'].includes(ext)) return;

  const fullText = document.getText();
  const hasIconScript = fullText.includes('icon.js') || fullText.includes('icons.js');
  
  if (!hasIconScript) {
    const outputDir = config.outputDirectory || 'iconwrap-icons';
    const addScript = await vscode.window.showWarningMessage(
      `⚠️ ${t('messages.missingScriptImport', { outputDir })}`,
      t('messages.copyToClipboard'),
      t('messages.dismiss')
    );
    
    if (addScript === t('messages.copyToClipboard')) {
      const scriptTag = `<script type="module" src="./${outputDir}/icon.js"></script>`;
      await vscode.env.clipboard.writeText(scriptTag);
      vscode.window.showInformationMessage(t('messages.scriptCopiedToClipboard'));
    }
  }
}

/**
 * Create a WorkspaceIcon from build parameters.
 */
export function createBuiltIcon(
  iconName: string,
  svgContent: string,
  sourcePath?: string
): WorkspaceIcon {
  const outputPath = getFullOutputPath();
  return {
    name: iconName,
    svg: svgContent,
    path: outputPath || sourcePath || '',
    source: 'library',
    isBuilt: true
  };
}

/**
 * Show success message after build operation.
 */
export function showBuildSuccess(result: BuildResult, extras?: string[]): void {
  const formatName = result.format === 'sprite' ? 'sprite' : t('editor.iconsLibrary');
  const targets = extras ? [formatName, ...extras].join(' & ') : formatName;
  vscode.window.showInformationMessage(t('messages.iconImported', { name: result.iconName, targets }));
}

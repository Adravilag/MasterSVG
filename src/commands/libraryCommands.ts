/**
 * Library Commands - Commands for the Astro icon library
 */

import * as vscode from 'vscode';
import { AstroLibraryPanel, getAstroLibraryService, SvgTransformer } from '../services';
import type { IconSelectionResult } from '../services';
import { WorkspaceSvgProvider, BuiltIconsProvider } from '../providers';
import { addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';
import { t } from '../i18n';

export interface LibraryCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
  svgTransformer: SvgTransformer;
}

type IconSelectionHandler = (icon: IconSelectionResult) => Promise<void>;

/**
 * Register library commands
 */
export function registerLibraryCommands(
  context: vscode.ExtensionContext,
  providers: LibraryCommandProviders
): void {
  const { workspaceSvgProvider, builtIconsProvider, svgTransformer } = providers;

  const onIconSelected: IconSelectionHandler = async (icon) => {
    await handleIconSelection(icon, svgTransformer, workspaceSvgProvider, builtIconsProvider);
  };

  const commands = [
    createOpenLibraryCommand(context, onIconSelected),
    createSearchLibraryCommand(context, onIconSelected),
    createBrowseIconifyCommand(context, onIconSelected),
    createToggleServerCommand(),
    createShowServerOutputCommand(),
    createConfigureLibraryPathCommand(),
  ];

  context.subscriptions.push(...commands);
  context.subscriptions.push({ dispose: () => getAstroLibraryService().dispose() });
}

function createOpenLibraryCommand(
  context: vscode.ExtensionContext,
  onIconSelected: IconSelectionHandler
): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.openLibrary', async () => {
    try {
      const panel = await AstroLibraryPanel.createOrShow(context.extensionUri, undefined, 'browse');
      panel.onIconSelected(onIconSelected);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open icon library: ${getErrorMessage(error)}`);
    }
  });
}

function createSearchLibraryCommand(
  context: vscode.ExtensionContext,
  onIconSelected: IconSelectionHandler
): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.searchLibrary', async (query?: string) => {
    const searchQuery = query || await promptForSearchQuery('ui.prompts.searchLibrary', 'Search icons in library');
    if (!searchQuery) return;

    try {
      const panel = await AstroLibraryPanel.createOrShow(context.extensionUri, searchQuery, 'search');
      panel.onIconSelected(onIconSelected);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open icon library: ${getErrorMessage(error)}`);
    }
  });
}

function createBrowseIconifyCommand(
  context: vscode.ExtensionContext,
  onIconSelected: IconSelectionHandler
): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.browseIconify', async (query?: string) => {
    const searchQuery = query || await promptForSearchQuery('ui.prompts.searchIconify', 'Search Iconify icons');
    if (!searchQuery) return;

    try {
      const panel = await AstroLibraryPanel.createOrShow(context.extensionUri, searchQuery, 'search');
      panel.onIconSelected(onIconSelected);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open Iconify browser: ${getErrorMessage(error)}`);
    }
  });
}

function createToggleServerCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.toggleLibraryServer', async () => {
    const service = getAstroLibraryService();

    if (service.running) {
      service.stopServer();
      vscode.window.showInformationMessage('Icon library server stopped');
      return;
    }

    const started = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Starting icon library server...', cancellable: false },
      async () => service.startServer()
    );

    if (started) {
      vscode.window.showInformationMessage(`Icon library server started at http://localhost:${service.currentPort}`);
    } else {
      vscode.window.showErrorMessage('Failed to start icon library server');
    }
  });
}

function createShowServerOutputCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.showLibraryServerOutput', () => {
    getAstroLibraryService().showOutput();
  });
}

function createConfigureLibraryPathCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('masterSVG.configureLibraryPath', async () => {
    const folders = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Icon Manager Project',
      title: 'Select Astro Icon Manager Project Folder',
    });

    if (folders && folders[0]) {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('astroLibraryPath', folders[0].fsPath, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Library path set to: ${folders[0].fsPath}`);
    }
  });
}

async function promptForSearchQuery(translationKey: string, fallback: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: t(translationKey) || fallback,
    placeHolder: t('ui.placeholders.enterSearchTerm') || 'Enter search term...',
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Handle icon selection from the library
 */
async function handleIconSelection(
  icon: IconSelectionResult,
  svgTransformer: SvgTransformer,
  workspaceSvgProvider: WorkspaceSvgProvider,
  builtIconsProvider: BuiltIconsProvider
): Promise<void> {
  const config = getConfig();
  const outputPath = getOutputPathOrWarn();

  if (!outputPath) return;

  const isSprite = config.buildFormat === 'sprite.svg';

  try {
    await addIconToOutput(icon, outputPath, isSprite, svgTransformer);
    updateProviders(icon, outputPath, workspaceSvgProvider, builtIconsProvider);
    showSuccessMessage(icon.name, isSprite);
  } catch (error) {
    vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: String(error) }) || `Failed to add icon: ${error}`);
  }
}

async function addIconToOutput(
  icon: IconSelectionResult,
  outputPath: string,
  isSprite: boolean,
  svgTransformer: SvgTransformer
): Promise<void> {
  if (isSprite) {
    await addToSpriteSvg(outputPath, icon.name, icon.content, svgTransformer);
  } else {
    await addToIconsJs({ outputPath, iconName: icon.name, svgContent: icon.content, transformer: svgTransformer });
  }
}

function updateProviders(
  icon: IconSelectionResult,
  outputPath: string,
  workspaceSvgProvider: WorkspaceSvgProvider,
  builtIconsProvider: BuiltIconsProvider
): void {
  const builtIcon = {
    name: icon.name,
    svg: icon.content,
    path: outputPath,
    source: 'library' as const,
    category: icon.category || 'library',
    isBuilt: true,
  };
  workspaceSvgProvider.addBuiltIcon(icon.name, builtIcon);
  workspaceSvgProvider.softRefresh();
  builtIconsProvider.refresh();
}

function showSuccessMessage(iconName: string, isSprite: boolean): void {
  const formatName = isSprite ? 'sprite' : 'icons library';
  vscode.window.showInformationMessage(
    t('messages.iconAddedToFormat', { name: iconName, format: formatName }) || `Icon "${iconName}" added to ${formatName}`
  );
}

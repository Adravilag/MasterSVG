import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider, BuiltIconsProvider, SvgItem } from '../providers/WorkspaceSvgProvider';
import { getSpriteGenerator, SpriteIcon } from '../services/SpriteGenerator';
import { cleanSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';
import { t } from '../i18n';
import { 
  getSpritePreviewHtml, 
  createPreviewMessageHandler,
  IconPreviewData,
  parseSpriteIcons,
  parseIconsJsIcons
} from './helpers/spritePreviewHelper';

// Re-export for backward compatibility
export { getSpritePreviewHtml };

/**
 * Interface for providers needed by sprite commands
 */
export interface SpriteCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
}

/**
 * Register sprite-related commands
 */
export function registerSpriteCommands(
  context: vscode.ExtensionContext,
  providers: SpriteCommandProviders
): vscode.Disposable[] {
  const { workspaceSvgProvider, builtIconsProvider } = providers;
  const disposables: vscode.Disposable[] = [];

  // Command: Generate sprite
  const generateSpriteCmd = vscode.commands.registerCommand('iconManager.generateSprite', async () => {
    const icons = await workspaceSvgProvider.getAllIcons();
    if (icons.length === 0) {
      vscode.window.showWarningMessage(t('messages.noIconsInLibrary'));
      return;
    }

    const formatChoice = await vscode.window.showQuickPick(
      [
        { label: t('ui.labels.svgSprite'), value: 'svg' as const },
        { label: t('ui.labels.webComponentJs'), value: 'css' as const },
        { label: t('ui.labels.both'), value: 'both' as const }
      ],
      { placeHolder: t('ui.placeholders.selectSpriteFormat') }
    );

    if (!formatChoice) return;

    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const config = getConfig();
    const webComponentName = config.webComponentName;

    const spriteIcons: SpriteIcon[] = [];
    
    for (const icon of icons) {
      let svgContent = icon.svg;

      if (!svgContent && icon.path && fs.existsSync(icon.path) && icon.path.toLowerCase().endsWith('.svg')) {
        try {
          svgContent = fs.readFileSync(icon.path, 'utf-8');
        } catch (e) {
          console.error(`Failed to read SVG for ${icon.name}`, e);
        }
      }

      if (svgContent) {
        spriteIcons.push({
          id: icon.name,
          name: icon.name,
          svg: svgContent,
          viewBox: undefined
        });
      }
    }

    const generator = getSpriteGenerator();

    if (formatChoice.value === 'svg' || formatChoice.value === 'both') {
      const result = generator.generate(spriteIcons, { outputPath });
      fs.writeFileSync(path.join(outputPath, 'sprite.svg'), result.sprite);
    }

    if (formatChoice.value === 'css' || formatChoice.value === 'both') {
      const result = generator.generate(spriteIcons, { 
        outputPath, 
        generateHelper: true, 
        helperFormat: 'vanilla',
        webComponentName
      });
      if (result.helperComponent) {
        fs.writeFileSync(path.join(outputPath, 'icons.js'), result.helperComponent);
      }
    }

    vscode.window.showInformationMessage(t('messages.spriteGenerated', { path: outputPath }));
  });
  disposables.push(generateSpriteCmd);

  // Command: View Sprite Content
  const viewSpriteCmd = vscode.commands.registerCommand('iconManager.viewSprite', async (itemOrUri?: vscode.Uri | SvgItem) => {
    let spritePath: string;

    if (itemOrUri instanceof vscode.Uri) {
      spritePath = itemOrUri.fsPath;
    } else if (itemOrUri && 'category' in itemOrUri && itemOrUri.category?.startsWith('built:')) {
      const fileName = itemOrUri.category.replace('built:', '');
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      spritePath = path.join(outputPath, fileName);
    } else {
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      spritePath = path.join(outputPath, 'sprite.svg');
    }
    
    if (!fs.existsSync(spritePath)) {
      vscode.window.showWarningMessage(t('messages.spriteNotFound'));
      return;
    }

    const content = fs.readFileSync(spritePath, 'utf-8');
    const icons: IconPreviewData[] = parseSpriteIcons(content);

    if (icons.length === 0) {
      vscode.window.showWarningMessage(t('messages.noIconsInSprite'));
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'spritePreview',
      'SVG Sprite',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));

    panel.webview.onDidReceiveMessage(createPreviewMessageHandler({
      icons,
      filePath: spritePath,
      panel,
      extensionUri: context.extensionUri,
      builtIconsProvider,
      isSprite: true,
      parseIconsFromContent: parseSpriteIcons
    }));
  });
  disposables.push(viewSpriteCmd);

  // Command: Clean Sprite
  const cleanSpriteCmd = vscode.commands.registerCommand('iconManager.cleanSprite', async () => {
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const result = cleanSpriteSvg(outputPath);
    
    if (result.removed.length === 0) {
      vscode.window.showInformationMessage(t('messages.spriteClean'));
    } else {
      vscode.window.showInformationMessage(
        t('messages.spriteCleanedCount', { removed: result.removed.length, kept: result.kept })
      );
      builtIconsProvider.refresh();
    }
  });
  disposables.push(cleanSpriteCmd);

  // Command: View Icons File Content
  const viewIconsFileCmd = vscode.commands.registerCommand('iconManager.viewIconsFile', async (item?: SvgItem) => {
    let iconsFilePath: string | undefined;

    if (item?.category?.startsWith('built:')) {
      const fileName = item.category.replace('built:', '');
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      iconsFilePath = path.join(outputPath, fileName);
    } else {
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      
      for (const name of ['icons.js', 'icons.ts']) {
        const filePath = path.join(outputPath, name);
        if (fs.existsSync(filePath)) {
          iconsFilePath = filePath;
          break;
        }
      }
      
      if (!iconsFilePath) {
        vscode.window.showWarningMessage(t('messages.noIconsFile'));
        return;
      }
    }
    
    if (!fs.existsSync(iconsFilePath)) {
      vscode.window.showWarningMessage(t('messages.iconsFileNotFound'));
      return;
    }

    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const icons: IconPreviewData[] = parseIconsJsIcons(content);

    if (icons.length === 0) {
      vscode.window.showWarningMessage(t('messages.noIconsInFile'));
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconsFilePreview',
      'Icons File',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath));

    panel.webview.onDidReceiveMessage(createPreviewMessageHandler({
      icons,
      filePath: iconsFilePath,
      panel,
      extensionUri: context.extensionUri,
      builtIconsProvider,
      isSprite: false,
      parseIconsFromContent: parseIconsJsIcons
    }));
  });
  disposables.push(viewIconsFileCmd);

  // Command: Delete built file
  const deleteBuiltFileCmd = vscode.commands.registerCommand('iconManager.deleteBuiltFile', async (item?: SvgItem) => {
    if (!item?.category?.startsWith('built:')) {
      vscode.window.showWarningMessage(t('messages.noFileSelected'));
      return;
    }

    const fileName = item.category.replace('built:', '');
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const filePath = path.join(outputPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(t('messages.fileNotFound', { name: fileName }));
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      t('messages.confirmDeleteFile', { name: fileName }),
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      try {
        fs.unlinkSync(filePath);
        builtIconsProvider.refresh();
        vscode.window.showInformationMessage(t('messages.fileDeleted', { name: fileName }));
      } catch (error) {
        vscode.window.showErrorMessage(t('messages.failedToDeleteFile', { error: String(error) }));
      }
    }
  });
  disposables.push(deleteBuiltFileCmd);

  return disposables;
}


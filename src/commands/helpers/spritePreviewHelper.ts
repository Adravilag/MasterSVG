import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconEditorPanel } from '../../panels/IconEditorPanel';
import { IconDetailsPanel } from '../../panels/IconDetailsPanel';
import { BuiltIconsProvider } from '../../providers/WorkspaceSvgProvider';
import { getComponentExporter } from '../../services/ComponentExporter';
import { t } from '../../i18n';

// Template cache for lazy loading
let spritePreviewCss: string | null = null;
let spritePreviewJs: string | null = null;
let spritePreviewHtml: string | null = null;

/**
 * Icon preview data structure
 */
export interface IconPreviewData {
  id: string;
  viewBox: string;
  content: string;
}

/**
 * Configuration for message handler
 */
export interface PreviewMessageHandlerConfig {
  icons: IconPreviewData[];
  filePath: string;
  panel: vscode.WebviewPanel;
  extensionUri: vscode.Uri;
  builtIconsProvider: BuiltIconsProvider;
  isSprite: boolean;
  parseIconsFromContent: (content: string) => IconPreviewData[];
}

/**
 * Load sprite preview templates from disk
 */
export function loadSpritePreviewTemplates(): { css: string; js: string; html: string } {
  if (!spritePreviewCss || !spritePreviewJs || !spritePreviewHtml) {
    const templatesDir = path.join(__dirname, '..', '..', 'templates', 'sprite-preview');
    spritePreviewCss = fs.readFileSync(path.join(templatesDir, 'SpritePreview.css'), 'utf-8');
    spritePreviewJs = fs.readFileSync(path.join(templatesDir, 'SpritePreview.js'), 'utf-8');
    spritePreviewHtml = fs.readFileSync(path.join(templatesDir, 'SpritePreview.html'), 'utf-8');
  }
  return { css: spritePreviewCss, js: spritePreviewJs, html: spritePreviewHtml };
}

/**
 * Generates HTML for sprite/icons file preview webview
 */
export function getSpritePreviewHtml(icons: IconPreviewData[], fileName: string): string {
  const templates = loadSpritePreviewTemplates();

  const iconCards = icons
    .map(icon => {
      // Clean content - remove text, title, desc, and embedded style/script elements
      const cleanContent = icon.content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '');

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${cleanContent}</svg>`;
      return `
      <div class="icon-card" data-icon-id="${icon.id}" title="${icon.id}">
        <div class="icon-preview">${svg}</div>
        <div class="icon-name">${icon.id}</div>
      </div>
    `;
    })
    .join('');

  const htmlContent = templates.html
    .replace(/\$\{fileName\}/g, fileName)
    .replace(/\$\{iconCount\}/g, String(icons.length))
    .replace(/\$\{iconCards\}/g, iconCards)
    // i18n translations
    .replace(/\$\{i18n_icons\}/g, t('webview.spritePreview.icons'))
    .replace(/\$\{i18n_openFile\}/g, t('webview.spritePreview.openFile'))
    .replace(/\$\{i18n_refresh\}/g, t('webview.spritePreview.refresh'))
    .replace(/\$\{i18n_copyName\}/g, t('webview.spritePreview.copyName'))
    .replace(/\$\{i18n_copySvg\}/g, t('webview.spritePreview.copySvg'))
    .replace(/\$\{i18n_editIcon\}/g, t('webview.spritePreview.editIcon'))
    .replace(/\$\{i18n_showDetails\}/g, t('webview.spritePreview.showDetails'))
    .replace(/\$\{i18n_exportComponent\}/g, t('webview.spritePreview.exportComponent'))
    .replace(/\$\{i18n_rename\}/g, t('webview.spritePreview.rename'))
    .replace(/\$\{i18n_delete\}/g, t('webview.spritePreview.delete'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SVG Sprite Preview</title>
  <style>${templates.css}</style>
</head>
<body>
  ${htmlContent}
  <script>${templates.js}</script>
</body>
</html>`;
}

/**
 * Build full SVG from icon data
 */
function buildFullSvg(iconData: IconPreviewData): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
}

/**
 * Create a message handler for the preview webview
 */
export function createPreviewMessageHandler(config: PreviewMessageHandlerConfig) {
  const {
    icons,
    filePath,
    panel,
    extensionUri,
    builtIconsProvider,
    isSprite,
    parseIconsFromContent,
  } = config;

  return async (message: { command: string; iconId?: string }) => {
    const iconData = icons.find(i => i.id === message.iconId);
    if (!iconData && message.command !== 'openFile' && message.command !== 'refresh') return;

    switch (message.command) {
      case 'copyName':
        await vscode.env.clipboard.writeText(message.iconId!);
        vscode.window.showInformationMessage(t('messages.iconCopied', { name: message.iconId! }));
        break;

      case 'copySvg':
        await vscode.env.clipboard.writeText(buildFullSvg(iconData!));
        vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
        break;

      case 'editIcon':
        IconEditorPanel.createOrShow(extensionUri, {
          name: message.iconId!,
          svg: buildFullSvg(iconData!),
          ...(isSprite
            ? { spriteFile: filePath, viewBox: iconData!.viewBox }
            : { iconsFile: filePath, viewBox: iconData!.viewBox }),
        });
        break;

      case 'showDetails':
        IconDetailsPanel.createOrShow(extensionUri, {
          name: message.iconId!,
          svg: buildFullSvg(iconData!),
          isBuilt: true,
        });
        break;

      case 'exportComponent':
        try {
          const componentExporter = getComponentExporter();
          const result = componentExporter.export({
            format: 'react',
            typescript: true,
            iconName: message.iconId!,
            svg: buildFullSvg(iconData!),
          });
          const doc = await vscode.workspace.openTextDocument({
            content: result.code,
            language: 'typescriptreact',
          });
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (err) {
          vscode.window.showErrorMessage(
            t('messages.failedToExportComponent', { error: String(err) })
          );
        }
        break;

      case 'renameIcon':
        await handleRenameIcon(
          message.iconId!,
          iconData!,
          icons,
          filePath,
          panel,
          builtIconsProvider,
          isSprite
        );
        break;

      case 'openFile': {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        break;
      }

      case 'deleteIcon':
        await handleDeleteIcon(
          message.iconId!,
          icons,
          filePath,
          panel,
          builtIconsProvider,
          isSprite
        );
        break;

      case 'refresh':
        handleRefresh(icons, filePath, panel, parseIconsFromContent);
        break;
    }
  };
}

/**
 * Handle icon rename
 */
async function handleRenameIcon(
  iconId: string,
  iconData: IconPreviewData,
  icons: IconPreviewData[],
  filePath: string,
  panel: vscode.WebviewPanel,
  builtIconsProvider: BuiltIconsProvider,
  isSprite: boolean
): Promise<void> {
  const newName = await vscode.window.showInputBox({
    prompt: t('ui.prompts.enterNewIconName'),
    value: iconId,
    validateInput: value => {
      if (!value || value.trim() === '') return t('ui.validation.nameCannotBeEmpty');
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return t('ui.validation.invalidNameFormat');
      return null;
    },
  });

  if (newName && newName !== iconId) {
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    if (isSprite) {
      const oldIdPattern = new RegExp(`id=["']${iconId}["']`, 'g');
      fileContent = fileContent.replace(oldIdPattern, `id="${newName}"`);
    } else {
      const namePattern = new RegExp(
        `(export\\s+const\\s+\\w+\\s*=\\s*\\{[\\s\\S]*?name:\\s*['"])${iconId}(['"])`,
        'g'
      );
      fileContent = fileContent.replace(namePattern, `$1${newName}$2`);
      const oldVarName = iconId.replace(/-/g, '_');
      const newVarName = newName.replace(/-/g, '_');
      const varPattern = new RegExp(`export\\s+const\\s+${oldVarName}\\s*=`, 'g');
      fileContent = fileContent.replace(varPattern, `export const ${newVarName} =`);
    }

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    iconData.id = newName;
    panel.webview.html = getSpritePreviewHtml(icons, path.basename(filePath));
    builtIconsProvider.refresh();
    vscode.window.showInformationMessage(t('messages.iconRenamedTo', { name: newName }));
  }
}

/**
 * Handle icon deletion
 */
async function handleDeleteIcon(
  iconId: string,
  icons: IconPreviewData[],
  filePath: string,
  panel: vscode.WebviewPanel,
  builtIconsProvider: BuiltIconsProvider,
  isSprite: boolean
): Promise<void> {
  const messageKey = isSprite ? 'messages.confirmDeleteIcon' : 'messages.confirmDeleteIconFromFile';
  const confirm = await vscode.window.showWarningMessage(
    t(messageKey, { name: iconId }),
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    if (isSprite) {
      const symbolPattern = new RegExp(
        `<symbol[^>]*id=["']${iconId}["'][^>]*>[\\s\\S]*?<\\/symbol>\\s*`,
        'gi'
      );
      fileContent = fileContent.replace(symbolPattern, '');
    } else {
      const varName = iconId.replace(/-/g, '_');
      const iconPat = new RegExp(
        `export\\s+const\\s+${varName}\\s*=\\s*\\{[\\s\\S]*?\\};\\s*`,
        'g'
      );
      fileContent = fileContent.replace(iconPat, '');
    }

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    const index = icons.findIndex(i => i.id === iconId);
    if (index > -1) icons.splice(index, 1);
    panel.webview.html = getSpritePreviewHtml(icons, path.basename(filePath));
    builtIconsProvider.refresh();
    vscode.window.showInformationMessage(t('messages.iconDeleted', { name: iconId }));
  }
}

/**
 * Handle refresh
 */
function handleRefresh(
  icons: IconPreviewData[],
  filePath: string,
  panel: vscode.WebviewPanel,
  parseIconsFromContent: (content: string) => IconPreviewData[]
): void {
  const newContent = fs.readFileSync(filePath, 'utf-8');
  const newIcons = parseIconsFromContent(newContent);
  icons.length = 0;
  icons.push(...newIcons);

  panel.webview.postMessage({
    command: 'refreshComplete',
    icons: icons.map(icon => {
      const cleanContent = icon.content
        .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '');
      return {
        id: icon.id,
        viewBox: icon.viewBox,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${cleanContent}</svg>`,
      };
    }),
    count: icons.length,
  });
}

/**
 * Parse icons from sprite.svg content
 */
export function parseSpriteIcons(content: string): IconPreviewData[] {
  const symbolRegex =
    /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
  const icons: IconPreviewData[] = [];
  let match;
  while ((match = symbolRegex.exec(content)) !== null) {
    icons.push({ id: match[1], viewBox: match[2], content: match[3] });
  }
  return icons;
}

/**
 * Parse icons from icons.js content
 */
export function parseIconsJsIcons(content: string): IconPreviewData[] {
  const iconPattern =
    /export\s+const\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?body:\s*`([^`]*)`[\s\S]*?viewBox:\s*['"]([^'"]+)['"][\s\S]*?\};/g;
  const icons: IconPreviewData[] = [];
  let match;
  while ((match = iconPattern.exec(content)) !== null) {
    icons.push({ id: match[2], viewBox: match[4], content: match[3] });
  }
  return icons;
}

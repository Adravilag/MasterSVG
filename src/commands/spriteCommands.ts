import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconEditorPanel } from '../panels/IconEditorPanel';
import { IconDetailsPanel } from '../panels/IconDetailsPanel';
import { WorkspaceSvgProvider, BuiltIconsProvider, SvgItem } from '../providers/WorkspaceSvgProvider';
import { getComponentExporter } from '../services/ComponentExporter';
import { getSpriteGenerator, SpriteIcon } from '../services/SpriteGenerator';
import { cleanSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';

// Template cache for lazy loading
let spritePreviewCss: string | null = null;
let spritePreviewJs: string | null = null;
let spritePreviewHtml: string | null = null;

function loadSpritePreviewTemplates(): { css: string; js: string; html: string } {
  if (!spritePreviewCss || !spritePreviewJs || !spritePreviewHtml) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    spritePreviewCss = fs.readFileSync(path.join(templatesDir, 'SpritePreview.css'), 'utf-8');
    spritePreviewJs = fs.readFileSync(path.join(templatesDir, 'SpritePreview.js'), 'utf-8');
    spritePreviewHtml = fs.readFileSync(path.join(templatesDir, 'SpritePreview.html'), 'utf-8');
  }
  return { css: spritePreviewCss, js: spritePreviewJs, html: spritePreviewHtml };
}

/**
 * Interface for providers needed by sprite commands
 */
export interface SpriteCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
}

/**
 * Generates HTML for sprite/icons file preview webview
 */
export function getSpritePreviewHtml(icons: { id: string; viewBox: string; content: string }[], fileName: string): string {
  const templates = loadSpritePreviewTemplates();
  
  const iconCards = icons.map(icon => {
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
  }).join('');

  const htmlContent = templates.html
    .replace(/\$\{fileName\}/g, fileName)
    .replace(/\$\{iconCount\}/g, String(icons.length))
    .replace(/\$\{iconCards\}/g, iconCards);

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
      vscode.window.showWarningMessage('No icons found in library');
      return;
    }

    const formatChoice = await vscode.window.showQuickPick(
      [
        { label: 'SVG Sprite', value: 'svg' as const },
        { label: 'Web Component (JS)', value: 'css' as const },
        { label: 'Both', value: 'both' as const }
      ],
      { placeHolder: 'Select sprite format' }
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

    vscode.window.showInformationMessage(`Sprite generated in ${outputPath}`);
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
      vscode.window.showWarningMessage('sprite.svg not found.');
      return;
    }

    const content = fs.readFileSync(spritePath, 'utf-8');
    const symbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
    const icons: { id: string; viewBox: string; content: string }[] = [];
    let match;

    while ((match = symbolRegex.exec(content)) !== null) {
      icons.push({ id: match[1], viewBox: match[2], content: match[3] });
    }

    if (icons.length === 0) {
      vscode.window.showWarningMessage('No icons found in sprite.svg');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'spritePreview',
      'SVG Sprite',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));

    panel.webview.onDidReceiveMessage(async (message) => {
      const iconData = icons.find(i => i.id === message.iconId);
      if (!iconData && message.command !== 'openFile' && message.command !== 'refresh') return;

      switch (message.command) {
        case 'copyName':
          await vscode.env.clipboard.writeText(message.iconId);
          vscode.window.showInformationMessage(`Copied: ${message.iconId}`);
          break;

        case 'copySvg':
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage('SVG copied to clipboard');
          break;

        case 'editIcon':
          const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          IconEditorPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: editSvg,
            spriteFile: spritePath,
            viewBox: iconData!.viewBox
          });
          break;

        case 'showDetails':
          const detailsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          IconDetailsPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: detailsSvg,
            isBuilt: true
          });
          break;

        case 'exportComponent':
          try {
            const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
            const componentExporter = getComponentExporter();
            const result = componentExporter.export({
              format: 'react',
              typescript: true,
              iconName: message.iconId,
              svg: fullSvg
            });
            const doc = await vscode.workspace.openTextDocument({ content: result.code, language: 'typescriptreact' });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to export component: ${err}`);
          }
          break;

        case 'renameIcon':
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new icon name',
            value: message.iconId,
            validateInput: (value) => {
              if (!value || value.trim() === '') return 'Name cannot be empty';
              if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return 'Invalid name format';
              return null;
            }
          });
          
          if (newName && newName !== message.iconId) {
            let spriteContent = fs.readFileSync(spritePath, 'utf-8');
            const oldIdPattern = new RegExp(`id=["']${message.iconId}["']`, 'g');
            spriteContent = spriteContent.replace(oldIdPattern, `id="${newName}"`);
            fs.writeFileSync(spritePath, spriteContent, 'utf-8');
            iconData!.id = newName;
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon renamed to: ${newName}`);
          }
          break;

        case 'openFile':
          const doc = await vscode.workspace.openTextDocument(spritePath);
          await vscode.window.showTextDocument(doc);
          break;

        case 'deleteIcon':
          const confirm = await vscode.window.showWarningMessage(
            `Delete "${message.iconId}" from sprite?`,
            { modal: true },
            'Delete'
          );
          
          if (confirm === 'Delete') {
            let spriteContent = fs.readFileSync(spritePath, 'utf-8');
            const symbolPattern = new RegExp(`<symbol[^>]*id=["']${message.iconId}["'][^>]*>[\\s\\S]*?<\\/symbol>\\s*`, 'gi');
            spriteContent = spriteContent.replace(symbolPattern, '');
            fs.writeFileSync(spritePath, spriteContent, 'utf-8');
            const index = icons.findIndex(i => i.id === message.iconId);
            if (index > -1) icons.splice(index, 1);
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon deleted: ${message.iconId}`);
          }
          break;

        case 'refresh':
          const newContent = fs.readFileSync(spritePath, 'utf-8');
          const newSymbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
          icons.length = 0;
          let newMatch;
          while ((newMatch = newSymbolRegex.exec(newContent)) !== null) {
            icons.push({ id: newMatch[1], viewBox: newMatch[2], content: newMatch[3] });
          }
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
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${cleanContent}</svg>`
              };
            }),
            count: icons.length
          });
          break;
      }
    });
  });
  disposables.push(viewSpriteCmd);

  // Command: Clean Sprite
  const cleanSpriteCmd = vscode.commands.registerCommand('iconManager.cleanSprite', async () => {
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const result = cleanSpriteSvg(outputPath);
    
    if (result.removed.length === 0) {
      vscode.window.showInformationMessage('Sprite is clean - no invalid content found.');
    } else {
      vscode.window.showInformationMessage(
        `Cleaned sprite: removed ${result.removed.length} invalid entries. ${result.kept} icons remaining.`
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
        vscode.window.showWarningMessage('No icons file found.');
        return;
      }
    }
    
    if (!fs.existsSync(iconsFilePath)) {
      vscode.window.showWarningMessage('Icons file not found.');
      return;
    }

    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const iconPattern = /export\s+const\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?body:\s*`([^`]*)`[\s\S]*?viewBox:\s*['"]([^'"]+)['"][\s\S]*?\};/g;
    const icons: { id: string; viewBox: string; content: string }[] = [];
    let match;

    while ((match = iconPattern.exec(content)) !== null) {
      icons.push({ id: match[2], viewBox: match[4], content: match[3] });
    }

    if (icons.length === 0) {
      vscode.window.showWarningMessage('No icons found in the file');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconsFilePreview',
      'Icons File',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath));

    panel.webview.onDidReceiveMessage(async (message) => {
      const iconData = icons.find(i => i.id === message.iconId);
      if (!iconData && message.command !== 'openFile' && message.command !== 'refresh') return;

      switch (message.command) {
        case 'copyName':
          await vscode.env.clipboard.writeText(message.iconId);
          vscode.window.showInformationMessage(`Copied: ${message.iconId}`);
          break;

        case 'copySvg':
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage('SVG copied to clipboard');
          break;

        case 'editIcon':
          const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          IconEditorPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: editSvg,
            iconsFile: iconsFilePath,
            viewBox: iconData!.viewBox
          });
          break;

        case 'showDetails':
          const detailsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
          IconDetailsPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: detailsSvg,
            isBuilt: true
          });
          break;

        case 'exportComponent':
          try {
            const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData!.viewBox}" fill="currentColor">${iconData!.content}</svg>`;
            const componentExporter = getComponentExporter();
            const result = componentExporter.export({
              format: 'react',
              typescript: true,
              iconName: message.iconId,
              svg: fullSvg
            });
            const doc = await vscode.workspace.openTextDocument({ content: result.code, language: 'typescriptreact' });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to export component: ${err}`);
          }
          break;

        case 'renameIcon':
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new icon name',
            value: message.iconId,
            validateInput: (value) => {
              if (!value || value.trim() === '') return 'Name cannot be empty';
              if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return 'Invalid name format';
              return null;
            }
          });
          
          if (newName && newName !== message.iconId) {
            let fileContent = fs.readFileSync(iconsFilePath!, 'utf-8');
            const namePattern = new RegExp(`(export\\s+const\\s+\\w+\\s*=\\s*\\{[\\s\\S]*?name:\\s*['"])${message.iconId}(['"])`, 'g');
            fileContent = fileContent.replace(namePattern, `$1${newName}$2`);
            const oldVarName = message.iconId.replace(/-/g, '_');
            const newVarName = newName.replace(/-/g, '_');
            const varPattern = new RegExp(`export\\s+const\\s+${oldVarName}\\s*=`, 'g');
            fileContent = fileContent.replace(varPattern, `export const ${newVarName} =`);
            fs.writeFileSync(iconsFilePath!, fileContent, 'utf-8');
            iconData!.id = newName;
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath!));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon renamed to: ${newName}`);
          }
          break;

        case 'openFile':
          const openDoc = await vscode.workspace.openTextDocument(iconsFilePath!);
          await vscode.window.showTextDocument(openDoc);
          break;

        case 'deleteIcon':
          const confirm = await vscode.window.showWarningMessage(
            `Delete "${message.iconId}" from icons file?`,
            { modal: true },
            'Delete'
          );
          
          if (confirm === 'Delete') {
            let fileContent = fs.readFileSync(iconsFilePath!, 'utf-8');
            const varName = message.iconId.replace(/-/g, '_');
            const iconPat = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*\\{[\\s\\S]*?\\};\\s*`, 'g');
            fileContent = fileContent.replace(iconPat, '');
            fs.writeFileSync(iconsFilePath!, fileContent, 'utf-8');
            const index = icons.findIndex(i => i.id === message.iconId);
            if (index > -1) icons.splice(index, 1);
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath!));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon deleted: ${message.iconId}`);
          }
          break;

        case 'refresh':
          const newContent = fs.readFileSync(iconsFilePath!, 'utf-8');
          const newIconPattern = /export\s+const\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?body:\s*`([^`]*)`[\s\S]*?viewBox:\s*['"]([^'"]+)['"][\s\S]*?\};/g;
          icons.length = 0;
          let newMatch;
          while ((newMatch = newIconPattern.exec(newContent)) !== null) {
            icons.push({ id: newMatch[2], viewBox: newMatch[4], content: newMatch[3] });
          }
          panel.webview.postMessage({ 
            command: 'refreshComplete', 
            icons: icons.map(icon => ({
              id: icon.id,
              viewBox: icon.viewBox,
              svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${icon.content}</svg>`
            })),
            count: icons.length
          });
          break;
      }
    });
  });
  disposables.push(viewIconsFileCmd);

  // Command: Delete built file
  const deleteBuiltFileCmd = vscode.commands.registerCommand('iconManager.deleteBuiltFile', async (item?: SvgItem) => {
    if (!item?.category?.startsWith('built:')) {
      vscode.window.showWarningMessage('No file selected');
      return;
    }

    const fileName = item.category.replace('built:', '');
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const filePath = path.join(outputPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`File not found: ${fileName}`);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete "${fileName}"? This action cannot be undone.`,
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      try {
        fs.unlinkSync(filePath);
        builtIconsProvider.refresh();
        vscode.window.showInformationMessage(`Deleted: ${fileName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
      }
    }
  });
  disposables.push(deleteBuiltFileCmd);

  return disposables;
}

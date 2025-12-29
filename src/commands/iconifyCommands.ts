import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SvgTransformer } from '../services/SvgTransformer';
import { WorkspaceSvgProvider, BuiltIconsProvider, SvgItem } from '../providers/WorkspaceSvgProvider';
import { searchIconify, fetchIconSvg, IconifySearchResult } from '../utils/iconifyService';
import { addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';
import { getIconPickerHtml } from '../utils/iconPickerHtml';
import { t } from '../i18n';

/**
 * Interface for providers needed by Iconify commands
 */
export interface IconifyCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  builtIconsProvider: BuiltIconsProvider;
  svgTransformer: SvgTransformer;
}

/**
 * Shows a webview panel to select an icon from Iconify with previews
 * Returns a promise that resolves with the selected icon info or undefined
 */
export function showIconifyReplacementPicker(
  context: vscode.ExtensionContext,
  icons: IconifySearchResult[],
  query: string,
  missingIconName: string
): Promise<{ prefix: string; name: string; svg: string } | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'iconifyReplacePicker',
      `Replace: ${missingIconName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    let resolved = false;

    panel.webview.html = getIconifyReplacePickerHtml(icons, query, missingIconName);

    panel.onDidDispose(() => {
      if (!resolved) {
        resolve(undefined);
      }
    });

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'selectIcon') {
          const { prefix, name, color } = message;

          try {
            const svg = await fetchIconSvg(prefix, name, color !== '#ffffff' ? color : undefined);

            if (!svg) {
              vscode.window.showErrorMessage(t('messages.failedToFetchIcon'));
              return;
            }

            resolved = true;
            panel.dispose();
            resolve({ prefix, name, svg });
          } catch (error) {
            vscode.window.showErrorMessage(t('messages.failedToFetchIconError', { error: String(error) }));
          }
        } else if (message.command === 'cancel') {
          resolved = true;
          panel.dispose();
          resolve(undefined);
        } else if (message.command === 'search') {
          // Handle new search from within the picker
          const newQuery = message.query;
          const results = await searchIconify(newQuery);
          panel.webview.postMessage({ command: 'updateResults', icons: results, query: newQuery });
        }
      }
    );
  });
}

/**
 * Shows icon picker panel for Iconify search results
 */
export function showIconPickerPanel(
  context: vscode.ExtensionContext,
  results: IconifySearchResult[],
  query: string,
  svgTransformer: SvgTransformer,
  workspaceSvgProvider: WorkspaceSvgProvider
): void {
  const panel = vscode.window.createWebviewPanel(
    'iconPicker',
    `Icons: ${query}`,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getIconPickerHtml(results, query);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'selectIcon') {
        const { prefix, name, color } = message;
        
        try {
          const svg = await fetchIconSvg(prefix, name, color !== '#ffffff' ? color : undefined);
          
          if (!svg) {
            vscode.window.showErrorMessage(t('messages.failedToFetchIcon'));
            return;
          }

          // Save icon name for build
          const iconName = `${prefix}-${name}`;
          const outputPath = getOutputPathOrWarn();
          if (!outputPath) return;

          // Use configured build format
          const config = getConfig();
          const isSprite = config.buildFormat === 'sprite.svg';
          
          if (isSprite) {
            await addToSpriteSvg(outputPath, iconName, svg, svgTransformer);
          } else {
            await addToIconsJs(outputPath, iconName, svg, svgTransformer);
          }

          workspaceSvgProvider.refresh();
          const formatName = isSprite ? 'sprite' : 'icons library';
          vscode.window.showInformationMessage(t('messages.iconAddedToFormat', { name: iconName, format: formatName }));
        } catch (error) {
          vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: String(error) }));
        }
      } else if (message.command === 'search') {
        // Handle search from within the picker
        const newQuery = message.query;
        const newResults = await searchIconify(newQuery);
        panel.title = `Icons: ${newQuery}`;
        panel.webview.postMessage({ command: 'updateResults', icons: newResults, query: newQuery });
      } else if (message.command === 'close') {
        panel.dispose();
      }
    }
  );
}

/**
 * Generates HTML for the Iconify replacement picker
 */
function getIconifyReplacePickerHtml(icons: IconifySearchResult[], query: string, missingIconName: string): string {
  const escapedQuery = query.replace(/"/g, '&quot;');
  const escapedMissing = missingIconName.replace(/"/g, '&quot;');
  
  const iconCards = icons.map(icon => `
    <div class="icon-card" data-prefix="${icon.prefix}" data-name="${icon.name}">
      <div class="icon-preview">
        <img src="https://api.iconify.design/${icon.prefix}/${icon.name}.svg?color=%23ffffff" alt="${icon.name}" loading="lazy" />
      </div>
      <div class="icon-info">
        <span class="icon-name">${icon.name}</span>
        <span class="icon-prefix">${icon.prefix}</span>
      </div>
      <button class="select-btn" onclick="selectIcon('${icon.prefix}', '${icon.name}')">
        Build
      </button>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Replace Icon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.3rem;
    }
    .cancel-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .cancel-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .info-box {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .info-box .icon { font-size: 20px; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    .toolbar label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .color-picker {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
    }
    .color-presets {
      display: flex;
      gap: 6px;
    }
    .color-preset {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s;
    }
    .color-preset:hover { transform: scale(1.15); }
    .color-preset.active { border-color: var(--vscode-focusBorder); }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }
    .icon-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.2s;
    }
    .icon-card:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(-2px);
    }
    .icon-preview {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .icon-preview img {
      width: 100%;
      height: 100%;
    }
    .icon-info {
      text-align: center;
      margin-bottom: 8px;
    }
    .icon-name {
      display: block;
      font-size: 11px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 110px;
    }
    .icon-prefix {
      display: block;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .select-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .select-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔄 Replace Missing Icon</h1>
    <button class="cancel-btn" onclick="cancel()">Cancel</button>
  </div>
  
  <div class="info-box">
    <span class="icon">⚠️</span>
    <span>Missing icon: <strong>${escapedMissing}.svg</strong> — Select a replacement from Iconify</span>
  </div>
  
  <div class="toolbar">
    <label>
      🎨 Color:
      <input type="color" id="colorPicker" class="color-picker" value="#ffffff" />
    </label>
    <div class="color-presets">
      <button class="color-preset active" style="background: #ffffff" data-color="#ffffff" title="White"></button>
      <button class="color-preset" style="background: #000000" data-color="#000000" title="Black"></button>
      <button class="color-preset" style="background: #3b82f6" data-color="#3b82f6" title="Blue"></button>
      <button class="color-preset" style="background: #10b981" data-color="#10b981" title="Green"></button>
      <button class="color-preset" style="background: #f59e0b" data-color="#f59e0b" title="Orange"></button>
      <button class="color-preset" style="background: #ef4444" data-color="#ef4444" title="Red"></button>
      <button class="color-preset" style="background: #8b5cf6" data-color="#8b5cf6" title="Purple"></button>
    </div>
  </div>

  <p class="subtitle">Results for "${escapedQuery}" — ${icons.length} icons found. Click to build.</p>
  
  <div class="grid">
    ${iconCards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentColor = '#ffffff';
    
    function updateIconColors(color) {
      currentColor = color;
      const encodedColor = encodeURIComponent(color);
      document.querySelectorAll('.icon-preview img').forEach(img => {
        const src = img.src;
        img.src = src.replace(/color=[^&]*/, 'color=' + encodedColor);
      });
      document.querySelectorAll('.color-preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
      document.getElementById('colorPicker').value = color;
    }
    
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      updateIconColors(e.target.value);
    });
    
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        updateIconColors(btn.dataset.color);
      });
    });
    
    function selectIcon(prefix, name) {
      vscode.postMessage({ command: 'selectIcon', prefix, name, color: currentColor });
    }
    
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }
  </script>
</body>
</html>`;
}

/**
 * Register Iconify-related commands
 */
export function registerIconifyCommands(
  context: vscode.ExtensionContext,
  providers: IconifyCommandProviders
): void {
  const { workspaceSvgProvider, builtIconsProvider, svgTransformer } = providers;

  // Command: Search icons (Iconify)
  const searchIconsCmd = vscode.commands.registerCommand('iconManager.searchIcons', async () => {
    const query = await vscode.window.showInputBox({
      prompt: t('ui.prompts.searchIconifyFull'),
      placeHolder: t('ui.placeholders.enterSearchTerm')
    });

    if (!query) return;

    const results = await searchIconify(query);

    if (results.length === 0) {
      vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query }));
      return;
    }

    showIconPickerPanel(context, results, query, svgTransformer, workspaceSvgProvider);
  });

  // Command: Search Iconify with pre-filled query (for hover links)
  const searchIconifyCmd = vscode.commands.registerCommand('iconManager.searchIconify', async (query?: string) => {
    // If no query provided, show input box
    const searchTerm = query || await vscode.window.showInputBox({
      prompt: t('ui.prompts.searchIconify'),
      placeHolder: t('ui.placeholders.enterSearchTerm')
    });

    if (!searchTerm) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Searching "${searchTerm}" in Iconify...`,
      cancellable: false
    }, async () => {
      const results = await searchIconify(searchTerm);

      if (results.length === 0) {
        vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query: searchTerm }));
        return;
      }

      showIconPickerPanel(context, results, searchTerm, svgTransformer, workspaceSvgProvider);
    });
  });

  // Command: Import missing icon (for web components with missing icons)
  const importIconCmd = vscode.commands.registerCommand('iconManager.importIcon', async (iconName: string, sourceFile?: string, line?: number) => {
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';

    // Show source selection menu
    const sourceChoice = await vscode.window.showQuickPick([
      { 
        label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`, 
        description: t('ui.labels.findBuildIconify'),
        value: 'iconify' 
      },
      { 
        label: `$(folder-opened) ${t('ui.labels.browseForSvgFile')}`, 
        description: t('ui.labels.selectExistingSvg'),
        value: 'file' 
      }
    ], {
      placeHolder: `Import icon "${iconName}" - Select source`,
      title: `📥 Import: ${iconName}`
    });

    if (!sourceChoice) return;

    let svgContent: string | undefined;
    let finalIconName = iconName;

    if (sourceChoice.value === 'iconify') {
      // Search Iconify
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
      finalIconName = `${selectedIcon.prefix}-${selectedIcon.name}`;

    } else if (sourceChoice.value === 'file') {
      // Browse for SVG file
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] },
        title: `Select SVG file for "${iconName}"`
      });

      if (!fileUri?.[0]) return;

      svgContent = fs.readFileSync(fileUri[0].fsPath, 'utf-8');
      // Keep the original icon name for consistency
    }

    if (!svgContent) return;

    // Build the icon
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    if (isSprite) {
      await addToSpriteSvg(outputPath, finalIconName, svgContent, svgTransformer);
    } else {
      await addToIconsJs(outputPath, finalIconName, svgContent, svgTransformer);
    }

    // Update reference if icon name changed
    if (sourceFile && line !== undefined && finalIconName !== iconName) {
      try {
        const document = await vscode.workspace.openTextDocument(sourceFile);
        const lineText = document.lineAt(line).text;
        
        const newText = lineText.replace(
          new RegExp(`name=["']${iconName}["']`, 'g'),
          `name="${finalIconName}"`
        );
        
        if (newText !== lineText) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
          await vscode.workspace.applyEdit(edit);
        }
      } catch (e) {
        console.error('Failed to update icon reference:', e);
      }
    }

    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    
    const formatName = isSprite ? 'sprite' : 'icons library';
    vscode.window.showInformationMessage(t('messages.iconImportedToFormat', { name: finalIconName, format: formatName }));
  });

  context.subscriptions.push(
    searchIconsCmd,
    searchIconifyCmd,
    importIconCmd
  );
}


import * as vscode from 'vscode';
import * as fs from 'fs';
import { SvgTransformer } from '../services/SvgTransformer';
import {
  WorkspaceSvgProvider,
  BuiltIconsProvider,
} from '../providers/WorkspaceSvgProvider';
import { searchIconify, fetchIconSvg, IconifySearchResult, searchInCollection } from '../utils/iconifyService';
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
 * Check if icon name already exists and handle duplicates
 * Returns the final name to use, or undefined if cancelled
 */
export async function handleDuplicateIconName(
  iconName: string,
  workspaceSvgProvider: WorkspaceSvgProvider
): Promise<string | undefined> {
  const existingIcon = workspaceSvgProvider.getIcon(iconName);

  if (!existingIcon) {
    return iconName; // Name is available
  }

  // Icon already exists - ask user what to do
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: t('ui.labels.renameIcon') || 'Rename icon',
        description: t('ui.labels.enterNewName') || 'Enter a different name',
        value: 'rename',
      },
      {
        label: t('ui.labels.replaceIcon') || 'Replace existing',
        description: t('ui.labels.overwriteExisting') || 'Overwrite the existing icon',
        value: 'replace',
      },
      {
        label: t('ui.labels.cancel') || 'Cancel',
        description: '',
        value: 'cancel',
      },
    ],
    {
      placeHolder:
        t('messages.iconAlreadyExists', { name: iconName }) || `Icon "${iconName}" already exists`,
      title: t('ui.titles.duplicateIcon') || 'Duplicate Icon Name',
    }
  );

  if (!choice || choice.value === 'cancel') {
    return undefined;
  }

  if (choice.value === 'replace') {
    return iconName; // Use same name, will overwrite
  }

  // Rename - suggest a new name
  const suggestedName = generateUniqueName(iconName, workspaceSvgProvider);

  const newName = await vscode.window.showInputBox({
    prompt: t('ui.prompts.enterNewIconName') || 'Enter a new name for the icon',
    value: suggestedName,
    placeHolder: t('ui.placeholders.iconName') || 'icon-name',
    validateInput: value => {
      if (!value || value.trim() === '') {
        return t('validation.nameRequired') || 'Name is required';
      }
      if (!/^[a-z0-9-]+$/.test(value)) {
        return (
          t('validation.invalidCharacters') || 'Use only lowercase letters, numbers, and hyphens'
        );
      }
      // Don't validate uniqueness here - user might want to overwrite
      return null;
    },
  });

  return newName || undefined;
}

/**
 * Generate a unique name by adding a numeric suffix
 */
function generateUniqueName(baseName: string, workspaceSvgProvider: WorkspaceSvgProvider): string {
  let counter = 2;
  let newName = `${baseName}-${counter}`;

  while (workspaceSvgProvider.getIcon(newName)) {
    counter++;
    newName = `${baseName}-${counter}`;
  }

  return newName;
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
  return new Promise(resolve => {
    const panel = vscode.window.createWebviewPanel(
      'iconifyReplacePicker',
      `Replace: ${missingIconName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    let resolved = false;

    panel.webview.html = getIconifyReplacePickerHtml(icons, query, missingIconName);

    panel.onDidDispose(() => {
      if (!resolved) {
        resolve(undefined);
      }
    });

    panel.webview.onDidReceiveMessage(async message => {
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
          vscode.window.showErrorMessage(
            t('messages.failedToFetchIconError', { error: String(error) })
          );
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
    });
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

  panel.webview.onDidReceiveMessage(async message => {
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
          await addToIconsJs({
            outputPath,
            iconName,
            svgContent: svg,
            transformer: svgTransformer,
          });
        }

        workspaceSvgProvider.refresh();
        const formatName = isSprite ? 'sprite' : 'icons library';
        vscode.window.showInformationMessage(
          t('messages.iconAddedToFormat', { name: iconName, format: formatName })
        );
      } catch (error) {
        vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: String(error) }));
      }
    } else if (message.command === 'search') {
      // Handle search from within the picker (supports collection filter)
      const { query: newQuery, collection } = message;
      let newResults: IconifySearchResult[];
      
      if (collection && !newQuery) {
        // Browse collection without specific query
        newResults = await searchInCollection(collection, undefined, 100);
      } else if (collection) {
        // Search within specific collection
        newResults = await searchIconify(newQuery, { limit: 100, prefixes: [collection] });
      } else {
        // General search
        newResults = await searchIconify(newQuery);
      }
      
      panel.title = `Icons: ${newQuery || collection || 'Browse'}`;
      panel.webview.postMessage({ command: 'updateResults', icons: newResults, query: newQuery });
    } else if (message.command === 'close') {
      panel.dispose();
    }
  });
}

/**
 * Generates HTML for the Iconify replacement picker
 */
function getIconifyReplacePickerHtml(
  icons: IconifySearchResult[],
  query: string,
  missingIconName: string
): string {
  const escapedQuery = query.replace(/"/g, '&quot;');
  const escapedMissing = missingIconName.replace(/"/g, '&quot;');

  const iconCards = icons
    .map(
      icon => `
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
  `
    )
    .join('');

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
    <span>Missing icon: <strong>${escapedMissing}</strong> — Select a replacement from Iconify</span>
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
  const searchIconsCmd = vscode.commands.registerCommand('masterSVG.searchIcons', async () => {
    const query = await vscode.window.showInputBox({
      prompt: t('ui.prompts.searchIconifyFull'),
      placeHolder: t('ui.placeholders.enterSearchTerm'),
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
  const searchIconifyCmd = vscode.commands.registerCommand(
    'masterSVG.searchIconify',
    async (query?: string) => {
      // If no query provided, show input box
      const searchTerm =
        query ||
        (await vscode.window.showInputBox({
          prompt: t('ui.prompts.searchIconify'),
          placeHolder: t('ui.placeholders.enterSearchTerm'),
        }));

      if (!searchTerm) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Searching "${searchTerm}" in Iconify...`,
          cancellable: false,
        },
        async () => {
          const results = await searchIconify(searchTerm);

          if (results.length === 0) {
            vscode.window.showInformationMessage(
              t('messages.noIconsFoundForQuery', { query: searchTerm })
            );
            return;
          }

          showIconPickerPanel(context, results, searchTerm, svgTransformer, workspaceSvgProvider);
        }
      );
    }
  );

  // Command: Import missing icon (for web components with missing icons)
  const importIconCmd = vscode.commands.registerCommand(
    'masterSVG.importIcon',
    async (iconName: string, sourceFile?: string, line?: number) => {
      const config = getConfig();
      const isSprite = config.buildFormat === 'sprite.svg';

      // Show source selection menu
      const sourceChoice = await vscode.window.showQuickPick(
        [
          {
            label: `$(cloud-download) ${t('ui.labels.searchInIconify')}`,
            description: t('ui.labels.findBuildIconify'),
            value: 'iconify',
          },
          {
            label: `$(folder-opened) ${t('ui.labels.browseForSvgFile')}`,
            description: t('ui.labels.selectExistingSvg'),
            value: 'file',
          },
        ],
        {
          placeHolder: `Import icon "${iconName}" - Select source`,
          title: `📥 Import: ${iconName}`,
        }
      );

      if (!sourceChoice) return;

      let svgContent: string | undefined;
      let finalIconName = iconName;

      if (sourceChoice.value === 'iconify') {
        // Search Iconify
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
      } else if (sourceChoice.value === 'file') {
        // Browse for SVG file
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'SVG Files': ['svg'] },
          title: `Select SVG file for "${iconName}"`,
        });

        if (!fileUri?.[0]) return;

        svgContent = fs.readFileSync(fileUri[0].fsPath, 'utf-8');

        // Check for duplicate name
        const resolvedName = await handleDuplicateIconName(finalIconName, workspaceSvgProvider);
        if (!resolvedName) return;
        finalIconName = resolvedName;
      }

      if (!svgContent) return;

      // Build the icon
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;

      if (isSprite) {
        await addToSpriteSvg(outputPath, finalIconName, svgContent, svgTransformer);
      } else {
        await addToIconsJs({
          outputPath,
          iconName: finalIconName,
          svgContent,
          transformer: svgTransformer,
        });
      }

      // Add icon directly to cache for immediate detection
      const builtIcon = {
        name: finalIconName,
        svg: svgContent,
        path: outputPath,
        source: 'library' as const,
        category: 'built',
        isBuilt: true,
      };
      workspaceSvgProvider.addBuiltIcon(finalIconName, builtIcon);

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
        } catch (updateError) {
          console.error('Failed to update icon reference:', updateError);
        }
      }

      // Soft refresh to update tree without clearing cache
      workspaceSvgProvider.softRefresh();
      builtIconsProvider.refresh();

      const formatName = isSprite ? 'sprite' : 'icons library';
      vscode.window.showInformationMessage(
        t('messages.iconImportedToFormat', { name: finalIconName, format: formatName })
      );
    }
  );

  // Command: Search Iconify for component (triggered from code action)
  const searchIconifyForComponentCmd = vscode.commands.registerCommand(
    'masterSVG.searchIconifyForComponent',
    async (suggestedQuery?: string, sourceFile?: string, line?: number) => {
      const config = getConfig();
      const isSprite = config.buildFormat === 'sprite.svg';
      const componentName = config.webComponentName || 'svg-icon';

      // Ask for search query
      const query = await vscode.window.showInputBox({
        prompt: t('ui.prompts.searchIconify'),
        value: suggestedQuery || '',
        placeHolder: t('ui.placeholders.enterSearchTerm'),
      });

      if (!query) return;

      const results = await searchIconify(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(t('messages.noIconsFoundForQuery', { query }));
        return;
      }

      // Show picker
      const selectedIcon = await showIconifyReplacementPicker(
        context,
        results,
        query,
        suggestedQuery || query
      );

      if (!selectedIcon) return;

      let finalIconName = `${selectedIcon.prefix}-${selectedIcon.name}`;

      // Check for duplicate name
      const resolvedName = await handleDuplicateIconName(finalIconName, workspaceSvgProvider);
      if (!resolvedName) return;
      finalIconName = resolvedName;

      // Build the icon
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;

      if (isSprite) {
        await addToSpriteSvg(outputPath, finalIconName, selectedIcon.svg, svgTransformer);
      } else {
        await addToIconsJs({
          outputPath,
          iconName: finalIconName,
          svgContent: selectedIcon.svg,
          transformer: svgTransformer,
        });
      }

      // Add icon directly to cache for immediate detection
      const builtIcon = {
        name: finalIconName,
        svg: selectedIcon.svg,
        path: outputPath,
        source: 'library' as const,
        category: 'built',
        isBuilt: true,
      };
      workspaceSvgProvider.addBuiltIcon(finalIconName, builtIcon);

      // Update or insert reference in source file
      if (sourceFile && line !== undefined) {
        try {
          const document = await vscode.workspace.openTextDocument(sourceFile);
          const lineText = document.lineAt(line).text;

          // Update name attribute if it exists
          const namePattern = new RegExp(`(<${componentName}[^>]*name=["'])([^"']*)(['"])`, 'gi');

          let newText: string;
          if (namePattern.test(lineText)) {
            // Reset regex lastIndex after test()
            namePattern.lastIndex = 0;
            newText = lineText.replace(namePattern, `$1${finalIconName}$3`);
          } else {
            // Insert name attribute if missing
            const tagPattern = new RegExp(String.raw`<${componentName}(\s*)`, 'gi');
            newText = lineText.replace(tagPattern, `<${componentName}$1name="${finalIconName}" `);
          }

          if (newText !== lineText) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (updateError) {
          console.error('Failed to update icon reference:', updateError);
        }
      }

      // Soft refresh to update tree without clearing cache
      workspaceSvgProvider.softRefresh();
      builtIconsProvider.refresh();

      const formatName = isSprite ? 'sprite' : 'icons library';
      vscode.window.showInformationMessage(
        t('messages.iconImportedToFormat', { name: finalIconName, format: formatName })
      );
    }
  );

  // Command: Browse workspace icons (triggered from code action)
  const browseWorkspaceIconsCmd = vscode.commands.registerCommand(
    'masterSVG.browseWorkspaceIcons',
    async (suggestedName?: string, sourceFile?: string, line?: number) => {
      const config = getConfig();
      const componentName = config.webComponentName || 'svg-icon';

      // Get all available icons from the workspace
      const allIcons = await workspaceSvgProvider.getAllIcons();

      if (allIcons.length === 0) {
        vscode.window.showInformationMessage(
          t('messages.noIconsInWorkspace') || 'No icons found in workspace. Try searching Iconify.'
        );
        return;
      }

      // Show quick pick with all icons
      const iconItems = allIcons.map(icon => ({
        label: `$(symbol-misc) ${icon.name}`,
        description: icon.source === 'library' ? t('ui.labels.library') : icon.source,
        iconName: icon.name,
      }));

      const selected = await vscode.window.showQuickPick(iconItems, {
        placeHolder: t('ui.placeholders.selectIcon') || 'Select an icon',
        matchOnDescription: true,
        title: t('ui.titles.browseIcons') || '📁 Browse Workspace Icons',
      });

      if (!selected) return;

      // Update reference in source file
      if (sourceFile && line !== undefined) {
        try {
          const document = await vscode.workspace.openTextDocument(sourceFile);
          const lineText = document.lineAt(line).text;

          const namePattern = new RegExp(`(<${componentName}[^>]*name=["'])([^"']*)(['"])`, 'gi');

          let newText: string;
          if (namePattern.test(lineText)) {
            // Reset regex lastIndex after test()
            namePattern.lastIndex = 0;
            newText = lineText.replace(namePattern, `$1${selected.iconName}$3`);
          } else {
            const tagPattern = new RegExp(String.raw`<${componentName}(\s*)`, 'gi');
            newText = lineText.replace(
              tagPattern,
              `<${componentName}$1name="${selected.iconName}" `
            );
          }

          if (newText !== lineText) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (updateError) {
          console.error('Failed to update icon reference:', updateError);
        }
      }

      vscode.window.showInformationMessage(
        t('messages.iconSelected', { name: selected.iconName }) ||
          `Icon "${selected.iconName}" selected`
      );
    }
  );

  // Command: Import missing icon from tree view
  const importMissingIconCmd = vscode.commands.registerCommand(
    'masterSVG.importMissingIcon',
    async (item: any) => {
      // Get the icon name from the tree item
      const iconName = item?.icon?.name || item?.label;
      
      if (!iconName) {
        vscode.window.showWarningMessage(
          t('messages.noIconNameFound') || 'No icon name found'
        );
        return;
      }

      // Search for the icon in Iconify
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('messages.searchingIconify', { name: iconName }) || `Searching "${iconName}" in Iconify...`,
          cancellable: false,
        },
        async () => {
          const results = await searchIconify(iconName);

          if (results.length === 0) {
            vscode.window.showInformationMessage(
              t('messages.noIconsFoundForQuery', { query: iconName })
            );
            return;
          }

          showIconPickerPanel(context, results, iconName, svgTransformer, workspaceSvgProvider);
        }
      );
    }
  );

  context.subscriptions.push(
    searchIconsCmd,
    searchIconifyCmd,
    importIconCmd,
    searchIconifyForComponentCmd,
    browseWorkspaceIconsCmd,
    importMissingIconCmd
  );
}

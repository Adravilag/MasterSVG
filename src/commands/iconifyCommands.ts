import * as vscode from 'vscode';
import * as fs from 'fs';
import { SvgTransformer } from '../services';
import {
  WorkspaceSvgProvider,
  BuiltIconsProvider,
} from '../providers';
import { searchIconify, fetchIconSvg, IconifySearchResult, searchInCollection } from '../utils/iconifyService';
import { addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';
import { getIconPickerHtml } from '../utils/iconPickerHtml';
import { IconifySuggestionProvider } from '../utils/iconifySuggestionService';
import { extractProjectPalette, extractProjectContext } from '../utils/projectPaletteExtractor';
import { SvgOptimizer } from '../services/svg/SvgOptimizer';
import type { IconSuggestion } from '../services/types/mastersvgTypes';
import type { WorkspaceIcon } from '../types';
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
  missingIconName: string,
  builtIcons?: WorkspaceIcon[]
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

    panel.webview.html = getIconifyReplacePickerHtml(icons, query, missingIconName, builtIcons);

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
      } else if (message.command === 'selectBuiltIcon') {
        const { name, svg } = message;
        if (name && svg) {
          resolved = true;
          panel.dispose();
          resolve({ prefix: 'built', name, svg });
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
  missingIconName: string,
  builtIcons?: WorkspaceIcon[]
): string {
  const escapedQuery = query.replace(/"/g, '&quot;');
  const escapedMissing = missingIconName.replace(/"/g, '&quot;');

  // Built icons section (no Iconify sub-header here — that's handled below)
  const builtIconsSection = builtIcons && builtIcons.length > 0 ? `
    <div class="section-header">
      <h2>📦 ${t('ui.labels.browseBuiltIcons') || 'Built Icons'}</h2>
      <span class="section-count">${builtIcons.length}</span>
    </div>
    <div class="grid built-grid">
      ${builtIcons.filter(icon => icon.svg).map(icon => {
        const encodedSvg = encodeURIComponent(icon.svg!);
        return `
      <div class="icon-card built-card" data-built-name="${icon.name}" data-built-svg="${encodedSvg}">
        <div class="icon-preview built-preview">${icon.svg}</div>
        <div class="icon-info">
          <span class="icon-name">${icon.name}</span>
          <span class="icon-prefix built-label">${t('treeView.builtStatus') || 'Built'}</span>
        </div>
        <button class="select-btn built-btn">${t('ui.labels.use') || 'Use'}</button>
      </div>`;
      }).join('')}
    </div>
    <div class="section-divider"></div>
  ` : '';

  // Separate best matches from the rest with scoring
  const normalizedMissing = missingIconName.toLowerCase().replace(/[-_\s]/g, '');
  const minMatchLength = 3; // Avoid trivially short matches
  const scored: { icon: IconifySearchResult; score: number }[] = [];
  const otherIcons: IconifySearchResult[] = [];

  for (const icon of icons) {
    const normalizedName = icon.name.toLowerCase().replace(/[-_\s]/g, '');
    let score = 0;

    if (normalizedName === normalizedMissing) {
      score = 100; // Exact match
    } else if (normalizedName.startsWith(normalizedMissing) && normalizedMissing.length >= minMatchLength) {
      score = 80; // Icon name starts with our search
    } else if (normalizedMissing.startsWith(normalizedName) && normalizedName.length >= minMatchLength && normalizedName.length >= normalizedMissing.length * 0.5) {
      score = 60; // Our search starts with icon name, but only if icon name is at least 50% of the length
    } else if (normalizedName.includes(normalizedMissing) && normalizedMissing.length >= minMatchLength) {
      score = 40; // Icon name contains our search term
    }

    if (score > 0) {
      scored.push({ icon, score });
    } else {
      otherIcons.push(icon);
    }
  }

  // Sort best matches by score (highest first), then alphabetically
  scored.sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name));
  const bestMatches = scored.map(s => s.icon);

  const renderCard = (icon: IconifySearchResult, highlight = false) => `
    <div class="icon-card${highlight ? ' best-match-card' : ''}" data-prefix="${icon.prefix}" data-name="${icon.name}">
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
    </div>`;

  // Show sections only when there's a split to show
  const hasSplit = bestMatches.length > 0 && otherIcons.length > 0;

  const bestMatchSection = bestMatches.length > 0 ? `
    <div class="section-header">
      <h2>🎯 Best match</h2>
      <span class="section-count">${bestMatches.length}${hasSplit ? ` · ${Math.round((bestMatches.length / icons.length) * 100)}%` : ''}</span>
    </div>
    <div class="grid best-match-grid">
      ${bestMatches.map(icon => renderCard(icon, true)).join('')}
    </div>
    ${hasSplit ? '<div class="section-divider"></div>' : ''}
  ` : '';

  const otherSection = otherIcons.length > 0 ? `
    ${hasSplit ? `
    <div class="section-header">
      <h2>🌐 Iconify</h2>
      <span class="section-count">${otherIcons.length} · ${Math.round((otherIcons.length / icons.length) * 100)}%</span>
    </div>` : ''}
    <div class="grid">
      ${otherIcons.map(icon => renderCard(icon)).join('')}
    </div>
  ` : '';

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
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .section-header h2 {
      font-size: 1rem;
      font-weight: 600;
    }
    .section-count {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }
    .section-divider {
      border-top: 1px solid var(--vscode-input-border);
      margin: 24px 0;
    }
    .built-grid {
      margin-bottom: 8px;
    }
    .built-card {
      border-color: rgba(0, 120, 212, 0.3);
    }
    .built-preview {
      background: var(--vscode-editor-background);
      border-radius: 6px;
      padding: 4px;
    }
    .built-preview svg {
      width: 100%;
      height: 100%;
    }
    .built-label {
      color: var(--vscode-charts-blue) !important;
      font-weight: 500;
    }
    .built-btn {
      background: rgba(0, 120, 212, 0.15) !important;
      color: var(--vscode-foreground) !important;
      border: 1px solid rgba(0, 120, 212, 0.3) !important;
    }
    .built-btn:hover {
      background: rgba(0, 120, 212, 0.25) !important;
    }
    .best-match-card {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.06);
    }
    .best-match-card:hover {
      border-color: rgba(16, 185, 129, 0.6);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
    }
    .best-match-grid {
      margin-bottom: 8px;
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

  ${builtIconsSection}

  ${bestMatchSection}

  ${otherSection}

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

    function selectBuiltIcon(name, svg) {
      vscode.postMessage({ command: 'selectBuiltIcon', name, svg });
    }

    // Attach click handlers to built icon cards
    document.querySelectorAll('.built-card').forEach(card => {
      const btn = card.querySelector('.built-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const name = card.dataset.builtName;
          const svg = decodeURIComponent(card.dataset.builtSvg);
          selectBuiltIcon(name, svg);
        });
      }
    });

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

  // Command: Search icons (Iconify) — accepts optional pre-filled query
  const searchIconsCmd = vscode.commands.registerCommand(
    'masterSVG.searchIcons',
    async (query?: string) => {
      const searchTerm =
        query ||
        (await vscode.window.showInputBox({
          prompt: t('ui.prompts.searchIconifyFull'),
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

  // Command: searchIconify — alias for searchIcons (backward compatibility for hover links)
  const searchIconifyCmd = vscode.commands.registerCommand(
    'masterSVG.searchIconify',
    async (query?: string) => {
      await vscode.commands.executeCommand('masterSVG.searchIcons', query);
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

        if (selectedIcon.prefix === 'built') {
          // Built icon selected - already exists, just update reference
          finalIconName = selectedIcon.name;
          svgContent = selectedIcon.svg;
          // Skip build since icon already exists
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
              console.error('Failed to update reference:', updateError);
            }
          }
          vscode.window.showInformationMessage(
            t('messages.iconTransformed', { name: finalIconName, component: config.webComponentName || 'svg-icon' })
          );
          workspaceSvgProvider.softRefresh();
          return;
        }

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
        suggestedQuery || query,
        builtIconsProvider.getBuiltIconsList()
      );

      if (!selectedIcon) return;

      if (selectedIcon.prefix === 'built') {
        // Built icon selected - already exists, just update reference
        const finalIconName = selectedIcon.name;
        if (sourceFile && line !== undefined) {
          try {
            const document = await vscode.workspace.openTextDocument(sourceFile);
            const lineText = document.lineAt(line).text;
            const newText = lineText.replace(
              new RegExp(`name=["']${suggestedQuery || query}["']`, 'g'),
              `name="${finalIconName}"`
            );
            if (newText !== lineText) {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
              await vscode.workspace.applyEdit(edit);
            }
          } catch (updateError) {
            console.error('Failed to update reference:', updateError);
          }
        }
        vscode.window.showInformationMessage(
          t('messages.iconTransformed', { name: finalIconName, component: componentName })
        );
        workspaceSvgProvider.softRefresh();
        builtIconsProvider.refresh();
        return;
      }

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

  // Command: Suggest icons based on context and colors
  const suggestIconsCmd = vscode.commands.registerCommand(
    'masterSVG.suggestIcons',
    async () => {
      // 1) Extract semantic context from project (auto-detect)
      let autoKeywords: string[] = [];
      const useAutoContext = await vscode.window.showQuickPick(
        [
          { label: '$(search) Auto-detect project context', value: 'auto' },
          { label: '$(edit) Enter keywords manually only', value: 'manual' },
        ],
        { placeHolder: t('ui.placeholders.contextSource') || 'How do you want to provide context keywords?' }
      );
      if (!useAutoContext) return;

      if (useAutoContext.value === 'auto') {
        autoKeywords = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: t('messages.scanningContext') || 'Scanning project for context…' },
          () => extractProjectContext(10)
        );
        if (autoKeywords.length > 0) {
          // Let user confirm / edit detected context
          const confirmed = await vscode.window.showInputBox({
            prompt: t('ui.prompts.confirmContext') || 'Detected context keywords (edit if needed, comma-separated)',
            value: autoKeywords.join(', '),
          });
          if (!confirmed) return;
          autoKeywords = confirmed.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        }
      }

      // 2) Ask for additional context tags
      const tagsInput = await vscode.window.showInputBox({
        prompt: autoKeywords.length > 0
          ? (t('ui.prompts.additionalTags') || 'Additional keywords? (optional, comma-separated)')
          : (t('ui.prompts.enterContextTags') || 'Enter context keywords (comma-separated, e.g. clinic, health, dashboard)'),
        placeHolder: 'clinic, health, dashboard',
      });
      const manualTags = tagsInput
        ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

      const contextTags = Array.from(new Set([...autoKeywords, ...manualTags]));

      if (contextTags.length === 0) {
        vscode.window.showWarningMessage(
          t('messages.noContextTags') || 'No context keywords provided. At least one is required.'
        );
        return;
      }

      // 3) Optionally gather colors for preview tinting
      let colors: string[] = [];
      const wantColors = await vscode.window.showQuickPick(
        [
          { label: '$(color-mode) Auto-detect palette', value: 'auto' },
          { label: '$(edit) Enter colors manually', value: 'manual' },
          { label: '$(close) Skip colors', value: 'skip' },
        ],
        { placeHolder: t('ui.placeholders.colorSource') || 'Colors for preview? (optional)' }
      );

      if (wantColors?.value === 'auto') {
        colors = await extractProjectPalette(30);
      } else if (wantColors?.value === 'manual') {
        const colorInput = await vscode.window.showInputBox({
          prompt: t('ui.prompts.enterColors') || 'Enter colors (comma-separated hex, e.g. #0b66ff, #ffffff)',
          placeHolder: '#0b66ff, #ffffff',
        });
        if (colorInput) {
          colors = colorInput
            .split(',')
            .map(c => c.trim())
            .filter(c => /^#?[0-9a-fA-F]{3,6}$/.test(c))
            .map(c => (c.startsWith('#') ? c : `#${c}`));
        }
      }

      // 4) Fetch suggestions with progress (API only, no UI)
      const provider = new IconifySuggestionProvider();
      const suggestions = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('messages.suggestingIcons') || 'Suggesting icons…',
          cancellable: false,
        },
        () => provider.suggest({ colors, contextTags, limit: 20 })
      );

      if (suggestions.length === 0) {
        vscode.window.showInformationMessage(
          t('messages.noSuggestionsFound') || 'No icon suggestions found for your criteria.'
        );
        return;
      }

      // 5) Show QuickPick with results (interactive, no progress overlay)
      const items: (vscode.QuickPickItem & { suggestion: IconSuggestion })[] = suggestions.map(s => ({
        label: `$(symbol-misc) ${s.prefix}:${s.name}`,
        description: `Score: ${Math.round((s.score ?? 0) * 100)}%`,
        detail: [
          s.collection ? `Collection: ${s.collection}` : '',
          s.license ? `License: ${s.license}` : '',
          s.tags?.length ? `Tags: ${s.tags.join(', ')}` : '',
          s.matchingColors?.length ? `Colors: ${s.matchingColors.slice(0, 5).join(', ')}` : '',
          s.ariaLabel ? `Aria: ${s.ariaLabel}` : '',
        ].filter(Boolean).join('  |  '),
        suggestion: s,
      }));

      const picked = await vscode.window.showQuickPick(items, {
        title: t('ui.titles.suggestedIcons') || 'Suggested Icons',
        placeHolder: t('ui.placeholders.selectSuggestedIcon') || 'Select an icon to insert or copy',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!picked) return;

      // 6) Action on selection
      const action = await vscode.window.showQuickPick(
        [
          { label: '$(insert) Insert SVG inline', value: 'insert' },
          { label: '$(clippy) Copy SVG to clipboard', value: 'copy' },
          { label: '$(add) Add to project icons', value: 'add' },
        ],
        { placeHolder: t('ui.placeholders.chooseAction') || 'What do you want to do with this icon?' }
      );

      if (!action) return;

      const svg = picked.suggestion.previewSvg || (await fetchIconSvg(picked.suggestion.prefix, picked.suggestion.name));

      if (!svg) {
        vscode.window.showErrorMessage(
          t('messages.failedToFetchSvg') || 'Failed to fetch SVG content.'
        );
        return;
      }

      switch (action.value) {
        case 'insert': {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            await editor.edit(editBuilder => {
              editBuilder.insert(editor.selection.active, svg);
            });
          }
          break;
        }
        case 'copy': {
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage(
            t('messages.svgCopied') || 'SVG copied to clipboard.'
          );
          break;
        }
        case 'add': {
          const iconName = picked.suggestion.name;
          const config = getConfig();
          const isSprite = config.buildFormat === 'sprite.svg';
          const outputPath = getOutputPathOrWarn();
          if (!outputPath) return;

          // Optimize SVG using SvgOptimizer before adding
          const optimizer = new SvgOptimizer();
          const optimized = optimizer.optimize(svg);

          if (isSprite) {
            await addToSpriteSvg(outputPath, iconName, optimized.svg, svgTransformer);
          } else {
            await addToIconsJs({
              outputPath,
              iconName,
              svgContent: optimized.svg,
              transformer: svgTransformer,
            });
          }
          workspaceSvgProvider.refresh();
          builtIconsProvider.refresh();
          const savedBytes = optimized.savings ?? 0;
          const savedPct = typeof optimized.savingsPercent === 'number' ? optimized.savingsPercent.toFixed(1) : '0.0';
          vscode.window.showInformationMessage(
            t('messages.iconAdded', { name: iconName }) ||
              `Icon "${iconName}" added to project — saved ${savedBytes} bytes (${savedPct}%).`
          );
          break;
        }
      }
    }
  );

  context.subscriptions.push(
    searchIconsCmd,
    searchIconifyCmd,
    importIconCmd,
    searchIconifyForComponentCmd,
    browseWorkspaceIconsCmd,
    importMissingIconCmd,
    suggestIconsCmd
  );
}

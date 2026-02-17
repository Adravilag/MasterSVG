/**
 * Icon Picker HTML Generator
 * Pure functions for generating the icon picker webview HTML
 */

import {
  IconifySearchResult,
  ColorPreset as CentralizedColorPreset,
  PopularCollection as CentralizedPopularCollection,
} from '../services/types/mastersvgTypes';

// Re-export for backwards compatibility
export type IconSearchResult = IconifySearchResult;
export type ColorPreset = CentralizedColorPreset;
export type PopularCollection = CentralizedPopularCollection;

export const DEFAULT_COLOR_PRESETS: ColorPreset[] = [
  { color: '#ffffff', title: 'White' },
  { color: '#000000', title: 'Black' },
  { color: '#3b82f6', title: 'Blue' },
  { color: '#10b981', title: 'Green' },
  { color: '#f59e0b', title: 'Orange' },
  { color: '#ef4444', title: 'Red' },
  { color: '#8b5cf6', title: 'Purple' },
  { color: '#ec4899', title: 'Pink' },
];

export const POPULAR_COLLECTIONS: PopularCollection[] = [
  { prefix: 'mdi', name: 'Material Design Icons', total: 7000 },
  { prefix: 'lucide', name: 'Lucide', total: 1500 },
  { prefix: 'heroicons', name: 'Heroicons', total: 300 },
  { prefix: 'tabler', name: 'Tabler Icons', total: 5000 },
  { prefix: 'ph', name: 'Phosphor', total: 9000 },
  { prefix: 'ri', name: 'Remix Icon', total: 2800 },
  { prefix: 'carbon', name: 'Carbon', total: 2000 },
  { prefix: 'fluent', name: 'Fluent UI', total: 4500 },
  { prefix: 'ic', name: 'Google Material', total: 2500 },
  { prefix: 'bi', name: 'Bootstrap Icons', total: 2000 },
];

/**
 * Escape special characters for HTML attributes
 */
export function escapeHtmlAttribute(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generate a single icon card HTML
 */
export function generateIconCard(icon: IconSearchResult, previewColor: string = '#ffffff'): string {
  const escapedName = escapeHtmlAttribute(icon.name);
  const escapedPrefix = escapeHtmlAttribute(icon.prefix);
  const encodedColor = encodeURIComponent(previewColor);

  return `
    <div class="icon-card" data-prefix="${escapedPrefix}" data-name="${escapedName}">
      <div class="icon-preview">
        <img src="https://api.iconify.design/${escapedPrefix}/${escapedName}.svg?color=${encodedColor}" alt="${escapedName}" />
      </div>
      <div class="icon-info">
        <span class="icon-name">${escapedName}</span>
        <span class="icon-prefix">${escapedPrefix}</span>
      </div>
      <button class="add-btn" onclick="addIcon('${escapedPrefix}', '${escapedName}')">
        + Add
      </button>
    </div>`;
}

/**
 * Generate all icon cards HTML
 */
export function generateIconCards(
  icons: IconSearchResult[],
  previewColor: string = '#ffffff'
): string {
  return icons.map(icon => generateIconCard(icon, previewColor)).join('');
}

/**
 * Generate color preset button HTML
 */
export function generateColorPresetButton(preset: ColorPreset, isActive: boolean = false): string {
  const activeClass = isActive ? ' active' : '';
  return `<button class="color-preset${activeClass}" style="background: ${preset.color}" data-color="${preset.color}" title="${preset.title}"></button>`;
}

/**
 * Generate color presets HTML
 */
export function generateColorPresets(
  presets: ColorPreset[] = DEFAULT_COLOR_PRESETS,
  activeColor: string = '#ffffff'
): string {
  return presets
    .map(preset => generateColorPresetButton(preset, preset.color === activeColor))
    .join('\n      ');
}

/**
 * Get CSS styles for the icon picker
 */
export function getIconPickerStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .close-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .close-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .search-container {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search-input-wrapper {
      flex: 1;
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 10px 16px 10px 40px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--vscode-descriptionForeground);
      width: 16px;
      height: 16px;
    }
    .label-icon {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      margin-right: 4px;
    }
    .search-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }
    .search-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .search-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .collections-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    .collections-bar-title {
      width: 100%;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .collection-chip {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border: 1px solid transparent;
      padding: 4px 10px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
    }
    .collection-chip:hover {
      background: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
    }
    .collection-chip.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-focusBorder);
    }
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
    .color-preset:hover {
      transform: scale(1.15);
    }
    .color-preset.active {
      border-color: var(--vscode-focusBorder);
    }
    .results-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .loading {
      display: none;
      align-items: center;
      gap: 8px;
      color: var(--vscode-descriptionForeground);
    }
    .loading.show {
      display: flex;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
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
    .icon-card.added {
      border-color: var(--vscode-charts-green);
      background: var(--vscode-diffEditor-insertedTextBackground);
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
      font-size: 12px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 120px;
    }
    .icon-prefix {
      display: block;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .add-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .add-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .add-btn.added {
      background: var(--vscode-charts-green);
      cursor: default;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state-icon {
      margin-bottom: 16px;
      display: flex;
      justify-content: center;
    }
    .empty-state-icon svg {
      opacity: 0.5;
    }
    .empty-state-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--vscode-foreground);
      margin-bottom: 8px;
    }
    .empty-state-text {
      font-size: 13px;
    }`;
}

/**
 * Get JavaScript for the icon picker
 */
export function getIconPickerScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    let currentColor = '#ffffff';
    let currentQuery = '';
    let currentCollection = '';
    let isSearching = false;

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

    function showLoading(show) {
      isSearching = show;
      document.getElementById('loading').classList.toggle('show', show);
      document.getElementById('searchBtn').disabled = show;
    }

    function doSearch(query, collection) {
      if (!query && !collection) return;
      if (isSearching) return;

      currentQuery = query || '';
      currentCollection = collection || '';

      showLoading(true);
      vscode.postMessage({
        command: 'search',
        query: currentQuery,
        collection: currentCollection
      });
    }

    function selectCollection(prefix) {
      document.querySelectorAll('.collection-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.prefix === prefix);
      });
      currentCollection = prefix;
      const searchInput = document.getElementById('searchInput');
      doSearch(searchInput.value, prefix);
    }

    function updateGrid(icons, query) {
      showLoading(false);
      const grid = document.getElementById('iconGrid');
      const subtitle = document.getElementById('subtitle');
      const encodedColor = encodeURIComponent(currentColor);

      if (icons.length === 0) {
        grid.innerHTML = \`
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon"><svg viewBox="0 0 24 24" width="48" height="48"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg></div>
            <div class="empty-state-title">No icons found</div>
            <div class="empty-state-text">Try a different search term or browse a collection</div>
          </div>
        \`;
        subtitle.textContent = 'No results';
        return;
      }

      grid.innerHTML = icons.map(icon => \`
        <div class="icon-card" data-prefix="\${icon.prefix}" data-name="\${icon.name}">
          <div class="icon-preview">
            <img src="https://api.iconify.design/\${icon.prefix}/\${icon.name}.svg?color=\${encodedColor}" alt="\${icon.name}" loading="lazy" />
          </div>
          <div class="icon-info">
            <span class="icon-name">\${icon.name}</span>
            <span class="icon-prefix">\${icon.prefix}</span>
          </div>
          <button class="add-btn" onclick="addIcon('\${icon.prefix}', '\${icon.name}')">
            + Add
          </button>
        </div>
      \`).join('');

      subtitle.textContent = \`Found \${icons.length} icons\${query ? ' for "' + query + '"' : ''}\`;
    }

    // Event listeners
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      updateIconColors(e.target.value);
    });

    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        updateIconColors(btn.dataset.color);
      });
    });

    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        doSearch(e.target.value, currentCollection);
      }
    });

    document.getElementById('searchBtn').addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      doSearch(searchInput.value, currentCollection);
    });

    document.querySelectorAll('.collection-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectCollection(chip.dataset.prefix);
      });
    });

    document.getElementById('closeBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'close' });
    });

    function addIcon(prefix, name) {
      vscode.postMessage({ command: 'selectIcon', prefix, name, color: currentColor });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'updateResults') {
        updateGrid(message.icons, message.query);
      } else if (message.command === 'iconAdded') {
        const card = document.querySelector(\`.icon-card[data-prefix="\${message.prefix}"][data-name="\${message.name}"]\`);
        if (card) {
          card.classList.add('added');
          const btn = card.querySelector('.add-btn');
          btn.textContent = '✓ Added';
          btn.classList.add('added');
          btn.onclick = null;
        }
      }
    });`;
}

/**
 * Generate toolbar HTML with color picker
 */
export function generateToolbarHtml(activeColor: string = '#ffffff'): string {
  return `
  <div class="toolbar">
    <label>
      <svg class="label-icon" viewBox="0 0 24 24"><path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 0 1 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z" fill="currentColor"/><circle cx="6.5" cy="11.5" r="1.5" fill="currentColor"/><circle cx="9.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="14.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="17.5" cy="11.5" r="1.5" fill="currentColor"/></svg>
      Color:
      <input type="color" id="colorPicker" class="color-picker" value="${activeColor}" />
    </label>
    <div class="color-presets">
      ${generateColorPresets(DEFAULT_COLOR_PRESETS, activeColor)}
    </div>
    <span style="color: var(--vscode-descriptionForeground); font-size: 12px;">
      (Color for monochrome icons only)
    </span>
  </div>`;
}

/**
 * Generate search bar HTML
 */
export function generateSearchBarHtml(query: string = ''): string {
  const escapedQuery = escapeHtmlAttribute(query);
  return `
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
      <input type="text" id="searchInput" class="search-input" value="${escapedQuery}" placeholder="Search icons..." autofocus />
    </div>
    <button id="searchBtn" class="search-btn">Search</button>
  </div>`;
}

/**
 * Generate collection chips HTML
 */
export function generateCollectionsBar(
  collections: PopularCollection[] = POPULAR_COLLECTIONS,
  activePrefix: string = ''
): string {
  const chips = collections
    .map(col => {
      const isActive = col.prefix === activePrefix;
      return `<button class="collection-chip${isActive ? ' active' : ''}" data-prefix="${col.prefix}">${col.name}</button>`;
    })
    .join('\n      ');

  return `
  <div class="collections-bar">
    <div class="collections-bar-title">Popular Collections</div>
    ${chips}
  </div>`;
}

/**
 * Generate complete icon picker HTML
 */
export function getIconPickerHtml(
  icons: IconSearchResult[],
  query: string,
  previewColor: string = '#ffffff'
): string {
  const escapedQuery = escapeHtmlAttribute(query);
  const iconCards = generateIconCards(icons, previewColor);
  const styles = getIconPickerStyles();
  const script = getIconPickerScript();
  const toolbar = generateToolbarHtml(previewColor);
  const searchBar = generateSearchBarHtml(query);
  const collectionsBar = generateCollectionsBar();

  const gridContent =
    icons.length > 0
      ? iconCards
      : `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" width="48" height="48"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg></div>
      <div class="empty-state-title">No icons found</div>
      <div class="empty-state-text">Try a different search term or browse a collection</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Icon Picker</title>
  <style>${styles}</style>
</head>
<body>
  <div class="header">
    <h1><svg class="header-icon" viewBox="0 0 24 24"><path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 0 1 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z" fill="currentColor"/><circle cx="6.5" cy="11.5" r="1.5" fill="currentColor"/><circle cx="9.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="14.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="17.5" cy="11.5" r="1.5" fill="currentColor"/></svg> Iconify Browser</h1>
    <button id="closeBtn" class="close-btn">Close</button>
  </div>

  ${searchBar}
  ${collectionsBar}
  ${toolbar}

  <div class="results-info">
    <p id="subtitle" class="subtitle">Found ${icons.length} icons${query ? ` for "${escapedQuery}"` : ''}</p>
    <div id="loading" class="loading">
      <div class="spinner"></div>
      <span>Searching...</span>
    </div>
  </div>

  <div id="iconGrid" class="grid">
    ${gridContent}
  </div>

  <script>${script}</script>
</body>
</html>`;
}

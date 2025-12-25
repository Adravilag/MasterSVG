/**
 * Utility functions for icon picker panel HTML generation
 * Extracted from extension.ts for better testability
 */

export interface IconPickerIcon {
  prefix: string;
  name: string;
}

/**
 * Color preset for icon picker
 */
export interface ColorPreset {
  color: string;
  name: string;
}

/**
 * Default color presets for the icon picker
 */
export const DEFAULT_COLOR_PRESETS: ColorPreset[] = [
  { color: '#ffffff', name: 'White' },
  { color: '#000000', name: 'Black' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#10b981', name: 'Green' },
  { color: '#f59e0b', name: 'Orange' },
  { color: '#ef4444', name: 'Red' },
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
];

/**
 * Encode a color value for use in URLs
 */
export function encodeColorForUrl(color: string): string {
  return encodeURIComponent(color);
}

/**
 * Create an icon preview URL from Iconify API
 */
export function createIconifyPreviewUrl(
  prefix: string,
  name: string,
  color: string = '#ffffff'
): string {
  const encodedColor = encodeColorForUrl(color);
  return `https://api.iconify.design/${prefix}/${name}.svg?color=${encodedColor}`;
}

/**
 * Escape special characters for HTML attributes
 */
export function escapeForHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generate an icon card HTML element
 */
export function generateIconCard(
  icon: IconPickerIcon,
  previewColor: string = '#ffffff'
): string {
  const escapedPrefix = escapeForHtmlAttribute(icon.prefix);
  const escapedName = escapeForHtmlAttribute(icon.name);
  const previewUrl = createIconifyPreviewUrl(icon.prefix, icon.name, previewColor);

  return `
    <div class="icon-card" data-prefix="${escapedPrefix}" data-name="${escapedName}">
      <div class="icon-preview">
        <img src="${previewUrl}" alt="${escapedName}" />
      </div>
      <div class="icon-info">
        <span class="icon-name">${escapedName}</span>
        <span class="icon-prefix">${escapedPrefix}</span>
      </div>
      <button class="add-btn" onclick="addIcon('${escapedPrefix}', '${escapedName}')">
        + Add
      </button>
    </div>
  `;
}

/**
 * Generate multiple icon cards
 */
export function generateIconCards(
  icons: IconPickerIcon[],
  previewColor: string = '#ffffff'
): string {
  return icons.map(icon => generateIconCard(icon, previewColor)).join('');
}

/**
 * Generate a color preset button HTML
 */
export function generateColorPresetButton(
  preset: ColorPreset,
  isActive: boolean = false
): string {
  const activeClass = isActive ? ' active' : '';
  return `<button class="color-preset${activeClass}" style="background: ${preset.color}" data-color="${preset.color}" title="${preset.name}"></button>`;
}

/**
 * Generate all color preset buttons
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
 * Get icon picker CSS styles
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
    h1 {
      font-size: 1.5rem;
      margin-bottom: 10px;
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
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
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
  `;
}

/**
 * Get icon picker JavaScript code
 */
export function getIconPickerScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    let currentColor = '#ffffff';
    
    function updateIconColors(color) {
      currentColor = color;
      const encodedColor = encodeURIComponent(color);
      document.querySelectorAll('.icon-preview img').forEach(img => {
        const src = img.src;
        // Update color parameter in URL
        img.src = src.replace(/color=[^&]*/, 'color=' + encodedColor);
      });
      
      // Update active preset
      document.querySelectorAll('.color-preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
      
      document.getElementById('colorPicker').value = color;
    }
    
    // Color picker change
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      updateIconColors(e.target.value);
    });
    
    // Color preset buttons
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        updateIconColors(btn.dataset.color);
      });
    });
    
    function addIcon(prefix, name) {
      vscode.postMessage({ command: 'addIcon', prefix, name, color: currentColor });
    }
    
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'iconAdded') {
        const card = document.querySelector(\`.icon-card[data-prefix="\${message.prefix}"][data-name="\${message.name}"]\`);
        if (card) {
          card.classList.add('added');
          const btn = card.querySelector('.add-btn');
          btn.textContent = '✓ Added';
          btn.classList.add('added');
          btn.onclick = null;
        }
      }
    });
  `;
}

/**
 * Generate the toolbar HTML for the icon picker
 */
export function generateToolbarHtml(
  presets: ColorPreset[] = DEFAULT_COLOR_PRESETS,
  activeColor: string = '#ffffff'
): string {
  const colorPresetsHtml = generateColorPresets(presets, activeColor);
  
  return `
  <div class="toolbar">
    <label>
      🎨 Color:
      <input type="color" id="colorPicker" class="color-picker" value="${activeColor}" />
    </label>
    <div class="color-presets">
      ${colorPresetsHtml}
    </div>
    <span style="color: var(--vscode-descriptionForeground); font-size: 12px;">
      (Color for monochrome icons only)
    </span>
  </div>
  `;
}

/**
 * Generate complete icon picker HTML
 */
export function generateIconPickerHtml(
  icons: IconPickerIcon[],
  query: string,
  previewColor: string = '#ffffff'
): string {
  const escapedQuery = escapeForHtmlAttribute(query);
  const styles = getIconPickerStyles();
  const iconCards = generateIconCards(icons, previewColor);
  const toolbar = generateToolbarHtml(DEFAULT_COLOR_PRESETS, previewColor);
  const script = getIconPickerScript();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Icon Picker</title>
  <style>${styles}</style>
</head>
<body>
  <h1>🔍 Search Results for "${escapedQuery}"</h1>
  ${toolbar}
  <p class="subtitle">Found ${icons.length} icons. Click "Add" to add to your library.</p>
  <div class="grid">
    ${iconCards}
  </div>
  <script>${script}</script>
</body>
</html>`;
}

/**
 * Parse icon ID string (prefix:name) into components
 */
export function parseIconId(iconId: string): IconPickerIcon | null {
  const [prefix, name] = iconId.split(':');
  if (prefix && name) {
    return { prefix, name };
  }
  return null;
}

/**
 * Format icon components into icon ID string
 */
export function formatIconId(prefix: string, name: string): string {
  return `${prefix}:${name}`;
}

/**
 * Generate the combined icon name for saving
 */
export function generateCombinedIconName(prefix: string, name: string): string {
  return `${prefix}-${name}`;
}

/**
 * Filter icons by prefix
 */
export function filterIconsByPrefix(
  icons: IconPickerIcon[],
  prefix: string
): IconPickerIcon[] {
  return icons.filter(icon => icon.prefix === prefix);
}

/**
 * Get unique prefixes from icons
 */
export function getUniquePrefixes(icons: IconPickerIcon[]): string[] {
  const prefixes = new Set(icons.map(icon => icon.prefix));
  return Array.from(prefixes).sort();
}

/**
 * Sort icons by name
 */
export function sortIconsByName(icons: IconPickerIcon[]): IconPickerIcon[] {
  return [...icons].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort icons by prefix then name
 */
export function sortIconsByPrefixAndName(icons: IconPickerIcon[]): IconPickerIcon[] {
  return [...icons].sort((a, b) => {
    const prefixCompare = a.prefix.localeCompare(b.prefix);
    if (prefixCompare !== 0) return prefixCompare;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Group icons by prefix
 */
export function groupIconsByPrefix(
  icons: IconPickerIcon[]
): Record<string, IconPickerIcon[]> {
  return icons.reduce((groups, icon) => {
    const key = icon.prefix;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(icon);
    return groups;
  }, {} as Record<string, IconPickerIcon[]>);
}

/**
 * Truncate icon display name if too long
 */
export function truncateIconName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.substring(0, maxLength - 1) + '…';
}

/**
 * Check if color is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Ensure color has # prefix
 */
export function normalizeHexColor(color: string): string {
  if (!color) return '#ffffff';
  if (color.startsWith('#')) return color;
  return `#${color}`;
}

/**
 * Check if icon matches search query
 */
export function iconMatchesQuery(
  icon: IconPickerIcon,
  query: string
): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    icon.name.toLowerCase().includes(lowerQuery) ||
    icon.prefix.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter icons by search query
 */
export function filterIconsByQuery(
  icons: IconPickerIcon[],
  query: string
): IconPickerIcon[] {
  if (!query.trim()) return icons;
  return icons.filter(icon => iconMatchesQuery(icon, query));
}

/**
 * Calculate grid columns based on container width
 */
export function calculateGridColumns(
  containerWidth: number,
  minColumnWidth: number = 140,
  gap: number = 16
): number {
  return Math.floor((containerWidth + gap) / (minColumnWidth + gap));
}

/**
 * Paginate icons array
 */
export function paginateIcons(
  icons: IconPickerIcon[],
  page: number,
  pageSize: number
): IconPickerIcon[] {
  const start = page * pageSize;
  return icons.slice(start, start + pageSize);
}

/**
 * Get total pages for pagination
 */
export function getTotalPages(
  totalIcons: number,
  pageSize: number
): number {
  return Math.ceil(totalIcons / pageSize);
}

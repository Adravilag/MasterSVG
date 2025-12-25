/**
 * Icon Picker HTML Generator
 * Pure functions for generating the icon picker webview HTML
 */

export interface IconSearchResult {
  prefix: string;
  name: string;
}

export interface ColorPreset {
  color: string;
  title: string;
}

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
export function generateIconCards(icons: IconSearchResult[], previewColor: string = '#ffffff'): string {
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
export function generateColorPresets(presets: ColorPreset[] = DEFAULT_COLOR_PRESETS, activeColor: string = '#ffffff'): string {
  return presets.map(preset => generateColorPresetButton(preset, preset.color === activeColor)).join('\n      ');
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
    }`;
}

/**
 * Get JavaScript for the icon picker
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
    });`;
}

/**
 * Generate toolbar HTML with color picker
 */
export function generateToolbarHtml(activeColor: string = '#ffffff'): string {
  return `
  <div class="toolbar">
    <label>
      🎨 Color:
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
 * Generate complete icon picker HTML
 */
export function getIconPickerHtml(icons: IconSearchResult[], query: string, previewColor: string = '#ffffff'): string {
  const escapedQuery = escapeHtmlAttribute(query);
  const iconCards = generateIconCards(icons, previewColor);
  const styles = getIconPickerStyles();
  const script = getIconPickerScript();
  const toolbar = generateToolbarHtml(previewColor);

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

/**
 * Utilities for webview generation and HTML helpers
 * Extracted from extension.ts for better testability
 */

/**
 * Standard color presets for icon customization
 */
export const WEBVIEW_COLOR_PRESETS = [
  { color: '#ffffff', name: 'White' },
  { color: '#000000', name: 'Black' },
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#84cc16', name: 'Lime' },
  { color: '#10b981', name: 'Emerald' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#6b7280', name: 'Gray' },
] as const;

/**
 * Animation keyframes CSS for icon animations
 */
export const ANIMATION_KEYFRAMES_CSS = `
  @keyframes icon-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes icon-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
  @keyframes icon-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes icon-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
  @keyframes icon-fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
`;

/**
 * Base CSS variables reference for VS Code webviews
 */
export const VSCODE_CSS_VARIABLES = {
  fontFamily: 'var(--vscode-font-family)',
  editorBackground: 'var(--vscode-editor-background)',
  foreground: 'var(--vscode-foreground)',
  inputBackground: 'var(--vscode-input-background)',
  inputBorder: 'var(--vscode-input-border)',
  buttonBackground: 'var(--vscode-button-background)',
  buttonForeground: 'var(--vscode-button-foreground)',
  buttonHoverBackground: 'var(--vscode-button-hoverBackground)',
  buttonSecondaryBackground: 'var(--vscode-button-secondaryBackground)',
  buttonSecondaryForeground: 'var(--vscode-button-secondaryForeground)',
  focusBorder: 'var(--vscode-focusBorder)',
  descriptionForeground: 'var(--vscode-descriptionForeground)',
  panelBorder: 'var(--vscode-panel-border)',
  badgeBackground: 'var(--vscode-badge-background)',
  chartsGreen: 'var(--vscode-charts-green)',
} as const;

/**
 * Escape special characters for safe HTML embedding
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape string for use in JavaScript template literals
 */
export function escapeTemplateString(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

/**
 * Escape string for use in JSON embedded in HTML
 */
export function escapeJsonForHtml(obj: any): string {
  return JSON.stringify(obj).replace(/'/g, "\\'").replace(/</g, '\\u003c');
}

/**
 * Generate a nonce for Content Security Policy
 */
export function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a basic button element HTML
 */
export function createButton(
  label: string,
  onclick: string,
  variant: 'primary' | 'secondary' = 'primary',
  icon?: string
): string {
  const iconHtml = icon ? `${icon} ` : '';
  return `<button class="btn btn-${variant}" onclick="${escapeHtml(onclick)}">${iconHtml}${escapeHtml(label)}</button>`;
}

/**
 * Create a color preset button HTML
 */
export function createColorPresetButton(
  color: string,
  isActive: boolean = false,
  title?: string
): string {
  const activeClass = isActive ? ' active' : '';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<button class="color-preset${activeClass}" style="background: ${color}" data-color="${color}"${titleAttr}></button>`;
}

/**
 * Generate color preset buttons grid HTML
 */
export function generateColorPresetsGrid(
  activeColor?: string,
  presets: readonly { color: string; name: string }[] = WEBVIEW_COLOR_PRESETS
): string {
  return presets
    .map(preset => createColorPresetButton(preset.color, preset.color === activeColor, preset.name))
    .join('\n');
}

/**
 * Create icon card HTML for icon picker
 */
export function createIconCard(
  prefix: string,
  name: string,
  color: string = '%23ffffff'
): string {
  const encodedColor = encodeURIComponent(color.replace('#', '%23'));
  return `
    <div class="icon-card" data-prefix="${escapeHtml(prefix)}" data-name="${escapeHtml(name)}">
      <div class="icon-preview">
        <img src="https://api.iconify.design/${prefix}/${name}.svg?color=${encodedColor}" alt="${escapeHtml(name)}" />
      </div>
      <div class="icon-info">
        <span class="icon-name">${escapeHtml(name)}</span>
        <span class="icon-prefix">${escapeHtml(prefix)}</span>
      </div>
      <button class="add-btn" onclick="addIcon('${escapeHtml(prefix)}', '${escapeHtml(name)}')">
        + Add
      </button>
    </div>
  `;
}

/**
 * Create checkerboard pattern CSS for transparent backgrounds
 */
export function getCheckerboardCss(size: number = 16): string {
  return `
    background: 
      linear-gradient(45deg, rgba(128,128,128,0.1) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(128,128,128,0.1) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.1) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.1) 75%);
    background-size: ${size}px ${size}px;
    background-position: 0 0, 0 ${size / 2}px, ${size / 2}px -${size / 2}px, -${size / 2}px 0;
  `;
}

/**
 * Build animation style string for an icon
 */
export function buildAnimationStyleInline(
  animName: string | null,
  duration: number = 1,
  timing: string = 'ease',
  iteration: string = 'infinite'
): string {
  if (!animName || animName === 'none') {
    return '';
  }
  return `animation: icon-${animName} ${duration}s ${timing} ${iteration};`;
}

/**
 * Create SVG wrapper with inline styles
 */
export function createSvgWrapper(
  body: string,
  viewBox: string,
  size: string = '1em',
  fill: string = 'currentColor',
  animStyle: string = ''
): string {
  const styleAttr = animStyle ? ` style="display: inline-block; vertical-align: middle; ${animStyle}"` : ' style="display: inline-block; vertical-align: middle;"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}" fill="${fill}"${styleAttr}>${body}</svg>`;
}

/**
 * Get standard webview base styles
 */
export function getBaseWebviewStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.1s;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
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
  `;
}

/**
 * Wrap content in basic HTML document structure
 */
export function wrapInHtmlDocument(
  title: string,
  styles: string,
  bodyContent: string,
  scripts: string = ''
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  ${bodyContent}
  ${scripts ? `<script>${scripts}</script>` : ''}
</body>
</html>`;
}

/**
 * Create vscode API script for webview communication
 */
export function getVscodeApiScript(): string {
  return `const vscode = acquireVsCodeApi();`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate unique ID for webview elements
 */
export function generateWebviewId(prefix: string = 'el'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse color from various formats to hex
 */
export function parseColorToHex(color: string): string | null {
  if (!color) return null;
  
  // Already hex
  if (/^#[0-9a-fA-F]{3,6}$/.test(color)) {
    if (color.length === 4) {
      // Expand #RGB to #RRGGBB
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color.toLowerCase();
  }
  
  // RGB format
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
  }
  
  return null;
}

/**
 * Create progress bar HTML
 */
export function createProgressBar(
  percent: number,
  showLabel: boolean = true,
  color: string = 'var(--vscode-progressBar-background)'
): string {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const labelHtml = showLabel ? `<span class="progress-label">${clampedPercent.toFixed(0)}%</span>` : '';
  return `
    <div class="progress-container" style="background: var(--vscode-input-background); border-radius: 4px; height: 8px; overflow: hidden;">
      <div class="progress-bar" style="width: ${clampedPercent}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
    </div>
    ${labelHtml}
  `;
}

/**
 * Create badge/tag HTML
 */
export function createBadge(
  text: string,
  variant: 'default' | 'success' | 'warning' | 'error' = 'default'
): string {
  const colorMap = {
    default: 'var(--vscode-badge-background)',
    success: 'var(--vscode-charts-green)',
    warning: 'var(--vscode-charts-yellow)',
    error: 'var(--vscode-charts-red)',
  };
  return `<span class="badge" style="background: ${colorMap[variant]}; color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 10px; font-size: 11px;">${escapeHtml(text)}</span>`;
}

/**
 * Create tooltip wrapper HTML
 */
export function createTooltip(content: string, tooltip: string): string {
  return `<span class="tooltip-wrapper" title="${escapeHtml(tooltip)}">${content}</span>`;
}

/**
 * Webview HTML Generators
 * Utility functions for generating HTML content for VS Code webview panels.
 * These are pure functions that can be easily tested without VS Code dependencies.
 */

import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface IconLocation {
  file: string;
  line: number;
}

export interface SavedStyle {
  id: number;
  svg: string;
  isPrimary: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const QUICK_COLORS: string[] = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

// ============================================================================
// Escape Functions
// ============================================================================

/**
 * Escape SVG content for embedding in template literals
 */
export function escapeSvgForTemplate(svg: string): string {
  return svg.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

/**
 * Escape string for JSON embedding
 */
export function escapeForJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape file path for JavaScript string
 */
export function escapeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ============================================================================
// Color Editor HTML Generator
// ============================================================================

/**
 * Generate Color Editor HTML page
 */
export function getColorEditorHtml(iconName: string, svg: string, filePath?: string, lineNumber?: number, savedStyles?: SavedStyle[]): string {
  const escapedSvg = escapeSvgForTemplate(svg);
  const canSave = filePath && lineNumber !== undefined;
  const shortPath = filePath ? path.basename(filePath) : '';
  const stylesJson = JSON.stringify(savedStyles || []).replace(/'/g, "\\'");
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Color Editor: ${escapeHtml(iconName)}</title>
  <style>
    ${getColorEditorStyles()}
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 Color Editor: ${escapeHtml(iconName)}</h1>
    ${canSave ? `<span class="source">📁 ${escapeHtml(shortPath)}:${lineNumber}</span>` : ''}
  </div>
  
  <div class="layout">
    <div class="preview-panel">
      <div class="preview-box" id="previewBox">
        ${svg}
      </div>
      <div class="actions" style="width: 100%; flex-direction: column;">
        ${canSave ? `<button class="btn btn-primary" onclick="saveSvg()">💾 Save to Source</button>` : ''}
        <button class="btn ${canSave ? 'btn-secondary' : 'btn-primary'}" onclick="copySvg()">📋 Copy SVG</button>
        <button class="btn btn-secondary" onclick="exportSvg()">📤 Export SVG</button>
        <button class="btn btn-secondary" onclick="resetColors()">↩️ Reset</button>
      </div>
    </div>
    
    <div class="colors-panel">
      <div class="saved-styles">
        <div class="saved-styles-header">
          <span class="section-title" style="margin-bottom: 0">Saved Styles</span>
        </div>
        <div class="saved-styles-list" id="savedStylesList"></div>
      </div>
      
      <div class="presets">
        <div class="section-title">Quick Colors</div>
        <div class="presets-grid">
          ${QUICK_COLORS.map(c => `<button class="preset" style="background: ${c}" onclick="applyToAll('${c}')"></button>`).join('\n          ')}
        </div>
      </div>
      
      <div class="apply-all">
        <label>Apply color to all fills & strokes</label>
        <div class="apply-all-row">
          <input type="color" id="globalColor" value="#3b82f6">
          <button class="btn btn-primary" onclick="applyToAll(document.getElementById('globalColor').value)">Apply to All</button>
        </div>
      </div>
      
      <div class="section-title">Individual Colors</div>
      <div class="color-list" id="colorList"></div>
    </div>
  </div>
  
  <script>
    ${getColorEditorScript(escapedSvg, iconName, filePath, lineNumber, stylesJson)}
  </script>
</body>
</html>`;
}

/**
 * Get Color Editor CSS styles
 */
export function getColorEditorStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 16px;
    }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .header h1 { font-size: 14px; font-weight: 600; flex: 1; }
    .header .source { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .layout { display: grid; grid-template-columns: 200px 1fr; gap: 20px; height: calc(100vh - 80px); }
    .preview-panel { position: sticky; top: 0; align-self: start; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .preview-box { width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; background: linear-gradient(45deg, rgba(128,128,128,0.1) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.1) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.1) 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0; border-radius: 8px; border: 1px solid var(--vscode-panel-border); }
    .preview-box svg { width: 96px; height: 96px; }
    .colors-panel { background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px; overflow-y: auto; max-height: calc(100vh - 80px); }
    .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
    .color-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .color-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--vscode-editor-background); border-radius: 4px; }
    .color-item .swatch { width: 32px; height: 32px; border-radius: 4px; border: 2px solid var(--vscode-panel-border); cursor: pointer; position: relative; }
    .color-item .swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
    .color-item .info { flex: 1; }
    .color-item .attr { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .color-item .value { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
    .color-item .count { font-size: 10px; color: var(--vscode-descriptionForeground); background: var(--vscode-badge-background); padding: 2px 6px; border-radius: 10px; }
    .presets { margin-bottom: 20px; }
    .presets-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .preset { width: 28px; height: 28px; border-radius: 4px; border: 2px solid transparent; cursor: pointer; transition: all 0.1s; }
    .preset:hover { transform: scale(1.1); border-color: var(--vscode-focusBorder); }
    .saved-styles { margin-bottom: 20px; padding: 12px; background: var(--vscode-editor-background); border-radius: 4px; }
    .saved-styles-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .saved-styles-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .style-item { position: relative; width: 48px; height: 48px; border-radius: 6px; border: 2px solid var(--vscode-panel-border); cursor: pointer; overflow: hidden; transition: all 0.15s; }
    .style-item:hover { border-color: var(--vscode-focusBorder); transform: scale(1.05); }
    .style-item.primary { border-color: var(--vscode-button-background); box-shadow: 0 0 0 2px var(--vscode-button-background); }
    .style-item svg { width: 100%; height: 100%; }
    .style-item .badge { position: absolute; top: 2px; right: 2px; font-size: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 1px 4px; border-radius: 3px; }
    .style-item .delete-btn { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: rgba(239, 68, 68, 0.9); color: white; border: none; cursor: pointer; font-size: 10px; line-height: 1; opacity: 0; transition: opacity 0.15s; }
    .style-item:hover .delete-btn { opacity: 1; }
    .add-style-btn { width: 48px; height: 48px; border-radius: 6px; border: 2px dashed var(--vscode-panel-border); background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 20px; transition: all 0.15s; }
    .add-style-btn:hover { border-color: var(--vscode-focusBorder); color: var(--vscode-foreground); }
    .actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border); }
    .btn { flex: 1; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.1s; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .apply-all { margin-bottom: 20px; padding: 12px; background: var(--vscode-editor-background); border-radius: 4px; }
    .apply-all label { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
    .apply-all-row { display: flex; gap: 8px; }
    .apply-all-row input[type="color"] { width: 40px; height: 32px; border: none; border-radius: 4px; cursor: pointer; }
    .apply-all-row button { flex: 1; }
  `;
}

/**
 * Get Color Editor JavaScript
 */
export function getColorEditorScript(escapedSvg: string, iconName: string, filePath?: string, lineNumber?: number, stylesJson?: string): string {
  const filePathStr = filePath ? `'${escapeFilePath(filePath)}'` : 'null';
  const lineNumberStr = lineNumber !== undefined ? String(lineNumber) : 'null';
  return `
    const vscode = acquireVsCodeApi();
    const originalSvg = \`${escapedSvg}\`;
    const iconName = '${escapeHtml(iconName)}';
    const filePath = ${filePathStr};
    const lineNumber = ${lineNumberStr};
    let colorMap = new Map();
    let savedStyles = JSON.parse('${stylesJson || '[]'}') || [];
    
    function normalizeColor(color) {
      if (!color || color === 'none' || color === 'currentColor') return null;
      const temp = document.createElement('div');
      temp.style.color = color;
      document.body.appendChild(temp);
      const computed = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      const match = computed.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
      if (match) return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      return color;
    }
    
    function detectColors() {
      const svg = document.querySelector('#previewBox svg');
      if (!svg) return [];
      const colors = new Map();
      
      // Helper to extract color from style string
      function extractStyleColor(styleStr, prop) {
        if (!styleStr) return null;
        const regex = new RegExp(prop + '\\\\s*:\\\\s*([^;]+)', 'i');
        const match = styleStr.match(regex);
        return match ? match[1].trim() : null;
      }
      
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          // Check attribute
          let val = el.getAttribute(attr);
          
          // Check inline style if no attribute
          if (!val || val === '') {
            const styleVal = extractStyleColor(el.getAttribute('style'), attr);
            if (styleVal) val = styleVal;
          }
          
          // Check computed style as fallback
          if (!val || val === '') {
            const computed = window.getComputedStyle(el);
            const computedVal = attr === 'fill' ? computed.fill : computed.stroke;
            if (computedVal && computedVal !== 'none' && computedVal !== 'rgba(0, 0, 0, 0)') {
              val = computedVal;
            }
          }
          
          if (val && val !== 'none' && val !== 'inherit' && val !== 'transparent') {
            const hex = normalizeColor(val);
            if (hex) {
              if (!colors.has(hex)) colors.set(hex, { fills: 0, strokes: 0, elements: [] });
              const data = colors.get(hex);
              if (attr === 'fill') data.fills++; else data.strokes++;
              data.elements.push({ el, attr });
            }
          }
        });
      });
      return Array.from(colors.entries());
    }
    
    function buildColorList() {
      const list = document.getElementById('colorList');
      const colors = detectColors();
      list.innerHTML = colors.map(([hex, data]) => {
        const total = data.fills + data.strokes;
        const details = [];
        if (data.fills) details.push(data.fills + ' fill' + (data.fills > 1 ? 's' : ''));
        if (data.strokes) details.push(data.strokes + ' stroke' + (data.strokes > 1 ? 's' : ''));
        colorMap.set(hex, hex);
        return \`<div class="color-item" data-original="\${hex}"><div class="swatch" style="background: \${hex}"><input type="color" value="\${hex}" oninput="changeColor('\${hex}', this.value)"></div><div class="info"><div class="value">\${hex}</div><div class="attr">\${details.join(', ')}</div></div><span class="count">\${total}</span></div>\`;
      }).join('');
    }
    
    function changeColor(original, newColor) {
      const svg = document.querySelector('#previewBox svg');
      if (!svg) return;
      const current = colorMap.get(original) || original;
      
      // Helper to extract color from style string
      function extractStyleColor(styleStr, prop) {
        if (!styleStr) return null;
        const regex = new RegExp(prop + '\\\\s*:\\\\s*([^;]+)', 'i');
        const match = styleStr.match(regex);
        return match ? match[1].trim() : null;
      }
      
      // Helper to update style property
      function updateStyleProp(el, prop, newVal) {
        let style = el.getAttribute('style') || '';
        const regex = new RegExp('(' + prop + '\\\\s*:\\\\s*)([^;]+)', 'i');
        if (regex.test(style)) {
          style = style.replace(regex, '$1' + newVal);
        } else {
          style = style + (style && !style.endsWith(';') ? ';' : '') + prop + ':' + newVal;
        }
        el.setAttribute('style', style);
      }
      
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          // Check attribute
          const attrVal = el.getAttribute(attr);
          if (attrVal && normalizeColor(attrVal) === current) {
            el.setAttribute(attr, newColor);
            return;
          }
          
          // Check inline style
          const styleVal = extractStyleColor(el.getAttribute('style'), attr);
          if (styleVal && normalizeColor(styleVal) === current) {
            updateStyleProp(el, attr, newColor);
            return;
          }
          
          // Check computed style (for inherited colors)
          const computed = window.getComputedStyle(el);
          const computedVal = attr === 'fill' ? computed.fill : computed.stroke;
          if (computedVal && normalizeColor(computedVal) === current) {
            el.setAttribute(attr, newColor);
          }
        });
      });
      colorMap.set(original, newColor);
      const item = document.querySelector(\`.color-item[data-original="\${original}"]\`);
      if (item) {
        const swatch = item.querySelector('.swatch');
        const valueEl = item.querySelector('.value');
        if (swatch) swatch.style.background = newColor;
        if (valueEl) valueEl.textContent = newColor;
      }
    }
    
    function applyToAll(color) {
      const svg = document.querySelector('#previewBox svg');
      if (!svg) return;
      
      // Helper to update style property
      function updateStyleProp(el, prop, newVal) {
        let style = el.getAttribute('style') || '';
        const regex = new RegExp('(' + prop + '\\\\s*:\\\\s*)([^;]+)', 'i');
        if (regex.test(style)) {
          style = style.replace(regex, '$1' + newVal);
          el.setAttribute('style', style);
        }
      }
      
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          // Check and update attribute
          const attrVal = el.getAttribute(attr);
          if (attrVal && attrVal !== 'none') {
            el.setAttribute(attr, color);
          }
          
          // Check and update inline style
          const style = el.getAttribute('style') || '';
          const regex = new RegExp(attr + '\\\\s*:\\\\s*([^;]+)', 'i');
          if (regex.test(style)) {
            updateStyleProp(el, attr, color);
          }
        });
      });
      if (!svg.querySelector('[fill]') && !svg.querySelector('[stroke]')) svg.setAttribute('fill', color);
      buildColorList();
    }
    
    function resetColors() { document.getElementById('previewBox').innerHTML = originalSvg; colorMap.clear(); buildColorList(); }
    function copySvg() { const svg = document.querySelector('#previewBox svg'); if (svg) vscode.postMessage({ command: 'copyModifiedSvg', svg: svg.outerHTML }); }
    function exportSvg() { const svg = document.querySelector('#previewBox svg'); if (svg) vscode.postMessage({ command: 'exportSvg', svg: svg.outerHTML, iconName: iconName }); }
    function saveSvg() { const svg = document.querySelector('#previewBox svg'); if (svg) vscode.postMessage({ command: 'saveSvg', svg: svg.outerHTML, filePath: filePath, lineNumber: lineNumber }); }
    function saveState() { vscode.postMessage({ command: 'saveStyles', iconName: iconName, styles: savedStyles }); }
    function renderSavedStyles() {
      const list = document.getElementById('savedStylesList');
      const stylesHtml = savedStyles.map((style, idx) => \`<div class="style-item \${style.isPrimary ? 'primary' : ''}" onclick="loadStyle(\${idx})" ondblclick="setPrimary(\${idx})" title="\${style.isPrimary ? '⭐ Primary' : 'Click to load'}">\${style.svg}\${style.isPrimary ? '<span class="badge">⭐</span>' : ''}<button class="delete-btn" onclick="event.stopPropagation(); deleteStyle(\${idx})">×</button></div>\`).join('');
      list.innerHTML = stylesHtml + '<button class="add-style-btn" onclick="saveCurrentStyle()" title="Save current style">+</button>';
    }
    function saveCurrentStyle() {
      const svg = document.querySelector('#previewBox svg');
      if (!svg) return;
      savedStyles.push({ id: Date.now(), svg: svg.outerHTML, isPrimary: savedStyles.length === 0 });
      saveState(); renderSavedStyles();
      vscode.postMessage({ command: 'showInfo', message: 'Style saved!' });
    }
    function loadStyle(idx) { const style = savedStyles[idx]; if (!style) return; document.getElementById('previewBox').innerHTML = style.svg; colorMap.clear(); buildColorList(); }
    function setPrimary(idx) { savedStyles.forEach((s, i) => s.isPrimary = (i === idx)); saveState(); renderSavedStyles(); vscode.postMessage({ command: 'showInfo', message: 'Primary style updated!' }); }
    function deleteStyle(idx) { const wasPrimary = savedStyles[idx]?.isPrimary; savedStyles.splice(idx, 1); if (wasPrimary && savedStyles.length > 0) savedStyles[0].isPrimary = true; saveState(); renderSavedStyles(); }
    buildColorList(); renderSavedStyles();
  `;
}

// ============================================================================
// Icon Details HTML Generator
// ============================================================================

/**
 * Generate Icon Details HTML page
 */
export function getIconDetailsHtml(iconName: string, svg: string, location?: IconLocation, isBuilt?: boolean): string {
  const escapedSvg = escapeSvgForTemplate(svg);
  const shortPath = location?.file ? path.basename(location.file) : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Details: ${escapeHtml(iconName)}</title>
  <style>
    ${getIconDetailsStyles()}
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 ${escapeHtml(iconName)}</h1>
    ${isBuilt ? '<span class="badge">Built-in</span>' : ''}
  </div>
  
  <div class="content">
    <div class="preview-section">
      <div class="preview-box">${svg}</div>
      <div class="actions">
        <button class="btn btn-primary" onclick="openColorEditor()">🎨 Edit Colors</button>
        <button class="btn btn-secondary" onclick="copyName()">📋 Copy Name</button>
        <button class="btn btn-secondary" onclick="copySvg()">📄 Copy SVG</button>
        <button class="btn btn-secondary" onclick="exportSvg()">📤 Export</button>
        ${location ? `<button class="btn btn-secondary" onclick="goToLocation()">📍 Go to Source</button>` : ''}
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escapeHtml(iconName)}</span></div>
      ${location ? `<div class="info-row"><span class="info-label">Location</span><span class="info-value"><a href="#" onclick="goToLocation(); return false;">${escapeHtml(shortPath)}:${location.line}</a></span></div>` : ''}
      <div class="info-row"><span class="info-label">Type</span><span class="info-value">${isBuilt ? 'Built-in Icon' : 'Workspace SVG'}</span></div>
      <div class="info-row"><span class="info-label">SVG Code</span></div>
      <div class="code-block">${escapeHtml(svg)}</div>
    </div>
  </div>
  
  <script>
    ${getIconDetailsScript(escapedSvg, iconName, location)}
  </script>
</body>
</html>`;
}

/**
 * Get Icon Details CSS styles
 */
export function getIconDetailsStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); background: var(--vscode-editor-background); color: var(--vscode-foreground); padding: 20px; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .header h1 { font-size: 16px; font-weight: 600; flex: 1; }
    .badge { font-size: 10px; padding: 3px 8px; border-radius: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .content { display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
    .preview-section { position: sticky; top: 0; align-self: start; }
    .preview-box { width: 180px; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(45deg, rgba(128,128,128,0.1) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.1) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.1) 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0; border-radius: 12px; border: 1px solid var(--vscode-panel-border); margin-bottom: 16px; }
    .preview-box svg { width: 120px; height: 120px; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.1s; text-align: center; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .info-section { background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px; }
    .info-row { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border); }
    .info-row:last-of-type { border-bottom: none; }
    .info-label { width: 80px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); }
    .info-value { flex: 1; font-size: 13px; }
    .info-value a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .info-value a:hover { text-decoration: underline; }
    .code-block { margin-top: 12px; padding: 12px; background: var(--vscode-editor-background); border-radius: 4px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
  `;
}

/**
 * Get Icon Details JavaScript
 */
export function getIconDetailsScript(escapedSvg: string, iconName: string, location?: IconLocation): string {
  return `
    const vscode = acquireVsCodeApi();
    const iconName = '${escapeHtml(iconName)}';
    const svg = \`${escapedSvg}\`;
    const location = ${location ? JSON.stringify(location) : 'null'};
    
    function copyName() { vscode.postMessage({ command: 'copyName', name: iconName }); }
    function copySvg() { vscode.postMessage({ command: 'copySvg', svg: svg }); }
    function exportSvg() { vscode.postMessage({ command: 'exportSvg', svg: svg, iconName: iconName }); }
    function goToLocation() { if (location) vscode.postMessage({ command: 'goToLocation', file: location.file, line: location.line }); }
    function openColorEditor() { vscode.postMessage({ command: 'openColorEditor', iconName: iconName }); }
  `;
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PreviewAnimation } from '../providers/IconPreviewProvider';

export interface PreviewTemplateOptions {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  isBuilt?: boolean;
  animation?: PreviewAnimation;
  isRasterized?: boolean;
  variants?: Array<{ name: string; colors: string[] }>;
}

/**
 * Service for generating HTML templates for the icon preview webview
 */
export class PreviewTemplateService {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Load CSS from external file
   */
  loadCss(): string {
    const cssPath = path.join(this.extensionUri.fsPath, 'src', 'templates', 'shared', 'IconPreview.css');
    return fs.readFileSync(cssPath, 'utf8');
  }

  /**
   * Generate empty state HTML
   */
  generateEmptyState(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="empty">
    <div class="icon">🎨</div>
    <div>Select an icon to preview</div>
  </div>
</body>
</html>`;
  }

  /**
   * Prepare SVG for display with proper sizing
   */
  prepareSvgForDisplay(svg: string, animation?: PreviewAnimation): string {
    let displaySvg = svg;
    
    // Add default sizing if needed
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }
    
    // Apply animation style if present
    if (animation && animation.type && animation.type !== 'none') {
      const duration = animation.duration || 1;
      const timing = animation.timing || 'ease';
      const iteration = animation.iteration || 'infinite';
      const delay = animation.delay || 0;
      const direction = animation.direction || 'normal';
      const animationStyle = `animation: icon-${animation.type} ${duration}s ${timing} ${delay}s ${iteration} ${direction};`;
      
      if (displaySvg.includes('style="')) {
        displaySvg = displaySvg.replace(/style="([^"]*)"/, `style="$1 ${animationStyle}"`);
      } else {
        displaySvg = displaySvg.replace('<svg', `<svg style="${animationStyle}"`);
      }
    }
    
    return displaySvg;
  }

  /**
   * Generate header section HTML
   */
  generateHeader(name: string, isBuilt?: boolean, isRasterized?: boolean): string {
    let badges = '';
    if (isBuilt !== undefined) {
      badges += `<span class="badge ${isBuilt ? 'built' : 'draft'}">${isBuilt ? 'Built' : 'Draft'}</span>`;
    }
    if (isRasterized) {
      badges += `<span class="badge rasterized" title="SVG has too many colors for editing">⚠</span>`;
    }
    
    return `<header class="header">
    <span class="icon-name" title="${name}">${name}</span>
    ${badges}
  </header>`;
  }

  /**
   * Generate variants bar HTML
   */
  generateVariantsBar(variants?: Array<{ name: string; colors: string[] }>): string {
    if (!variants || variants.length === 0) return '';
    
    // Limit to max 3 variants for compact display
    const maxVariants = 3;
    const displayVariants = variants.slice(0, maxVariants);
    const hasMore = variants.length > maxVariants;
    
    const swatches = displayVariants.map((v, i) => {
      const colorDots = v.colors.slice(0, 4).map(c => `<span style="background:${c}"></span>`).join('');
      return `<button class="variant-swatch ${i === 0 ? 'active' : ''}" data-index="${i}" title="${v.name}" onclick="applyVariant(${i})">
          <span class="variant-colors">${colorDots}</span>
        </button>`;
    }).join('');
    
    const moreIndicator = hasMore ? `<span class="variants-more" title="${variants.length - maxVariants} more variants">+${variants.length - maxVariants}</span>` : '';
    
    return `<div class="variants-bar" id="variantsPalette">
      ${swatches}${moreIndicator}
    </div>`;
  }

  /**
   * Generate toolbar HTML
   */
  generateToolbar(hasLocation: boolean, isRasterized?: boolean): string {
    const buttons: string[] = [];
    
    // Refresh button
    buttons.push(`<button class="toolbar-btn" onclick="refreshPreview()" title="Refresh">
      <span class="codicon codicon-refresh"></span>
    </button>`);
    
    buttons.push(`<button class="toolbar-btn" onclick="copySvg()" title="Copy SVG">
      <span class="codicon codicon-copy"></span>
    </button>`);
    
    buttons.push(`<button class="toolbar-btn" onclick="downloadSvg()" title="Download">
      <span class="codicon codicon-desktop-download"></span>
    </button>`);
    
    if (!isRasterized) {
      buttons.push(`<button class="toolbar-btn" onclick="previewComponent()" title="Open in Editor">
      <span class="codicon codicon-edit"></span>
    </button>`);
    }
    
    if (hasLocation) {
      buttons.push(`<button class="toolbar-btn" onclick="goToLocation()" title="Go to Source">
      <span class="codicon codicon-go-to-file"></span>
    </button>`);
    }
    
    buttons.push(`<button class="toolbar-btn" onclick="openDetails()" title="Details">
      <span class="codicon codicon-info"></span>
    </button>`);
    
    return `<div class="toolbar-row">
    ${buttons.join('\n    ')}
  </div>`;
  }

  /**
   * Generate the preview script
   */
  generateScript(name: string, variants?: Array<{ name: string; colors: string[] }>): string {
    return `<script>
    const vscode = acquireVsCodeApi();
    const colorMap = new Map();
    const savedVariants = ${JSON.stringify(variants || [])};
    const originalSvg = document.querySelector('.icon-container svg')?.outerHTML;
    
    // === SIZE CONTROL ===
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');
    const root = document.documentElement;
    
    sizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      sizeValue.textContent = size;
      root.style.setProperty('--avatar-size', size + 'px');
    });
    
    // === COLOR DETECTION (for variants) ===
    function normalizeColor(color) {
      if (!color || color === 'none' || color === 'currentColor') return null;
      const temp = document.createElement('div');
      temp.style.color = color;
      document.body.appendChild(temp);
      const computed = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      const match = computed.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
      if (match) {
        return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      }
      return color;
    }
    
    function detectColors() {
      const svg = document.querySelector('.icon-container svg');
      if (!svg) return [];
      const colors = new Map();
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && val !== 'none') {
            const hex = normalizeColor(val);
            if (hex && !colors.has(hex)) colors.set(hex, []);
            if (hex) colors.get(hex).push({ el, attr });
          }
        });
      });
      return Array.from(colors.entries());
    }
    
    // === VARIANTS ===
    // Store original SVG on load
    const originalSvgContent = document.querySelector('.icon-container svg')?.outerHTML || '';
    // Use _original variant colors as reference
    const originalVariant = savedVariants.find(v => v.name === '_original');
    const originalColors = originalVariant ? originalVariant.colors : [];
    
    console.log('[Preview] savedVariants:', savedVariants);
    console.log('[Preview] originalColors from _original:', originalColors);
    
    function applyVariant(index) {
      const variant = savedVariants[index];
      console.log('[Preview] applyVariant:', index, variant);
      
      if (!variant || !variant.colors || variant.colors.length === 0) {
        console.log('[Preview] No variant or colors');
        return;
      }
      
      const container = document.querySelector('.icon-container');
      if (!container || !originalSvgContent) {
        console.log('[Preview] No container or originalSvgContent');
        return;
      }
      
      // Start with original SVG
      let newSvg = originalSvgContent;
      
      // Replace colors directly in SVG string
      if (originalColors.length > 0) {
        originalColors.forEach((origColor, i) => {
          if (i < variant.colors.length) {
            const newColor = variant.colors[i];
            // Replace color in fill and stroke attributes (case insensitive)
            const regex = new RegExp(origColor.replace('#', '#?'), 'gi');
            newSvg = newSvg.replace(regex, newColor);
            console.log('[Preview] Replaced', origColor, 'with', newColor);
          }
        });
      }
      
      // Update container
      container.innerHTML = newSvg;
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.width = 'var(--avatar-size)';
        svg.style.height = 'var(--avatar-size)';
      }
      
      // Update active state
      document.querySelectorAll('.variant-swatch').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });
    }
    
    // === ACTIONS ===
    function goToLocation() { vscode.postMessage({ command: 'goToLocation' }); }
    function copyName() { vscode.postMessage({ command: 'copyName' }); }
    function copySvg() {
      const svgEl = document.querySelector('.icon-container svg');
      vscode.postMessage({ command: 'copySvg', svg: svgEl?.outerHTML });
    }
    function downloadSvg() {
      const svgEl = document.querySelector('.icon-container svg');
      if (svgEl) {
        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '${name}.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    function refreshPreview() {
      vscode.postMessage({ command: 'refreshPreview' });
    }
    function optimizeSvg() {
      const svgEl = document.querySelector('.icon-container svg');
      if (svgEl) {
        vscode.postMessage({ command: 'optimizeSvg', svg: svgEl.outerHTML });
      }
    }
    function previewComponent() {
      vscode.postMessage({ command: 'previewComponent' });
    }
    function openDetails() {
      vscode.postMessage({ command: 'openDetails' });
    }
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'resetSvg') {
        const container = document.querySelector('.icon-container');
        if (container && message.svg) {
          let svg = message.svg;
          if (!svg.includes('width=') && !svg.includes('style=')) {
            svg = svg.replace('<svg', '<svg width="100%" height="100%"');
          }
          container.innerHTML = svg;
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = 'var(--avatar-size)';
            svgEl.style.height = 'var(--avatar-size)';
          }
          colorMap.clear();
        }
      } else if (message.command === 'updateSvgContent') {
        // Update SVG content from Editor color changes
        const container = document.querySelector('.icon-container');
        if (container && message.svg) {
          let svg = message.svg;
          if (!svg.includes('width=') && !svg.includes('style=')) {
            svg = svg.replace('<svg', '<svg width="100%" height="100%"');
          }
          container.innerHTML = svg;
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = 'var(--avatar-size)';
            svgEl.style.height = 'var(--avatar-size)';
          }
        }
      }
    });
  </script>`;
  }

  /**
   * Generate preview surface HTML
   */
  generatePreviewSurface(displaySvg: string, variants?: Array<{ name: string; colors: string[] }>, isRasterized?: boolean): string {
    return `<div class="preview-surface" id="preview">
    <div class="icon-container">
      ${displaySvg}
    </div>
    <div class="bottom-controls">
      ${!isRasterized ? this.generateVariantsBar(variants) : ''}
      <div class="size-bar">
        <input type="range" class="size-slider" id="sizeSlider" min="16" max="128" value="64" />
        <span class="size-value" id="sizeValue">64</span>
      </div>
    </div>
  </div>`;
  }

  /**
   * Generate full HTML for webview
   */
  generateHtml(options: PreviewTemplateOptions): string {
    const { name, svg, location, isBuilt, animation, isRasterized, variants } = options;
    
    if (!svg) {
      return this.generateEmptyState();
    }

    const css = this.loadCss();
    const displaySvg = this.prepareSvgForDisplay(svg, animation);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>
    ${css}
  </style>
</head>
<body>
  ${this.generateHeader(name, isBuilt, isRasterized)}
  
  ${this.generatePreviewSurface(displaySvg, variants, isRasterized)}
  
  ${this.generateToolbar(!!location, isRasterized)}
  
  ${this.generateScript(name, variants)}
</body>
</html>`;
  }
}

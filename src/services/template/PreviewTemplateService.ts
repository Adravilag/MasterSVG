import * as vscode from 'vscode';
import type { PreviewAnimation, PreviewTemplateOptions } from '../types';

// Template import – bundled as raw text by esbuild's templateTextPlugin
import iconPreviewCss from '../../templates/shared/IconPreview.css';

/**
 * Service for generating HTML templates for the icon preview webview
 */
export class PreviewTemplateService {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Load CSS from bundled import (no runtime I/O)
   */
  loadCss(): string {
    return iconPreviewCss;
  }

  /**
   * Clear CSS cache - kept for API compatibility (no-op with static imports)
   */
  clearCache(): void {
    // No-op: CSS is bundled at build time
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

    // Apply animation style if present - only to the root <svg> tag
    if (animation && animation.type && animation.type !== 'none') {
      const duration = animation.duration || 1;
      const timing = animation.timing || 'linear';
      const iteration = animation.iteration || 'infinite';
      const delay = animation.delay || 0;
      const direction = animation.direction || 'normal';
      // Include transform-origin for proper rotation/scale animations
      const animationStyle = `animation: icon-${animation.type} ${duration}s ${timing} ${delay}s ${iteration} ${direction}; transform-origin: center;`;

      // Match only the root <svg> tag (first occurrence)
      const svgTagMatch = displaySvg.match(/^[\s\S]*?(<svg[^>]*>)/i);
      if (svgTagMatch && svgTagMatch[1]) {
        const svgTag = svgTagMatch[1];
        let newSvgTag: string;

        if (svgTag.includes('style="')) {
          // Append to existing style on the root svg tag
          newSvgTag = svgTag.replace(/style="([^"]*)"/, `style="$1; ${animationStyle}"`);
        } else {
          // Add style to root svg tag
          newSvgTag = svgTag.replace('<svg', `<svg style="${animationStyle}"`);
        }
        displaySvg = displaySvg.replace(svgTag, newSvgTag);
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
   * Generate toolbar HTML
   */
  generateToolbar(hasLocation: boolean, isRasterized?: boolean, hasAnimation?: boolean): string {
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

    // Animation toggle button (only show if icon has animation)
    if (hasAnimation) {
      buttons.push(`<button class="toolbar-btn animation-toggle" id="animationToggle" onclick="toggleAnimation()" title="Pause Animation">
      <span class="codicon codicon-debug-pause"></span>
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
generateScript(name: string, hasAnimation?: boolean): string {
    return `<script>
    const vscode = acquireVsCodeApi();

    // === ANIMATION CONTROL ===
    let animationPaused = false;
    function toggleAnimation() {
      const svgEl = document.querySelector('.icon-container svg');
      const toggleBtn = document.getElementById('animationToggle');
      if (svgEl && toggleBtn) {
        animationPaused = !animationPaused;
        if (animationPaused) {
          svgEl.style.animationPlayState = 'paused';
          toggleBtn.innerHTML = '<span class="codicon codicon-debug-start"></span>';
          toggleBtn.title = 'Play Animation';
        } else {
          svgEl.style.animationPlayState = 'running';
          toggleBtn.innerHTML = '<span class="codicon codicon-debug-pause"></span>';
          toggleBtn.title = 'Pause Animation';
        }
      }
    }

    // === SIZE CONTROL ===
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');
    const root = document.documentElement;

    sizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      sizeValue.textContent = size;
      root.style.setProperty('--avatar-size', size + 'px');
    });

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
        }
      }
    });
  </script>`;
  }

  /**
   * Generate preview surface HTML
   */
  generatePreviewSurface(
    displaySvg: string,
    isRasterized?: boolean
  ): string {
    return `<div class="preview-surface" id="preview">
    <div class="icon-container">
      ${displaySvg}
    </div>
    <div class="bottom-controls">
      <div class="size-bar">
        <input type="range" class="size-slider" id="sizeSlider" min="16" max="128" value="128" />
        <span class="size-value" id="sizeValue">128</span>
      </div>
    </div>
  </div>`;
  }

  /**
   * Generate full HTML for webview
   */
  generateHtml(options: PreviewTemplateOptions): string {
    const { name, svg, location, isBuilt, animation, isRasterized } = options;

    if (!svg) {
      return this.generateEmptyState();
    }

    const css = this.loadCss();
    const displaySvg = this.prepareSvgForDisplay(svg, animation);

    // Cache buster for development
    const cacheBuster = Date.now();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <!-- Cache buster: ${cacheBuster} -->
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>
    ${css}
  </style>
</head>
<body>
  ${this.generateHeader(name, isBuilt, isRasterized)}

  ${this.generatePreviewSurface(displaySvg, isRasterized)}

  ${this.generateToolbar(!!location, isRasterized, !!(animation && animation.type && animation.type !== 'none'))}

  ${this.generateScript(name, !!(animation && animation.type && animation.type !== 'none'))}
</body>
</html>`;
  }
}

import * as vscode from 'vscode';
import { ColorService } from '../services/ColorService';
import { getVariantsService } from '../services/VariantsService';
import { getUsageFinderService } from '../services/UsageFinderService';
import { handleMessage, PanelContext, IconDetails, IconAnimation } from './handlers/iconDetailHandlers';
import { t } from '../i18n';

export { IconDetails, IconAnimation };

const colorService = new ColorService();

export class IconDetailsPanel {
  public static currentPanel: IconDetailsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _iconDetails?: IconDetails;
  private _originalColors: string[] = [];
  private _selectedVariantIndex: number = -1;

  public static createOrShow(extensionUri: vscode.Uri, details?: IconDetails) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (IconDetailsPanel.currentPanel) {
      IconDetailsPanel.currentPanel._panel.reveal(column);
      if (details) {
        IconDetailsPanel.currentPanel._iconDetails = details;
        IconDetailsPanel.currentPanel._originalColors = colorService.extractAllColorsFromSvg(details.svg).colors;
        IconDetailsPanel.currentPanel._selectedVariantIndex = -1;
        IconDetailsPanel.currentPanel._update(details);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconDetails',
      t('details.title'),
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    IconDetailsPanel.currentPanel = new IconDetailsPanel(panel, extensionUri, details);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, details?: IconDetails) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._iconDetails = details;
    if (details) {
      this._originalColors = colorService.extractAllColorsFromSvg(details.svg).colors;
    }

    this._update(details);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Reveal in tree view when panel becomes visible (tab selected)
    this._panel.onDidChangeViewState(e => {
      if (e.webviewPanel.visible && this._iconDetails) {
        vscode.commands.executeCommand('iconManager.revealInTree', this._iconDetails.name, this._iconDetails.location?.file, this._iconDetails.location?.line);
      }
    }, null, this._disposables);

    // Set up message handler using extracted handlers
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        // Handle findUsages separately as it requires local panel reference
        if (message.command === 'findUsages') {
          if (this._iconDetails?.name) {
            this._findIconUsages(this._iconDetails.name);
          }
          return;
        }
        
        // Create context for handlers
        const ctx: PanelContext = {
          iconDetails: this._iconDetails,
          originalColors: this._originalColors,
          selectedVariantIndex: this._selectedVariantIndex,
          panel: this._panel,
          update: () => this._update(),
          setIconDetails: (details: IconDetails) => { this._iconDetails = details; },
          setSelectedVariantIndex: (index: number) => { this._selectedVariantIndex = index; }
        };
        
        await handleMessage(ctx, message);
      },
      null,
      this._disposables
    );
  }

  private async _findIconUsages(iconName: string): Promise<void> {
    const usageFinderService = getUsageFinderService();
    
    try {
      const usages = await usageFinderService.findIconUsages(iconName);
      const formattedUsages = usages.map(u => ({
        file: u.file,
        line: u.line,
        preview: u.text.substring(0, 100) + (u.text.length > 100 ? '...' : '')
      }));
      
      this._panel.webview.postMessage({ 
        command: 'usagesResult', 
        usages: formattedUsages,
        total: formattedUsages.length 
      });
    } catch {
      this._panel.webview.postMessage({ command: 'usagesResult', usages: [], total: 0 });
    }
  }

  public dispose() {
    IconDetailsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(details?: IconDetails) {
    if (details) {
      this._iconDetails = details;
      this._panel.title = `Details: ${details.name}`;
    }
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    if (!this._iconDetails) {
      return `<!DOCTYPE html>
<html><body><p>No icon selected</p></body></html>`;
    }

    const { name, svg, location, isBuilt, animation } = this._iconDetails;
    
    console.log('[Icon Studio] IconDetailsPanel animation:', animation);

    // Extract data from SVG
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    
    const widthMatch = svg.match(/width=["']([^"']+)["']/);
    const heightMatch = svg.match(/height=["']([^"']+)["']/);
    const dimensions = widthMatch && heightMatch ? `${widthMatch[1]} × ${heightMatch[1]}` : null;
    
    const fileSize = new Blob([svg]).size;
    const fileSizeStr = fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;
    
    const pathCount = (svg.match(/<path/g) || []).length;
    const circleCount = (svg.match(/<circle/g) || []).length;
    const rectCount = (svg.match(/<rect/g) || []).length;
    const lineCount = (svg.match(/<line/g) || []).length;
    const polygonCount = (svg.match(/<polygon/g) || []).length;
    const ellipseCount = (svg.match(/<ellipse/g) || []).length;
    const totalElements = pathCount + circleCount + rectCount + lineCount + polygonCount + ellipseCount;
    
    const elementParts: string[] = [];
    if (pathCount) elementParts.push(`${pathCount} path`);
    if (circleCount) elementParts.push(`${circleCount} circle`);
    if (rectCount) elementParts.push(`${rectCount} rect`);
    if (lineCount) elementParts.push(`${lineCount} line`);
    if (polygonCount) elementParts.push(`${polygonCount} polygon`);
    if (ellipseCount) elementParts.push(`${ellipseCount} ellipse`);
    const elementsStr = elementParts.join(', ') || 'none';
    
    const hasGradient = /<(linearGradient|radialGradient)/i.test(svg);
    const hasFilter = /<filter/i.test(svg);
    const hasClipPath = /<clipPath/i.test(svg);
    const hasMask = /<mask/i.test(svg);
    const features = [hasGradient ? 'gradient' : '', hasFilter ? 'filter' : '', hasClipPath ? 'clipPath' : '', hasMask ? 'mask' : ''].filter(Boolean);

    const fileName = location ? location.file.split(/[/\\]/).pop() : '';

    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }
    
    // Apply animation style to SVG if present
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

    // Extract colors from SVG using ColorService
    const { colors: allColors, hasCurrentColor } = colorService.extractAllColorsFromSvg(svg);
    const totalColorCount = allColors.length;
    const MAX_COLORS_TO_SHOW = 50;
    const svgColors = allColors.slice(0, MAX_COLORS_TO_SHOW);
    const hasMoreColors = totalColorCount > MAX_COLORS_TO_SHOW;

    // Load templates
    const fs = require('fs');
    const path = require('path');
    const templatesDir = path.join(this._extensionUri.fsPath, 'src', 'templates', 'icon-details');
    
    const cssContent = fs.readFileSync(path.join(templatesDir, 'iconDetails.css'), 'utf-8');
    const jsTemplate = fs.readFileSync(path.join(templatesDir, 'iconDetails.js'), 'utf-8');
    
    // Inject i18n translations into JS
    const i18nObject = {
      noUsagesFound: t('webview.js.noUsagesFound'),
      original: t('webview.js.original'),
      optimized: t('webview.js.optimized'),
      saved: t('webview.js.saved'),
      alreadyOptimal: t('webview.js.alreadyOptimal')
    };
    const jsContent = jsTemplate.replace(/__I18N__/g, JSON.stringify(i18nObject));

    // Generate dynamic HTML parts
    const badgeHtml = isBuilt !== undefined 
      ? `<span class="badge ${isBuilt ? 'built' : 'draft'}">${isBuilt ? t('webview.details.built') : t('webview.details.draft')}</span>` 
      : '';

    const locationButtonHtml = location 
      ? `<button class="action-btn" onclick="goToLocation()" title="${t('webview.details.goToSource')}"><span class="codicon codicon-go-to-file"></span></button>` 
      : '';

    const colorsHtml = hasMoreColors 
      ? `<div class="colors-warning"><span class="codicon codicon-warning"></span><span>${t('webview.details.colorsWarning').replace('{count}', String(totalColorCount))}</span></div>`
      : `<div class="color-swatches" id="colorSwatches">
          ${hasCurrentColor ? `<div class="current-color-info"><span class="codicon codicon-paintcan"></span><span>${t('webview.details.usesCurrentColor')}</span><span class="color-hint">(${t('webview.details.inheritsFromCss')})</span></div>` : ''}
          ${svgColors.length > 0 ? svgColors.map(color => `<div class="color-swatch-view" style="background-color: ${color}" title="Click to copy: ${color}" onclick="copyColor('${color}')"><span class="color-tooltip">${color}</span></div>`).join('') : (!hasCurrentColor ? `<span class="no-colors">${t('webview.details.noColorsDetected')}</span>` : '')}
        </div>`;

    const dimensionsHtml = dimensions 
      ? `<div class="detail-card"><div class="detail-label"><span class="codicon codicon-screen-full"></span> ${t('webview.details.dimensions')}</div><div class="detail-value">${dimensions}</div></div>` 
      : '';

    const featuresHtml = features.length > 0 
      ? `<div class="detail-card"><div class="detail-label"><span class="codicon codicon-extensions"></span> ${t('webview.details.features')}</div><div class="features">${features.map(f => `<span class="feature-tag" data-feature="${f}">${f}</span>`).join('')}</div></div>` 
      : '';

    const locationCardHtml = location 
      ? `<div class="detail-card clickable location-card" onclick="goToLocation()"><div class="detail-label"><span class="codicon codicon-go-to-file"></span> ${t('webview.details.sourceLocation')}</div><div class="detail-value">${fileName}:${location.line}</div><div class="detail-sub">${location.file}</div></div>` 
      : '';

    const variantsContentHtml = hasMoreColors 
      ? `<div class="Variants-disabled-message"><span class="codicon codicon-info"></span> ${t('webview.details.variantsDisabled')}</div>`
      : `<div class="Variants-container" id="VariantsContainer">${this._generateVariantsHtml(name)}</div>`;

    const variantsAddButtonHtml = !hasMoreColors 
      ? `<button class="variant-add-btn" onclick="saveVariant()" title="${t('webview.details.saveVariant')}"><span class="codicon codicon-add"></span></button>` 
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>${cssContent}</style>
</head>
<body>
  <div class="container">
    <header class="header">
      <span class="icon-name">${name}</span>
      ${badgeHtml}
    </header>
    
    <div class="content">
      <div class="preview-section">
        <div class="preview-container">
          <div class="preview-box zoom-3" id="previewBox">${displaySvg}</div>
        </div>
        
        <div class="zoom-controls">
          <button class="zoom-btn" onclick="zoomOut()" title="${t('webview.details.zoomOut')}"><span class="codicon codicon-zoom-out"></span></button>
          <span class="zoom-level" id="zoomLevel">100%</span>
          <button class="zoom-btn" onclick="zoomIn()" title="${t('webview.details.zoomIn')}"><span class="codicon codicon-zoom-in"></span></button>
          <button class="zoom-btn" onclick="resetZoom()" title="${t('webview.details.resetZoom')}"><span class="codicon codicon-screen-normal"></span></button>
        </div>
        
        <div class="quick-actions">
          <button class="action-btn" onclick="copyName()" title="${t('webview.details.copyIconName')}"><span class="codicon codicon-copy"></span></button>
          <button class="action-btn" onclick="copySvg()" title="${t('webview.details.copySvgCode')}"><span class="codicon codicon-code"></span></button>
          <button class="action-btn primary" onclick="openEditor()" title="${t('webview.details.openInEditor')}"><span class="codicon codicon-edit"></span></button>
          ${locationButtonHtml}
        </div>
        
        <div class="color-picker-section">
          <div class="color-picker-title"><span class="codicon codicon-symbol-color"></span> ${t('webview.details.colors')}</div>
          ${colorsHtml}
        </div>
      </div>
      
      <div class="details-section">
        <h2>${t('webview.details.properties')}</h2>
        
        <!-- Compact Stats Row -->
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-value">${viewBox}</span>
            <span class="stat-label">viewBox</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value" id="fileSize">${fileSizeStr}</span>
            <span class="stat-label">Size</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value">${totalElements}</span>
            <span class="stat-label">Elements</span>
          </div>
        </div>
        
        <div class="details-grid">
          <div class="detail-card">
            <div class="detail-label"><span class="codicon codicon-symbol-class"></span> ${t('webview.details.elementsBreakdown') || 'Elements Breakdown'}</div>
            <div class="detail-sub">${elementsStr}</div>
          </div>
          ${featuresHtml}
          ${locationCardHtml}
        </div>
        
        <div class="Variants-section${hasMoreColors ? ' disabled-section' : ''}">
          <div class="Variants-header">
            <h2><span class="codicon codicon-color-mode"></span> ${t('webview.details.variants')}</h2>
            ${variantsAddButtonHtml}
          </div>
          ${variantsContentHtml}
        </div>
        
        <div class="usages-section">
          <div class="usages-header">
            <h2><span class="codicon codicon-references"></span> ${t('webview.details.usages')}</h2>
            <span class="usages-count" id="usagesCount"></span>
          </div>
          <div class="usages-list" id="usagesList">
            <div class="loading"><span class="codicon codicon-sync"></span> ${t('webview.details.searchingUsages')}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>${jsContent}</script>
</body>
</html>`;
  }

  private _generateVariantsHtml(iconName: string): string {
    const variantsService = getVariantsService();
    const savedVariants = variantsService.getSavedVariants(iconName);
    const defaultVariant = variantsService.getDefaultVariant(iconName);
    
    // Original variant item (always present)
    const originalVariant = `
      <div class="variant-item default${this._selectedVariantIndex === -1 ? ' selected' : ''}${!defaultVariant ? ' is-default' : ''}" onclick="applyDefaultVariant()" title="Original colors${!defaultVariant ? ' (active default)' : ''}">
        <div class="variant-colors">
          ${this._originalColors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}"></div>`).join('')}
        </div>
        <span class="variant-name">original</span>
        <div class="variant-actions">
          <button class="variant-set-default${!defaultVariant ? ' active' : ''}" onclick="event.stopPropagation(); setDefaultVariant(null)" title="${!defaultVariant ? 'Currently default' : 'Set as default'}">
            <span class="codicon codicon-star${!defaultVariant ? '-full' : '-empty'}"></span>
          </button>
        </div>
      </div>
    `;
    
    // Saved Variants
    const savedVariantsHtml = savedVariants.map((variant, index) => `
      <div class="variant-item${this._selectedVariantIndex === index ? ' selected' : ''}${defaultVariant === variant.name ? ' is-default' : ''}" onclick="applyVariant(${index})" title="${variant.name} - Click to apply${defaultVariant === variant.name ? ' (active default)' : ''}">
        <div class="variant-colors">
          ${variant.colors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}"></div>`).join('')}
        </div>
        <span class="variant-name">${variant.name}</span>
        <div class="variant-actions">
          <button class="variant-set-default${defaultVariant === variant.name ? ' active' : ''}" onclick="event.stopPropagation(); setDefaultVariant('${variant.name}')" title="${defaultVariant === variant.name ? 'Currently default' : 'Set as default'}">
            <span class="codicon codicon-star${defaultVariant === variant.name ? '-full' : '-empty'}"></span>
          </button>
          <button class="variant-delete" onclick="event.stopPropagation(); deleteVariant(${index})" title="Delete">
            <span class="codicon codicon-trash"></span>
          </button>
        </div>
      </div>
    `).join('');
    
    return originalVariant + savedVariantsHtml;
  }
}


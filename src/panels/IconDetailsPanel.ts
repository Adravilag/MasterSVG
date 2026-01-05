import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ColorService } from '../services/ColorService';
import { getVariantsService } from '../services/VariantsService';
import { getUsageFinderService } from '../services/UsageFinderService';
import {
  handleMessage,
  PanelContext,
  IconDetails,
  IconAnimation,
} from './handlers/iconDetailHandlers';
import { t } from '../i18n';
import { getIconLicenseInfoSync, parseIconifyName, ensureCollectionsLoaded } from '../services/LicenseService';
import { getKeyframesForAnimation } from '../services/AnimationKeyframes';
import { scopeSvgIds } from '../utils/svgIdScoper';

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

    // Pre-load Iconify collections cache if this is an Iconify icon
    if (details?.name && parseIconifyName(details.name)) {
      ensureCollectionsLoaded().then(() => {
        // Update the panel after collections are loaded to show license info
        if (IconDetailsPanel.currentPanel) {
          IconDetailsPanel.currentPanel._update();
        }
      });
    }

    if (IconDetailsPanel.currentPanel) {
      IconDetailsPanel.currentPanel._panel.reveal(column);
      if (details) {
        IconDetailsPanel.currentPanel._iconDetails = details;

        // For built icons, try to get the original colors from the _original variant
        // This is the source of truth for what colors should be considered "original"
        let originalColors: string[] = [];
        if (details.isBuilt) {
          const variantsService = getVariantsService();
          const savedVariants = variantsService.getSavedVariants(details.name);
          const originalVariant = savedVariants.find(v => v.name === '_original');
          if (originalVariant) {
            originalColors = originalVariant.colors;
            console.log(`[IconDetailsPanel.createOrShow] Using _original variant colors:`, originalColors);
          }
        }

        // If no _original variant, fall back to extracting from the current SVG
        if (originalColors.length === 0) {
          originalColors = colorService.extractAllColorsFromSvg(details.svg).colors;
        }

        IconDetailsPanel.currentPanel._originalColors = originalColors;
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
        retainContextWhenHidden: true,
      }
    );

    IconDetailsPanel.currentPanel = new IconDetailsPanel(panel, extensionUri, details);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, details?: IconDetails) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._iconDetails = details;

    if (details) {
      // For built icons, try to get the original colors from the _original variant
      let originalColors: string[] = [];
      if (details.isBuilt) {
        const variantsService = getVariantsService();
        const savedVariants = variantsService.getSavedVariants(details.name);
        const originalVariant = savedVariants.find(v => v.name === '_original');
        if (originalVariant) {
          originalColors = originalVariant.colors;
          console.log(`[IconDetailsPanel] Using _original variant colors:`, originalColors);
        }
      }

      // If no _original variant, fall back to extracting from the current SVG
      if (originalColors.length === 0) {
        originalColors = colorService.extractAllColorsFromSvg(details.svg).colors;
      }

      this._originalColors = originalColors;

      // Pre-load Iconify collections cache if this is an Iconify icon
      if (parseIconifyName(details.name)) {
        ensureCollectionsLoaded().then(() => {
          // Update the panel after collections are loaded to show license info
          this._update();
        });
      }
    }

    this._update(details);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Reveal in tree view when panel becomes visible (tab selected)
    this._panel.onDidChangeViewState(
      e => {
        if (e.webviewPanel.visible && this._iconDetails) {
          vscode.commands.executeCommand(
            'masterSVG.revealInTree',
            this._iconDetails.name,
            this._iconDetails.location?.file,
            this._iconDetails.location?.line
          );
        }
      },
      null,
      this._disposables
    );

    // Set up message handler using extracted handlers
    this._panel.webview.onDidReceiveMessage(
      async message => {
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
          setIconDetails: (details: IconDetails) => {
            this._iconDetails = details;
          },
          setSelectedVariantIndex: (index: number) => {
            this._selectedVariantIndex = index;
          },
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

      // Filter out usages from the icon output directory (avoid circular references)
      const { getFullOutputPath } = require('../utils/configHelper');
      const outputPath = getFullOutputPath();

      const filteredUsages = usages.filter(u => {
        if (!outputPath) return true; // If no output path configured, include all
        // Normalize paths to use forward slashes for comparison
        const normalizedUsageFile = u.file.replace(/\\/g, '/');
        const normalizedOutputPath = outputPath.replace(/\\/g, '/');
        return !normalizedUsageFile.includes(normalizedOutputPath);
      });

      const formattedUsages = filteredUsages.map(u => ({
        file: u.file,
        line: u.line,
        // Provide full usage text so inline SVG (with <defs>, ids, etc.) is shown completely
        preview: u.text,
      }));

      this._panel.webview.postMessage({
        command: 'usagesResult',
        usages: formattedUsages,
        total: formattedUsages.length,
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
    const totalElements =
      pathCount + circleCount + rectCount + lineCount + polygonCount + ellipseCount;

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
    const features = [
      hasGradient ? 'gradient' : '',
      hasFilter ? 'filter' : '',
      hasClipPath ? 'clipPath' : '',
      hasMask ? 'mask' : '',
    ].filter(Boolean);

    const fileName = location ? location.file.split(/[/\\]/).pop() : '';

    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }

    // Apply animation style to SVG if present
    let animationKeyframes = '';
    let animationCssRule = '';
    if (animation && animation.type && animation.type !== 'none') {
      const duration = animation.duration || 1;
      const timing = animation.timing || 'ease';
      const iteration = animation.iteration || 'infinite';
      const delay = animation.delay || 0;
      const direction = animation.direction || 'normal';
      const animationShorthand = `${animation.type} ${duration}s ${timing} ${delay}s ${iteration} ${direction}`;
      const inlineProps = `animation: ${animationShorthand}; transform-origin: center; transform-box: fill-box; will-change: transform, filter; animation-fill-mode: both;`;

      // Prefer adding a CSS rule scoped to the preview container for reliability
      animationCssRule = `#previewBox svg { ${inlineProps} }`;

      // Also attempt to add/merge inline style on the <svg> element (handles svg that require inline)
      const svgTagMatch = displaySvg.match(/<svg\b([^>]*)>/i);
      if (svgTagMatch) {
        const svgAttrs = svgTagMatch[1];
        if (/style\s*=/.test(svgAttrs)) {
          // replace style inside the svg tag only
          displaySvg = displaySvg.replace(/(<svg\b[^>]*?)style=(['"])([\s\S]*?)\2/, (_m, pre, q, content) => `${pre}style=${q}${content} ${inlineProps}${q}`);
        } else {
          // add style attribute to svg tag
          displaySvg = displaySvg.replace('<svg', `<svg style="${inlineProps}"`);
        }
      } else {
        // fallback: naive replace
        if (displaySvg.includes('<svg')) displaySvg = displaySvg.replace('<svg', `<svg style="${inlineProps}"`);
      }

      // Get keyframes for the animation
      animationKeyframes = getKeyframesForAnimation(animation.type);
    }

    // Scope SVG ids to avoid collisions when multiple previews or templates are on the same page
    try {
      const idSuffix = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      displaySvg = scopeSvgIds(displaySvg, idSuffix);
    } catch {
      // ignore scoping errors and fall back to original svg
    }

    // Extract colors from SVG using ColorService
    const { colors: allColors, hasCurrentColor } = colorService.extractAllColorsFromSvg(svg);
    const totalColorCount = allColors.length;
    const MAX_COLORS_TO_SHOW = 50;
    const svgColors = allColors.slice(0, MAX_COLORS_TO_SHOW);
    const hasMoreColors = totalColorCount > MAX_COLORS_TO_SHOW;

    // Load templates
    // In bundled mode, templates are in dist/templates
    const templatesDir = path.join(this._extensionUri.fsPath, 'dist', 'templates', 'icon-details');

    const cssContent = fs.readFileSync(path.join(templatesDir, 'iconDetails.css'), 'utf-8');
    const jsTemplate = fs.readFileSync(path.join(templatesDir, 'iconDetails.js'), 'utf-8');

    // Inject i18n translations into JS
    const i18nObject = {
      noUsagesFound: t('webview.js.noUsagesFound'),
      found: t('webview.js.found'),
      original: t('webview.js.original'),
      optimized: t('webview.js.optimized'),
      saved: t('webview.js.saved'),
      alreadyOptimal: t('webview.js.alreadyOptimal'),
    };
    const jsContent = jsTemplate.replace(/__I18N__/g, JSON.stringify(i18nObject));

    // Generate dynamic HTML parts
    const badgeHtml =
      isBuilt !== undefined
        ? `<span class="badge ${isBuilt ? 'built' : 'draft'}">${isBuilt ? t('webview.details.built') : t('webview.details.draft')}</span>`
        : '';

    const locationButtonHtml = location
      ? `<button class="action-btn" onclick="goToLocation()" title="${t('webview.details.goToSource')}"><span class="codicon codicon-go-to-file"></span></button>`
      : '';

    const colorsHtml = hasMoreColors
      ? `<div class="colors-warning"><span class="codicon codicon-warning"></span><span>${t('webview.details.colorsWarning').replace('{count}', String(totalColorCount))}</span></div>`
      : `<div class="color-swatches" id="colorSwatches">
          ${hasCurrentColor ? `<div class="current-color-info"><span class="codicon codicon-paintcan"></span><span>${t('webview.details.usesCurrentColor')}</span><span class="color-hint">(${t('webview.details.inheritsFromCss')})</span></div>` : ''}
          ${svgColors.length > 0 ? svgColors.map(color => `<div class="color-swatch-view" style="background-color: ${color}" title="Click to copy: ${color}" onclick="copyColor('${color}')"><span class="color-tooltip">${color}</span></div>`).join('') : !hasCurrentColor ? `<span class="no-colors">${t('webview.details.noColorsDetected')}</span>` : ''}
        </div>`;

    const _dimensionsHtml = dimensions
      ? `<div class="detail-card"><div class="detail-label"><span class="codicon codicon-screen-full"></span> ${t('webview.details.dimensions')}</div><div class="detail-value">${dimensions}</div></div>`
      : '';

    const featuresHtml =
      features.length > 0
        ? `<div class="detail-card"><div class="detail-label"><span class="codicon codicon-extensions"></span> ${t('webview.details.features')}</div><div class="features">${features.map(f => `<span class="feature-tag" data-feature="${f}">${f}</span>`).join('')}</div></div>`
        : '';

    const locationCardHtml = location
      ? `<div class="detail-card clickable location-card" onclick="goToLocation()"><div class="detail-label"><span class="codicon codicon-go-to-file"></span> ${t('webview.details.sourceLocation')}</div><div class="detail-value">${fileName}:${location.line}</div><div class="detail-sub">${location.file}</div></div>`
      : '';

    // License info for Iconify icons
    let licenseCardHtml = '';
    const iconifyParsed = parseIconifyName(name);
    if (iconifyParsed) {
      const licenseInfo = getIconLicenseInfoSync(iconifyParsed.prefix);
      // Build Iconify URLs
      const iconifyPageUrl = `https://icon-sets.iconify.design/${iconifyParsed.prefix}/${iconifyParsed.name}/`;
      const iconifyDownloadUrl = `https://api.iconify.design/${iconifyParsed.prefix}/${iconifyParsed.name}.svg`;

      if (licenseInfo) {
        const authorLink = licenseInfo.author?.url
          ? `<a href="${licenseInfo.author.url}" class="license-link" onclick="openExternal('${licenseInfo.author.url}')">${licenseInfo.author.name}</a>`
          : licenseInfo.author?.name || t('webview.details.unknownAuthor');
        const licenseLink = licenseInfo.license?.url
          ? `<a href="${licenseInfo.license.url}" class="license-link" onclick="openExternal('${licenseInfo.license.url}')">${licenseInfo.license.spdx || licenseInfo.license.title}</a>`
          : licenseInfo.license?.spdx ||
            licenseInfo.license?.title ||
            t('webview.details.unknownLicense');
        licenseCardHtml = `
          <div class="detail-card license-card">
            <div class="detail-label"><span class="codicon codicon-law"></span> ${t('webview.details.license')}</div>
            <div class="license-info">
              <div class="license-row"><span class="license-label">${t('webview.details.collection')}:</span> <span class="license-value">${licenseInfo.name || iconifyParsed.prefix}</span></div>
              <div class="license-row"><span class="license-label">${t('webview.details.author')}:</span> <span class="license-value">${authorLink}</span></div>
              <div class="license-row"><span class="license-label">${t('webview.details.licenseType')}:</span> <span class="license-value">${licenseLink} ✅</span></div>
              <div class="license-row"><span class="license-label">${t('webview.details.download')}:</span> <span class="license-value"><a href="${iconifyPageUrl}" class="license-link" onclick="openExternal('${iconifyPageUrl}')"><span class="codicon codicon-link-external"></span> Iconify</a> · <a href="${iconifyDownloadUrl}" class="license-link" onclick="openExternal('${iconifyDownloadUrl}')"><span class="codicon codicon-cloud-download"></span> SVG</a></span></div>
            </div>
          </div>`;
      } else {
        licenseCardHtml = `
          <div class="detail-card license-card warning">
            <div class="detail-label"><span class="codicon codicon-law"></span> ${t('webview.details.license')}</div>
            <div class="license-info">
              <div class="license-row"><span class="license-label">${t('webview.details.collection')}:</span> <span class="license-value">${iconifyParsed.prefix}</span></div>
              <div class="license-row"><span class="license-value warning-text">⚠️ ${t('webview.details.licenseUnknown')}</span></div>
              <div class="license-row"><span class="license-label">${t('webview.details.download')}:</span> <span class="license-value"><a href="${iconifyPageUrl}" class="license-link" onclick="openExternal('${iconifyPageUrl}')"><span class="codicon codicon-link-external"></span> Iconify</a> · <a href="${iconifyDownloadUrl}" class="license-link" onclick="openExternal('${iconifyDownloadUrl}')"><span class="codicon codicon-cloud-download"></span> SVG</a></span></div>
            </div>
          </div>`;
      }
    }

    const variantsContentHtml = hasMoreColors
      ? `<div class="Variants-disabled-message"><span class="codicon codicon-info"></span> ${t('webview.details.variantsDisabled')}</div>`
      : `<div class="Variants-container" id="VariantsContainer">${this._generateVariantsHtml(name)}</div>`;

    // Animation section HTML - show animation details if present
    let animationHtml = '';
    if (animation && animation.type && animation.type !== 'none') {
      const animDetails: string[] = [];
      if (animation.duration) animDetails.push(`${animation.duration}s`);
      if (animation.timing) animDetails.push(animation.timing);
      if (animation.iteration) animDetails.push(animation.iteration);
      if (animation.delay) animDetails.push(`delay: ${animation.delay}s`);
      if (animation.direction) animDetails.push(animation.direction);

      const detailsStr = animDetails.length > 0 ? ` · ${animDetails.join(' · ')}` : '';

      animationHtml = `<div class="animation-section">
          <h2><span class="codicon codicon-play"></span> ${t('webview.details.animation')}</h2>
          <div class="animation-info">
            <span class="animation-type">⚡ ${animation.type}</span>
            <span class="animation-details">${detailsStr}</span>
          </div>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>${cssContent}
  ${animationKeyframes}
  ${animationCssRule}</style>
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
          ${licenseCardHtml}
        </div>

        ${animationHtml}

        <div class="Variants-section${hasMoreColors ? ' disabled-section' : ''}">
          <div class="Variants-header">
            <h2><span class="codicon codicon-color-mode"></span> ${t('webview.details.variants')}</h2>
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
      <div class="variant-item default${this._selectedVariantIndex === -1 ? ' selected' : ''}" onclick="applyDefaultVariant()" title="Original colors">
        <div class="variant-colors">
          ${this._originalColors
            .slice(0, 4)
            .map(c => `<div class="variant-color-dot" style="background:${c}"></div>`)
            .join('')}
        </div>
        <span class="variant-name">original</span>
        <div class="variant-actions">

        </div>
      </div>
    `;

    // Saved Variants
    const savedVariantsHtml = savedVariants
      .map(
        (variant, index) => `
      <div class="variant-item${this._selectedVariantIndex === index ? ' selected' : ''}${defaultVariant === variant.name ? ' is-default' : ''}" onclick="applyVariant(${index})" title="${variant.name} - Click to apply${defaultVariant === variant.name ? ' (active default)' : ''}">
        <div class="variant-colors">
          ${variant.colors
            .slice(0, 4)
            .map(c => `<div class="variant-color-dot" style="background:${c}"></div>`)
            .join('')}
        </div>
        <span class="variant-name">${variant.name}</span>
        <div class="variant-actions">
          <button class="variant-delete" onclick="event.stopPropagation(); deleteVariant(${index})" title="Delete">
            <span class="codicon codicon-trash"></span>
          </button>
        </div>
      </div>
    `
      )
      .join('');

    return originalVariant + savedVariantsHtml;
  }
}

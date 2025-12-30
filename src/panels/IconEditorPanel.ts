import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SvgOptimizer } from '../services/SvgOptimizer';
import { SvgManipulationService } from '../services/SvgManipulationService';
import { SvgTransformer } from '../services/SvgTransformer';
import { getColorService, ColorService } from '../services/ColorService';
import { getVariantsService, VariantsService } from '../services/VariantsService';
import { getIconPersistenceService } from '../services/IconPersistenceService';
import { getIconEditorTemplateService } from '../services/IconEditorTemplateService';
import { getSyntaxHighlighter } from '../services/SyntaxHighlighter';
import { AnimationSettings } from '../services/AnimationService';
import { getSvgConfig } from '../utils/config';
import { updateIconAnimation, AnimationConfig, addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';
import { getConfig, getOutputPathOrWarn } from '../utils/configHelper';
import { t } from '../i18n';

// Import handlers
import {
  ColorHandlerContext,
  handlePreviewColor,
  handleChangeColor,
  handleReplaceCurrentColor,
  handleAddFillColor,
  handleAddColor,
  handleApplyFilters
} from '../handlers/IconEditorColorHandlers';
import {
  VariantHandlerContext,
  handleSaveVariant,
  handleApplyVariant,
  handleApplyDefaultVariant,
  handleGenerateAutoVariant,
  handleDeleteVariant,
  handleSetDefaultVariant,
  handleEditVariant
} from '../handlers/IconEditorVariantHandlers';
import {
  SvgCodeHandlerContext,
  handleOptimizeSvg,
  handleApplyOptimizedSvg,
  handleCopySvg,
  handleCopyWithAnimation,
  handleFormatSvgCode,
  handleUpdateCodeWithAnimation,
  handleUpdateAnimationCode,
  handleShowMessage,
  handleInsertCodeAtCursor,
  handleRevertOptimization
} from '../handlers/IconEditorSvgHandlers';
import {
  IconHandlerContext,
  handleRequestRename,
  handleRenameIcon,
  handleRebuild,
  handleRefresh,
  handleSaveAnimation
} from '../handlers/IconEditorIconHandlers';
import { getAnimationService } from '../services/AnimationAssignmentService';

interface IconAnimation {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

interface IconData {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  spriteFile?: string; // Path to sprite.svg if icon comes from sprite
  iconsFile?: string; // Path to icons.js if icon comes from icons file
  viewBox?: string; // ViewBox for sprite icons
  isBuilt?: boolean; // Whether icon comes from built icons
  animation?: IconAnimation; // Animation settings from built icon
}

export class IconEditorPanel {
  public static currentPanel: IconEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _iconData?: IconData;
  private _originalSvg: string = ''; // Original SVG without color modifications
  private _originalColors: string[] = [];
  private _selectedVariantIndex: number = -1;
  private _preOptimizedSvg: string | undefined;
  private readonly _colorService: ColorService;
  private readonly _variantsService: VariantsService;

  public static createOrShow(extensionUri: vscode.Uri, data?: IconData) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (IconEditorPanel.currentPanel) {
      IconEditorPanel.currentPanel._panel.reveal(column);
      if (data) {
        // Reset cache when switching icons
        IconEditorPanel.currentPanel._variantsService.resetCache();
        IconEditorPanel.currentPanel._iconData = data;
        // Clean embedded animations and store original SVG
        if (data.svg) {
          data.svg = SvgManipulationService.cleanAnimationFromSvg(data.svg);
          IconEditorPanel.currentPanel._originalSvg = data.svg;
        }
        IconEditorPanel.currentPanel._originalColors = IconEditorPanel.currentPanel._colorService.extractColorsFromSvg(data.svg).colors;
        IconEditorPanel.currentPanel._selectedVariantIndex = -1;
        IconEditorPanel.currentPanel._ensureCustomVariant();
        IconEditorPanel.currentPanel._update();
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconEditor',
      t('editor.title'),
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    IconEditorPanel.currentPanel = new IconEditorPanel(panel, extensionUri, data);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, data?: IconData) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._iconData = data;
    this._colorService = getColorService();
    this._variantsService = getVariantsService();
    
    // Clean embedded animations from the loaded SVG to prevent double animations in preview
    if (this._iconData?.svg) {
      this._iconData.svg = SvgManipulationService.cleanAnimationFromSvg(this._iconData.svg);
      this._originalSvg = this._iconData.svg; // Store original SVG for Build
      this._originalColors = this._colorService.extractColorsFromSvg(this._iconData.svg).colors;
      
      // Ensure "custom" variant exists for every icon
      this._ensureCustomVariant();
    }

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Reveal in tree view when panel becomes visible (tab selected)
    this._panel.onDidChangeViewState(e => {
      if (e.webviewPanel.visible && this._iconData) {
        vscode.commands.executeCommand('iconManager.revealInTree', this._iconData.name, this._iconData.location?.file, this._iconData.location?.line);
      }
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // Calculate optimization stats initially
    if (this._iconData?.svg) {
      setTimeout(() => this._sendOptimizationStats(), 1000);
    }
  }

  private _sendOptimizationStats() {
    if (!this._iconData?.svg) return;
    
    const optimizer = new SvgOptimizer();
    const presets = optimizer.getPresets();
    const stats: Record<string, string> = {};
    
    for (const [key, options] of Object.entries(presets)) {
      const result = optimizer.optimize(this._iconData.svg, options);
      const savings = result.originalSize - result.optimizedSize;
      if (savings > 0) {
        stats[key] = `-${optimizer.formatSize(savings)}`;
      } else {
        stats[key] = '';
      }
    }
    
    this._panel.webview.postMessage({
      command: 'optimizationStats',
      stats
    });
  }

  /**
   * Handle incoming webview messages by delegating to appropriate handlers
   */
  private async _handleMessage(message: { command: string; [key: string]: unknown }): Promise<void> {
    if (message.command === 'log') {
        // Force a toast on first log to prove connectivity
        // vscode.window.showInformationMessage('Webview Log: ' + (message.message as string));
    }

    // Create handler contexts
    const colorCtx = this._createColorHandlerContext();
    const variantCtx = this._createVariantHandlerContext();
    const svgCtx = this._createSvgCodeHandlerContext();
    const iconCtx = this._createIconHandlerContext();

    switch (message.command) {
      // Color handlers
      case 'previewColor':
        handlePreviewColor(colorCtx, message as { oldColor?: string; newColor?: string });
        break;
      case 'changeColor':
        handleChangeColor(colorCtx, message as { oldColor?: string; newColor?: string });
        break;
      case 'replaceCurrentColor':
        handleReplaceCurrentColor(colorCtx, message as { newColor?: string });
        break;
      case 'addFillColor':
        handleAddFillColor(colorCtx, message as { color?: string });
        break;
      case 'addColor':
        handleAddColor(colorCtx, message as { color?: string });
        break;
      case 'applyFilters':
        handleApplyFilters(colorCtx, message as unknown as { filters: { hue: string; saturation: string; brightness: string } });
        // If thenRebuild is true, trigger rebuild after applying filters
        if ((message as { thenRebuild?: boolean }).thenRebuild) {
          const rebuildMsg = message as { animation?: string; animationSettings?: Record<string, unknown> };
          await handleRebuild(iconCtx, { animation: rebuildMsg.animation, animationSettings: rebuildMsg.animationSettings });
        }
        break;

      // Variant handlers
      case 'saveVariant':
        // console.log('[Icon Studio] Handling saveVariant command');
        await handleSaveVariant(variantCtx);
        break;
      case 'applyVariant':
        handleApplyVariant(variantCtx, message as { index?: number });
        break;
      case 'applyDefaultVariant':
        handleApplyDefaultVariant(variantCtx);
        break;
      case 'generateAutoVariant':
        handleGenerateAutoVariant(variantCtx, message as { type?: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale' });
        break;
      case 'deleteVariant':
        handleDeleteVariant(variantCtx, message as { index?: number });
        break;
      case 'setDefaultVariant':
        handleSetDefaultVariant(variantCtx, message as { variantName?: string | null });
        break;
      case 'editVariant':
        await handleEditVariant(variantCtx, message as { index?: number });
        break;

      // SVG/Code handlers
      case 'optimizeSvg':
        handleOptimizeSvg(svgCtx, message as { preset?: string });
        break;
      case 'applyOptimizedSvg':
        await handleApplyOptimizedSvg(svgCtx, message as { svg?: string });
        break;
      case 'revertOptimization':
        await handleRevertOptimization(svgCtx);
        break;
      case 'copySvg':
        handleCopySvg(svgCtx, message as { svg?: string });
        break;
      case 'copyWithAnimation':
        handleCopyWithAnimation(svgCtx, message as { animation?: string; settings?: Record<string, unknown> });
        break;
      case 'formatSvgCode':
        handleFormatSvgCode(svgCtx);
        break;
      case 'updateCodeWithAnimation':
        handleUpdateCodeWithAnimation(svgCtx, message as { animation?: string });
        break;
      case 'updateAnimationCode':
        handleUpdateAnimationCode(svgCtx, message as { animation?: string; settings?: Record<string, unknown> });
        break;
      case 'showMessage':
        handleShowMessage(message as { message?: string });
        break;
      case 'insertCodeAtCursor':
        handleInsertCodeAtCursor(message as { code?: string });
        break;

      // Icon handlers
      case 'requestRename':
        await handleRequestRename(iconCtx, message as { currentName?: string });
        break;
      case 'renameIcon':
        await handleRenameIcon(iconCtx, message as { oldName?: string; newName?: string });
        break;
      case 'rebuild':
        await handleRebuild(iconCtx, message as { animation?: string; animationSettings?: Record<string, unknown> });
        break;
      case 'saveAnimation':
        handleSaveAnimation(iconCtx, message as { animation?: string; settings?: Record<string, unknown> });
        break;
      case 'refresh':
        handleRefresh();
        break;
      case 'log':
        // Webview log - no-op in production
        break;
    }
  }

  /**
   * Create context for color handlers
   */
  private _createColorHandlerContext(): ColorHandlerContext {
    return {
      iconData: this._iconData,
      selectedVariantIndex: this._selectedVariantIndex,
      colorService: this._colorService,
      variantsService: this._variantsService,
      postMessage: (msg) => this._panel.webview.postMessage(msg),
      updateSvg: (svg) => { if (this._iconData) this._iconData.svg = svg; },
      setSelectedVariantIndex: (index) => { this._selectedVariantIndex = index; },
      refresh: () => this._update()
    };
  }

  /**
   * Create context for variant handlers
   */
  private _createVariantHandlerContext(): VariantHandlerContext {
    return {
      iconData: this._iconData,
      originalColors: this._originalColors,
      selectedVariantIndex: this._selectedVariantIndex,
      colorService: this._colorService,
      variantsService: this._variantsService,
      updateSvg: (svg) => { if (this._iconData) this._iconData.svg = svg; },
      setSelectedVariantIndex: (index) => { this._selectedVariantIndex = index; },
      refresh: () => this._update(),
      generateAutoVariant: (type) => this._generateAutoVariant(type)
    };
  }

  /**
   * Create context for SVG/code handlers
   */
  private _createSvgCodeHandlerContext(): SvgCodeHandlerContext {
    return {
      iconData: this._iconData,
      postMessage: (msg) => this._panel.webview.postMessage(msg),
      processAndSaveIcon: (options) => this._processAndSaveIcon(options),
      getPreOptimizedSvg: () => this._preOptimizedSvg,
      setPreOptimizedSvg: (svg) => { this._preOptimizedSvg = svg; }
    };
  }

  /**
   * Create context for icon handlers
   */
  private _createIconHandlerContext(): IconHandlerContext {
    return {
      iconData: this._iconData,
      panel: this._panel,
      postMessage: (msg) => this._panel.webview.postMessage(msg),
      updateIconName: (name) => { if (this._iconData) this._iconData.name = name; },
      updateIconLocation: (file) => { if (this._iconData?.location) this._iconData.location.file = file; },
      refresh: () => this._update(),
      addToIconCollection: (animation, settings) => this._addToIconCollection(animation, settings as AnimationSettings | undefined)
    };
  }

  /**
   * Generate HTML for the variants list
   */
  private _generateVariantsHtml(iconName: string): string {
    const variants = this._variantsService.getSavedVariants(iconName);
    
    // Original variant (read-only)
    const originalHtml = `
      <div class="variant-item default${this._selectedVariantIndex === -1 ? ' selected' : ''}"
           onclick="applyDefaultVariant()"
           title="Original colors (read-only)">
        <div class="variant-colors">
          ${this._originalColors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}" title="${c}"></div>`).join('')}
        </div>
        <span class="variant-name">original</span>
        <span class="variant-badge readonly">read-only</span>
      </div>
    `;

    // User-defined variants
    const variantsHtml = variants.map((variant, index) => `
      <div class="variant-item${this._selectedVariantIndex === index ? ' selected' : ''}"
           onclick="applyVariant(${index})"
           title="${variant.name} - Click to edit">
        <div class="variant-colors">
          ${variant.colors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}" title="${c}"></div>`).join('')}
        </div>
        <span class="variant-name">${variant.name}</span>
        <div class="variant-actions">
          <button class="variant-edit" onclick="event.stopPropagation(); editVariant(${index})" title="Edit variant name">
            <span class="codicon codicon-edit"></span>
          </button>
          <button class="variant-delete" onclick="event.stopPropagation(); deleteVariant(${index})" title="Delete variant">
            <span class="codicon codicon-trash"></span>
          </button>
        </div>
      </div>
    `).join('');

    if (variants.length === 0) {
      return originalHtml + `<div class="no-Variants">No custom variants yet. Click + to save current colors.</div>`;
    }

    return originalHtml + variantsHtml;
  }

  // Ensure icon has stored original colors and a "custom" variant for editing
  private _ensureCustomVariant(): void {
    if (!this._iconData) return;
    
    // Use the service's ensureCustomVariant which handles _original and custom variant creation
    this._originalColors = this._variantsService.ensureCustomVariant(this._iconData.name, this._originalColors);
  }

  // ==================== Auto-generate Variants ====================

  private _generateAutoVariant(type: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale'): void {
    if (!this._iconData) return;

    const { colors } = this._colorService.extractColorsFromSvg(this._iconData.svg);
    if (colors.length === 0) return;

    const { colors: newColors, variantName } = this._colorService.generateAutoVariantColors(colors, type);
    if (!variantName) return;

    // Check if variant already exists and add number suffix
    const existingVariants = this._variantsService.getSavedVariants(this._iconData.name);
    const existingNames = existingVariants.map(v => v.name);
    let finalName = variantName;
    let counter = 2;
    while (existingNames.includes(finalName)) {
      finalName = `${variantName} ${counter}`;
      counter++;
    }

    this._variantsService.saveVariant(this._iconData.name, finalName, newColors);

    // Apply the new variant
    let newSvg = this._iconData.svg;
    for (let i = 0; i < colors.length; i++) {
      newSvg = this._colorService.replaceColorInSvg(newSvg, colors[i], newColors[i]);
    }
    this._iconData.svg = newSvg;
    this._selectedVariantIndex = this._variantsService.getSavedVariants(this._iconData.name).length - 1;

    this._update();
    vscode.window.showInformationMessage(t('messages.variantGenerated', { name: finalName }));
  }

  // Animation storage methods - use animations.js in output directory
  private _getOutputPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const outputDir = getSvgConfig<string>('outputDirectory', 'bezier-icons');
    if (!workspaceFolders || !outputDir) return undefined;
    return path.join(workspaceFolders[0].uri.fsPath, outputDir);
  }

  private _getIconsFilePath(): string | undefined {
    const outputPath = this._getOutputPath();
    if (!outputPath) return undefined;
    return path.join(outputPath, 'icons.js');
  }

  private _readIconAnimation(iconName: string): AnimationConfig | undefined {
    // First, check the AnimationAssignmentService (animations.js)
    try {
      const animService = getAnimationService();
      const assigned = animService.getAnimation(iconName);
      if (assigned && assigned.type && assigned.type !== 'none') {
        return {
          type: assigned.type,
          duration: assigned.duration || 1,
          timing: assigned.timing || 'ease',
          iteration: assigned.iteration || 'infinite',
          delay: assigned.delay,
          direction: assigned.direction
        };
      }
    } catch (err) {
      console.error('[Icon Studio] Error reading from AnimationAssignmentService:', err);
    }
    
    // Fallback: check the icons.js file for embedded animation
    try {
      const filePath = this._getIconsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return undefined;

      const content = fs.readFileSync(filePath, 'utf-8');
      const varName = iconName.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
      
      // Pattern to find the specific icon export and extract its animation property
      // We need to be careful not to match animations from other icons
      // First, find the specific icon's definition
      const iconStartPattern = new RegExp(
        String.raw`export\s+const\s+${varName}\s*=\s*\{`,
        'g'
      );
      
      const startMatch = iconStartPattern.exec(content);
      if (!startMatch) return undefined;
      
      // Find the end of this icon definition (next export or end of file)
      const startIndex = startMatch.index;
      const nextExportMatch = content.slice(startIndex + 1).match(/\nexport\s+const\s+/);
      const endIndex = nextExportMatch 
        ? startIndex + 1 + nextExportMatch.index! 
        : content.length;
      
      // Extract just this icon's definition
      const iconDefinition = content.slice(startIndex, endIndex);
      
      // Now look for animation within this specific icon only
      const animationMatch = iconDefinition.match(/animation:\s*(\{[^}]+\})/);
      if (!animationMatch) return undefined;
      
      // Parse animation object
      return new Function(`return ${animationMatch[1]}`)() as AnimationConfig;
    } catch {
      return undefined;
    }
  }

  private async _saveAnimation(iconName: string, type: string, settings: { duration: number; timing: string; iteration: string; delay?: number; direction?: string }): Promise<void> {
    const outputPath = this._getOutputPath();
    if (!outputPath) return;

    const animation: AnimationConfig = {
      type,
      duration: settings.duration,
      timing: settings.timing,
      iteration: settings.iteration,
      delay: settings.delay,
      direction: settings.direction
    };

    await updateIconAnimation(outputPath, iconName, animation);
  }

  private async _removeAnimation(iconName: string): Promise<void> {
    const outputPath = this._getOutputPath();
    if (!outputPath) return;
    
    await updateIconAnimation(outputPath, iconName, null);
  }

  private _getIconAnimation(iconName: string): { type: string; duration: number; timing: string; iteration: string; delay?: number; direction?: string } | undefined {
    return this._readIconAnimation(iconName);
  }

  private async _processAndSaveIcon(options: {
    svg: string;
    animation?: string;
    animationSettings?: AnimationSettings;
    includeAnimationInFile?: boolean;
    updateAnimationMetadata?: boolean;
    triggerFullRebuild?: boolean;
    successMessage?: string;
    skipPanelUpdate?: boolean;
  }): Promise<void> {
    if (!this._iconData) {
        return;
    }

    let svgToSave = options.svg;

    // 1. Clean up old animations
    svgToSave = SvgManipulationService.cleanAnimationFromSvg(svgToSave);
    
    // 2. Ensure namespace
    svgToSave = SvgManipulationService.ensureSvgNamespace(svgToSave);

    // 3. Embed animation in SVG content if requested
    if (options.includeAnimationInFile && options.animation && options.animation !== 'none') {
      const settings = options.animationSettings || { duration: 2, timing: 'linear', iteration: 'infinite' };
      svgToSave = SvgManipulationService.embedAnimationInSvg(
        svgToSave,
        options.animation,
        settings
      );
    }
    
    // 4. Update internal state
    this._iconData.svg = svgToSave;

    // 5. Update animation metadata (animations.js) if requested
    if (options.updateAnimationMetadata) {
      if (options.animation && options.animation !== 'none') {
        const settings = options.animationSettings || { duration: 2, timing: 'linear', iteration: 'infinite' };
        await this._saveAnimation(this._iconData.name, options.animation, settings);
      } else {
        await this._removeAnimation(this._iconData.name);
      }
    }

    // 6. Save to disk
    if (this._iconData.spriteFile) {
      // Icon from sprite.svg - update the sprite file
      const updated = await this._updateSpriteFile(svgToSave);
      if (!updated) {
        vscode.window.showWarningMessage(t('messages.couldNotUpdateSprite'));
        return;
      }
      // Trigger rebuild after updating sprite
      if (options.triggerFullRebuild) {
        vscode.commands.executeCommand('iconManager.buildIcons');
      }
    } else {
      // Update icons.js directly
      const updated = await this._updateBuiltIconsFile(svgToSave);
      if (!updated) {
        vscode.window.showWarningMessage(t('messages.couldNotFindIconsJs'));
        return;
      }
    }

    // 7. Post-save updates
    this._originalColors = this._colorService.extractColorsFromSvg(svgToSave).colors;
    
    if (!options.skipPanelUpdate) {
      this._update();
    }
    
    // 8. Refresh tree view partially (preserves expansion state)
    // Use partial refresh by icon name to avoid collapsing tree branches
    await vscode.commands.executeCommand('iconManager.refreshIconByName', this._iconData.name);
    
    // 9. Notify
    if (options.successMessage) {
      vscode.window.showInformationMessage(options.successMessage);
    }
  }

  /**
   * Add icon to the icon collection
   * Uses buildFormat from config: sprite.svg OR icons.js (not both)
   * Saves the ORIGINAL SVG (without color modifications) to icons.js
   * Color mappings are saved separately in variants.js
   */
  private async _addToIconCollection(
    animation?: string,
    animationSettings?: AnimationSettings
  ): Promise<void> {
    if (!this._iconData) {
      vscode.window.showWarningMessage(t('messages.noIconData'));
      return;
    }

    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    try {
      // Get build format from config
      const config = getConfig();
      const isSprite = config.buildFormat === 'sprite.svg';

      // Use ORIGINAL SVG (without color modifications) for storage
      // Color changes are stored as colorMappings in variants.js
      let svgToAdd = this._originalSvg || this._iconData.svg;
      
      // 1. Clean the SVG and ensure namespace
      svgToAdd = SvgManipulationService.cleanAnimationFromSvg(svgToAdd);
      svgToAdd = SvgManipulationService.ensureSvgNamespace(svgToAdd);

      // 2. Ensure SVG has an ID for animation/variation reference
      svgToAdd = getIconPersistenceService().ensureSvgId(svgToAdd, this._iconData.name);

      const transformer = new SvgTransformer();
      
      if (isSprite) {
        // Add to sprite.svg (no animation config for sprites)
        await addToSpriteSvg(outputPath, this._iconData.name, svgToAdd, transformer);
        
        // Update internal state
        this._iconData.svg = svgToAdd;
        this._iconData.spriteFile = path.join(outputPath, 'sprite.svg');
        
        vscode.window.showInformationMessage(t('messages.iconAddedToSprite', { name: this._iconData.name }));
      } else {
        // Add to icons.js with optional animation
        let animConfig: AnimationConfig | undefined;
        if (animation && animation !== 'none') {
          const settings = animationSettings || { duration: 1, timing: 'ease', iteration: 'infinite' };
          animConfig = {
            type: animation,
            duration: settings.duration,
            timing: settings.timing,
            iteration: settings.iteration,
            delay: settings.delay,
            direction: settings.direction
          };
        }

        await addToIconsJs(outputPath, this._iconData.name, svgToAdd, transformer, animConfig);

        // Update internal state
        this._iconData.svg = svgToAdd;
        this._iconData.iconsFile = path.join(outputPath, 'icons.js');

        if (animConfig) {
          vscode.window.showInformationMessage(t('messages.iconAddedWithAnimation', { name: this._iconData.name }));
        } else {
          vscode.window.showInformationMessage(t('messages.iconAddedToIconsJs', { name: this._iconData.name }));
        }
        
        // Refresh tree views without collapsing:
        // - FILES: partial refresh to update "(built)" label
        // - BUILT: add icon to cache and refresh only icons.js container
        await vscode.commands.executeCommand('iconManager.refreshFilesItemByName', this._iconData.name);
        await vscode.commands.executeCommand('iconManager.addIconToBuiltAndRefresh', this._iconData.name, svgToAdd, this._iconData.iconsFile);
      }

      // Persist cached variants to file on build
      if (this._variantsService.hasUnsavedChanges) {
        this._variantsService.persistToFile();
      }

      // Update panel
      this._update();

    } catch (error: any) {
      vscode.window.showErrorMessage(t('messages.failedToAddIcon', { error: error.message }));
    }
  }

  /**
   * Update icon in sprite.svg file (delegates to persistence service)
   */
  private async _updateSpriteFile(svg: string): Promise<boolean> {
    if (!this._iconData?.name || !this._iconData.spriteFile) {
      return false;
    }
    return getIconPersistenceService().updateSpriteFile(
      this._iconData.name,
      svg,
      this._iconData.spriteFile,
      this._iconData.viewBox
    );
  }

  /**
   * Update icon in icons.js file (delegates to persistence service)
   */
  private async _updateBuiltIconsFile(svg: string): Promise<boolean> {
    if (!this._iconData?.name) {
      return false;
    }
    return getIconPersistenceService().updateBuiltIconsFile(this._iconData.name, svg);
  }

  public dispose() {
    IconEditorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _update() {
    if (this._iconData) {
      this._panel.title = `Edit: ${this._iconData.name}`;
    }
    const html = this._getHtmlForWebview();
    this._panel.webview.html = html;
    
    // Re-send optimization stats after update
    if (this._iconData?.svg) {
      setTimeout(() => this._sendOptimizationStats(), 100);
    }
  }

  private _getHtmlForWebview(): string {
    if (!this._iconData) {
      return '<html><body><p>No icon selected</p></body></html>';
    }

    const { name, svg, location, isBuilt, animation } = this._iconData;
    const defaultVariant = this._variantsService.getDefaultVariant(name);
    const savedAnimation = this._getIconAnimation(name);
    
    // Detect embedded animation in SVG
    let detectedAnimation = SvgManipulationService.detectAnimationFromSvg(svg);
    // If animation was passed (from built icon), use it
    if (!detectedAnimation && animation) {
        detectedAnimation = { type: animation.type, settings: animation };
    }
    // If no embedded animation and no passed animation, check the external config
    if (!detectedAnimation && savedAnimation) {
        detectedAnimation = { type: savedAnimation.type, settings: savedAnimation };
    }

    // Extract colors from SVG
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    const specialColors = new Set<string>();

    let colorMatch;
    while ((colorMatch = colorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        specialColors.add('currentColor');
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    while ((colorMatch = styleColorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        specialColors.add('currentColor');
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    const allColors = Array.from(colorsSet);
    const totalColorCount = allColors.length;
    const MAX_COLORS_TO_SHOW = 50;
    const svgColors = allColors.slice(0, MAX_COLORS_TO_SHOW);
    const hasMoreColors = totalColorCount > MAX_COLORS_TO_SHOW;
    const hasCurrentColor = specialColors.has('currentColor');

    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }

    const fileSize = new Blob([svg]).size;
    const fileSizeStr = fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;

    // Load templates from external files
    const templatesDir = path.join(this._extensionUri.fsPath, 'src', 'templates', 'icon-editor');
    const tabsDir = path.join(templatesDir, 'tabs');
    
    let cssContent: string, jsTemplate: string, bodyTemplate: string;
    let colorTabTemplate: string, animationTabTemplate: string, codeTabTemplate: string;
    
    try {
      // Load and concatenate CSS files
      const baseCss = fs.readFileSync(path.join(templatesDir, 'IconEditor.css'), 'utf-8');
      const colorCss = fs.readFileSync(path.join(tabsDir, 'IconEditorColor.css'), 'utf-8');
      const filtersCss = fs.readFileSync(path.join(tabsDir, 'IconEditorFilters.css'), 'utf-8');
      const animationCss = fs.readFileSync(path.join(tabsDir, 'IconEditorAnimation.css'), 'utf-8');
      const codeCss = fs.readFileSync(path.join(tabsDir, 'IconEditorCode.css'), 'utf-8');
      cssContent = baseCss + '\n' + colorCss + '\n' + filtersCss + '\n' + animationCss + '\n' + codeCss;
      
      jsTemplate = fs.readFileSync(path.join(templatesDir, 'IconEditor.js'), 'utf-8');
      bodyTemplate = fs.readFileSync(path.join(templatesDir, 'IconEditorBody.html'), 'utf-8');
      colorTabTemplate = fs.readFileSync(path.join(tabsDir, 'IconEditorColorTab.html'), 'utf-8');
      animationTabTemplate = fs.readFileSync(path.join(tabsDir, 'IconEditorAnimationTab.html'), 'utf-8');
      codeTabTemplate = fs.readFileSync(path.join(tabsDir, 'IconEditorCodeTab.html'), 'utf-8');
    } catch (err) {
      console.error('[Icon Studio] IconEditorPanel template load error:', err);
      return '<html><body><p>Error loading templates</p></body></html>';
    }
    
    // Replace template variables in JS
    const i18nObject = {
      svgWillIncludeAnimation: t('webview.js.svgWillIncludeAnimation'),
      svgCodeCopied: t('webview.js.svgCodeCopied'),
      animationCssCopied: t('webview.js.animationCssCopied'),
      usageCodeCopied: t('webview.js.usageCodeCopied'),
      optimizeSvgo: t('webview.js.optimizeSvgo'),
      optimal: t('webview.js.optimal'),
      alreadyOptimized: t('webview.js.alreadyOptimized'),
      selectAnimationToEnable: t('webview.js.selectAnimationToEnable'),
      originalColor: t('webview.js.originalColor'),
      addFillColor: t('webview.js.addFillColor'),
      noColorsDetected: t('webview.js.noColorsDetected')
    };
    
    const jsContent = jsTemplate
      .replace(/__I18N__/g, JSON.stringify(i18nObject))
      .replace(/__ANIMATION_TYPE__/g, JSON.stringify(detectedAnimation?.type || 'none'))
      .replace(/__ANIMATION_DURATION__/g, JSON.stringify(detectedAnimation?.settings?.duration || 1))
      .replace(/__ANIMATION_TIMING__/g, JSON.stringify(detectedAnimation?.settings?.timing || 'ease'))
      .replace(/__ANIMATION_ITERATION__/g, JSON.stringify(detectedAnimation?.settings?.iteration || 'infinite'))
      .replace(/__ANIMATION_DELAY__/g, JSON.stringify(detectedAnimation?.settings?.delay || 0))
      .replace(/__ANIMATION_DIRECTION__/g, JSON.stringify(detectedAnimation?.settings?.direction || 'normal'))
      .replace(/__ORIGINAL_COLORS__/g, JSON.stringify(this._originalColors))
      .replace(/__CURRENT_COLORS__/g, JSON.stringify(svgColors));

    // Generate tab contents using templates (delegate to service where possible)
    const templateService = getIconEditorTemplateService();
    const colorTabContent = this._generateColorTabHtml(colorTabTemplate, hasMoreColors, totalColorCount, svgColors, hasCurrentColor);
    const animationTabContent = templateService.generateAnimationTabHtml(animationTabTemplate, detectedAnimation);
    const codeTabContent = templateService.generateCodeTabHtml(codeTabTemplate, name, svg, detectedAnimation);

    // Generate HTML body from template
    const htmlBody = templateService.generateHtmlBody(bodyTemplate, {
      name, displaySvg, fileSizeStr, isBuilt,
      colorTabContent, animationTabContent, codeTabContent,
      animationName: detectedAnimation?.type
    });

    // Get webview CSP source
    const cspSource = this._panel.webview.cspSource;
    
    console.log('[Icon Studio] JS Content length:', jsContent.length);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' https://unpkg.com; script-src 'unsafe-inline' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource} https://unpkg.com;">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>
${cssContent}
  </style>
</head>
${htmlBody}
  <script>
${jsContent}
  </script>
</body>
</html>`;
  }

  /**
   * Generate Color Tab HTML from template
   */
  private _generateColorTabHtml(
    template: string,
    hasMoreColors: boolean,
    totalColorCount: number,
    svgColors: string[],
    hasCurrentColor: boolean
  ): string {
    if (hasMoreColors) {
      return `
        <div class="section disabled-section">
          <div class="section-title">
            <span class="codicon codicon-paintcan"></span> Colors
          </div>
          <div class="colors-warning">
            <span class="codicon codicon-warning"></span>
            This SVG has ${totalColorCount} unique colors. Color editing is disabled for rasterized SVGs.
          </div>
        </div>
        <div class="section disabled-section">
          <div class="section-title">
            <span class="codicon codicon-symbol-color"></span> Variants
          </div>
          <div class="Variants-disabled-message">
            <span class="codicon codicon-info"></span> Variants disabled for SVGs with too many colors
          </div>
        </div>
      `;
    }

    const colorSwatches = svgColors.map((color, index) => {
      const escapedColor = color.replace(/'/g, "\\'").replace(/"/g, '\\"');
      return `
      <div class="color-item" title="Click to change color">
        <div class="color-swatch" style="background-color: ${color}">
          <input type="color" value="${this._colorService.toHexColor(color)}" 
            data-original-color="${escapedColor}"
            onchange="changeColor(this.dataset.originalColor, this.value)"
            oninput="previewColor(this.dataset.originalColor, this.value)" />
        </div>
        <span class="color-label" onclick="copyToClipboard('${escapedColor}')" title="Click to copy: ${color}">${color}</span>
      </div>
    `;
    }).join('');

    const currentColorHtml = hasCurrentColor ? `
      <div class="current-color-item">
        <div class="current-color-swatch" title="currentColor - inherits from CSS">
          <input type="color" value="#000000" 
            onchange="replaceCurrentColor(this.value)" />
          <span class="current-color-icon codicon codicon-paintcan"></span>
        </div>
        <span class="current-color-label">currentColor</span>
      </div>
    ` : '';

    const isOriginalSelected = this._selectedVariantIndex === -1;

    return template
      .replace(/\$\{colorsDisabledClass\}/g, isOriginalSelected ? ' colors-disabled' : '')
      .replace(/\$\{colorsHint\}/g, isOriginalSelected ? '<span class="colors-hint">(select custom to edit)</span>' : '')
      .replace(/\$\{swatchesDisabledClass\}/g, isOriginalSelected ? ' disabled' : '')
      .replace(/\$\{filtersDisabledClass\}/g, isOriginalSelected ? ' colors-disabled' : '')
      .replace(/\$\{filtersHint\}/g, isOriginalSelected ? '<span class="colors-hint">(select custom)</span>' : '')
      .replace(/\$\{filtersContainerDisabledClass\}/g, isOriginalSelected ? ' disabled' : '')
      .replace(/\$\{filtersDisabled\}/g, isOriginalSelected ? ' disabled' : '')
      .replace(/\$\{currentColorHtml\}/g, currentColorHtml)
      .replace(/\$\{colorSwatches\}/g, colorSwatches)
      .replace(/\$\{variantsHtml\}/g, this._generateVariantsHtml(this._iconData?.name || ''))
      // i18n translations for color tab
      .replace(/\$\{i18n_colors\}/g, t('webview.color.colors'))
      .replace(/\$\{i18n_globalFilters\}/g, t('webview.color.globalFilters'))
      .replace(/\$\{i18n_hueRotate\}/g, t('webview.color.hueRotate'))
      .replace(/\$\{i18n_saturation\}/g, t('webview.color.saturation'))
      .replace(/\$\{i18n_brightness\}/g, t('webview.color.brightness'))
      .replace(/\$\{i18n_reset\}/g, t('webview.color.reset'))
      .replace(/\$\{i18n_resetFilters\}/g, t('webview.color.resetFilters'))
      .replace(/\$\{i18n_variants\}/g, t('webview.color.variants'))
      .replace(/\$\{i18n_saveVariant\}/g, t('webview.color.saveVariant'));
  }
}


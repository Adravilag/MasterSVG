/**
 * Message handlers for IconDetailsPanel
 * Extracted to reduce complexity and improve maintainability
 */
import * as vscode from 'vscode';
import { SvgOptimizer } from '../../services/SvgOptimizer';
import { ColorService } from '../../services/ColorService';
import { getVariantsService } from '../../services/VariantsService';
import { t } from '../../i18n';

const svgOptimizer = new SvgOptimizer();
const colorService = new ColorService();

export interface IconDetails {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  isBuilt?: boolean;
  animation?: IconAnimation;
}

export interface IconAnimation {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

export interface PanelContext {
  iconDetails?: IconDetails;
  originalColors: string[];
  selectedVariantIndex: number;
  panel: vscode.WebviewPanel;
  update: () => void;
  setIconDetails: (details: IconDetails) => void;
  setSelectedVariantIndex: (index: number) => void;
}

// =====================================================
// Navigation Handlers
// =====================================================

export async function handleGoToLocation(ctx: PanelContext): Promise<void> {
  if (ctx.iconDetails?.location) {
    const uri = vscode.Uri.file(ctx.iconDetails.location.file);
    const position = new vscode.Position(ctx.iconDetails.location.line - 1, 0);
    await vscode.window.showTextDocument(uri, {
      selection: new vscode.Range(position, position),
      preview: false
    });
  }
}

export async function handleGoToUsage(message: { file: string; line: number }): Promise<void> {
  if (message.file && message.line) {
    const uri = vscode.Uri.file(message.file);
    const position = new vscode.Position(message.line - 1, 0);
    await vscode.window.showTextDocument(uri, {
      selection: new vscode.Range(position, position),
      preview: true
    });
  }
}

// =====================================================
// Copy Handlers
// =====================================================

export async function handleCopyName(ctx: PanelContext): Promise<void> {
  if (ctx.iconDetails?.name) {
    await vscode.env.clipboard.writeText(ctx.iconDetails.name);
    vscode.window.showInformationMessage(t('messages.copiedNameToClipboard', { name: ctx.iconDetails.name }));
  }
}

export async function handleCopySvg(ctx: PanelContext, message: { svg?: string }): Promise<void> {
  const svgToCopy = message.svg || ctx.iconDetails?.svg;
  if (svgToCopy) {
    await vscode.env.clipboard.writeText(svgToCopy);
    vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
  }
}

// =====================================================
// Editor Handlers
// =====================================================

export async function handleOpenEditor(ctx: PanelContext): Promise<void> {
  if (ctx.iconDetails) {
    await vscode.commands.executeCommand('iconManager.colorEditor', {
      icon: {
        name: ctx.iconDetails.name,
        svg: ctx.iconDetails.svg,
        path: ctx.iconDetails.location?.file,
        line: ctx.iconDetails.location?.line,
        isBuilt: ctx.iconDetails.isBuilt
      }
    });
  }
}

// =====================================================
// Optimization Handlers
// =====================================================

export async function handleOptimizeSvg(ctx: PanelContext, message: { preset?: string }): Promise<void> {
  if (ctx.iconDetails?.svg) {
    const preset = message.preset || 'safe';
    const presets = svgOptimizer.getPresets();
    const result = svgOptimizer.optimize(ctx.iconDetails.svg, presets[preset] || presets.safe);
    
    await ctx.panel.webview.postMessage({
      command: 'optimizeResult',
      ...result,
      originalSizeStr: svgOptimizer.formatSize(result.originalSize),
      optimizedSizeStr: svgOptimizer.formatSize(result.optimizedSize)
    });
    
    if (result.savingsPercent > 0) {
      vscode.window.showInformationMessage(
        `SVG optimized! Saved ${svgOptimizer.formatSize(result.savings)} (${result.savingsPercent.toFixed(1)}%)`
      );
    } else {
      vscode.window.showInformationMessage(t('messages.svgAlreadyOptimized'));
    }
  }
}

export function handleApplyOptimizedSvg(ctx: PanelContext, message: { svg: string }): void {
  if (ctx.iconDetails && message.svg) {
    ctx.setIconDetails({ ...ctx.iconDetails, svg: message.svg });
    vscode.window.showInformationMessage(t('messages.optimizedSvgApplied'));
  }
}

// =====================================================
// Color Handlers
// =====================================================

export async function handleChangeColor(ctx: PanelContext, message: { oldColor: string; newColor: string }): Promise<void> {
  if (ctx.iconDetails?.svg && message.oldColor && message.newColor) {
    const updatedSvg = colorService.replaceColorInSvg(ctx.iconDetails.svg, message.oldColor, message.newColor);
    ctx.setIconDetails({ ...ctx.iconDetails, svg: updatedSvg });
    await ctx.panel.webview.postMessage({
      command: 'colorChanged',
      svg: updatedSvg
    });
  }
}

export function handleAddColorToSvg(ctx: PanelContext, message: { color: string }): void {
  if (ctx.iconDetails?.svg && message.color) {
    let updatedSvg = ctx.iconDetails.svg;
    if (updatedSvg.includes('fill=')) {
      updatedSvg = updatedSvg.replace(/<svg([^>]*)fill=["'][^"']*["']/, `<svg$1fill="${message.color}"`);
    } else {
      updatedSvg = updatedSvg.replace(/<svg/, `<svg fill="${message.color}"`);
    }
    ctx.setIconDetails({ ...ctx.iconDetails, svg: updatedSvg });
    ctx.update();
    vscode.window.showInformationMessage(t('messages.addedFillColor', { color: message.color }));
  }
}

// =====================================================
// Variant Handlers
// =====================================================

export function handleApplyVariant(ctx: PanelContext, message: { index: number }): void {
  if (ctx.iconDetails && message.index !== undefined) {
    const variantsService = getVariantsService();
    const variants = variantsService.getSavedVariants(ctx.iconDetails.name);
    const variant = variants[message.index];
    
    if (variant) {
      const { colors: currentColors } = colorService.extractAllColorsFromSvg(ctx.iconDetails.svg);
      let newSvg = ctx.iconDetails.svg;
      
      for (let i = 0; i < Math.min(currentColors.length, variant.colors.length); i++) {
        newSvg = colorService.replaceColorInSvg(newSvg, currentColors[i], variant.colors[i]);
      }
      
      ctx.setIconDetails({ ...ctx.iconDetails, svg: newSvg });
      ctx.setSelectedVariantIndex(message.index);
      ctx.update();
    }
  }
}

export function handleApplyDefaultVariant(ctx: PanelContext): void {
  if (ctx.iconDetails && ctx.originalColors.length > 0) {
    const { colors: currentColors } = colorService.extractAllColorsFromSvg(ctx.iconDetails.svg);
    let newSvg = ctx.iconDetails.svg;
    
    for (let i = 0; i < Math.min(currentColors.length, ctx.originalColors.length); i++) {
      newSvg = colorService.replaceColorInSvg(newSvg, currentColors[i], ctx.originalColors[i]);
    }
    
    ctx.setIconDetails({ ...ctx.iconDetails, svg: newSvg });
    ctx.setSelectedVariantIndex(-1);
    ctx.update();
  }
}

export async function handleSaveVariant(ctx: PanelContext): Promise<void> {
  if (ctx.iconDetails) {
    const variantName = await vscode.window.showInputBox({
      prompt: t('editor.enterVariantName'),
      placeHolder: t('editor.variantPlaceholder')
    });
    
    if (variantName) {
      const { colors } = colorService.extractAllColorsFromSvg(ctx.iconDetails.svg);
      const variantsService = getVariantsService();
      variantsService.saveVariant(ctx.iconDetails.name, variantName, colors);
      variantsService.persistToFile();
      ctx.update();
      vscode.window.showInformationMessage(t('messages.variantSaved', { name: variantName }));
    }
  }
}

export function handleDeleteVariant(ctx: PanelContext, message: { index: number }): void {
  if (ctx.iconDetails && message.index !== undefined) {
    const variantsService = getVariantsService();
    variantsService.deleteVariant(ctx.iconDetails.name, message.index);
    
    // If deleted variant was the default, clear default
    const variants = variantsService.getSavedVariants(ctx.iconDetails.name);
    const variantNames = variants.map(s => s.name);
    const currentDefault = variantsService.getDefaultVariant(ctx.iconDetails.name);
    
    if (currentDefault && !variantNames.includes(currentDefault)) {
      variantsService.setDefaultVariant(ctx.iconDetails.name, null);
    }
    
    variantsService.persistToFile();
    
    if (ctx.selectedVariantIndex === message.index) {
      ctx.setSelectedVariantIndex(-1);
    } else if (ctx.selectedVariantIndex > message.index) {
      ctx.setSelectedVariantIndex(ctx.selectedVariantIndex - 1);
    }
    
    ctx.update();
  }
}

export function handleSetDefaultVariant(ctx: PanelContext, message: { variantName: string | null }): void {
  if (ctx.iconDetails) {
    const variantsService = getVariantsService();
    variantsService.setDefaultVariant(ctx.iconDetails.name, message.variantName);
    variantsService.persistToFile();
    ctx.update();
    
    if (message.variantName) {
      vscode.window.showInformationMessage(t('messages.variantSetAsDefault', { name: message.variantName, iconName: ctx.iconDetails.name }));
    } else {
      vscode.window.showInformationMessage(t('messages.defaultVariantCleared', { iconName: ctx.iconDetails.name }));
    }
  }
}

// =====================================================
// Message Router
// =====================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleMessage(ctx: PanelContext, message: any): Promise<void> {
  switch (message.command) {
    case 'goToLocation':
      await handleGoToLocation(ctx);
      break;
    case 'copyName':
      await handleCopyName(ctx);
      break;
    case 'copySvg':
      await handleCopySvg(ctx, message);
      break;
    case 'openEditor':
      await handleOpenEditor(ctx);
      break;
    case 'optimizeSvg':
      await handleOptimizeSvg(ctx, message);
      break;
    case 'applyOptimizedSvg':
      handleApplyOptimizedSvg(ctx, message);
      break;
    case 'changeColor':
      await handleChangeColor(ctx, message);
      break;
    case 'addColorToSvg':
      handleAddColorToSvg(ctx, message);
      break;
    case 'goToUsage':
      await handleGoToUsage(message);
      break;
    case 'applyVariant':
      handleApplyVariant(ctx, message);
      break;
    case 'applyDefaultVariant':
      handleApplyDefaultVariant(ctx);
      break;
    case 'saveVariant':
      await handleSaveVariant(ctx);
      break;
    case 'deleteVariant':
      handleDeleteVariant(ctx, message);
      break;
    case 'setDefaultVariant':
      handleSetDefaultVariant(ctx, message);
      break;
  }
}


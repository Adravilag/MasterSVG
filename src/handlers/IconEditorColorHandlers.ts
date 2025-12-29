import * as vscode from 'vscode';
import { ColorService } from '../services/ColorService';
import { VariantsService } from '../services/VariantsService';
import { SvgManipulationService } from '../services/SvgManipulationService';
import { t } from '../i18n';

/**
 * Context passed to color handlers
 */
export interface ColorHandlerContext {
  iconData: {
    name: string;
    svg: string;
  } | undefined;
  selectedVariantIndex: number;
  colorService: ColorService;
  variantsService: VariantsService;
  postMessage: (message: unknown) => void;
  updateSvg: (svg: string) => void;
  setSelectedVariantIndex: (index: number) => void;
  refresh: () => void;
}

/**
 * Handle preview color change (picker still open)
 */
export function handlePreviewColor(
  ctx: ColorHandlerContext,
  message: { oldColor?: string; newColor?: string }
): void {
  if (!ctx.iconData?.svg || !message.oldColor || !message.newColor) return;

  const updatedSvg = ctx.colorService.replaceColorInSvg(
    ctx.iconData.svg,
    message.oldColor,
    message.newColor
  );
  ctx.postMessage({
    command: 'previewUpdated',
    svg: updatedSvg
  });
  
  // Extract colors from updated SVG for custom variant display
  const { colors } = ctx.colorService.extractColorsFromSvg(updatedSvg);
  
  // Update TreeView preview in real-time with current colors
  vscode.commands.executeCommand('iconManager.updateTreeViewPreview', ctx.iconData.name, updatedSvg, colors);
}

/**
 * Handle color change (picker closed)
 * Stores color mapping in variants.js instead of modifying SVG directly
 */
export function handleChangeColor(
  ctx: ColorHandlerContext,
  message: { oldColor?: string; newColor?: string; originalColor?: string }
): void {
  if (!ctx.iconData?.svg || !message.oldColor || !message.newColor) return;

  // Get the original color (before any transformations)
  // This is the color that was in the SVG when first loaded
  const originalColor = message.originalColor || message.oldColor;

  // Store the color mapping: originalColor → newColor
  ctx.variantsService.setColorMapping(ctx.iconData.name, originalColor, message.newColor);

  // Update preview SVG with the new color (for visual feedback)
  const updatedSvg = ctx.colorService.replaceColorInSvg(
    ctx.iconData.svg,
    message.oldColor,
    message.newColor
  );
  ctx.updateSvg(updatedSvg);

  // Use filtered extraction - only save editable colors (excludes SMIL secondary)
  const { colors } = ctx.colorService.extractColorsFromSvg(updatedSvg);
  
  // Update TreeView preview with current colors for real-time custom variant display
  vscode.commands.executeCommand('iconManager.updateTreeViewPreview', ctx.iconData.name, updatedSvg, colors);

  // If in "original" (read-only), switch to "custom" automatically
  let targetVariantIndex = ctx.selectedVariantIndex;
  if (ctx.selectedVariantIndex === -1) {
    const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
    const customIndex = variants.findIndex(v => v.name === 'custom');
    if (customIndex >= 0) {
      targetVariantIndex = customIndex;
      ctx.setSelectedVariantIndex(customIndex);
      ctx.variantsService.updateVariantColors(ctx.iconData.name, customIndex, colors);
    }
  } else {
    ctx.variantsService.updateVariantColors(ctx.iconData.name, ctx.selectedVariantIndex, colors);
  }

  // Send message to update variant color dots in the webview
  ctx.postMessage({
    command: 'variantColorsUpdated',
    variantIndex: targetVariantIndex,
    colors: colors
  });

  ctx.refresh();
}

/**
 * Handle replacing currentColor with a specific color
 */
export function handleReplaceCurrentColor(
  ctx: ColorHandlerContext,
  message: { newColor?: string }
): void {
  if (!ctx.iconData?.svg || !message.newColor) return;

  const updatedSvg = ctx.colorService.replaceColorInSvg(
    ctx.iconData.svg,
    'currentColor',
    message.newColor
  );
  ctx.updateSvg(updatedSvg);

  const { colors } = ctx.colorService.extractColorsFromSvg(updatedSvg);

  let targetVariantIndex = ctx.selectedVariantIndex;
  if (ctx.selectedVariantIndex === -1) {
    const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
    const customIndex = variants.findIndex(v => v.name === 'custom');
    if (customIndex >= 0) {
      targetVariantIndex = customIndex;
      ctx.setSelectedVariantIndex(customIndex);
      ctx.variantsService.updateVariantColors(ctx.iconData.name, customIndex, colors);
    }
  } else {
    ctx.variantsService.updateVariantColors(ctx.iconData.name, ctx.selectedVariantIndex, colors);
  }

  // Send message to update variant color dots in the webview
  ctx.postMessage({
    command: 'variantColorsUpdated',
    variantIndex: targetVariantIndex,
    colors: colors
  });

  ctx.refresh();
}

/**
 * Handle adding fill color to elements without one
 */
export function handleAddFillColor(
  ctx: ColorHandlerContext,
  message: { color?: string }
): void {
  if (!ctx.iconData?.svg || !message.color) return;

  let updatedSvg = ctx.iconData.svg;
  // Add fill to paths that don't have fill attribute
  updatedSvg = updatedSvg.replace(
    /<path(?![^>]*fill=)([^>]*)\/?>/gi,
    `<path fill="${message.color}"$1/>`
  );
  // Also add to circles, rects, etc. that don't have fill
  updatedSvg = updatedSvg.replace(
    /<(circle|rect|ellipse|polygon|polyline)(?![^>]*fill=)([^>]*)\/?>/gi,
    `<$1 fill="${message.color}"$2/>`
  );

  ctx.updateSvg(updatedSvg);
  ctx.refresh();
}

/**
 * Handle adding color to SVG root
 */
export function handleAddColor(
  ctx: ColorHandlerContext,
  message: { color?: string }
): void {
  if (!ctx.iconData?.svg || !message.color) return;

  let updatedSvg = ctx.iconData.svg;
  if (updatedSvg.includes('fill=')) {
    updatedSvg = updatedSvg.replace(
      /<svg([^>]*)fill=["'][^"']*["']/,
      `<svg$1fill="${message.color}"`
    );
  } else {
    updatedSvg = updatedSvg.replace(/<svg/, `<svg fill="${message.color}"`);
  }

  ctx.updateSvg(updatedSvg);
  ctx.refresh();
}

/**
 * Handle applying CSS filters to SVG - converts filtered colors to real colors
 */
export function handleApplyFilters(
  ctx: ColorHandlerContext,
  message: { filters: { hue: string; saturation: string; brightness: string } }
): void {
  if (!ctx.iconData?.svg) return;

  const hue = parseInt(message.filters.hue) || 0;
  const saturation = parseInt(message.filters.saturation) || 100;
  const brightness = parseInt(message.filters.brightness) || 100;

  // If no filters applied, nothing to do
  if (hue === 0 && saturation === 100 && brightness === 100) {
    vscode.window.showInformationMessage(t('messages.noFiltersToApply'));
    return;
  }

  // Get current colors from SVG
  const { colors: currentColors } = ctx.colorService.extractColorsFromSvg(ctx.iconData.svg);
  
  // Apply filters to each color and replace in SVG
  let updatedSvg = ctx.iconData.svg;
  const newColors: string[] = [];
  
  for (const color of currentColors) {
    const filteredColor = applyColorFilters(color, hue, saturation, brightness);
    newColors.push(filteredColor);
    updatedSvg = ctx.colorService.replaceColorInSvg(updatedSvg, color, filteredColor);
  }

  // Remove any CSS filter that might have been added
  updatedSvg = updatedSvg.replace(/filter:\s*hue-rotate\([^)]+\)\s*saturate\([^)]+\)\s*brightness\([^)]+\);?\s*/gi, '');
  
  ctx.updateSvg(updatedSvg);
  
  // Update TreeView preview with current colors
  vscode.commands.executeCommand('iconManager.updateTreeViewPreview', ctx.iconData.name, updatedSvg, newColors);

  // Update the selected variant with new colors
  let targetVariantIndex = ctx.selectedVariantIndex;
  if (ctx.selectedVariantIndex === -1) {
    // If in "original" (read-only), switch to "custom" automatically
    const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
    const customIndex = variants.findIndex(v => v.name === 'custom');
    if (customIndex >= 0) {
      targetVariantIndex = customIndex;
      ctx.setSelectedVariantIndex(customIndex);
      ctx.variantsService.updateVariantColors(ctx.iconData.name, customIndex, newColors);
    }
  } else {
    ctx.variantsService.updateVariantColors(ctx.iconData.name, ctx.selectedVariantIndex, newColors);
  }

  // Send message to update variant color dots in the webview
  ctx.postMessage({
    command: 'variantColorsUpdated',
    variantIndex: targetVariantIndex,
    colors: newColors
  });

  ctx.refresh();
  vscode.window.showInformationMessage(t('messages.filtersApplied'));
}

/**
 * Apply HSB filters to a hex color and return the result
 */
function applyColorFilters(hexColor: string, hue: number, saturation: number, brightness: number): string {
  // Convert hex to RGB
  let r: number, g: number, b: number;
  
  if (hexColor.startsWith('#')) {
    const hex = hexColor.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return hexColor; // Can't process
    }
  } else if (hexColor.startsWith('rgb')) {
    const match = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    } else {
      return hexColor;
    }
  } else {
    return hexColor; // Named color or other format
  }

  // Convert to HSL
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  // Apply hue rotation
  let newH = (h + hue / 360) % 1;
  if (newH < 0) newH += 1;

  // Apply saturation (as multiplier, 100% = no change)
  const newS = Math.min(1, Math.max(0, s * (saturation / 100)));

  // Apply brightness (as multiplier, 100% = no change)
  const newL = Math.min(1, Math.max(0, l * (brightness / 100)));

  // Convert back to RGB
  let r2: number, g2: number, b2: number;
  if (newS === 0) {
    r2 = g2 = b2 = newL;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const p = 2 * newL - q;
    r2 = hue2rgb(p, q, newH + 1/3);
    g2 = hue2rgb(p, q, newH);
    b2 = hue2rgb(p, q, newH - 1/3);
  }

  // Convert to hex
  const toHex = (x: number): string => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

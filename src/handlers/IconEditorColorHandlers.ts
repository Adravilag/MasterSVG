import * as vscode from 'vscode';
import { ColorService } from '../services/ColorService';
import { VariantsService } from '../services/VariantsService';
import { t } from '../i18n';

/**
 * Context passed to color handlers
 */
export interface ColorHandlerContext {
  iconData:
    | {
        name: string;
        svg: string;
      }
    | undefined;
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
    svg: updatedSvg,
  });
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
    colors: colors,
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
    colors: colors,
  });

  ctx.refresh();
}

/**
 * Handle adding fill color to elements without one
 */
export function handleAddFillColor(ctx: ColorHandlerContext, message: { color?: string }): void {
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
export function handleAddColor(ctx: ColorHandlerContext, message: { color?: string }): void {
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


import * as vscode from 'vscode';
import { ColorService } from '../services/ColorService';
import { VariantsService } from '../services/VariantsService';

/**
 * Context passed to variant handlers
 */
export interface VariantHandlerContext {
  iconData: {
    name: string;
    svg: string;
  } | undefined;
  originalColors: string[];
  selectedVariantIndex: number;
  colorService: ColorService;
  variantsService: VariantsService;
  updateSvg: (svg: string) => void;
  setSelectedVariantIndex: (index: number) => void;
  refresh: () => void;
  generateAutoVariant: (type: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale') => void;
}

/**
 * Handle saving a new variant
 */
export async function handleSaveVariant(ctx: VariantHandlerContext): Promise<void> {
  if (!ctx.iconData) {
    vscode.window.showErrorMessage('Error: No icon data available. Please reopen the editor.');
    return;
  }

  const variantName = await vscode.window.showInputBox({
    prompt: 'Enter variant name',
    placeHolder: 'e.g. Dark theme, Primary colors...'
  });

  if (variantName) {
    const { colors } = ctx.colorService.extractColorsFromSvg(ctx.iconData.svg);
    ctx.variantsService.saveVariant(ctx.iconData.name, variantName, colors);
    ctx.refresh();
  }
}

/**
 * Handle applying a variant
 */
export function handleApplyVariant(
  ctx: VariantHandlerContext,
  message: { index?: number }
): void {
  if (!ctx.iconData || message.index === undefined) return;

  const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
  const variant = variants[message.index];

  if (variant) {
    const currentColors = ctx.colorService.extractColorsFromSvg(ctx.iconData.svg).colors;
    let newSvg = ctx.iconData.svg;

    for (let i = 0; i < Math.min(currentColors.length, variant.colors.length); i++) {
      newSvg = ctx.colorService.replaceColorInSvg(newSvg, currentColors[i], variant.colors[i]);
    }

    ctx.updateSvg(newSvg);
    ctx.setSelectedVariantIndex(message.index);
    ctx.refresh();
  }
}

/**
 * Handle applying the default (original) variant
 */
export function handleApplyDefaultVariant(ctx: VariantHandlerContext): void {
  if (!ctx.iconData) return;

  if (ctx.originalColors.length > 0) {
    const currentColors = ctx.colorService.extractColorsFromSvg(ctx.iconData.svg).colors;
    let newSvg = ctx.iconData.svg;

    for (let i = 0; i < Math.min(currentColors.length, ctx.originalColors.length); i++) {
      newSvg = ctx.colorService.replaceColorInSvg(newSvg, currentColors[i], ctx.originalColors[i]);
    }
    ctx.updateSvg(newSvg);
  }

  ctx.setSelectedVariantIndex(-1);
  ctx.refresh();
}

/**
 * Handle generating an auto variant
 */
export function handleGenerateAutoVariant(
  ctx: VariantHandlerContext,
  message: { type?: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale' }
): void {
  if (!ctx.iconData || !message.type) return;
  ctx.generateAutoVariant(message.type);
}

/**
 * Handle deleting a variant
 */
export function handleDeleteVariant(
  ctx: VariantHandlerContext,
  message: { index?: number }
): void {
  if (!ctx.iconData || message.index === undefined) return;

  ctx.variantsService.deleteVariant(ctx.iconData.name, message.index);

  // If deleted variant was the default, clear default
  const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
  const variantNames = variants.map(s => s.name);
  const currentDefault = ctx.variantsService.getDefaultVariant(ctx.iconData.name);

  if (currentDefault && !variantNames.includes(currentDefault)) {
    ctx.variantsService.setDefaultVariant(ctx.iconData.name, null);
  }

  if (ctx.selectedVariantIndex === message.index) {
    ctx.setSelectedVariantIndex(-1);
  } else if (ctx.selectedVariantIndex > message.index) {
    ctx.setSelectedVariantIndex(ctx.selectedVariantIndex - 1);
  }

  ctx.refresh();
}

/**
 * Handle setting a default variant
 */
export function handleSetDefaultVariant(
  ctx: VariantHandlerContext,
  message: { variantName?: string | null }
): void {
  if (!ctx.iconData) return;

  const variantName = message.variantName;
  ctx.variantsService.setDefaultVariant(ctx.iconData.name, variantName ?? null);
  ctx.refresh();

  if (variantName) {
    vscode.window.showInformationMessage(
      `"${variantName}" is now the default Variant for ${ctx.iconData.name}`
    );
  } else {
    vscode.window.showInformationMessage(
      `default variant cleared for ${ctx.iconData.name}`
    );
  }
}

/**
 * Handle editing a variant name
 */
export async function handleEditVariant(
  ctx: VariantHandlerContext,
  message: { index?: number }
): Promise<void> {
  if (!ctx.iconData || message.index === undefined) return;

  const variants = ctx.variantsService.getSavedVariants(ctx.iconData.name);
  const variant = variants[message.index];

  if (variant) {
    const newName = await vscode.window.showInputBox({
      prompt: 'Edit variant name',
      value: variant.name,
      placeHolder: 'e.g. Dark theme, Primary colors...'
    });

    if (newName !== undefined) {
      const { colors } = ctx.colorService.extractColorsFromSvg(ctx.iconData.svg);
      ctx.variantsService.updateVariant(ctx.iconData.name, message.index, newName, colors);
      ctx.refresh();
      vscode.window.showInformationMessage(`Variant "${newName}" updated`);
    }
  }
}

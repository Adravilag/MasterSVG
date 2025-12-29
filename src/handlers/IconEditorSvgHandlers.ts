import * as vscode from 'vscode';
import { SvgOptimizer } from '../services/SvgOptimizer';
import { SvgManipulationService } from '../services/SvgManipulationService';
import { getSyntaxHighlighter } from '../services/SyntaxHighlighter';
import { getIconEditorTemplateService } from '../services/IconEditorTemplateService';
import { t } from '../i18n';

const svgOptimizer = new SvgOptimizer();

/**
 * Context passed to SVG/code handlers
 */
export interface SvgCodeHandlerContext {
  iconData: {
    name: string;
    svg: string;
  } | undefined;
  postMessage: (message: unknown) => void;
  processAndSaveIcon: (options: {
    svg: string;
    includeAnimationInFile: boolean;
    updateAnimationMetadata: boolean;
    triggerFullRebuild: boolean;
    skipPanelUpdate: boolean;
    successMessage: string;
  }) => Promise<void>;
  getPreOptimizedSvg: () => string | undefined;
  setPreOptimizedSvg: (svg: string | undefined) => void;
}

/**
 * Handle SVG optimization request
 */
export function handleOptimizeSvg(
  ctx: SvgCodeHandlerContext,
  message: { preset?: string }
): void {
  if (!ctx.iconData?.svg) return;

  const preset = message.preset || 'safe';
  const presets = svgOptimizer.getPresets();
  const result = svgOptimizer.optimize(ctx.iconData.svg, presets[preset] || presets.safe);

  ctx.postMessage({
    command: 'optimizeResult',
    ...result,
    originalSizeStr: svgOptimizer.formatSize(result.originalSize),
    optimizedSizeStr: svgOptimizer.formatSize(result.optimizedSize)
  });
}

/**
 * Handle applying optimized SVG
 */
export async function handleApplyOptimizedSvg(
  ctx: SvgCodeHandlerContext,
  message: { svg?: string }
): Promise<void> {
  if (!ctx.iconData || !message.svg) return;

  // Save pre-optimized state if not already saved
  if (!ctx.getPreOptimizedSvg()) {
    ctx.setPreOptimizedSvg(ctx.iconData.svg);
  }

  await ctx.processAndSaveIcon({
    svg: message.svg,
    includeAnimationInFile: false,
    updateAnimationMetadata: false,
    triggerFullRebuild: false,
    skipPanelUpdate: true,
    successMessage: 'Optimized SVG applied (session only)'
  });

  ctx.postMessage({
    command: 'optimizedSvgApplied',
    svg: ctx.iconData.svg,
    code: getSyntaxHighlighter().highlightSvg(ctx.iconData.svg)
  });
}

/**
 * Handle reverting optimization
 */
export async function handleRevertOptimization(
  ctx: SvgCodeHandlerContext
): Promise<void> {
  const preOptimizedSvg = ctx.getPreOptimizedSvg();
  if (!ctx.iconData || !preOptimizedSvg) return;

  await ctx.processAndSaveIcon({
    svg: preOptimizedSvg,
    includeAnimationInFile: false,
    updateAnimationMetadata: false,
    triggerFullRebuild: false,
    skipPanelUpdate: true,
    successMessage: 'Optimization reverted'
  });

  ctx.setPreOptimizedSvg(undefined);

  ctx.postMessage({
    command: 'optimizationReverted',
    svg: ctx.iconData.svg,
    code: getSyntaxHighlighter().highlightSvg(ctx.iconData.svg)
  });
}

/**
 * Handle copying SVG to clipboard
 */
export function handleCopySvg(
  ctx: SvgCodeHandlerContext,
  message: { svg?: string }
): void {
  const svgToCopy = message.svg || ctx.iconData?.svg;
  if (svgToCopy) {
    vscode.env.clipboard.writeText(svgToCopy);
    vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
  }
}

/**
 * Handle copying SVG with animation
 */
export function handleCopyWithAnimation(
  ctx: SvgCodeHandlerContext,
  message: { animation?: string; settings?: unknown }
): void {
  if (!ctx.iconData?.svg || !message.animation || message.animation === 'none') return;

  // Default settings if not provided
  const defaultSettings = { duration: 1, timing: 'ease', iteration: 'infinite' };
  const settings = message.settings || defaultSettings;

  const animatedSvg = SvgManipulationService.embedAnimationInSvg(
    ctx.iconData.svg,
    message.animation,
    settings as unknown as import('../services/AnimationService').AnimationSettings
  );
  vscode.env.clipboard.writeText(animatedSvg);
  vscode.window.showInformationMessage(t('messages.animatedSvgCopied'));
}

/**
 * Handle formatting SVG code
 */
export function handleFormatSvgCode(ctx: SvgCodeHandlerContext): void {
  if (!ctx.iconData?.svg) return;

  ctx.postMessage({
    command: 'updateCodeTab',
    code: getSyntaxHighlighter().highlightSvg(ctx.iconData.svg)
  });
}

/**
 * Handle updating code with animation info
 */
export function handleUpdateCodeWithAnimation(
  ctx: SvgCodeHandlerContext,
  message: { animation?: string }
): void {
  if (!ctx.iconData?.svg) return;

  ctx.postMessage({
    command: 'updateCodeTab',
    code: getSyntaxHighlighter().highlightSvg(ctx.iconData.svg),
    size: Buffer.byteLength(ctx.iconData.svg, 'utf8'),
    hasAnimation: message.animation && message.animation !== 'none'
  });
}

/**
 * Handle updating animation code section
 */
export function handleUpdateAnimationCode(
  ctx: SvgCodeHandlerContext,
  message: { animation?: string; settings?: unknown }
): void {
  if (!message.animation) return;

  ctx.postMessage({
    command: 'animationCodeUpdated',
    code: getIconEditorTemplateService().generateAnimationCodeHtml(
      message.animation, 
      message.settings as { duration?: number; timing?: string; iteration?: string; delay?: number; direction?: string } | undefined
    ),
    animationType: message.animation
  });
}

/**
 * Handle showing a message
 */
export function handleShowMessage(message: { message?: string }): void {
  if (message.message) {
    vscode.window.showInformationMessage(message.message);
  }
}

/**
 * Handle inserting code at cursor
 */
export function handleInsertCodeAtCursor(message: { code?: string }): void {
  if (!message.code) return;

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, message.code!);
    }).then(success => {
      if (success) {
        vscode.window.showInformationMessage(t('messages.codeInsertedAtCursor'));
      }
    });
  } else {
    vscode.env.clipboard.writeText(message.code);
    vscode.window.showInformationMessage(t('messages.noActiveEditorCodeCopied'));
  }
}


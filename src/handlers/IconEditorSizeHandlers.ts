import { t } from '../i18n';
import { parseSvg, getSvgElement, serializeSvg } from '../services/helpers/SvgDomParser';

/**
 * Context passed to size handlers
 */
export interface SizeHandlerContext {
  iconData:
    | {
        name: string;
        svg: string;
      }
    | undefined;
  postMessage: (message: unknown) => void;
  processAndSaveIcon: (options: {
    svg: string;
    includeAnimationInFile: boolean;
    updateAnimationMetadata: boolean;
    triggerFullRebuild: boolean;
    skipPanelUpdate: boolean;
    successMessage: string;
  }) => Promise<void>;
}

/**
 * Extract current width and height from SVG
 */
export function extractSvgDimensions(svg: string): {
  width: string | null;
  height: string | null;
  viewBox: string | null;
} {
  const widthMatch = svg.match(/<svg[^>]*\swidth=["']([^"']+)["']/i);
  const heightMatch = svg.match(/<svg[^>]*\sheight=["']([^"']+)["']/i);
  const viewBoxMatch = svg.match(/<svg[^>]*\sviewBox=["']([^"']+)["']/i);

  return {
    width: widthMatch ? widthMatch[1] : null,
    height: heightMatch ? heightMatch[1] : null,
    viewBox: viewBoxMatch ? viewBoxMatch[1] : null,
  };
}

/**
 * Parse a dimension value, stripping units
 */
function parseDimensionValue(value: string | null): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Get numeric width/height from viewBox
 */
function getViewBoxDimensions(viewBox: string | null): {
  width: number;
  height: number;
} {
  if (!viewBox) return { width: 24, height: 24 };
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
    return { width: parts[2], height: parts[3] };
  }
  return { width: 24, height: 24 };
}

/**
 * Set width and height attributes on SVG element
 */
function setSvgDimensions(svg: string, width: number, height: number): string {
  const result = parseSvg(svg);
  if (result) {
    const svgElement = getSvgElement(result.doc);
    if (svgElement) {
      svgElement.setAttribute('width', String(width));
      svgElement.setAttribute('height', String(height));
      return serializeSvg(result.doc);
    }
  }

  // Fallback to regex
  return setSvgDimensionsRegex(svg, width, height);
}

/**
 * Regex fallback for setting SVG dimensions
 */
function setSvgDimensionsRegex(svg: string, width: number, height: number): string {
  let result = svg;

  // Replace or add width
  if (/\swidth=["'][^"']*["']/i.test(result)) {
    result = result.replace(/(\s)width=["'][^"']*["']/i, `$1width="${width}"`);
  } else {
    result = result.replace(/<svg/i, `<svg width="${width}"`);
  }

  // Replace or add height
  if (/\sheight=["'][^"']*["']/i.test(result)) {
    result = result.replace(/(\s)height=["'][^"']*["']/i, `$1height="${height}"`);
  } else {
    result = result.replace(/<svg/i, `<svg height="${height}"`);
  }

  return result;
}

/**
 * Remove width and height attributes from SVG
 */
function removeSvgDimensions(svg: string): string {
  const result = parseSvg(svg);
  if (result) {
    const svgElement = getSvgElement(result.doc);
    if (svgElement) {
      svgElement.removeAttribute('width');
      svgElement.removeAttribute('height');
      return serializeSvg(result.doc);
    }
  }

  // Fallback to regex
  return svg
    .replace(/\s+width=["'][^"']*["']/gi, '')
    .replace(/\s+height=["'][^"']*["']/gi, '');
}

/**
 * Handle changing icon size
 */
export async function handleChangeSize(
  ctx: SizeHandlerContext,
  message: { width?: number; height?: number }
): Promise<void> {
  if (!ctx.iconData?.svg) return;

  const width = message.width;
  const height = message.height;

  if (!width || !height || width < 1 || height < 1 || width > 2048 || height > 2048) {
    return;
  }

  const newSvg = setSvgDimensions(ctx.iconData.svg, width, height);

  await ctx.processAndSaveIcon({
    svg: newSvg,
    includeAnimationInFile: false,
    updateAnimationMetadata: false,
    triggerFullRebuild: false,
    skipPanelUpdate: false,
    successMessage: t('messages.sizeChanged', { width: String(width), height: String(height) }),
  });
}

/**
 * Handle removing size attributes from SVG (makes it responsive)
 */
export async function handleRemoveSize(ctx: SizeHandlerContext): Promise<void> {
  if (!ctx.iconData?.svg) return;

  const newSvg = removeSvgDimensions(ctx.iconData.svg);

  await ctx.processAndSaveIcon({
    svg: newSvg,
    includeAnimationInFile: false,
    updateAnimationMetadata: false,
    triggerFullRebuild: false,
    skipPanelUpdate: false,
    successMessage: t('messages.sizeRemoved'),
  });
}

export { getViewBoxDimensions, parseDimensionValue };

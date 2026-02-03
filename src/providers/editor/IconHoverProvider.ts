import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from '../tree/WorkspaceSvgProvider';
import { getSvgConfig } from '../../utils/config';
import { ANIMATION_KEYFRAMES } from '../../services/animation/AnimationKeyframes';
import { getIconLicenseInfo } from '../../services/LicenseService';
import { getAnimationService } from '../../services/animation/AnimationAssignmentService';
import { t } from '../../i18n';

interface IconMatchContext {
  iconName: string;
  startIndex: number;
  endIndex: number;
  line: string;
  matchIndex: number;
}

interface HoverContext {
  variantName: string | null;
  animationAttr: string | null;
  sizeAttr: string | null;
  effectiveAnimation: string | null;
  previewSize: number;
}

interface IconData {
  name: string;
  svg?: string;
  path: string;
  source: string;
  category?: string;
  filePath?: string;
  line?: number;
  isBuilt?: boolean;
}

export class IconHoverProvider implements vscode.HoverProvider {
  constructor(private svgProvider: WorkspaceSvgProvider) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const line = document.lineAt(position).text;
    const patterns = this.getIconPatterns();

    for (const pattern of patterns) {
      const result = await this.tryMatchPattern(pattern, line, position, document);
      if (result) return result;
    }
    return null;
  }

  private getIconPatterns(): RegExp[] {
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const webComponentName = getSvgConfig<string>('webComponentName', 'svg-icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    return [
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      new RegExp(`<${webComponentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      /<iconify-icon[^>]*icon=["']([^"']+)["']/gi,
      /(?:name|icon)=["']([a-z0-9:-]+)["']/gi,
    ];
  }

  private async tryMatchPattern(
    pattern: RegExp,
    line: string,
    position: vscode.Position,
    document: vscode.TextDocument
  ): Promise<vscode.Hover | null> {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const ctx: IconMatchContext = {
        iconName: match[1],
        startIndex: match.index + match[0].indexOf(match[1]),
        endIndex: match.index + match[0].indexOf(match[1]) + match[1].length,
        line,
        matchIndex: match.index,
      };

      if (position.character < ctx.startIndex || position.character > ctx.endIndex) continue;

      const icon = this.svgProvider.getIcon(ctx.iconName);
      const range = new vscode.Range(position.line, ctx.startIndex, position.line, ctx.endIndex);

      if (icon) {
        return this.buildIconHover(icon as IconData, ctx, range);
      }
      return this.buildNotFoundHover(ctx.iconName, document, position, range);
    }
    return null;
  }

  private async buildIconHover(
    icon: IconData,
    ctx: IconMatchContext,
    range: vscode.Range
  ): Promise<vscode.Hover> {
    const hoverCtx = this.buildHoverContext(ctx, icon.name);
    const svgPreview = this.buildSvgPreview(icon, ctx.iconName, hoverCtx);
    const infoLines = await this.buildInfoLines(icon, hoverCtx);
    const markdown = this.buildIconMarkdown(icon, svgPreview, infoLines, hoverCtx.effectiveAnimation);
    return new vscode.Hover(markdown, range);
  }

  private buildHoverContext(ctx: IconMatchContext, iconName: string): HoverContext {
    const variantName = this.extractAttributeFromLine(ctx.line, ctx.matchIndex, 'variant');
    const animationAttr = this.extractAttributeFromLine(ctx.line, ctx.matchIndex, 'animation');
    const sizeAttr = this.extractAttributeFromLine(ctx.line, ctx.matchIndex, 'size');

    const animationService = getAnimationService();
    const assignedAnimation = animationService.getAnimation(iconName);
    const effectiveAnimation = animationAttr || assignedAnimation?.type || null;

    return {
      variantName,
      animationAttr,
      sizeAttr,
      effectiveAnimation,
      previewSize: this.parseSize(sizeAttr),
    };
  }

  private buildSvgPreview(icon: IconData, iconName: string, ctx: HoverContext): string {
    if (!icon.svg) return '';

    let svgToPreview = icon.svg;
    if (ctx.variantName) {
      svgToPreview = this.applyVariantToSvg(iconName, svgToPreview, ctx.variantName);
    }
    return this.createSvgPreview(svgToPreview, ctx.effectiveAnimation, ctx.previewSize);
  }

  private async buildInfoLines(icon: IconData, ctx: HoverContext): Promise<string[]> {
    const infoLines: string[] = [];

    const licenseInfo = await getIconLicenseInfo(icon.name);
    this.addLicenseInfo(infoLines, licenseInfo);
    this.addBasicInfo(infoLines, icon);
    this.addOptionalAttributes(infoLines, ctx);

    return infoLines;
  }

  private addLicenseInfo(
    infoLines: string[],
    licenseInfo: Awaited<ReturnType<typeof getIconLicenseInfo>>
  ): void {
    if (!licenseInfo?.isIconify) return;

    if (licenseInfo.collection) {
      infoLines.push(`Collection: ${licenseInfo.collection}`);
    }
    if (licenseInfo.author) {
      const authorLink = licenseInfo.author.url
        ? `[${licenseInfo.author.name}](${licenseInfo.author.url})`
        : licenseInfo.author.name;
      infoLines.push(`Author: ${authorLink}`);
    }
    if (licenseInfo.license) {
      const licenseLink = licenseInfo.license.url
        ? `[${licenseInfo.license.title}](${licenseInfo.license.url})`
        : licenseInfo.license.title;
      infoLines.push(`License: ${licenseLink} ✅`);
    }
  }

  private addBasicInfo(infoLines: string[], icon: IconData): void {
    infoLines.push(`Source: ${icon.source}`);
    if (icon.category && icon.category !== 'none') {
      infoLines.push(`Category: ${icon.category}`);
    }
    const displayPath = icon.path.length > 40 ? '...' + icon.path.slice(-37) : icon.path;
    infoLines.push(`Path: ${displayPath}`);
  }

  private addOptionalAttributes(infoLines: string[], ctx: HoverContext): void {
    if (ctx.variantName) {
      infoLines.push(`Variant: ${ctx.variantName}`);
    }
    if (ctx.effectiveAnimation && ctx.effectiveAnimation !== 'none') {
      const animSource = ctx.animationAttr ? '' : ' (default)';
      infoLines.push(`Animation: ${ctx.effectiveAnimation}${animSource}`);
    }
    if (ctx.sizeAttr) {
      infoLines.push(`Size: ${ctx.sizeAttr}`);
    }
  }

  private buildIconMarkdown(
    icon: IconData,
    svgPreview: string,
    infoLines: string[],
    effectiveAnimation: string | null
  ): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.supportThemeIcons = true;
    markdown.isTrusted = true;

    markdown.appendMarkdown(`**${icon.name}**\n\n`);
    const infoColumn = infoLines.map(l => `• ${l}`).join('<br/>');
    markdown.appendMarkdown(`| | |\n|:---:|:---|\n| ${svgPreview} &nbsp;&nbsp; | ${infoColumn} |`);

    this.appendActionLinks(markdown, icon, effectiveAnimation);
    return markdown;
  }

  private appendActionLinks(
    markdown: vscode.MarkdownString,
    icon: IconData,
    effectiveAnimation: string | null
  ): void {
    const editCmd = `command:masterSVG.colorEditor?${encodeURIComponent(JSON.stringify(icon.name))}`;
    const detailsData = {
      name: icon.name,
      svg: icon.svg,
      path: icon.path,
      source: icon.source,
      category: icon.category,
      filePath: icon.filePath,
      line: icon.line,
      isBuilt: icon.isBuilt,
      animation: effectiveAnimation ? { type: effectiveAnimation } : undefined,
    };
    const detailsCmd = `command:masterSVG.showDetails?${encodeURIComponent(JSON.stringify(detailsData))}`;

    markdown.appendMarkdown(`\n\n`);

    if (icon.isBuilt) {
      markdown.appendMarkdown(
        `[$(edit) Edit](${editCmd} "Edit icon") · ` +
        `[$(info) Details](${detailsCmd} "Show details")`
      );
    } else {
      const buildData = { iconName: icon.name, svgContent: icon.svg, filePath: icon.path };
      const buildCmd = `command:masterSVG.buildSingleIcon?${encodeURIComponent(JSON.stringify(buildData))}`;
      markdown.appendMarkdown(
        `[$(package) ${t('commands.build') || 'Build'}](${buildCmd} "Add to library") · ` +
        `[$(edit) Edit](${editCmd} "Edit icon") · ` +
        `[$(info) Details](${detailsCmd} "Show details")`
      );
    }
  }

  private buildNotFoundHover(
    iconName: string,
    document: vscode.TextDocument,
    position: vscode.Position,
    range: vscode.Range
  ): vscode.Hover {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    markdown.supportThemeIcons = true;
    markdown.appendMarkdown(`⚠️ **Icon not found:** ${iconName}\n\n`);
    markdown.appendMarkdown(`This icon is not in your workspace or library.\n\n`);

    const importCmd = `command:masterSVG.importIcon?${encodeURIComponent(JSON.stringify([iconName, document.uri.fsPath, position.line]))}`;
    markdown.appendMarkdown(`[$(cloud-download) Import](${importCmd} "Import or replace icon")`);

    return new vscode.Hover(markdown, range);
  }

  /**
   * Extract an attribute value from the same tag
   */
  private extractAttributeFromLine(
    line: string,
    tagStartIndex: number,
    attrName: string
  ): string | null {
    // Find the opening < at or before the match
    let tagStart = tagStartIndex;

    // If tagStartIndex doesn't point to '<', search backwards
    if (line[tagStartIndex] !== '<') {
      const beforeMatch = line.substring(0, tagStartIndex);
      tagStart = beforeMatch.lastIndexOf('<');
      if (tagStart === -1) return null;
    }

    const afterTagStart = line.substring(tagStart);
    const tagEnd = afterTagStart.indexOf('>');
    if (tagEnd === -1) return null;

    const tagContent = afterTagStart.substring(0, tagEnd + 1);

    // Look for attrName="value" or attrName='value'
    const attrRegex = new RegExp(`${attrName}=["']([^"']+)["']`);
    const attrMatch = tagContent.match(attrRegex);
    return attrMatch ? attrMatch[1] : null;
  }

  /**
   * Apply variant colors to SVG
   */
  private applyVariantToSvg(iconName: string, svg: string, variantName: string): string {
    const variantsData = this.readVariantsFromFile();

    // Get original colors and variant colors
    const iconVariants = variantsData[iconName];
    if (!iconVariants) return svg;

    const originalColors = iconVariants['_original'] || [];
    const variantColors = iconVariants[variantName] || [];

    if (originalColors.length === 0 || variantColors.length === 0) return svg;

    // Replace colors
    let modifiedSvg = svg;
    for (let i = 0; i < originalColors.length && i < variantColors.length; i++) {
      const original = originalColors[i];
      const replacement = variantColors[i];

      // Replace in fill, stroke, stop-color attributes (case-insensitive)
      const colorRegex = new RegExp(this.escapeRegex(original), 'gi');
      modifiedSvg = modifiedSvg.replace(colorRegex, replacement);
    }

    return modifiedSvg;
  }

  /**
   * Read variants from file
   */
  private readVariantsFromFile(): Record<string, Record<string, string[]>> {
    try {
      const outputDir = getSvgConfig<string>('outputDirectory', '');
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || !outputDir) return {};

      const filePath = path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
      if (!fs.existsSync(filePath)) return {};

      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\});?/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Parse size attribute to a number for preview
   */
  private parseSize(sizeAttr: string | null): number {
    if (!sizeAttr) return 48; // Default preview size (compact)

    // Extract numeric value
    const numericMatch = sizeAttr.match(/^(\d+(?:\.\d+)?)/);
    if (numericMatch) {
      const size = parseFloat(numericMatch[1]);
      // Clamp size for preview between 16 and 64
      return Math.max(16, Math.min(64, size));
    }

    return 64;
  }

  private createSvgPreview(svg: string, animationName?: string | null, size: number = 48): string {
    // Extract viewBox if present
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

    // Remove existing width/height/class attributes
    let cleanSvg = svg
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '')
      .replace(/\s+class="[^"]*"/g, '');

    // Ensure viewBox is set
    if (!cleanSvg.includes('viewBox')) {
      cleanSvg = cleanSvg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
    }

    // Add width/height for proper display with the specified size
    cleanSvg = cleanSvg.replace(/<svg/, `<svg width="${size}" height="${size}"`);

    // Add animation if specified
    if (animationName && animationName !== 'none' && ANIMATION_KEYFRAMES[animationName]) {
      const keyframes = ANIMATION_KEYFRAMES[animationName];
      const animationDuration = this.getAnimationDuration(animationName);
      const animationTiming = this.getAnimationTiming(animationName);

      // Create style element with keyframes and animation
      const styleContent = `
        ${keyframes}
        svg { animation: ${animationName} ${animationDuration} ${animationTiming} infinite; }
      `.trim();

      // Inject style into SVG
      cleanSvg = cleanSvg.replace(/<svg([^>]*)>/, `<svg$1><style>${styleContent}</style>`);
    }

    // URL encode the SVG for use in data URI (more reliable than base64)
    const encoded = encodeURIComponent(cleanSvg).replace(/'/g, '%27').replace(/"/g, '%22');

    // Use markdown image syntax instead of HTML
    return `![icon](data:image/svg+xml,${encoded})`;
  }

  /**
   * Get appropriate duration for animation type
   */
  private getAnimationDuration(animationType: string): string {
    const fastAnimations = ['spin', 'spin-reverse', 'blink'];
    const slowAnimations = ['float', 'fade', 'glow'];

    if (fastAnimations.includes(animationType)) return '1s';
    if (slowAnimations.includes(animationType)) return '2s';
    return '1.5s';
  }

  /**
   * Get appropriate timing function for animation type
   */
  private getAnimationTiming(animationType: string): string {
    const linearAnimations = ['spin', 'spin-reverse'];
    const easeOutAnimations = ['bounce', 'bounce-horizontal', 'slide-in-up', 'slide-in-down'];

    if (linearAnimations.includes(animationType)) return 'linear';
    if (easeOutAnimations.includes(animationType)) return 'ease-out';
    return 'ease-in-out';
  }
}

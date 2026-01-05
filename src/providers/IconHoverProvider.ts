import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { getSvgConfig } from '../utils/config';
import { ANIMATION_KEYFRAMES } from '../services/AnimationKeyframes';
import { getIconLicenseInfo } from '../services/LicenseService';
import { getAnimationService } from '../services/AnimationAssignmentService';
import { t } from '../i18n';

export class IconHoverProvider implements vscode.HoverProvider {
  constructor(private svgProvider: WorkspaceSvgProvider) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const webComponentName = getSvgConfig<string>('webComponentName', 'svg-icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    // Get the line and try to find icon reference
    const line = document.lineAt(position).text;

    // Patterns to match icon references
    const patterns = [
      // <Icon name="icon-name" /> or <icon name="icon-name">
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      // <svg-icon name="icon-name" /> (web component)
      new RegExp(`<${webComponentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      // <iconify-icon icon="prefix:name" />
      /<iconify-icon[^>]*icon=["']([^"']+)["']/gi,
      // Generic name="icon" or icon="icon"
      /(?:name|icon)=["']([a-z0-9:-]+)["']/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const iconName = match[1];
        const startIndex = match.index + match[0].indexOf(iconName);
        const endIndex = startIndex + iconName.length;

        // Check if cursor is within the icon name
        if (position.character >= startIndex && position.character <= endIndex) {
          const icon = this.svgProvider.getIcon(iconName);

          if (icon) {
            const markdown = new vscode.MarkdownString();
            markdown.supportHtml = true;
            markdown.supportThemeIcons = true;
            markdown.isTrusted = true;

            // Check for variant, animation, and size attributes in the same tag
            const variantName = this.extractAttributeFromLine(line, match.index, 'variant');
            const animationAttr = this.extractAttributeFromLine(line, match.index, 'animation');
            const sizeAttr = this.extractAttributeFromLine(line, match.index, 'size');

            // Get assigned animation from service if not specified in tag
            const animationService = getAnimationService();
            const assignedAnimation = animationService.getAnimation(iconName);
            const effectiveAnimation = animationAttr || assignedAnimation?.type || null;

            // Parse size for preview
            const previewSize = this.parseSize(sizeAttr);

            // Create SVG preview
            let svgPreview = '';
            if (icon.svg) {
              let svgToPreview = icon.svg;

              // Apply variant colors if specified
              if (variantName) {
                svgToPreview = this.applyVariantToSvg(iconName, svgToPreview, variantName);
              }

              // Apply animation if specified (from tag or assigned)
              svgPreview = this.createSvgPreview(svgToPreview, effectiveAnimation, previewSize);
            }

            // Build info lines
            const infoLines: string[] = [];

            // Check if it's an Iconify icon
            const licenseInfo = await getIconLicenseInfo(icon.name);

            if (licenseInfo?.isIconify) {
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

            // Source and category
            infoLines.push(`Source: ${icon.source}`);
            if (icon.category && icon.category !== 'none') {
              infoLines.push(`Category: ${icon.category}`);
            }

            // Path (shortened)
            const displayPath = icon.path.length > 40 ? '...' + icon.path.slice(-37) : icon.path;
            infoLines.push(`Path: ${displayPath}`);

            // Optional attributes
            if (variantName) {
              infoLines.push(`Variant: ${variantName}`);
            }
            if (effectiveAnimation && effectiveAnimation !== 'none') {
              // Show animation source: from tag attribute or assigned by default
              const animSource = animationAttr ? '' : ' (default)';
              infoLines.push(`Animation: ${effectiveAnimation}${animSource}`);
            }
            if (sizeAttr) {
              infoLines.push(`Size: ${sizeAttr}`);
            }

            // Title on its own line, then table layout: icon on left, info on right
            markdown.appendMarkdown(`**${icon.name}**\n\n`);
            const infoColumn = infoLines.map(l => `• ${l}`).join('<br/>');
            markdown.appendMarkdown(
              `| | |\n|:---:|:---|\n| ${svgPreview} &nbsp;&nbsp; | ${infoColumn} |`
            );

            // Action links using HTML to avoid long command tooltips
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
            
            // Build action links based on built status
            if (icon.isBuilt) {
              // Icon is built - show standard actions only
              markdown.appendMarkdown(
                `[$(edit) Edit](${editCmd} "Edit icon") · ` +
                `[$(info) Details](${detailsCmd} "Show details")`
              );
            } else {
              // Icon not built - show build action first
              const buildData = {
                iconName: icon.name,
                svgContent: icon.svg,
                filePath: icon.path,
              };
              const buildCmd = `command:masterSVG.buildSingleIcon?${encodeURIComponent(JSON.stringify(buildData))}`;
              markdown.appendMarkdown(
                `[$(package) ${t('commands.build') || 'Build'}](${buildCmd} "Add to library") · ` +
                `[$(edit) Edit](${editCmd} "Edit icon") · ` +
                `[$(info) Details](${detailsCmd} "Show details")`
              );
            }

            const range = new vscode.Range(position.line, startIndex, position.line, endIndex);

            return new vscode.Hover(markdown, range);
          } else {
            // Icon not found in workspace
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportHtml = true;
            markdown.supportThemeIcons = true;
            markdown.appendMarkdown(`⚠️ **Icon not found:** ${iconName}\n\n`);
            markdown.appendMarkdown(`This icon is not in your workspace or library.\n\n`);

            // Import from Iconify (will search and optionally replace the reference)
            const importCmd = `command:masterSVG.importIcon?${encodeURIComponent(JSON.stringify([iconName, document.uri.fsPath, position.line]))}`;

            markdown.appendMarkdown(
              `[$(cloud-download) Import](${importCmd} "Import or replace icon")`
            );

            const range = new vscode.Range(position.line, startIndex, position.line, endIndex);

            return new vscode.Hover(markdown, range);
          }
        }
      }
    }

    return null;
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

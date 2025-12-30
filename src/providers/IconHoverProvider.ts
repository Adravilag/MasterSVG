import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { getSvgConfig } from '../utils/config';
import { ANIMATION_KEYFRAMES } from '../services/AnimationKeyframes';

export class IconHoverProvider implements vscode.HoverProvider {
  constructor(private svgProvider: WorkspaceSvgProvider) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const webComponentName = getSvgConfig<string>('webComponentName', 'sg-icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    // Get the line and try to find icon reference
    const line = document.lineAt(position).text;
    
    // Patterns to match icon references
    const patterns = [
      // <Icon name="icon-name" /> or <icon name="icon-name">
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      // <sg-icon name="icon-name" /> (web component)
      new RegExp(`<${webComponentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      // <iconify-icon icon="prefix:name" />
      /<iconify-icon[^>]*icon=["']([^"']+)["']/gi,
      // Generic name="icon" or icon="icon"
      /(?:name|icon)=["']([a-z0-9:-]+)["']/gi
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
            markdown.isTrusted = true;

            // Check for variant, animation, and size attributes in the same tag
            const variantName = this.extractAttributeFromLine(line, match.index, 'variant');
            const animationName = this.extractAttributeFromLine(line, match.index, 'animation');
            const sizeAttr = this.extractAttributeFromLine(line, match.index, 'size');
            
            // Parse size for preview
            const previewSize = this.parseSize(sizeAttr);
            
            // Add SVG preview if available
            if (icon.svg) {
              let svgToPreview = icon.svg;
              
              // Apply variant colors if specified
              if (variantName) {
                svgToPreview = this.applyVariantToSvg(iconName, svgToPreview, variantName);
              }
              
              // Apply animation if specified
              const preview = this.createSvgPreview(svgToPreview, animationName, previewSize);
              markdown.appendMarkdown(preview + '\n\n');
            }

            markdown.appendMarkdown(`**${icon.name}**\n\n`);
            if (variantName) {
              markdown.appendMarkdown(`- Variant: \`${variantName}\`\n`);
            }
            if (animationName && animationName !== 'none') {
              markdown.appendMarkdown(`- Animation: \`${animationName}\`\n`);
            }
            if (sizeAttr) {
              markdown.appendMarkdown(`- Size: \`${sizeAttr}\`\n`);
            }
            markdown.appendMarkdown(`- Source: \`${icon.source}\`\n`);
            markdown.appendMarkdown(`- Category: \`${icon.category || 'none'}\`\n`);
            markdown.appendMarkdown(`- Path: \`${icon.path}\`\n`);

            const range = new vscode.Range(
              position.line, startIndex,
              position.line, endIndex
            );

            return new vscode.Hover(markdown, range);
          } else {
            // Icon not found in workspace
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportHtml = true;
            markdown.appendMarkdown(`⚠️ **Icon not found**: \`${iconName}\`\n\n`);
            markdown.appendMarkdown(`This icon is not in your workspace or library.\n\n`);
            markdown.appendMarkdown(`[📥 Import "${iconName}"](command:iconManager.importIcon?${encodeURIComponent(JSON.stringify([iconName, document.uri.fsPath, position.line]))})`);
            
            return new vscode.Hover(markdown);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract an attribute value from the same tag
   */
  private extractAttributeFromLine(line: string, tagStartIndex: number, attrName: string): string | null {
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
    if (!sizeAttr) return 64; // Default preview size
    
    // Extract numeric value
    const numericMatch = sizeAttr.match(/^(\d+(?:\.\d+)?)/);
    if (numericMatch) {
      const size = parseFloat(numericMatch[1]);
      // Clamp size for preview between 16 and 128
      return Math.max(16, Math.min(128, size));
    }
    
    return 64;
  }

private createSvgPreview(svg: string, animationName?: string | null, size: number = 64): string {
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
    cleanSvg = cleanSvg.replace(
      /<svg/,
      `<svg width="${size}" height="${size}"`
    );
    
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
      cleanSvg = cleanSvg.replace(
        /<svg([^>]*)>/,
        `<svg$1><style>${styleContent}</style>`
      );
    }
    
    // URL encode the SVG for use in data URI (more reliable than base64)
    const encoded = encodeURIComponent(cleanSvg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    
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


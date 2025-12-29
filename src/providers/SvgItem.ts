import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon, IconAnimation } from '../types/icons';
import { saveTempSvgIcon } from './TempIconManager';
import { SvgContentCache } from './SvgContentCache';

/**
 * TreeItem for SVG icons in the tree view
 */
export class SvgItem extends vscode.TreeItem {
  private static instanceCounter = 0;
  private static svgCache = SvgContentCache.getInstance();
  
  constructor(
    public readonly label: string,
    public readonly count: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'section' | 'category' | 'icon' | 'action' | 'usage',
    public readonly icon?: WorkspaceIcon,
    public readonly category?: string,
    public readonly usage?: { file: string; line: number; preview: string }
  ) {
    super(label, collapsibleState);
    
    const instanceId = SvgItem.instanceCounter++;

    // Set unique ID for TreeView.reveal() to work
    if (type === 'section' && category) {
      this.id = `${instanceId}/section:${category}`;
    } else if (type === 'category' && category) {
      this.id = `${instanceId}/category:${category}`;
    } else if (type === 'icon' && icon) {
      // Use icon name + source + path for unique ID
      // Name is essential for library icons that share the same path file
      this.id = `${instanceId}/icon:${icon.name}:${icon.source || 'unknown'}:${icon.path || ''}`;
      if (icon.line !== undefined) {
        this.id += `:L${icon.line}`;
      }
    } else if (type === 'usage' && usage) {
      this.id = `${instanceId}/usage:${usage.file}:${usage.line}`;
    } else if (type === 'action') {
      this.id = `${instanceId}/action:scan`;
    }

    if (type === 'section') {
      this.description = `${count}`;
      this.contextValue = 'svgSection';
      // Use different icons based on section
      if (category === 'built') {
        this.iconPath = new vscode.ThemeIcon('package');
      } else if (category === 'files') {
        this.iconPath = new vscode.ThemeIcon('folder-library');
      } else if (category === 'inline') {
        this.iconPath = new vscode.ThemeIcon('code');
      } else if (category === 'references') {
        this.iconPath = new vscode.ThemeIcon('references');
      } else if (category === 'icon_usages_section') {
        this.iconPath = new vscode.ThemeIcon('references');
      }
    } else if (type === 'category') {
      this.description = `${count}`;
      // Use different icons based on category type
      if (category?.startsWith('built:')) {
        this.iconPath = new vscode.ThemeIcon('file-code');
      } else if (category?.startsWith('folder:')) {
        this.iconPath = new vscode.ThemeIcon('folder');
      } else if (category?.startsWith('inlinedir:') || category?.startsWith('refsdir:')) {
        this.iconPath = new vscode.ThemeIcon('folder');
      } else if (category?.startsWith('inline:')) {
        this.iconPath = new vscode.ThemeIcon('file-code');
      } else if (category?.startsWith('refs:')) {
        this.iconPath = new vscode.ThemeIcon('file-media');
      } else if (category?.startsWith('📦 ')) {
        this.iconPath = new vscode.ThemeIcon('package');
      } else if (category?.startsWith('📄 ')) {
        this.iconPath = new vscode.ThemeIcon('file-code');
      } else {
        this.iconPath = new vscode.ThemeIcon('folder');
      }
      this.contextValue = 'svgCategory';
    } else if (type === 'action') {
      this.iconPath = new vscode.ThemeIcon('refresh');
      this.contextValue = 'svgAction';
      this.command = {
        command: 'iconManager.scanWorkspace',
        title: 'Scan Workspace'
      };
    } else if (type === 'usage' && usage) {
      // Usage item - clicking navigates to the file/line
      this.iconPath = new vscode.ThemeIcon('go-to-file');
      this.contextValue = 'iconUsage';
      this.tooltip = usage.preview;
      this.command = {
        command: 'iconManager.goToUsage',
        title: 'Go to Usage',
        arguments: [usage.file, usage.line]
      };
    } else if (icon) {
      this.setupIconItem(icon);
    }
  }

  /**
   * Setup icon-specific item properties
   */
  private setupIconItem(icon: WorkspaceIcon): void {
    // Check if this is a missing/broken reference (exists === false)
    const isMissingRef = icon.category === 'img-ref' && icon.exists === false;
    
    // Get SVG content using cache (lazy loading)
    let svgContent = icon.svg;
    if (!svgContent && icon.path) {
      // Use cached content instead of direct file read
      svgContent = SvgItem.svgCache.getContent(icon.path);
    }
    
    // Check if this is a rasterized SVG using cached analysis
    const isRasterized = icon.path 
      ? SvgItem.svgCache.isRasterized(icon.path) 
      : this.isRasterizedSvg(svgContent);
    
    // Detect animation type using cached analysis or from icon data
    const animationType = icon.animation?.type || (
      icon.path 
        ? SvgItem.svgCache.getAnimationType(icon.path) 
        : this.detectAnimationType(icon)
    );
    
    // Show usage count for built icons, or line number for inline SVGs
    if (isMissingRef) {
      this.description = '⚠ File not found';
    } else if (isRasterized) {
      this.description = '⚠ Rasterized (not buildable)';
    } else if (icon.isBuilt) {
      // Build description with animation info for built icons
      const parts: string[] = [];
      if (animationType) {
        parts.push(`⚡ ${animationType}`);
      }
      if (icon.usageCount !== undefined) {
        if (icon.usageCount === 0) {
          parts.push('⚠ unused');
        } else {
          parts.push(`${icon.usageCount} use${icon.usageCount > 1 ? 's' : ''}`);
        }
      }
      this.description = parts.join(' · ');
    } else if (icon.line !== undefined) {
      this.description = `L${icon.line + 1}`;
    }
    
    // Set contextValue for preview detection and context menu
    this.contextValue = this.determineContextValue(icon, isMissingRef, isRasterized);
    
    // Build tooltip with usage info
    let tooltipLines: string[] = [icon.name];
    if (isRasterized) {
      tooltipLines.push('⚠ Rasterized SVG - Too many colors');
      tooltipLines.push('   Not suitable for icon library');
    }
    
    // Set resourceUri for file operations (delete, rename) - only for workspace SVG files
    if (icon.source === 'workspace' && icon.path) {
      this.resourceUri = vscode.Uri.file(icon.path);
    }
    
    if (isMissingRef) {
      tooltipLines.push('❌ SVG file not found');
      tooltipLines.push(`Expected path: ${icon.path}`);
      if (icon.filePath) {
        tooltipLines.push(`Referenced in: ${path.basename(icon.filePath)}:${(icon.line || 0) + 1}`);
      }
    } else if (icon.isBuilt) {
      tooltipLines.push('✓ Built');
      // Add animation details to tooltip
      if (animationType) {
        tooltipLines.push(`⚡ Animation: ${animationType}`);
        if (icon.animation) {
          tooltipLines.push(`   Duration: ${icon.animation.duration}s`);
          tooltipLines.push(`   Timing: ${icon.animation.timing}`);
          tooltipLines.push(`   Iteration: ${icon.animation.iteration}`);
        }
      }
    }
    
    if (icon.usages && icon.usages.length > 0) {
      tooltipLines.push('');
      tooltipLines.push(`📍 ${icon.usages.length} usage${icon.usages.length > 1 ? 's' : ''}:`);
      // Show first 5 usages in tooltip
      for (const usage of icon.usages.slice(0, 5)) {
        const shortFile = usage.file.split(/[\\/]/).slice(-2).join('/');
        tooltipLines.push(`  • ${shortFile}:${usage.line}`);
      }
      if (icon.usages.length > 5) {
        tooltipLines.push(`  + ${icon.usages.length - 5} more...`);
      }
    }
    
    // Setup tooltip and command
    this.setupTooltipAndCommand(icon, tooltipLines, isMissingRef);

    // Setup icon path
    this.setupIconPath(icon, svgContent, isMissingRef);
  }

  /**
   * Determine the contextValue based on icon properties
   */
  private determineContextValue(icon: WorkspaceIcon, isMissingRef: boolean, isRasterized: boolean): string {
    if (isMissingRef) {
      return 'missingRef';
    } else if (isRasterized) {
      // Rasterized SVGs - limited menu options based on source
      if (icon.source === 'workspace') {
        return icon.isBuilt ? 'svgIconRasterizedBuilt' : 'svgIconRasterized';
      } else if (icon.category === 'img-ref') {
        return 'imgRefRasterized';
      } else if (icon.source === 'inline') {
        return icon.isBuilt ? 'inlineSvgRasterizedBuilt' : 'inlineSvgRasterized';
      } else {
        return 'builtIconRasterized';
      }
    } else if (icon.category === 'img-ref') {
      return 'imgRef';
    } else if (icon.source === 'inline') {
      return icon.isBuilt ? 'inlineSvgBuilt' : 'inlineSvg';
    } else if (icon.isBuilt) {
      return icon.source === 'workspace' ? 'svgIconBuilt' : 'builtIcon';
    } else {
      return 'svgIcon';
    }
  }

  /**
   * Setup tooltip and click command
   */
  private setupTooltipAndCommand(icon: WorkspaceIcon, tooltipLines: string[], isMissingRef: boolean): void {
    if (isMissingRef) {
      this.tooltip = tooltipLines.join('\n');
      // Still allow clicking to navigate to the reference
      if (icon.filePath && icon.line !== undefined) {
        this.command = {
          command: 'iconManager.goToInlineSvg',
          title: 'Go to Reference',
          arguments: [icon]
        };
      }
    } else if (icon.source === 'library') {
      // For library/built icons - double click shows details
      this.tooltip = tooltipLines.join('\n');
      this.command = {
        command: 'iconManager.showDetails',
        title: 'Show Details',
        arguments: [icon]
      };
    } else if (icon.source === 'inline' && icon.filePath && icon.line !== undefined) {
      // For inline SVGs, navigate to the line in the file
      const fileName = path.basename(icon.filePath);
      this.tooltip = `${icon.name}\n${fileName}:${icon.line + 1}`;
      this.command = {
        command: 'iconManager.goToInlineSvg',
        title: 'Go to SVG',
        arguments: [icon]
      };
    } else {
      // For workspace SVG files - double click shows details
      this.tooltip = `${icon.name}\n${icon.path}`;
      this.command = {
        command: 'iconManager.showDetails',
        title: 'Show Details',
        arguments: [icon]
      };
    }
  }

  /**
   * Setup the icon path for display in tree view
   */
  private setupIconPath(icon: WorkspaceIcon, svgContent: string | undefined, isMissingRef: boolean): void {
    // For missing references, show error icon in red
    if (isMissingRef) {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      return;
    }

    // Try to load SVG content if not provided
    if (!svgContent && icon.path) {
      try {
        const fs = require('fs');
        if (fs.existsSync(icon.path)) {
          svgContent = fs.readFileSync(icon.path, 'utf-8');
        }
      } catch (err) {
        console.error('[IconWrap] Error reading SVG file:', icon.path, err);
      }
    }

    // Use the actual SVG as icon
    if (svgContent) {
      try {
        const tempPath = saveTempSvgIcon(icon.name, svgContent);
        this.iconPath = vscode.Uri.file(tempPath);
      } catch (err) {
        console.error('[IconWrap] Error saving temp SVG:', icon.name, err);
        this.iconPath = icon.isBuilt 
          ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'))
          : new vscode.ThemeIcon('circle-outline');
      }
    } else {
      // Show symbol icon for missing SVGs
      console.warn('[IconWrap] No SVG content for icon:', icon.name, 'path:', icon.path);
      this.iconPath = new vscode.ThemeIcon('symbol-misc');
    }
  }

  /**
   * Detect animation type from icon data or SVG content
   * Returns a human-readable animation type string
   */
  private detectAnimationType(icon: WorkspaceIcon): string | null {
    // First check if animation is defined in icon data (from icons.js)
    if (icon.animation?.type) {
      return icon.animation.type;
    }

    // Then check SVG content for embedded animations
    const svg = icon.svg;
    if (!svg) return null;

    // Check for CSS animations (in <style> tags)
    const hasStyleAnimation = /<style[^>]*>[\s\S]*@keyframes[\s\S]*<\/style>/i.test(svg);
    const hasInlineAnimation = /animation\s*:/i.test(svg);
    
    // Check for SMIL animations
    const hasAnimate = /<animate\b/i.test(svg);
    const hasAnimateTransform = /<animateTransform\b/i.test(svg);
    const hasAnimateMotion = /<animateMotion\b/i.test(svg);
    const hasSet = /<set\b/i.test(svg);

    // Determine animation type
    if (hasStyleAnimation || hasInlineAnimation) {
      // Try to detect specific CSS animation type
      if (/spin|rotate/i.test(svg)) return 'spin (CSS)';
      if (/pulse|scale/i.test(svg)) return 'pulse (CSS)';
      if (/fade|opacity/i.test(svg)) return 'fade (CSS)';
      if (/bounce/i.test(svg)) return 'bounce (CSS)';
      if (/shake/i.test(svg)) return 'shake (CSS)';
      if (/draw|stroke-dash/i.test(svg)) return 'draw (CSS)';
      return 'CSS';
    }

    if (hasAnimateTransform) {
      return 'SMIL transform';
    }
    if (hasAnimateMotion) {
      return 'SMIL motion';
    }
    if (hasAnimate || hasSet) {
      return 'SMIL';
    }

    return null;
  }

  /**
   * Count unique colors in SVG content to detect rasterized images
   */
  private countSvgColors(svg: string): number {
    const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
    const colors = new Set<string>();
    let match;
    while ((match = colorRegex.exec(svg)) !== null) {
      colors.add(match[0].toLowerCase());
    }
    return colors.size;
  }

  /**
   * Check if SVG is a rasterized image (too many colors for icon editing)
   */
  private isRasterizedSvg(svg: string | undefined): boolean {
    if (!svg) return false;
    const MAX_COLORS_FOR_ICONS = 50;
    return this.countSvgColors(svg) > MAX_COLORS_FOR_ICONS;
  }
}

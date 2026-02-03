import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceIcon } from '../../types/icons';
import { saveTempSvgIcon } from '../TempIconStudio';
import { SvgContentCache } from '../../utils/SvgContentCache';
import { t } from '../../i18n';
import { getAnimationService } from '../../services/animation/AnimationAssignmentService';

/**
 * Options for creating a SvgItem
 */
export interface SvgItemOptions {
  label: string;
  count: number;
  collapsibleState: vscode.TreeItemCollapsibleState;
  type: 'section' | 'category' | 'icon' | 'action' | 'usage';
  icon?: WorkspaceIcon;
  category?: string;
  usage?: { file: string; line: number; preview: string };
}

/**
 * TreeItem for SVG icons in the tree view
 */
export class SvgItem extends vscode.TreeItem {
  private static svgCache = SvgContentCache.getInstance();

  public readonly count: number;
  public readonly type: SvgItemOptions['type'];
  public readonly icon?: WorkspaceIcon;
  public readonly category?: string;
  public readonly usage?: SvgItemOptions['usage'];

  /**
   * Factory method to create SvgItem with individual parameters
   * Maintains backwards compatibility with existing code
   */
  // eslint-disable-next-line max-params -- Factory method for backwards compatibility
  static create(
    label: string,
    count: number,
    collapsibleState: vscode.TreeItemCollapsibleState,
    type: SvgItemOptions['type'],
    icon?: WorkspaceIcon,
    category?: string,
    usage?: SvgItemOptions['usage']
  ): SvgItem {
    return new SvgItem({ label, count, collapsibleState, type, icon, category, usage });
  }

  constructor(options: SvgItemOptions) {
    super(options.label, options.collapsibleState);

    this.count = options.count;
    this.type = options.type;
    this.icon = options.icon;
    this.category = options.category;
    this.usage = options.usage;

    this.id = this.generateId();
    this.setupByType();
  }

  /**
   * Generate stable unique ID for TreeView.reveal()
   */
  private generateId(): string {
    const { type, category, icon, usage } = this;

    if (type === 'section' && category) return `section:${category}`;
    if (type === 'category' && category) return `category:${category}`;
    if (type === 'usage' && usage) return `usage:${usage.file}:${usage.line}`;
    if (type === 'action') return `action:${category || 'scan'}`;

    if (type === 'icon' && icon) {
      let id = `icon:${icon.name}:${icon.source || 'unknown'}:${icon.path || ''}`;
      if (icon.line !== undefined) id += `:L${icon.line}`;
      return id;
    }

    return `${type}:${this.label}`;
  }

  /**
   * Setup item based on type
   */
  private setupByType(): void {
    switch (this.type) {
      case 'section':
        this.setupSection();
        break;
      case 'category':
        this.setupCategory();
        break;
      case 'action':
        this.setupAction();
        break;
      case 'usage':
        this.setupUsage();
        break;
      case 'icon':
        if (this.icon) this.setupIconItem(this.icon);
        break;
    }
  }

  private setupSection(): void {
    this.description = `${this.count}`;
    this.contextValue = 'svgSection';
    this.iconPath = this.getSectionIcon();
  }

  private getSectionIcon(): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      built: 'package',
      files: 'folder-library',
      inline: 'code',
      references: 'references',
      icon_usages_section: 'references',
    };
    return new vscode.ThemeIcon(iconMap[this.category || ''] || 'folder');
  }

  private setupCategory(): void {
    this.description = `${this.count}`;
    this.contextValue = 'svgCategory';
    this.iconPath = this.getCategoryIcon();
  }

  private getCategoryIcon(): vscode.ThemeIcon {
    const cat = this.category || '';
    if (cat.startsWith('built:') || cat.startsWith('inline:')) return new vscode.ThemeIcon('file-code');
    if (cat.startsWith('folder:') || cat.startsWith('inlinedir:') || cat.startsWith('refsdir:')) {
      return new vscode.ThemeIcon('folder');
    }
    if (cat.startsWith('refs:')) return new vscode.ThemeIcon('file-media');
    if (cat.startsWith('📦 ')) return new vscode.ThemeIcon('package');
    if (cat.startsWith('📄 ')) return new vscode.ThemeIcon('file-code');
    return new vscode.ThemeIcon('folder');
  }

  private setupAction(): void {
    this.iconPath = new vscode.ThemeIcon('refresh');
    this.contextValue = 'svgAction';
    this.command = {
      command: 'masterSVG.scanWorkspace',
      title: t('commands.scanWorkspace'),
    };
  }

  private setupUsage(): void {
    if (!this.usage) return;
    this.iconPath = new vscode.ThemeIcon('go-to-file');
    this.contextValue = 'iconUsage';
    this.tooltip = this.usage.preview;
    this.command = {
      command: 'masterSVG.goToUsage',
      title: t('commands.goToUsage'),
      arguments: [this.usage.file, this.usage.line],
    };
  }

  /**
   * Setup icon-specific item properties
   */
  private setupIconItem(icon: WorkspaceIcon): void {
    const isMissingRef = icon.category === 'img-ref' && icon.exists === false;
    const svgContent = this.getSvgContent(icon);
    const animationType = this.detectIconAnimation(icon);

    this.description = this.buildIconDescription(icon, isMissingRef, animationType);
    this.contextValue = this.determineContextValue(icon, isMissingRef, false);

    if (icon.source === 'workspace' && icon.path) {
      this.resourceUri = vscode.Uri.file(icon.path);
    }

    const tooltipLines = this.buildTooltipLines(icon, isMissingRef, animationType);
    this.setupTooltipAndCommand(icon, tooltipLines, isMissingRef);
    this.setupIconPath(icon, svgContent, isMissingRef);
  }

  private getSvgContent(icon: WorkspaceIcon): string | undefined {
    if (icon.svg) return icon.svg;
    if (icon.path) return SvgItem.svgCache.getContent(icon.path);
    return undefined;
  }

  private detectIconAnimation(icon: WorkspaceIcon): string | null {
    if (icon.isBuilt) {
      return this.detectBuiltIconAnimation(icon);
    }
    return icon.animation?.type ||
      (icon.path ? SvgItem.svgCache.getAnimationType(icon.path) : this.detectAnimationType(icon));
  }

  private detectBuiltIconAnimation(icon: WorkspaceIcon): string | null {
    const animService = getAnimationService();
    const assigned = animService.getAnimation(icon.name);

    if (assigned?.type && assigned.type !== 'none') return assigned.type;
    if (icon.animation?.type && icon.animation.type !== 'none') return icon.animation.type;
    if (icon.svg) return this.detectNativeAnimation(icon.svg);

    return null;
  }

  private buildIconDescription(icon: WorkspaceIcon, isMissingRef: boolean, animationType: string | null): string {
    if (isMissingRef) return '⚠ File not found';

    if (icon.isBuilt) {
      const parts: string[] = [];
      if (animationType) {
        const isNative = animationType.startsWith('native');
        parts.push(`${isNative ? '🔄' : '⚡'} ${animationType}`);
      }
      if (icon.usageCount !== undefined) {
        parts.push(icon.usageCount === 0 ? '⚠ unused' : `${icon.usageCount} use${icon.usageCount > 1 ? 's' : ''}`);
      }
      return parts.join(' · ');
    }

    return icon.line !== undefined ? `L${icon.line + 1}` : '';
  }

  private buildTooltipLines(icon: WorkspaceIcon, isMissingRef: boolean, animationType: string | null): string[] {
    const lines: string[] = [icon.name];

    if (isMissingRef) {
      this.addMissingRefTooltip(lines, icon);
    } else if (icon.isBuilt) {
      this.addBuiltIconTooltip(lines, icon, animationType);
    }

    this.addUsagesTooltip(lines, icon);
    return lines;
  }

  private addMissingRefTooltip(lines: string[], icon: WorkspaceIcon): void {
    lines.push('❌ SVG file not found');
    lines.push(`Expected path: ${icon.path}`);
    if (icon.filePath) {
      lines.push(`Referenced in: ${path.basename(icon.filePath)}:${(icon.line || 0) + 1}`);
    }
  }

  private addBuiltIconTooltip(lines: string[], icon: WorkspaceIcon, animationType: string | null): void {
    lines.push('✓ Built');
    if (animationType) {
      lines.push(`⚡ Animation: ${animationType}`);
      if (icon.animation) {
        lines.push(`   Duration: ${icon.animation.duration}s`);
        lines.push(`   Timing: ${icon.animation.timing}`);
        lines.push(`   Iteration: ${icon.animation.iteration}`);
      }
    }
  }

  private addUsagesTooltip(lines: string[], icon: WorkspaceIcon): void {
    if (!icon.usages || icon.usages.length === 0) return;

    lines.push('');
    lines.push(`📍 ${icon.usages.length} usage${icon.usages.length > 1 ? 's' : ''}:`);

    for (const usage of icon.usages.slice(0, 5)) {
      const shortFile = usage.file.split(/[\\/]/).slice(-2).join('/');
      lines.push(`  • ${shortFile}:${usage.line}`);
    }

    if (icon.usages.length > 5) {
      lines.push(`  + ${icon.usages.length - 5} more...`);
    }
  }

  /**
   * Determine the contextValue based on icon properties
   */
  private determineContextValue(
    icon: WorkspaceIcon,
    isMissingRef: boolean,
    isRasterized: boolean
  ): string {
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
  private setupTooltipAndCommand(
    icon: WorkspaceIcon,
    tooltipLines: string[],
    isMissingRef: boolean
  ): void {
    if (isMissingRef) {
      this.tooltip = tooltipLines.join('\n');
      // Still allow clicking to navigate to the reference
      if (icon.filePath && icon.line !== undefined) {
        this.command = {
          command: 'masterSVG.goToInlineSvg',
          title: t('commands.goToReference'),
          arguments: [icon],
        };
      }
    } else if (icon.source === 'library') {
      // For library/built icons - click handled by iconClick command (detects double click)
      this.tooltip = tooltipLines.join('\n');
      this.command = {
        command: 'masterSVG.iconClick',
        title: t('commands.showDetails'),
        arguments: [icon],
      };
    } else if (icon.source === 'inline' && icon.filePath && icon.line !== undefined) {
      // For inline SVGs, navigate to the line in the file
      const fileName = path.basename(icon.filePath);
      this.tooltip = `${icon.name}\n${fileName}:${icon.line + 1}`;
      this.command = {
        command: 'masterSVG.goToInlineSvg',
        title: t('commands.goToSvg'),
        arguments: [icon],
      };
    } else {
      // For workspace SVG files - click handled by iconClick command (detects double click)
      this.tooltip = `${icon.name}\n${icon.path}`;
      this.command = {
        command: 'masterSVG.iconClick',
        title: t('commands.showDetails'),
        arguments: [icon],
      };
    }
  }

  /**
   * Setup the icon path for display in tree view
   */
  private setupIconPath(
    icon: WorkspaceIcon,
    svgContent: string | undefined,
    isMissingRef: boolean
  ): void {
    if (isMissingRef) {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      return;
    }

    const content = svgContent || this.tryReadSvgFile(icon.path);

    if (content) {
      this.iconPath = this.createTempIconPath(icon.name, content, icon.isBuilt);
    } else {
      this.iconPath = new vscode.ThemeIcon('symbol-misc');
    }
  }

  private tryReadSvgFile(filePath: string | undefined): string | undefined {
    if (!filePath) return undefined;
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
    } catch {
      // Failed to read SVG file
    }
    return undefined;
  }

  private createTempIconPath(name: string, svgContent: string, isBuilt?: boolean): vscode.Uri | vscode.ThemeIcon {
    try {
      const tempPath = saveTempSvgIcon(name, svgContent);
      return vscode.Uri.file(tempPath);
    } catch {
      // Failed to save temp SVG, use fallback icon
      return isBuilt
        ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('circle-outline');
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
      // Extract style content and animation names for more accurate detection
      const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const styleContent = styleMatch ? styleMatch[1] : '';
      const animationNameMatch = svg.match(/animation(?:-name)?\s*:\s*([^;}\s]+)/i);
      const animationName = animationNameMatch ? animationNameMatch[1] : '';
      const searchContext = styleContent + ' ' + animationName;

      // Try to detect specific CSS animation type from keyframes and animation names
      if (/spin|rotate/i.test(searchContext)) return 'spin (CSS)';
      if (/pulse|scale/i.test(searchContext)) return 'pulse (CSS)';
      if (/fade/i.test(searchContext)) return 'fade (CSS)';
      if (/bounce/i.test(searchContext)) return 'bounce (CSS)';
      if (/shake/i.test(searchContext)) return 'shake (CSS)';
      if (/draw|stroke-dash/i.test(searchContext)) return 'draw (CSS)';
      // Only check for opacity animation in keyframes, not as a static attribute
      if (/@keyframes[\s\S]*opacity/i.test(styleContent)) return 'fade (CSS)';
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
   * Detect native SMIL animation from SVG content
   * Returns animation type string or null
   */
  private detectNativeAnimation(svg: string): string | null {
    // Check for SMIL animation elements
    const hasAnimateTransform = /<animateTransform\b/i.test(svg);
    const hasAnimate = /<animate\b/i.test(svg);
    const hasAnimateMotion = /<animateMotion\b/i.test(svg);
    const hasSet = /<set\b/i.test(svg);

    if (!hasAnimateTransform && !hasAnimate && !hasAnimateMotion && !hasSet) {
      return null;
    }

    // Determine specific animation type
    if (hasAnimateTransform) {
      // Check the type of transform
      const typeMatch = svg.match(/<animateTransform[^>]*type=["']([^"']+)["']/i);
      if (typeMatch) {
        const transformType = typeMatch[1].toLowerCase();
        return `native-${transformType}`;
      }
      return 'native-transform';
    }
    if (hasAnimateMotion) {
      return 'native-motion';
    }
    if (hasAnimate) {
      return 'native-animate';
    }
    return 'native';
  }

  /**
   * Count unique colors in SVG content to detect rasterized images
   */
  private countSvgColors(svg: string): number {
    const colorRegex =
      /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
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

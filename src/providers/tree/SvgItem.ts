import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon } from '../../types/icons';
import { saveTempSvgIcon } from '../TempIconStudio';
import { SvgContentCache } from '../../utils/SvgContentCache';
import { t } from '../../i18n';
import { getAnimationService } from '../../services/animation/AnimationAssignmentService';
import { SvgAnimationDetector } from '../../services/svg/SvgAnimationDetector';
import { SvgRasterDetector } from '../../services/svg/SvgRasterDetector';

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
    if (isMissingRef) return `⚠ ${t('treeView.fileNotFoundLabel')}`;

    if (icon.isBuilt) {
      const parts: string[] = [];
      if (animationType) {
        const isNative = animationType.startsWith('native');
        parts.push(`${isNative ? '🔄' : '⚡'} ${animationType}`);
      }
      if (icon.usageCount !== undefined) {
        const usageText = icon.usageCount === 0
          ? `⚠ ${t('treeView.unusedLabel')}`
          : icon.usageCount === 1
            ? t('treeView.usageCount', { count: icon.usageCount })
            : t('treeView.usageCountPlural', { count: icon.usageCount });
        parts.push(usageText);
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
    lines.push(`❌ ${t('treeView.svgFileNotFound')}`);
    lines.push(t('treeView.expectedPath', { path: icon.path || '' }));
    if (icon.filePath) {
      lines.push(t('treeView.referencedIn', { file: path.basename(icon.filePath), line: (icon.line || 0) + 1 }));
    }
  }

  private addBuiltIconTooltip(lines: string[], icon: WorkspaceIcon, animationType: string | null): void {
    lines.push(`✓ ${t('treeView.builtStatus')}`);
    if (animationType) {
      lines.push(`⚡ ${t('treeView.animationLabel', { type: animationType })}`);
      if (icon.animation) {
        lines.push(`   ${t('treeView.durationLabel', { value: icon.animation.duration })}`);
        lines.push(`   ${t('treeView.timingLabel', { value: icon.animation.timing })}`);
        lines.push(`   ${t('treeView.iterationLabel', { value: icon.animation.iteration })}`);
      }
    }
  }

  private addUsagesTooltip(lines: string[], icon: WorkspaceIcon): void {
    if (!icon.usages || icon.usages.length === 0) return;

    lines.push('');
    const count = icon.usages.length;
    const headerKey = count === 1 ? 'treeView.usagesHeader' : 'treeView.usagesHeaderPlural';
    lines.push(`📍 ${t(headerKey, { count })}`);

    for (const usage of icon.usages.slice(0, 5)) {
      const shortFile = usage.file.split(/[\\/]/).slice(-2).join('/');
      lines.push(`  • ${shortFile}:${usage.line}`);
    }

    if (icon.usages.length > 5) {
      lines.push(`  ${t('treeView.moreUsages', { count: icon.usages.length - 5 })}`);
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
    // Delegate to SvgContentCache which handles caching, invalidation and lazy loading
    return SvgItem.svgCache.getContent(filePath);
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
   * Delegates to SvgAnimationDetector service
   */
  private detectAnimationType(icon: WorkspaceIcon): string | null {
    if (icon.animation?.type) return icon.animation.type;
    const svg = icon.svg;
    if (!svg) return null;
    return SvgAnimationDetector.detectFromContent(svg);
  }

  /**
   * Detect native SMIL animation from SVG content
   * Delegates to SvgAnimationDetector service
   */
  private detectNativeAnimation(svg: string): string | null {
    return SvgAnimationDetector.detectNativeAnimation(svg);
  }

  /**
   * Count unique colors in SVG content
   * Delegates to SvgRasterDetector service
   */
  private countSvgColors(svg: string): number {
    return SvgRasterDetector.countColors(svg);
  }

  /**
   * Check if SVG is a rasterized image (too many colors for icon editing)
   * Delegates to SvgRasterDetector service
   */
  private isRasterizedSvg(svg: string | undefined): boolean {
    return SvgRasterDetector.isRasterized(svg);
  }
}

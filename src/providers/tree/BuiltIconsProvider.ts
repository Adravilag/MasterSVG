import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceIcon, IconAnimation } from '../../types/icons';
import { getSvgConfig, isFullyConfigured } from '../../utils/config';
import { SvgItem } from './SvgItem';
import type { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { t } from '../../i18n';

/**
 * TreeDataProvider for Built Icons - separate view showing only compiled icons
 */
export class BuiltIconsProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> =
    new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> =
    this._onDidChangeTreeData.event;
  private itemCache: Map<string, SvgItem> = new Map();
  private builtIcons: Map<string, WorkspaceIcon> = new Map();
  private spriteIcons: Set<string> = new Set();
  private jsIcons: Set<string> = new Set();
  private isInitialized = false;
  private isScanning = false;

  constructor(private workspaceProvider: WorkspaceSvgProvider) { }

  refresh(): void {
    this.builtIcons.clear();
    this.spriteIcons.clear();
    this.jsIcons.clear();
    this.itemCache.clear();
    this.isInitialized = false;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Soft refresh - re-renders tree without clearing cache
   * This preserves expansion state better than full refresh
   * Use for updates that don't change the icon list significantly
   */
  softRefresh(): void {
    // Don't clear caches - just re-render using cached data
    // This preserves tree expansion state
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh a specific file container (icons.js or sprite.svg) without collapsing other containers
   */
  refreshContainer(fileName: string): void {
    const containerKey = `built:${fileName}`;
    const cachedContainer = this.itemCache.get(containerKey);
    if (cachedContainer) {
      this._onDidChangeTreeData.fire(cachedContainer);
    } else {
      // Fallback to soft refresh if container not in cache
      this.softRefresh();
    }
  }

  /**
   * Refresh only a specific file category - invalidates cache to reload from disk
   * Note: This will collapse the tree. Use refreshContainer for partial updates.
   */
  refreshFile(_fileName: string): void {
    // Must invalidate cache so getChildren() will re-read from disk
    this.builtIcons.clear();
    this.spriteIcons.clear();
    this.jsIcons.clear();
    this.isInitialized = false;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh a specific item by icon name without collapsing tree branches
   */
  refreshItemByName(iconName: string): void {
    const icon = this.builtIcons.get(iconName);
    if (icon) {
      // Create a SvgItem for this icon and fire partial refresh
      const item = SvgItem.create(icon.name, 0, vscode.TreeItemCollapsibleState.None, 'icon', icon);
      this._onDidChangeTreeData.fire(item);
    } else {
      // Icon not in cache, need full refresh
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Add a new icon to the cache and refresh the icons.js container only
   * This preserves tree expansion state when adding new icons
   */
  addIconAndRefresh(iconName: string, svg: string, iconsFilePath: string, animation?: IconAnimation): void {
    // Create WorkspaceIcon for the new icon
    const newIcon: WorkspaceIcon = {
      name: iconName,
      path: iconsFilePath,
      source: 'library',
      svg: svg,
      isBuilt: true,
      animation: animation,
    };

    // Add to caches
    this.builtIcons.set(iconName, newIcon);
    this.jsIcons.add(iconName);

    // Clear item cache for this icon to force recreation with animation
    this.itemCache.delete(`built:icons.js:${iconName}`);

    // Get the icons.js container item from cache and refresh only that
    const containerItem = this.itemCache.get('built:icons.js');
    if (containerItem) {
      // Update the counter in the cached container before firing
      // Count icons that belong to icons.js (not sprite.svg)
      const jsIconCount = Array.from(this.builtIcons.values()).filter(
        icon => icon.path.endsWith('icons.js') || icon.path.endsWith('icons.ts')
      ).length;
      containerItem.description = `(${jsIconCount})`;
      this._onDidChangeTreeData.fire(containerItem);
    } else {
      // Fallback to full refresh if container not cached
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Remove an icon from the cache and refresh the icons.js container only
   * This preserves tree expansion state when removing icons
   */
  removeIconAndRefresh(iconName: string): void {
    // Remove from caches
    this.builtIcons.delete(iconName);
    this.jsIcons.delete(iconName);

    // Get the icons.js container item from cache and refresh only that
    const containerItem = this.itemCache.get('built:icons.js');
    if (containerItem) {
      // Update the counter in the cached container before firing
      const jsIconCount = Array.from(this.builtIcons.values()).filter(
        icon => icon.path.endsWith('icons.js') || icon.path.endsWith('icons.ts')
      ).length;
      containerItem.description = jsIconCount > 0 ? `(${jsIconCount})` : '';
      this._onDidChangeTreeData.fire(containerItem);
    } else {
      // Fallback to full refresh if container not cached
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Get built icons list
   */
  getBuiltIconsList(): WorkspaceIcon[] {
    return Array.from(this.builtIcons.values());
  }

  /**
   * Check if an icon name is in the sprite.svg
   */
  isInSprite(iconName: string): boolean {
    return this.spriteIcons.has(iconName);
  }

  /**
   * Check if an icon name is in icons.js (built)
   */
  isInBuilt(iconName: string): boolean {
    return this.jsIcons.has(iconName);
  }

  /**
   * Get the build status label for an icon
   */
  getBuildStatusLabel(iconName: string): string {
    // With single build format, icon should only be in one place
    if (this.jsIcons.has(iconName)) {
      return '(built)';
    } else if (this.spriteIcons.has(iconName)) {
      return '(sprite)';
    }
    return '';
  }

  /**
   * Check if an icon is built
   */
  isIconBuilt(iconName: string): boolean {
    return this.jsIcons.has(iconName) || this.spriteIcons.has(iconName);
  }

  /**
   * Ensure the provider is initialized before accessing data
   */
  async ensureReady(): Promise<void> {
    await this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && !this.isScanning) {
      this.isScanning = true;
      await this.loadBuiltIcons();
      this.isInitialized = true;
      this.isScanning = false;
    }
  }

  private async loadBuiltIcons(): Promise<void> {

    this.builtIcons.clear();

    const outputDir = getSvgConfig<string>('outputDirectory', 'mastersvg-svg');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const fullOutputPath = path.join(workspaceRoot, outputDir);

    // Try icons.js first, then legacy icons.ts/icons.js
    for (const name of ['icons.js', 'icons.ts', 'icons.js']) {
      const iconsFile = path.join(fullOutputPath, name);
      if (fs.existsSync(iconsFile)) {
        await this.parseIconsFile(iconsFile);
        break;
      }
    }

    // Also load from sprite.svg
    const spriteSvg = path.join(fullOutputPath, 'sprite.svg');
    if (fs.existsSync(spriteSvg)) {
      await this.parseSpriteFile(spriteSvg);
    }


  }

  private async parseSpriteFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');


      // Extract symbols with their content
      const symbolRegex =
        /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
      let match;

      while ((match = symbolRegex.exec(content)) !== null) {
        const iconName = match[1];
        const viewBox = match[2];
        const body = match[3];

        // Skip if already loaded from icons.js (avoid duplicates)
        if (this.builtIcons.has(iconName)) {
          continue;
        }

        // Create a full SVG from the symbol
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;



        this.builtIcons.set(iconName, {
          name: iconName,
          path: filePath,
          source: 'library',
          svg: svgContent,
          isBuilt: true,
        });
        this.spriteIcons.add(iconName);
      }
    } catch (_error) {
      // Error parsing sprite file - icons will not be available
    }
  }

  /**
   * Parse animation string from icon definition
   */
  private parseAnimationString(animationStr: string): IconAnimation | undefined {
    try {
      const typeMatch = animationStr.match(/type:\s*['"]([^'"]+)['"]/);
      if (!typeMatch) return undefined;

      const durationMatch = animationStr.match(/duration:\s*([\d.]+)/);
      const timingMatch = animationStr.match(/timing:\s*['"]([^'"]+)['"]/);
      const iterationMatch = animationStr.match(/iteration:\s*['"]([^'"]+)['"]/);
      const delayMatch = animationStr.match(/delay:\s*([\d.]+)/);
      const directionMatch = animationStr.match(/direction:\s*['"]([^'"]+)['"]/);

      return {
        type: typeMatch[1],
        duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
        timing: timingMatch ? timingMatch[1] : 'ease',
        iteration: iterationMatch ? iterationMatch[1] : 'infinite',
        delay: delayMatch ? parseFloat(delayMatch[1]) : undefined,
        direction: directionMatch ? directionMatch[1] : undefined,
      };
    } catch (_e) {
      return undefined;
    }
  }

  private async parseIconsFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Pattern for: export const iconName = { name: '...', body: `...`, viewBox: '...', animation?: {...} }
      const iconPattern =
        /export\s+const\s+(\w+)\s*=\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*body:\s*`([\s\S]*?)`\s*,\s*viewBox:\s*['"]([^'"]+)['"](?:\s*,\s*animation:\s*\{([^}]*)\})?\s*\}/g;
      let match;

      while ((match = iconPattern.exec(content)) !== null) {
        const iconName = match[2];
        const body = match[3];
        const viewBox = match[4];
        const animationStr = match[5];

        // Reconstruct full SVG
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

        // Parse animation if present
        const animation = animationStr ? this.parseAnimationString(animationStr) : undefined;

        this.builtIcons.set(iconName, {
          name: iconName,
          path: filePath,
          source: 'library',
          svg: svgContent,
          isBuilt: true,
          animation,
        });
        this.jsIcons.add(iconName);
      }
    } catch (_error) {
      // Error parsing icons file - icons will not be available
    }
  }

  getTreeItem(element: SvgItem): vscode.TreeItem {
    if (element.category?.startsWith('built:')) {
      this.itemCache.set(element.category, element);
    }
    return element;
  }

  getParent(element: SvgItem): SvgItem | undefined {
    // Icons have their parent category stored
    if (element.icon && element.category?.startsWith('built:')) {
      return this.itemCache.get(element.category);
    }
    // Categories (files) have no parent
    return undefined;
  }

  /**
   * Create a setup item for unconfigured state
   */
  private createSetupItem(command: string): SvgItem {
    const setupItem = SvgItem.create(
      t('treeView.configureFirst'),
      0,
      vscode.TreeItemCollapsibleState.None,
      'action',
      undefined,
      'configure'
    );
    setupItem.command = { command, title: t('commands.openSetup') };
    setupItem.iconPath = new vscode.ThemeIcon('gear');
    return setupItem;
  }

  /**
   * Get empty state items when no icons are built
   */
  private getEmptyStateItems(): SvgItem[] {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const outputDir = config.get<string>('outputDirectory', '');

    if (!outputDir) {
      const setupItem = this.createSetupItem('masterSVG.openWelcome');
      setupItem.tooltip = t('messages.clickToConfigureOutput');
      return [setupItem];
    }

    return [
      SvgItem.create(
        t('treeView.noBuiltIcons'),
        0,
        vscode.TreeItemCollapsibleState.None,
        'action',
        undefined,
        undefined
      ),
    ];
  }

  /**
   * Build file category items from icons grouped by file
   */
  private buildFileCategoryItems(): SvgItem[] {
    const byFile = new Map<string, WorkspaceIcon[]>();
    for (const [, icon] of this.builtIcons) {
      const fileName = path.basename(icon.path);
      const existing = byFile.get(fileName) ?? [];
      existing.push(icon);
      byFile.set(fileName, existing);
    }

    const items: SvgItem[] = [];
    for (const [fileName, icons] of byFile) {
      const item = SvgItem.create(
        fileName,
        icons.length,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `built:${fileName}`
      );
      item.contextValue = this.getFileContextValue(fileName);
      items.push(item);
    }
    return items;
  }

  /**
   * Get context value for file type
   */
  private getFileContextValue(fileName: string): string {
    if (fileName === 'sprite.svg') return 'builtSpriteFile';
    if (fileName === 'icons.js' || fileName === 'icons.ts') return 'builtIconsFile';
    return 'builtFile';
  }

  async getChildren(element?: SvgItem): Promise<SvgItem[]> {
    if (!isFullyConfigured()) {
      return element ? [] : [this.createSetupItem('masterSVG.showWelcome')];
    }

    await this.ensureInitialized();

    if (element?.category?.startsWith('built:')) {
      return this.getIconsForFile(element.category.replace('built:', ''));
    }
    if (element) return [];

    return this.builtIcons.size === 0 ? this.getEmptyStateItems() : this.buildFileCategoryItems();
  }

  private getIconsForFile(fileName: string): SvgItem[] {
    const items: SvgItem[] = [];

    for (const [_name, icon] of this.builtIcons) {
      if (path.basename(icon.path) === fileName) {
        items.push(
          SvgItem.create(
            icon.name,
            0,
            vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            `built:${fileName}`
          )
        );
      }
    }

    return items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }
}

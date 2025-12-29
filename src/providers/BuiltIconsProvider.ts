import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceIcon, IconAnimation } from '../types/icons';
import { getSvgConfig } from '../utils/config';
import { SvgItem } from './SvgItem';
import type { WorkspaceSvgProvider } from './WorkspaceSvgProvider';

/**
 * TreeDataProvider for Built Icons - separate view showing only compiled icons
 */
export class BuiltIconsProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private itemCache: Map<string, SvgItem> = new Map();
  private builtIcons: Map<string, WorkspaceIcon> = new Map();
  private spriteIcons: Set<string> = new Set();
  private jsIcons: Set<string> = new Set();
  private isInitialized = false;
  private isScanning = false;

  constructor(private workspaceProvider: WorkspaceSvgProvider) {}

  refresh(): void {
    this.builtIcons.clear();
    this.spriteIcons.clear();
    this.jsIcons.clear();
    this.isInitialized = false;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh only a specific file category - invalidates cache to reload from disk
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
    console.log('[IconWrap] BuiltIconsProvider: Loading built icons...');
    this.builtIcons.clear();

    const outputDir = getSvgConfig<string>('outputDirectory', 'bezier-svg');
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

    console.log('[IconWrap] BuiltIconsProvider: Found', this.builtIcons.size, 'built icons');
  }

  private async parseSpriteFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log('[IconWrap] BuiltIconsProvider: Parsing sprite file', filePath);

      // Extract symbols with their content
      const symbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
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

        console.log('[IconWrap] BuiltIconsProvider: Found sprite icon:', iconName);

        this.builtIcons.set(iconName, {
          name: iconName,
          path: filePath,
          source: 'library',
          svg: svgContent,
          isBuilt: true
        });
        this.spriteIcons.add(iconName);
      }

      console.log('[IconWrap] BuiltIconsProvider: Total from sprite:', this.builtIcons.size);
    } catch (error) {
      console.error('[IconWrap] BuiltIconsProvider: Error parsing sprite file:', error);
    }
  }

  private async parseIconsFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log('[IconWrap] BuiltIconsProvider: Parsing file', filePath);
      
      // Pattern for: export const iconName = { name: '...', body: `...`, viewBox: '...', animation?: {...} }
      const iconPattern = /export\s+const\s+(\w+)\s*=\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*body:\s*`([^`]*)`\s*,\s*viewBox:\s*['"]([^'"]+)['"](?:\s*,\s*animation:\s*\{([^}]*)\})?\s*\}/g;
      let match;
      
      while ((match = iconPattern.exec(content)) !== null) {
        const varName = match[1];
        const iconName = match[2];
        const body = match[3];
        const viewBox = match[4];
        const animationStr = match[5];
        
        // Reconstruct full SVG
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
        
        // Parse animation if present
        let animation: IconAnimation | undefined;
        if (animationStr) {
          try {
            const typeMatch = animationStr.match(/type:\s*['"]([^'"]+)['"]/);
            const durationMatch = animationStr.match(/duration:\s*([\d.]+)/);
            const timingMatch = animationStr.match(/timing:\s*['"]([^'"]+)['"]/);
            const iterationMatch = animationStr.match(/iteration:\s*['"]([^'"]+)['"]/);
            const delayMatch = animationStr.match(/delay:\s*([\d.]+)/);
            const directionMatch = animationStr.match(/direction:\s*['"]([^'"]+)['"]/);
            
            if (typeMatch) {
              animation = {
                type: typeMatch[1],
                duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
                timing: timingMatch ? timingMatch[1] : 'ease',
                iteration: iterationMatch ? iterationMatch[1] : 'infinite',
                delay: delayMatch ? parseFloat(delayMatch[1]) : undefined,
                direction: directionMatch ? directionMatch[1] : undefined
              };
            }
          } catch (e) {
            console.warn('[IconWrap] BuiltIconsProvider: Failed to parse animation for', iconName);
          }
        }
        
        console.log('[IconWrap] BuiltIconsProvider: Found icon:', iconName, animation ? `with animation: ${animation.type}` : '');
        
        this.builtIcons.set(iconName, {
          name: iconName,
          path: filePath,
          source: 'library',
          svg: svgContent,
          isBuilt: true,
          animation
        });
        this.jsIcons.add(iconName);
      }

      console.log('[IconWrap] BuiltIconsProvider: Total parsed:', this.builtIcons.size);
    } catch (error) {
      console.error('[IconWrap] BuiltIconsProvider: Error parsing icons file:', error);
    }
  }

  getTreeItem(element: SvgItem): vscode.TreeItem {
    if (element.category?.startsWith('built:')) {
      this.itemCache.set(element.category, element);
    }
    return element;
  }

  async getChildren(element?: SvgItem): Promise<SvgItem[]> {
    await this.ensureInitialized();

    if (element) {
      if (element.category?.startsWith('built:')) {
        const fileName = element.category.replace('built:', '');
        return this.getIconsForFile(fileName);
      }
      return [];
    }

    if (this.builtIcons.size === 0) {
      // Check if output directory is configured
      const config = vscode.workspace.getConfiguration('iconManager');
      const outputDir = config.get<string>('outputDirectory', '');
      
      if (!outputDir) {
        // Not configured - show setup message
        const setupItem = new SvgItem(
          '⚙️ Configure Icon Manager',
          0,
          vscode.TreeItemCollapsibleState.None,
          'action',
          undefined,
          undefined
        );
        setupItem.command = {
          command: 'iconManager.openWelcome',
          title: 'Open Setup'
        };
        setupItem.tooltip = 'Click to configure output directory and settings';
        return [setupItem];
      }
      
      return [new SvgItem(
        'No built icons - Run Build command',
        0,
        vscode.TreeItemCollapsibleState.None,
        'action',
        undefined,
        undefined
      )];
    }

    // Group by source file
    const byFile = new Map<string, WorkspaceIcon[]>();
    for (const [_name, icon] of this.builtIcons) {
      const fileName = path.basename(icon.path);
      if (!byFile.has(fileName)) {
        byFile.set(fileName, []);
      }
      byFile.get(fileName)!.push(icon);
    }

    const items: SvgItem[] = [];
    for (const [fileName, icons] of byFile) {
      const item = new SvgItem(
        fileName,
        icons.length,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `built:${fileName}`
      );
      // Assign special contextValue for sprite.svg and icons.js to enable view commands
      if (fileName === 'sprite.svg') {
        item.contextValue = 'builtSpriteFile';
      } else if (fileName === 'icons.js' || fileName === 'icons.ts' || fileName === 'icons.js') {
        item.contextValue = 'builtIconsFile';
      } else {
        item.contextValue = 'builtFile';
      }
      items.push(item);
    }

    return items;
  }

  private getIconsForFile(fileName: string): SvgItem[] {
    const items: SvgItem[] = [];

    for (const [_name, icon] of this.builtIcons) {
      if (path.basename(icon.path) === fileName) {
        items.push(new SvgItem(
          icon.name,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          `built:${fileName}`
        ));
      }
    }

    return items.sort((a, b) => a.label.toString().localeCompare(b.label.toString()));
  }
}

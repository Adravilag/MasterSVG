import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceIcon } from '../types/icons';
import { getSvgConfig } from '../utils/config';
import { SvgItem } from './SvgItem';
import { shouldIgnorePath } from './IgnorePatterns';
import { SvgContentCache } from './SvgContentCache';
import type { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import type { BuiltIconsProvider } from './BuiltIconsProvider';

/**
 * TreeDataProvider for SVG Files - separate view showing only SVG files in workspace
 */
export class SvgFilesProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private folderCache: Map<string, SvgItem> = new Map();
  private svgFiles: Map<string, WorkspaceIcon> = new Map();
  private isInitialized = false;
  private isScanning = false;
  private builtIconsProvider: BuiltIconsProvider | null = null;
  private scanPromise: Promise<void> | null = null;

  constructor(private workspaceProvider: WorkspaceSvgProvider) {}

  /**
   * Set the BuiltIconsProvider reference (to avoid circular dependency in constructor)
   */
  setBuiltIconsProvider(provider: BuiltIconsProvider): void {
    this.builtIconsProvider = provider;
  }

  refresh(): void {
    // Clear and rescan
    this.svgFiles.clear();
    this.isInitialized = false;
    this.scanPromise = null;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh view after a file was modified or build status changed
   * Note: Does NOT clear svgFiles cache as files haven't changed,
   * but triggers re-render to update build status labels
   */
  refreshFile(_iconPath: string): void {
    // Just fire event to refresh display - svgFiles cache is still valid
    // but build status labels need to be re-read from BuiltIconsProvider
    this._onDidChangeTreeData.fire();
  }

  /**
   * Remove a single item from the tree
   */
  removeItem(iconPath: string): void {
    const iconName = path.basename(iconPath, '.svg');
    this.svgFiles.delete(iconName);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the SVG files map (for other components)
   */
  getSvgFilesMap(): Map<string, WorkspaceIcon> {
    return this.svgFiles;
  }

  /**
   * Ensure the provider is initialized before accessing data
   */
  async ensureReady(): Promise<void> {
    await this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    // If already scanning, wait for it to complete
    if (this.scanPromise) {
      await this.scanPromise;
      return;
    }
    
    if (!this.isInitialized && !this.isScanning) {
      this.isScanning = true;
      // Ensure BuiltIconsProvider is also initialized to get build status
      if (this.builtIconsProvider) {
        await this.builtIconsProvider.ensureReady();
      }
      this.scanPromise = this.scanSvgFiles();
      await this.scanPromise;
      this.scanPromise = null;
      this.isInitialized = true;
      this.isScanning = false;
    }
  }

  private async scanSvgFiles(): Promise<void> {
    console.log('[IconWrap] SvgFilesProvider: Starting scan...');
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('[IconWrap] SvgFilesProvider: No workspace folders');
      return;
    }

    for (const folder of workspaceFolders) {
      await this.scanFolder(folder.uri.fsPath);
    }
    
    console.log('[IconWrap] SvgFilesProvider: Scan complete. Found:', this.svgFiles.size, 'files');
  }

  private async scanFolder(folderPath: string): Promise<void> {
    const svgFolders = getSvgConfig<string[]>('svgFolders', []);
    let foundAny = false;

    // First try configured folders
    for (const svgFolder of svgFolders) {
      const fullPath = path.join(folderPath, svgFolder);
      if (fs.existsSync(fullPath)) {
        await this.scanDirectory(fullPath, svgFolder);
        foundAny = true;
      }
    }

    // If no configured folders found, scan ALL SVGs in workspace
    if (!foundAny) {
      console.log('[IconWrap] SvgFilesProvider: No configured folders, scanning all...');
      await this.scanAllSvgs(folderPath);
    }
  }

  private async scanDirectory(dirPath: string, category: string): Promise<void> {
    if (!fs.existsSync(dirPath) || shouldIgnorePath(dirPath)) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, `${category}/${entry.name}`);
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          if (shouldIgnorePath(fullPath)) continue;
          
          const iconName = path.basename(entry.name, '.svg');
          this.svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category,
            svg: undefined
          });
        }
      }
    } catch (error) {
      console.error(`[IconWrap] SvgFilesProvider: Error scanning ${dirPath}:`, error);
    }
  }

  private async scanAllSvgs(folderPath: string, relativePath: string = ''): Promise<void> {
    if (!fs.existsSync(folderPath) || shouldIgnorePath(folderPath)) return;

    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.svelte-kit'];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (!skipDirs.includes(entry.name)) {
            await this.scanAllSvgs(fullPath, relPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          if (shouldIgnorePath(fullPath)) continue;
          
          const iconName = path.basename(entry.name, '.svg');
          const category = path.dirname(relPath) || 'root';
          
          this.svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category === '.' ? 'root' : category,
            svg: undefined
          });
        }
      }
    } catch (error) {
      console.error(`[IconWrap] SvgFilesProvider: Error scanning ${folderPath}:`, error);
    }
  }

  getTreeItem(element: SvgItem): vscode.TreeItem {
    if (element.category?.startsWith('folder:')) {
      this.folderCache.set(element.category, element);
    }
    return element;
  }

  getParent(element: SvgItem): vscode.ProviderResult<SvgItem> {
    if (element.type === 'icon' && element.icon) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const relativePath = path.relative(workspaceRoot, element.icon.path);
      const parts = relativePath.split(path.sep);
      
      if (parts.length > 1) {
        const parentPath = path.dirname(element.icon.path);
        const folderName = path.basename(parentPath);
        return new SvgItem(
          folderName,
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `folder:${parentPath}`
        );
      }
    }
    return undefined;
  }

  async getChildren(element?: SvgItem): Promise<SvgItem[]> {
    await this.ensureInitialized();

    if (element) {
      if (element.category?.startsWith('folder:')) {
        const folderPath = element.category.replace('folder:', '');
        return this.getFolderChildren(folderPath);
      }
      return [];
    }

    if (this.svgFiles.size === 0) {
      return [new SvgItem(
        'No SVG files found',
        0,
        vscode.TreeItemCollapsibleState.None,
        'action',
        undefined,
        undefined
      )];
    }

    return this.buildFolderHierarchy();
  }

  private buildFolderHierarchy(): SvgItem[] {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const items: SvgItem[] = [];
    const topLevelFolders = new Map<string, number>();
    const rootFiles: WorkspaceIcon[] = [];

    for (const [_iconName, icon] of this.svgFiles) {
      const filePath = icon.path;
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      const parts = relativePath.split('/');
      
      if (parts.length === 1) {
        rootFiles.push(icon);
      } else {
        const topFolder = parts[0];
        topLevelFolders.set(topFolder, (topLevelFolders.get(topFolder) || 0) + 1);
      }
    }

    const sortedFolders = Array.from(topLevelFolders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [folderName, count] of sortedFolders) {
      const folderPath = path.join(workspaceRoot, folderName);
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `folder:${folderPath}`
      ));
    }

    for (const icon of rootFiles.sort((a, b) => a.name.localeCompare(b.name))) {
      items.push(this.createIconItem(icon));
    }

    return items;
  }

  /**
   * Create an SvgItem for an icon with build status label
   */
  private createIconItem(icon: WorkspaceIcon): SvgItem {
    const statusLabel = this.builtIconsProvider?.getBuildStatusLabel(icon.name) || '';
    const displayName = statusLabel ? `${icon.name} ${statusLabel}` : icon.name;
    
    // Update icon's isBuilt status from BuiltIconsProvider
    if (this.builtIconsProvider) {
      icon.isBuilt = this.builtIconsProvider.isIconBuilt(icon.name);
    }
    
    const item = new SvgItem(
      displayName,
      0,
      vscode.TreeItemCollapsibleState.None,
      'icon',
      icon,
      undefined
    );
    
    // Set description for additional info
    if (statusLabel) {
      item.description = '';
    }
    
    return item;
  }

  private getFolderChildren(folderPath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const subFolders = new Map<string, number>();
    const filesInFolder: WorkspaceIcon[] = [];
    const normalizedFolderPath = folderPath.replace(/\\/g, '/');

    for (const [_iconName, icon] of this.svgFiles) {
      const iconPath = icon.path.replace(/\\/g, '/');
      
      if (!iconPath.startsWith(normalizedFolderPath + '/')) {
        continue;
      }

      const relativePath = iconPath.substring(normalizedFolderPath.length + 1);
      const parts = relativePath.split('/');

      if (parts.length === 1) {
        filesInFolder.push(icon);
      } else {
        const subFolder = parts[0];
        subFolders.set(subFolder, (subFolders.get(subFolder) || 0) + 1);
      }
    }

    // Pre-load SVG content for files in this folder (batch optimization)
    const filePaths = filesInFolder.map(icon => icon.path);
    if (filePaths.length > 0) {
      SvgContentCache.getInstance().preloadBatch(filePaths);
    }

    const sortedFolders = Array.from(subFolders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [folderName, count] of sortedFolders) {
      const subFolderPath = path.join(folderPath, folderName);
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `folder:${subFolderPath}`
      ));
    }

    for (const icon of filesInFolder.sort((a, b) => a.name.localeCompare(b.name))) {
      items.push(this.createIconItem(icon));
    }

    return items;
  }
}

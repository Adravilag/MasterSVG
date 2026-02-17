import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon } from '../../types/icons';
import { isFullyConfigured } from '../../utils/config';
import { SvgItem } from './SvgItem';
import { SvgContentCache } from '../../utils/SvgContentCache';
import type { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import type { BuiltIconsProvider } from './BuiltIconsProvider';
import { FileSvgScanner } from '../scanner/FileSvgScanner';
import { t } from '../../i18n';

/**
 * TreeDataProvider for SVG Files - separate view showing only SVG files in workspace
 */
export class SvgFilesProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> =
    new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> =
    this._onDidChangeTreeData.event;
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
    this.folderCache.clear();
    this.isInitialized = false;
    this.scanPromise = null;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Soft refresh - re-renders tree without clearing cache
   * This preserves expansion state better than full refresh
   * Use for updates that don't change the file list (e.g., build status updates)
   */
  softRefresh(): void {
    // Don't clear caches - just re-render using cached data
    // This preserves tree expansion state
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh a specific folder without collapsing other folders
   */
  refreshFolder(folderPath: string): void {
    const folderKey = `folder:${folderPath}`;
    const cachedFolder = this.folderCache.get(folderKey);
    if (cachedFolder) {
      this._onDidChangeTreeData.fire(cachedFolder);
    } else {
      // Fallback to soft refresh if folder not in cache
      this.softRefresh();
    }
  }

  /**
   * Refresh view after a file was modified or build status changed
   * Note: Does NOT clear svgFiles cache as files haven't changed,
   * but triggers re-render to update build status labels
   */
  refreshFile(_iconPath: string): void {
    // Use soft refresh to preserve expansion state
    this.softRefresh();
  }

  /**
   * Remove a single item from the tree
   */
  removeItem(iconPath: string): void {
    this.svgFiles.delete(iconPath);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh a specific item by icon name without collapsing tree branches
   * This triggers a partial refresh that preserves expanded state
   */
  refreshItemByName(iconName: string): void {
    const icon = this.findIconByName(iconName);
    if (icon) {
      // Create a SvgItem for this icon and fire partial refresh
      const item = SvgItem.create(icon.name, 0, vscode.TreeItemCollapsibleState.None, 'icon', icon);
      this._onDidChangeTreeData.fire(item);
    }
  }

  /**
   * Find an icon by name (searches values since keys are file paths)
   */
  private findIconByName(iconName: string): WorkspaceIcon | undefined {
    for (const icon of this.svgFiles.values()) {
      if (icon.name === iconName) {
        return icon;
      }
    }
    return undefined;
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
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    for (const folder of workspaceFolders) {
      await FileSvgScanner.scanFolder(folder.uri.fsPath, this.svgFiles);
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
        return SvgItem.create(
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
    // Check if extension is fully configured first
    if (!isFullyConfigured()) {
      if (!element) {
        const configureItem = SvgItem.create(
          t('treeView.configureFirst'),
          0,
          vscode.TreeItemCollapsibleState.None,
          'action',
          undefined,
          'configure'
        );
        configureItem.command = {
          command: 'masterSVG.showWelcome',
          title: t('treeView.configureFirst'),
        };
        configureItem.iconPath = new vscode.ThemeIcon('gear');
        return [configureItem];
      }
      return [];
    }

    await this.ensureInitialized();

    if (element) {
      if (element.category?.startsWith('folder:')) {
        const folderPath = element.category.replace('folder:', '');
        return this.getFolderChildren(folderPath);
      }
      return [];
    }

    if (this.svgFiles.size === 0) {
      return [
        SvgItem.create(
          t('treeView.noSvgFilesInView'),
          0,
          vscode.TreeItemCollapsibleState.None,
          'action',
          undefined,
          undefined
        ),
      ];
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

    const sortedFolders = Array.from(topLevelFolders.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    for (const [folderName, count] of sortedFolders) {
      const folderPath = path.join(workspaceRoot, folderName);
      items.push(
        SvgItem.create(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `folder:${folderPath}`
        )
      );
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

    const item = SvgItem.create(
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
      items.push(
        SvgItem.create(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `folder:${subFolderPath}`
        )
      );
    }

    for (const icon of filesInFolder.sort((a, b) => a.name.localeCompare(b.name))) {
      items.push(this.createIconItem(icon));
    }

    return items;
  }
}

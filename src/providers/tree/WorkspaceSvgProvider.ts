import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isFullyConfigured } from '../../utils/config';
import { WorkspaceIcon, IconUsage, IconAnimation } from '../../types/icons';

// Re-export types for backward compatibility
export { WorkspaceIcon, IconUsage, IconAnimation };

// Re-export utilities from separate modules
export { initIgnoreFileWatcher, shouldIgnorePath } from '../../utils/IgnorePatterns';
export { clearTempIcons, saveTempSvgIcon } from '../TempIconStudio';

// Re-export classes from separate modules
export { SvgItem } from './SvgItem';
export { BuiltIconsProvider } from './BuiltIconsProvider';
export { SvgFilesProvider } from './SvgFilesProvider';
export { SvgContentCache } from '../../utils/SvgContentCache';

// Import SvgItem for use in this file
import { SvgItem } from './SvgItem';
import { clearTempIcons } from '../TempIconStudio';
import { SvgScanner } from '../scanner/SvgScanner';
import { SectionChildrenBuilder } from './SectionChildrenBuilder';
import { CategorySectionBuilder } from './CategorySectionBuilder';
import { IconCacheService } from '../../services/icon/IconCacheService';
import { IconLookupService, SvgDataResult, IconStorageMaps } from '../../services/icon/IconLookupService';
import { IconCategoryService } from '../../services/icon/IconCategoryService';
import { SvgContentCache } from '../../utils/SvgContentCache';
import { TreeParentResolver } from '../../utils/TreeParentResolver';
import { IconRemovalService, IconRemovalResult } from '../../services/icon/IconRemovalService';
import { t } from '../../i18n';

export class WorkspaceSvgProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> =
    new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private svgFiles: Map<string, WorkspaceIcon> = new Map();
  private libraryIcons: Map<string, WorkspaceIcon> = new Map();
  private inlineSvgs: Map<string, WorkspaceIcon> = new Map();
  private svgReferences: Map<string, WorkspaceIcon[]> = new Map(); // Files with <img src="...svg">
  private builtIcons: Set<string> = new Set();
  private iconUsages: Map<string, IconUsage[]> = new Map();
  private context: vscode.ExtensionContext;
  private scanner: SvgScanner;
  private cacheService: IconCacheService;
  private isInitialized = false;
  private isScanning = false;
  private usagesScanned = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.scanner = new SvgScanner(context);
    this.cacheService = new IconCacheService();
    // Defer loading - don't block activation
  }

  refresh(): void {
    // Clear all cached data
    this.svgFiles.clear();
    this.libraryIcons.clear();
    this.inlineSvgs.clear();
    this.svgReferences.clear();
    this.builtIcons.clear();
    this.iconUsages.clear();
    this.cacheService.clear();
    this.isInitialized = false;
    this.usagesScanned = false;
    // Clear SVG content cache
    SvgContentCache.getInstance().clear();
    // Clear temp icon files to force VS Code to reload new versions
    clearTempIcons();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Soft refresh - re-renders tree without clearing cache
   * This preserves expansion state better than full refresh
   */
  softRefresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Remove an SVG file from the cache without triggering refresh
   * Call the specific provider's refresh method after this
   */
  removeSvgFile(iconName: string): void {
    // Find by name since callers pass the icon name
    for (const [key, icon] of this.svgFiles) {
      if (icon.name === iconName) {
        this.svgFiles.delete(key);
        break;
      }
    }
    // Don't fire event - let caller handle partial refresh
  }

  /**
   * Remove an inline SVG from the cache by its key
   * The key is typically in format "filename:svg-N" or "filename:img-refname"
   * Call softRefresh() after this to update the tree
   */
  removeInlineSvg(key: string): void {
    this.inlineSvgs.delete(key);
  }

  /**
   * Remove an IMG reference from the cache by file path and icon name
   * @param filePath - The file containing the IMG reference (e.g., App.tsx)
   * @param iconName - The icon name (e.g., "rocket")
   * @param line - Optional line number for more precise matching
   */
  removeImgReference(filePath: string, iconName: string, line?: number): void {
    const refs = this.svgReferences.get(filePath);
    if (!refs) return;

    // Filter out the matching reference
    const filtered = refs.filter(ref => {
      if (ref.name !== iconName) return true;
      if (line !== undefined && ref.line !== line) return true;
      return false;
    });

    if (filtered.length === 0) {
      // No more references in this file
      this.svgReferences.delete(filePath);
    } else if (filtered.length !== refs.length) {
      // Some references remain
      this.svgReferences.set(filePath, filtered);
    }
  }

  /**
   * Update SVG file content in cache without full refresh
   * Used when a file is modified externally
   */
  updateSvgFileContent(filePath: string): void {
    // Use file path directly as key (path-keyed map)
    const existingIcon = this.svgFiles.get(filePath);

    // Invalidate SVG content cache for this file
    SvgContentCache.getInstance().invalidate(filePath);

    if (existingIcon && fs.existsSync(filePath)) {
      try {
        // Use cache to get fresh content
        const newContent = SvgContentCache.getInstance().getContent(filePath);
        if (newContent) {
          existingIcon.svg = newContent;
        }
        // Clear temp icon to force reload
        clearTempIcons();
      } catch {
        // Ignore read errors
      }
    }
  }

  /**
   * Add or update an icon in the built icons without triggering refresh
   * Call the specific provider's refresh method after this
   */
  addBuiltIcon(iconName: string, icon: WorkspaceIcon): void {
    this.libraryIcons.set(iconName, icon);
    this.builtIcons.add(iconName);
    // Don't fire event - let caller handle partial refresh
  }

  /**
   * Rename a built icon in the cache (partial refresh)
   * Updates all internal caches and fires a partial tree update
   */
  renameBuiltIcon(oldName: string, newName: string): void {
    const icon = this.libraryIcons.get(oldName);
    if (icon) {
      // Update the icon's name property
      icon.name = newName;

      // Move in libraryIcons map
      this.libraryIcons.delete(oldName);
      this.libraryIcons.set(newName, icon);

      // Update builtIcons set
      this.builtIcons.delete(oldName);
      this.builtIcons.add(newName);

      // Clear ALL cached items for built section to force full re-render
      this.cacheService.deleteMatching(
        (key, item) =>
          key.includes(oldName) ||
          key.includes('built:') ||
          (item.category?.startsWith('built:') ?? false)
      );

      // Clear temp icons to force reload
      clearTempIcons();

      // Fire update - use undefined to refresh entire tree
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  /**
   * Rename an SVG file in the cache (partial refresh)
   */
  renameSvgFile(oldName: string, newName: string, newPath: string): void {
    // Find by name since callers pass the icon name
    let oldKey: string | undefined;
    let icon: WorkspaceIcon | undefined;
    for (const [key, value] of this.svgFiles) {
      if (value.name === oldName) {
        oldKey = key;
        icon = value;
        break;
      }
    }
    if (icon && oldKey) {
      // Update icon properties
      icon.name = newName;
      icon.path = newPath;

      // Move in svgFiles map (delete old path key, set new path key)
      this.svgFiles.delete(oldKey);
      this.svgFiles.set(newPath, icon);

      // Clear ALL cached items for files section
      this.cacheService.deleteMatching(
        (key, item) =>
          key.includes(oldName) ||
          key.includes('folder:') ||
          (item.category?.startsWith('folder:') ?? false)
      );

      // Clear temp icons
      clearTempIcons();

      // Fire update
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: SvgItem): vscode.TreeItem {
    // Cache the item for later reveal
    this.cacheService.cacheItem(element);
    return element;
  }

  // Required for TreeView.reveal() to work with hierarchical structures
  getParent(element: SvgItem): SvgItem | undefined {
    return TreeParentResolver.getParent(element);
  }

  // Ensure the provider is initialized (call before searching for icons)
  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && !this.isScanning) {
      this.isScanning = true;
      await this.initialize();
      this.isInitialized = true;
      this.isScanning = false;
    }
  }

  async getChildren(element?: SvgItem): Promise<SvgItem[]> {
    // Check if extension is fully configured first
    if (!isFullyConfigured()) {
      if (!element) {
        const configureItem = SvgItem.create(
          'Configurar MasterSVG',
          0,
          vscode.TreeItemCollapsibleState.None,
          'action',
          undefined,
          'configure'
        );
        configureItem.command = {
          command: 'masterSVG.showWelcome',
          title: 'Configurar MasterSVG',
        };
        configureItem.iconPath = new vscode.ThemeIcon('gear');
        return [configureItem];
      }
      return [];
    }

    // Lazy initialization
    if (!this.isInitialized && !this.isScanning) {
      this.isScanning = true;
      await this.initialize();
      this.isInitialized = true;
      this.isScanning = false;
    }

    if (!element) {
      // Root level - show main sections
      return this.getRootSections();
    }

    // Handle section expansion
    if (element.type === 'section') {
      return await this.getSectionChildren(element.category!);
    }

    // Handle folder navigation in hierarchical tree
    if (element.type === 'category') {
      // SVG Files folder hierarchy
      if (element.category?.startsWith('folder:')) {
        return this.getFolderChildren(element.category.replace('folder:', ''));
      }

      // Inline SVGs folder hierarchy
      if (element.category?.startsWith('inlinedir:')) {
        return this.getInlineDirChildren(element.category.replace('inlinedir:', ''));
      }

      // Inline SVGs file → show icons
      if (element.category?.startsWith('inline:')) {
        return this.getInlineFileChildren(element.category.replace('inline:', ''));
      }

      // IMG References folder hierarchy
      if (element.category?.startsWith('refsdir:')) {
        return this.getRefsDirChildren(element.category.replace('refsdir:', ''));
      }

      // IMG References file → show icons
      if (element.category?.startsWith('refs:')) {
        return this.getRefsFileChildren(element.category.replace('refs:', ''));
      }

      // Icon Component usages folder hierarchy
      if (element.category?.startsWith('usagesdir:')) {
        return this.getUsagesDirChildren(element.category.replace('usagesdir:', ''));
      }

      // Icon Component usages file → show icons
      if (element.category?.startsWith('usages:')) {
        return this.getUsagesFileChildren(element.category.replace('usages:', ''));
      }

      // Built icons by file
      if (element.category?.startsWith('built:')) {
        const icons = this.getIconsByCategory(element.category);
        return icons.map(icon => {
          const hasUsages = icon.usages && icon.usages.length > 0;
          return SvgItem.create(
            icon.name,
            0,
            hasUsages
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            element.category
          );
        });
      }

      // Default: get icons by category
      const icons = this.getIconsByCategory(element.category!);
      return icons.map(icon => {
        const hasUsages = icon.usages && icon.usages.length > 0;
        return SvgItem.create(
          icon.name,
          0,
          hasUsages
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          element.category
        );
      });
    }

    // If element is an icon with usages, show usage locations
    if (element.type === 'icon' && element.icon?.usages && element.icon.usages.length > 0) {
      return element.icon.usages.map(usage => {
        const shortFile = usage.file.split(/[\\/]/).slice(-2).join('/');
        return SvgItem.create(
          `${shortFile}:${usage.line}`,
          0,
          vscode.TreeItemCollapsibleState.None,
          'usage',
          element.icon,
          element.category,
          usage
        );
      });
    }

    return [];
  }

  // Get children for SVG Files folder hierarchy
  private getFolderChildren(folderPath: string): SvgItem[] {
    return SectionChildrenBuilder.getFolderChildren(folderPath, this.svgFiles);
  }

  // Get children for Inline SVGs folder hierarchy
  private getInlineDirChildren(dirPath: string): SvgItem[] {
    return SectionChildrenBuilder.getInlineDirChildren(dirPath, this.inlineSvgs);
  }

  // Get children (inline SVGs) for a specific file
  private getInlineFileChildren(filePath: string): SvgItem[] {
    return SectionChildrenBuilder.getInlineFileChildren(filePath, this.inlineSvgs);
  }

  // Get children for IMG References folder hierarchy
  private getRefsDirChildren(dirPath: string): SvgItem[] {
    return SectionChildrenBuilder.getRefsDirChildren(dirPath, this.svgReferences);
  }

  // Get children (SVG references) for a specific file
  private getRefsFileChildren(filePath: string): SvgItem[] {
    return SectionChildrenBuilder.getRefsFileChildren(filePath, this.svgReferences);
  }

  // Get children for Icon Component usages folder hierarchy
  private getUsagesDirChildren(dirPath: string): SvgItem[] {
    return SectionChildrenBuilder.getUsagesDirChildren(dirPath, this.iconUsages);
  }

  // Get children (icon usages) for a specific file
  private getUsagesFileChildren(filePath: string): SvgItem[] {
    return SectionChildrenBuilder.getUsagesFileChildren(filePath, this.iconUsages, this.libraryIcons);
  }

  // Get children for a directory category (legacy - kept for compatibility)
  private getDirectoryChildren(category: string): SvgItem[] {
    if (category.startsWith('inlinedir:')) {
      return this.getInlineDirChildren(category.replace('inlinedir:', ''));
    } else if (category.startsWith('refsdir:')) {
      return this.getRefsDirChildren(category.replace('refsdir:', ''));
    }
    return [];
  }

  private getRootSections(): SvgItem[] {
    const sections: SvgItem[] = [];

    // 1. Inline SVGs section (files with <svg> elements)
    if (this.inlineSvgs.size > 0) {
      sections.push(
        SvgItem.create(
          t('treeView.inlineSvgs'),
          this.inlineSvgs.size,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'inline'
        )
      );
    }

    // 2. SVG References section (files with <img src="...svg">)
    if (this.svgReferences.size > 0) {
      const totalRefs = Array.from(this.svgReferences.values()).reduce(
        (sum, refs) => sum + refs.length,
        0
      );
      sections.push(
        SvgItem.create(
          t('treeView.imgReferences'),
          totalRefs,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'references'
        )
      );
    }

    // 3. Icon Component usages section (show if there are built icons)
    const hasBuiltIcons = Array.from(this.libraryIcons.values()).some(icon => icon.isBuilt);
    if (hasBuiltIcons) {
      const totalUsages = this.usagesScanned
        ? Array.from(this.iconUsages.values()).reduce((sum, usages) => sum + usages.length, 0)
        : undefined;
      sections.push(
        SvgItem.create(
          t('treeView.iconComponent'),
          totalUsages ?? 0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'icon_usages_section'
        )
      );
    }

    if (sections.length === 0) {
      return [
        SvgItem.create(
          t('treeView.noSvgsInCode'),
          0,
          vscode.TreeItemCollapsibleState.None,
          'action',
          undefined,
          undefined
        ),
      ];
    }

    return sections;
  }

  private async getSectionChildren(sectionId: string): Promise<SvgItem[]> {
    switch (sectionId) {
      case 'built': {
        // Group built icons by source file
        const items: SvgItem[] = [];
        const byFile = new Map<string, number>();
        for (const icon of this.libraryIcons.values()) {
          if (icon.isBuilt) {
            const fileName = path.basename(icon.path);
            byFile.set(fileName, (byFile.get(fileName) || 0) + 1);
          }
        }
        for (const [fileName, count] of byFile) {
          items.push(
            SvgItem.create(
              fileName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `built:${fileName}`
            )
          );
        }
        return items;
      }

      case 'files':
        return CategorySectionBuilder.buildFilesSectionChildren(this.svgFiles);

      case 'inline':
        return CategorySectionBuilder.buildInlineSectionChildren(this.inlineSvgs);

      case 'references':
        return CategorySectionBuilder.buildReferencesSectionChildren(this.svgReferences);

      case 'icon_usages_section': {
        // Lazy scan usages when section is expanded
        if (!this.usagesScanned) {
          await this.scanIconUsages();
          // Refresh tree to show updated count
          this._onDidChangeTreeData.fire();
        }
        return CategorySectionBuilder.buildUsagesSectionChildren(this.iconUsages);
      }

      default:
        return [];
    }
  }

  private async initialize(): Promise<void> {
    // Load library icons first (fast, from JSON)
    this.scanner.loadLibraryIcons(this.libraryIcons);
    // Load built icons from output file
    await this.scanner.loadBuiltIcons(this.libraryIcons, this.builtIcons);

    // Scan workspace with progress for large projects
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'MasterSVG: Scanning workspace',
        cancellable: false,
      },
      async progress => {
        // Scan workspace folders
        progress.report({ message: 'Scanning SVG files...' });
        await this.scanWorkspaceWithProgress(progress);

        // Scan inline SVGs in code files
        progress.report({ message: 'Scanning inline SVGs...' });
        await this.scanner.scanInlineSvgs(
          this.inlineSvgs,
          this.svgReferences,
          this.builtIcons,
          scanProgress => {
            if (scanProgress.percentage !== undefined) {
              progress.report({
                message: `Scanning inline SVGs... ${scanProgress.percentage}%`,
                increment: scanProgress.percentage > 0 ? 1 : 0,
              });
            }
          }
        );

        // Scan icon usages if there are built icons
        const hasBuiltIcons = Array.from(this.libraryIcons.values()).some(icon => icon.isBuilt);
        if (hasBuiltIcons) {
          progress.report({ message: 'Scanning icon usages...' });
          await this.scanIconUsagesWithProgress(progress);
        }
      }
    );
  }

  async scanFolder(folderPath: string): Promise<void> {
    await this.scanner.scanFolder(folderPath, this.svgFiles);
    this._onDidChangeTreeData.fire();
  }

  private async scanWorkspace(): Promise<void> {
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    for (const folder of workspaceFolders) {
      await this.scanner.scanFolder(folder.uri.fsPath, this.svgFiles);
    }
  }

  private async scanWorkspaceWithProgress(
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    for (let i = 0; i < workspaceFolders.length; i++) {
      const folder = workspaceFolders[i];
      progress.report({
        message: `Scanning ${folder.name}...`,
        increment: 100 / workspaceFolders.length,
      });

      await this.scanner.scanFolder(folder.uri.fsPath, this.svgFiles, scanProgress => {
        if (scanProgress.currentFile) {
          const fileName = path.basename(scanProgress.currentFile);
          progress.report({ message: `Found: ${fileName}` });
        }
      });
    }
  }

  private async scanIconUsagesWithProgress(
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    if (this.usagesScanned) return;

    await this.scanner.scanIconUsages(this.libraryIcons, this.iconUsages, scanProgress => {
      if (scanProgress.percentage !== undefined) {
        progress.report({
          message: `Scanning icon usages... ${scanProgress.percentage}%`,
        });
      }
    });
    this.usagesScanned = true;
  }

  // Check if an icon is built
  isIconBuilt(iconName: string): boolean {
    return this.builtIcons.has(iconName);
  }

  // Remove icons from the icons.js file
  async removeIcons(iconNames: string[]): Promise<IconRemovalResult> {
    const result = await IconRemovalService.removeIcons(
      iconNames,
      this.builtIcons,
      this.libraryIcons
    );

    if (result.success) {
      // Refresh the tree view
      this._onDidChangeTreeData.fire();
    }

    return result;
  }

  async getAllIcons(): Promise<WorkspaceIcon[]> {
    return IconLookupService.getAllIcons({
      svgFiles: this.svgFiles,
      libraryIcons: this.libraryIcons,
    });
  }

  /**
   * Get list of built icons only (for BuiltIconsProvider)
   */
  getBuiltIconsList(): WorkspaceIcon[] {
    return IconLookupService.getBuiltIconsList(this.libraryIcons);
  }

  /**
   * Get SVG files map (for SvgFilesProvider)
   */
  getSvgFilesMap(): Map<string, WorkspaceIcon> {
    return this.svgFiles;
  }

  /**
   * Get the hierarchical structure of SVG file folders
   */
  getSvgFilesFolderStructure(): { folders: Map<string, string[]>; rootFiles: string[] } {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const folders = new Map<string, string[]>();
    const rootFiles: string[] = [];

    for (const [filePath] of this.svgFiles) {
      const relativePath = path.relative(workspaceRoot, filePath);
      const parts = relativePath.split(path.sep);

      if (parts.length === 1) {
        rootFiles.push(filePath);
      } else {
        const topFolder = parts[0];
        if (!folders.has(topFolder)) {
          folders.set(topFolder, []);
        }
        folders.get(topFolder)!.push(filePath);
      }
    }

    return { folders, rootFiles };
  }

  getIcon(name: string): WorkspaceIcon | undefined {
    return IconLookupService.getIcon(name, this._getStorageMaps());
  }

  /**
   * Get all IMG references from the workspace
   * Used by buildAllReferences command
   */
  getImgReferences(): WorkspaceIcon[] {
    return IconLookupService.getImgReferences(this.svgReferences);
  }

  private _getStorageMaps(): IconStorageMaps {
    return {
      svgFiles: this.svgFiles,
      libraryIcons: this.libraryIcons,
      inlineSvgs: this.inlineSvgs,
      svgReferences: this.svgReferences,
    };
  }

  private getCategories(): { name: string; count: number; type: 'library' | 'file' | 'folder' }[] {
    return IconCategoryService.getCategories(this._getStorageMaps());
  }

  private getIconsByCategory(category: string): WorkspaceIcon[] {
    return IconCategoryService.getIconsByCategory(category, this._getStorageMaps());
  }

  // Scan all code files for inline <svg> elements and <img src="...svg"> references
  async scanInlineSvgs(): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'MasterSVG: Scanning inline SVGs',
        cancellable: false,
      },
      async progress => {
        await this.scanner.scanInlineSvgs(
          this.inlineSvgs,
          this.svgReferences,
          this.builtIcons,
          scanProgress => {
            if (scanProgress.percentage !== undefined) {
              progress.report({
                message: `${scanProgress.percentage}% complete`,
                increment: scanProgress.percentage > 0 ? 1 : 0,
              });
            }
          }
        );
      }
    );
    this._onDidChangeTreeData.fire();
  }

  getInlineSvgs(): WorkspaceIcon[] {
    return IconLookupService.getInlineSvgs(this.inlineSvgs);
  }

  getInlineSvgByKey(key: string): WorkspaceIcon | undefined {
    return IconLookupService.getInlineSvgByKey(key, this.inlineSvgs);
  }

  // Get SVG data for preview panel
  getSvgData(item: SvgItem): SvgDataResult | undefined {
    return IconLookupService.getSvgData(item);
  }

  // Scan workspace for icon usages
  async scanIconUsages(): Promise<void> {
    if (this.usagesScanned) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'MasterSVG: Scanning icon usages',
        cancellable: false,
      },
      async progress => {
        await this.scanner.scanIconUsages(this.libraryIcons, this.iconUsages, scanProgress => {
          if (scanProgress.percentage !== undefined) {
            progress.report({
              message: `${scanProgress.percentage}% complete`,
            });
          }
        });
      }
    );
    this.usagesScanned = true;

    // Refresh tree to show usage counts
    this._onDidChangeTreeData.fire();
  }

  // Get usages for a specific icon
  getIconUsages(iconName: string): IconUsage[] {
    return this.iconUsages.get(iconName) || [];
  }

  // Check if usages have been scanned
  hasScannedUsages(): boolean {
    return this.usagesScanned;
  }

  // Get icon by name from any source
  getIconByName(name: string): WorkspaceIcon | undefined {
    return IconLookupService.getIconByName(name, this._getStorageMaps());
  }

  // Find icon by file path
  getIconByPath(filePath: string): WorkspaceIcon | undefined {
    return IconLookupService.getIconByPath(filePath, this._getStorageMaps());
  }

  // Get a cached item by its ID
  getItemById(id: string): SvgItem | undefined {
    return this.cacheService.getItemById(id);
  }

  // Find item in cache by icon name or path
  findItemByIconNameOrPath(
    iconName: string,
    filePath?: string,
    lineNumber?: number
  ): SvgItem | undefined {
    return this.cacheService.findItemByIconNameOrPath(iconName, filePath, lineNumber);
  }

  // Create a SvgItem from a WorkspaceIcon for TreeView reveal
  createSvgItemFromIcon(icon: WorkspaceIcon): SvgItem | undefined {
    return this.cacheService.createSvgItemFromIcon(icon);
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { getSvgConfig } from '../utils/config';

// Directory for temporary SVG icon files
let tempIconDir: string | undefined;

// Cached ignore patterns
let ignorePatterns: string[] = [];
let ignoreFileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Read and parse .bezierignore file
 * Supports gitignore-like patterns:
 * - Lines starting with # are comments
 * - Empty lines are ignored
 * - Patterns can use * and ** wildcards
 * - Patterns starting with / are relative to workspace root
 * - Patterns ending with / match directories
 */
function loadIgnorePatterns(): string[] {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return [];

  const ignoreFile = path.join(workspaceRoot, '.bezierignore');
  
  if (!fs.existsSync(ignoreFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(ignoreFile, 'utf-8');
    const patterns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    console.log('[Bezier] Loaded .bezierignore patterns:', patterns);
    return patterns;
  } catch (error) {
    console.error('[Bezier] Error reading .bezierignore:', error);
    return [];
  }
}

/**
 * Check if a path should be ignored based on .bezierignore patterns
 * @param filePath Absolute path to check
 * @returns true if the path should be ignored
 */
function shouldIgnorePath(filePath: string): boolean {
  if (ignorePatterns.length === 0) return false;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return false;

  // Get relative path from workspace root
  const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  
  for (const pattern of ignorePatterns) {
    if (matchIgnorePattern(relativePath, pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Match a relative path against a gitignore-like pattern
 */
function matchIgnorePattern(relativePath: string, pattern: string): boolean {
  // Normalize pattern
  let normalizedPattern = pattern.replace(/\\/g, '/');
  
  // Handle directory patterns (ending with /)
  const isDirectoryPattern = normalizedPattern.endsWith('/');
  if (isDirectoryPattern) {
    normalizedPattern = normalizedPattern.slice(0, -1);
  }
  
  // Handle patterns starting with / (root-relative)
  const isRootRelative = normalizedPattern.startsWith('/');
  if (isRootRelative) {
    normalizedPattern = normalizedPattern.slice(1);
  }
  
  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLESTAR}}/g, '.*')
    .replace(/\?/g, '[^/]');
  
  // Build the final regex
  let regex: RegExp;
  if (isRootRelative) {
    // Match from start
    regex = new RegExp(`^${regexPattern}(?:/|$)`);
  } else if (isDirectoryPattern) {
    // Match directory anywhere in path
    regex = new RegExp(`(?:^|/)${regexPattern}(?:/|$)`);
  } else {
    // Match anywhere in path (file or directory)
    regex = new RegExp(`(?:^|/)${regexPattern}(?:/|$)|^${regexPattern}$`);
  }
  
  return regex.test(relativePath);
}

/**
 * Initialize the .bezierignore file watcher
 */
export function initIgnoreFileWatcher(context: vscode.ExtensionContext): void {
  // Load initial patterns
  ignorePatterns = loadIgnorePatterns();
  
  // Watch for changes to .bezierignore
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    ignoreFileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '.bezierignore')
    );
    
    const reloadPatterns = () => {
      ignorePatterns = loadIgnorePatterns();
      // Fire event to refresh tree (will be handled by the provider)
      vscode.commands.executeCommand('iconManager.refresh');
    };
    
    ignoreFileWatcher.onDidCreate(reloadPatterns);
    ignoreFileWatcher.onDidChange(reloadPatterns);
    ignoreFileWatcher.onDidDelete(reloadPatterns);
    
    context.subscriptions.push(ignoreFileWatcher);
  }
}

function getTempIconDir(): string {
  if (!tempIconDir) {
    tempIconDir = path.join(os.tmpdir(), 'icon-manager-previews');
    if (!fs.existsSync(tempIconDir)) {
      fs.mkdirSync(tempIconDir, { recursive: true });
    }
  }
  return tempIconDir;
}

// Clear temp icon directory on refresh
export function clearTempIcons(): void {
  const iconDir = getTempIconDir();
  try {
    const files = fs.readdirSync(iconDir);
    for (const file of files) {
      fs.unlinkSync(path.join(iconDir, file));
    }
  } catch {
    // Ignore errors
  }
}

function saveTempSvgIcon(name: string, svgContent: string): string {
  const iconDir = getTempIconDir();
  const safeName = name.replace(/[^a-z0-9-]/gi, '_');
  // Add hash of content to filename to force VS Code to reload when content changes
  const contentHash = crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8);
  const iconPath = path.join(iconDir, `${safeName}_${contentHash}.svg`);
  
  // Skip if file already exists with same content
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  
  // Normalize SVG for display - ensure it has proper viewBox and size
  let normalizedSvg = svgContent;
  
  // If SVG doesn't have width/height, add them for proper display
  if (!normalizedSvg.includes('width=') && !normalizedSvg.includes('height=')) {
    normalizedSvg = normalizedSvg.replace('<svg', '<svg width="16" height="16"');
  }
  
  // Check if SVG has real colors (not just black/none/currentColor)
  // Look for any color that is NOT black
  const hasGradient = /url\(#/.test(normalizedSvg);
  const colorPattern = /(?:fill|stroke)="([^"]+)"/gi;
  let match;
  let hasRealColors = hasGradient;
  
  while ((match = colorPattern.exec(normalizedSvg)) !== null) {
    const color = match[1].toLowerCase().trim();
    // Skip none, currentColor, and black variants
    if (color === 'none' || color === 'currentcolor') continue;
    if (color === '#000' || color === '#000000' || color === 'black' || 
        color === 'rgb(0,0,0)' || color === 'rgb(0, 0, 0)') continue;
    // Found a real color
    hasRealColors = true;
    break;
  }
  
  // If no real colors (monochrome black or no fill at all), use currentColor
  if (!hasRealColors) {
    // Replace existing black fills/strokes
    normalizedSvg = normalizedSvg
      .replace(/fill="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'fill="currentColor"')
      .replace(/stroke="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'stroke="currentColor"');
    
    // Add fill="currentColor" to svg element if no fill defined
    if (!normalizedSvg.includes('fill="')) {
      normalizedSvg = normalizedSvg.replace('<svg', '<svg fill="currentColor"');
    }
  }
  
  fs.writeFileSync(iconPath, normalizedSvg);
  return iconPath;
}

export interface IconUsage {
  file: string;
  line: number;
  preview: string;
}

export interface IconAnimation {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

export interface WorkspaceIcon {
  name: string;
  path: string;
  source: 'workspace' | 'library' | 'inline';
  category?: string;
  svg?: string;
  // Animation settings (from icons.js)
  animation?: IconAnimation;
  // For inline SVGs
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  // Build status
  isBuilt?: boolean;
  // Usages tracking
  usages?: IconUsage[];
  usageCount?: number;
  // For IMG references: whether the SVG file exists
  exists?: boolean;
}

export class WorkspaceSvgProvider implements vscode.TreeDataProvider<SvgItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SvgItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<SvgItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private svgFiles: Map<string, WorkspaceIcon> = new Map();
  private libraryIcons: Map<string, WorkspaceIcon> = new Map();
  private inlineSvgs: Map<string, WorkspaceIcon> = new Map();
  private svgReferences: Map<string, WorkspaceIcon[]> = new Map(); // Files with <img src="...svg">
  private builtIcons: Set<string> = new Set();
  private iconUsages: Map<string, IconUsage[]> = new Map();
  private context: vscode.ExtensionContext;
  private isInitialized = false;
  private isScanning = false;
  private usagesScanned = false;
  // Cache of created SvgItems for reveal functionality
  private itemCache: Map<string, SvgItem> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
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
    this.itemCache.clear();
    this.isInitialized = false;
    this.usagesScanned = false;
    // Clear temp icon files to force VS Code to reload new versions
    clearTempIcons();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Remove an SVG file from the cache without triggering refresh
   * Call the specific provider's refresh method after this
   */
  removeSvgFile(iconName: string): void {
    this.svgFiles.delete(iconName);
    // Don't fire event - let caller handle partial refresh
  }

  /**
   * Update SVG file content in cache without full refresh
   * Used when a file is modified externally
   */
  updateSvgFileContent(filePath: string): void {
    const iconName = path.basename(filePath, '.svg');
    const existingIcon = this.svgFiles.get(iconName);
    
    if (existingIcon && fs.existsSync(filePath)) {
      try {
        const newContent = fs.readFileSync(filePath, 'utf-8');
        existingIcon.svg = newContent;
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
    console.log(`[Bezier] renameBuiltIcon: "${oldName}" -> "${newName}"`);
    
    const icon = this.libraryIcons.get(oldName);
    if (icon) {
      console.log(`[Bezier] Found icon, updating...`);
      
      // Update the icon's name property
      icon.name = newName;
      
      // Move in libraryIcons map
      this.libraryIcons.delete(oldName);
      this.libraryIcons.set(newName, icon);
      
      // Update builtIcons set
      this.builtIcons.delete(oldName);
      this.builtIcons.add(newName);
      
      // Clear ALL cached items for built section to force full re-render
      for (const [key, item] of this.itemCache.entries()) {
        if (key.includes(oldName) || key.includes('built:') || item.category?.startsWith('built:')) {
          this.itemCache.delete(key);
        }
      }
      
      // Clear temp icons to force reload
      clearTempIcons();
      
      // Fire update - use undefined to refresh entire tree
      console.log(`[Bezier] Firing tree data change event (undefined)`);
      this._onDidChangeTreeData.fire(undefined);
    } else {
      console.log(`[Bezier] Icon "${oldName}" NOT FOUND in libraryIcons`);
    }
  }

  /**
   * Rename an SVG file in the cache (partial refresh)
   */
  renameSvgFile(oldName: string, newName: string, newPath: string): void {
    const icon = this.svgFiles.get(oldName);
    if (icon) {
      // Update icon properties
      icon.name = newName;
      icon.path = newPath;
      
      // Move in svgFiles map
      this.svgFiles.delete(oldName);
      this.svgFiles.set(newName, icon);
      
      // Clear ALL cached items for files section
      for (const [key, item] of this.itemCache.entries()) {
        if (key.includes(oldName) || key.includes('folder:') || item.category?.startsWith('folder:')) {
          this.itemCache.delete(key);
        }
      }
      
      // Clear temp icons
      clearTempIcons();
      
      // Fire update
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: SvgItem): vscode.TreeItem {
    // Cache the item for later reveal
    if (element.id) {
      this.itemCache.set(element.id, element);
    }
    return element;
  }

  // Required for TreeView.reveal() to work with hierarchical structures
  getParent(element: SvgItem): SvgItem | undefined {
    if (!element) return undefined;
    
    // Icons at root level (no parent section)
    if (!element.category && element.type === 'icon') {
      return undefined;
    }
    
    // Section items have no parent
    if (element.type === 'section') {
      return undefined;
    }
    
    // Category/folder items
    if (element.type === 'category' && element.category) {
      // Built library folders
      if (element.category.startsWith('built:')) {
        return new SvgItem(
          'Built Library',
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'built'
        );
      }
      
      // SVG Files folders
      if (element.category.startsWith('folder:')) {
        const folderPath = element.category.replace('folder:', '');
        const parentDir = folderPath.substring(0, folderPath.lastIndexOf('/'));
        if (parentDir) {
          return new SvgItem(
            parentDir.split('/').pop() || parentDir,
            0,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `folder:${parentDir}`
          );
        }
        return new SvgItem(
          'SVG Files',
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'files'
        );
      }
      
      // Inline folders/files
      if (element.category.startsWith('inlinedir:') || element.category.startsWith('inline:')) {
        return new SvgItem(
          'Inline SVGs',
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'inline'
        );
      }
      
      // Reference folders/files
      if (element.category.startsWith('refsdir:') || element.category.startsWith('refs:')) {
        return new SvgItem(
          'IMG References',
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'references'
        );
      }
    }
    
    // Icon items - find their parent category
    if (element.type === 'icon' && element.icon) {
      const icon = element.icon;
      
      // Built icon - the path property contains the source file path
      if (icon.isBuilt && icon.path) {
        const fileName = path.basename(icon.path);
        return new SvgItem(
          fileName,
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `built:${fileName}`
        );
      }
      
      // SVG file icon - parent is its folder
      if (icon.path && !icon.filePath) {
        const relativePath = vscode.workspace.asRelativePath(icon.path);
        const dir = relativePath.substring(0, relativePath.lastIndexOf('/'));
        if (dir) {
          return new SvgItem(
            dir.split('/').pop() || dir,
            0,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `folder:${dir}`
          );
        }
        return new SvgItem(
          'SVG Files',
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          undefined,
          'files'
        );
      }
      
      // Inline SVG - parent is the file
      if (icon.source === 'inline' && icon.filePath) {
        const fileName = icon.filePath.split(/[/\\]/).pop() || icon.filePath;
        return new SvgItem(
          fileName,
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `inline:${icon.filePath}`
        );
      }
      
      // IMG Reference - parent is the file containing the reference
      if (icon.category === 'img-ref' && icon.filePath) {
        const fileName = icon.filePath.split(/[/\\]/).pop() || icon.filePath;
        return new SvgItem(
          fileName,
          0,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `refs:${icon.filePath}`
        );
      }
    }
    
    return undefined;
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
          return new SvgItem(
            icon.name,
            0,
            hasUsages ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
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
        return new SvgItem(
          icon.name,
          0,
          hasUsages ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
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
        return new SvgItem(
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

  // Build a tree structure from paths
  private buildFolderTree(paths: string[]): Map<string, { subfolders: Set<string>; files: string[] }> {
    const tree = new Map<string, { subfolders: Set<string>; files: string[] }>();
    
    for (const p of paths) {
      const parts = p.split('/');
      let currentPath = '';
      
      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        
        if (!tree.has(parentPath)) {
          tree.set(parentPath, { subfolders: new Set(), files: [] });
        }
        tree.get(parentPath)!.subfolders.add(currentPath);
        
        if (!tree.has(currentPath)) {
          tree.set(currentPath, { subfolders: new Set(), files: [] });
        }
      }
      
      // Add file to its parent directory
      const parentDir = parts.slice(0, -1).join('/');
      if (!tree.has(parentDir)) {
        tree.set(parentDir, { subfolders: new Set(), files: [] });
      }
      tree.get(parentDir)!.files.push(p);
    }
    
    return tree;
  }

  // Get children for SVG Files folder hierarchy
  private getFolderChildren(folderPath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Build paths for all SVG files
    const allPaths: string[] = [];
    for (const icon of this.svgFiles.values()) {
      const relativePath = path.relative(workspaceRoot, icon.path).replace(/\\/g, '/');
      allPaths.push(relativePath);
    }
    
    const tree = this.buildFolderTree(allPaths);
    const node = tree.get(folderPath);
    
    if (!node) return items;
    
    // Add subfolders first
    for (const subfolder of Array.from(node.subfolders).sort()) {
      const folderName = subfolder.split('/').pop() || subfolder;
      // Count total SVGs in this subtree
      let count = 0;
      for (const p of allPaths) {
        if (p.startsWith(subfolder + '/') || p.startsWith(subfolder)) {
          count++;
        }
      }
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `folder:${subfolder}`
      ));
    }
    
    // Add SVG files in this folder
    for (const filePath of node.files.sort()) {
      const fileName = path.basename(filePath, '.svg');
      const fullPath = path.join(workspaceRoot, filePath);
      const icon = Array.from(this.svgFiles.values()).find(i => i.path === fullPath);
      if (icon) {
        items.push(new SvgItem(
          fileName,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          `folder:${folderPath}`
        ));
      }
    }
    
    return items;
  }

  // Get children for Inline SVGs folder hierarchy
  private getInlineDirChildren(dirPath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Build paths for all files containing inline SVGs
    const filePathsSet = new Set<string>();
    for (const icon of this.inlineSvgs.values()) {
      if (icon.filePath) {
        const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\/g, '/');
        filePathsSet.add(relativePath);
      }
    }
    const allPaths = Array.from(filePathsSet);
    
    const tree = this.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);
    
    if (!node) return items;
    
    // Add subfolders first
    for (const subfolder of Array.from(node.subfolders).sort()) {
      const folderName = subfolder.split('/').pop() || subfolder;
      // Count total inline SVGs in this subtree
      let count = 0;
      for (const icon of this.inlineSvgs.values()) {
        if (icon.filePath) {
          const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\/g, '/');
          if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
            count++;
          }
        }
      }
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `inlinedir:${subfolder}`
      ));
    }
    
    // Add files in this folder
    for (const filePath of node.files.sort()) {
      const fileName = path.basename(filePath);
      const fullPath = path.join(workspaceRoot, filePath);
      // Count icons in this file
      let count = 0;
      for (const icon of this.inlineSvgs.values()) {
        if (icon.filePath === fullPath) count++;
      }
      items.push(new SvgItem(
        fileName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `inline:${fullPath}`
      ));
    }
    
    return items;
  }

  // Get children (inline SVGs) for a specific file
  private getInlineFileChildren(filePath: string): SvgItem[] {
    const items: SvgItem[] = [];
    
    for (const icon of this.inlineSvgs.values()) {
      if (icon.filePath === filePath) {
        items.push(new SvgItem(
          icon.name,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          `inline:${filePath}`
        ));
      }
    }
    
    return items.sort((a, b) => (a.icon?.line || 0) - (b.icon?.line || 0));
  }

  // Get children for IMG References folder hierarchy
  private getRefsDirChildren(dirPath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Build paths for all files containing SVG references
    const allPaths: string[] = [];
    for (const filePath of this.svgReferences.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      allPaths.push(relativePath);
    }
    
    const tree = this.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);
    
    if (!node) return items;
    
    // Add subfolders first
    for (const subfolder of Array.from(node.subfolders).sort()) {
      const folderName = subfolder.split('/').pop() || subfolder;
      // Count total refs in this subtree
      let count = 0;
      for (const [filePath, refs] of this.svgReferences) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
          count += refs.length;
        }
      }
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `refsdir:${subfolder}`
      ));
    }
    
    // Add files in this folder
    for (const relPath of node.files.sort()) {
      const fileName = path.basename(relPath);
      const fullPath = path.join(workspaceRoot, relPath);
      const refs = this.svgReferences.get(fullPath);
      if (refs) {
        items.push(new SvgItem(
          fileName,
          refs.length,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `refs:${fullPath}`
        ));
      }
    }
    
    return items;
  }

  // Get children (SVG references) for a specific file
  private getRefsFileChildren(filePath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const refs = this.svgReferences.get(filePath);
    
    if (refs) {
      for (const icon of refs) {
        items.push(new SvgItem(
          icon.name,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          `refs:${filePath}`
        ));
      }
    }
    
    return items.sort((a, b) => (a.icon?.line || 0) - (b.icon?.line || 0));
  }

  // Get children for Icon Component usages folder hierarchy
  private getUsagesDirChildren(dirPath: string): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Group usages by file first
    const usagesByFile = new Map<string, { iconName: string, usage: IconUsage }[]>();
    for (const [iconName, usages] of this.iconUsages) {
      for (const usage of usages) {
        if (!usagesByFile.has(usage.file)) {
          usagesByFile.set(usage.file, []);
        }
        usagesByFile.get(usage.file)!.push({ iconName, usage });
      }
    }

    // Build paths
    const allPaths: string[] = [];
    for (const filePath of usagesByFile.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      allPaths.push(relativePath);
    }

    const tree = this.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);

    if (!node) return items;

    // Add subfolders first
    for (const subfolder of Array.from(node.subfolders).sort()) {
      const folderName = subfolder.split('/').pop() || subfolder;
      let count = 0;
      for (const [filePath, usageList] of usagesByFile) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
          count += usageList.length;
        }
      }
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `usagesdir:${subfolder}`
      ));
    }

    // Add files in this folder
    for (const relPath of node.files.sort()) {
      const fileName = path.basename(relPath);
      const fullPath = path.join(workspaceRoot, relPath);
      const usageList = usagesByFile.get(fullPath);
      if (usageList) {
        items.push(new SvgItem(
          fileName,
          usageList.length,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `usages:${fullPath}`
        ));
      }
    }

    return items;
  }

  // Get children (icon usages) for a specific file
  private getUsagesFileChildren(filePath: string): SvgItem[] {
    const items: SvgItem[] = [];

    // Collect all usages for this file
    const fileUsages: { iconName: string, usage: IconUsage }[] = [];
    for (const [iconName, usages] of this.iconUsages) {
      for (const usage of usages) {
        if (usage.file === filePath) {
          fileUsages.push({ iconName, usage });
        }
      }
    }

    // Sort by line number
    fileUsages.sort((a, b) => a.usage.line - b.usage.line);

    // Create items - show icon name with line info
    for (const { iconName, usage } of fileUsages) {
      // Try to get the built icon for preview
      const builtIcon = this.libraryIcons.get(iconName);
      
      const item = new SvgItem(
        iconName,
        0,
        vscode.TreeItemCollapsibleState.None,
        'icon',
        builtIcon ? { ...builtIcon, line: usage.line, filePath } : {
          name: iconName,
          path: filePath,
          svg: '',
          source: 'library' as const,
          line: usage.line,
          filePath
        },
        `usages:${filePath}`
      );
      item.description = `Line ${usage.line}`;
      item.tooltip = usage.preview;
      item.contextValue = 'iconUsage';
      // Note: Don't set resourceUri here to avoid showing file problem badges
      item.command = {
        command: 'iconManager.goToInlineSvg',
        title: 'Go to Usage',
        arguments: [{ icon: { filePath, line: usage.line } }]
      };
      items.push(item);
    }

    return items;
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
      sections.push(new SvgItem(
        'Inline SVGs',
        this.inlineSvgs.size,
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
        undefined,
        'section:inline'
      ));
    }

    // 2. SVG References section (files with <img src="...svg">)
    if (this.svgReferences.size > 0) {
      const totalRefs = Array.from(this.svgReferences.values()).reduce((sum, refs) => sum + refs.length, 0);
      sections.push(new SvgItem(
        'IMG References',
        totalRefs,
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
        undefined,
        'section:references'
      ));
    }

    // 3. Icon Component usages section (show if there are built icons)
    const hasBuiltIcons = Array.from(this.libraryIcons.values()).some(icon => icon.isBuilt);
    if (hasBuiltIcons) {
      const totalUsages = this.usagesScanned 
        ? Array.from(this.iconUsages.values()).reduce((sum, usages) => sum + usages.length, 0)
        : undefined;
      sections.push(new SvgItem(
        'Icon Component',
        totalUsages ?? 0,
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
        undefined,
        'section:usages'
      ));
    }

    if (sections.length === 0) {
      return [new SvgItem(
        'No SVGs in code - Click to scan',
        0,
        vscode.TreeItemCollapsibleState.None,
        'action',
        undefined,
        undefined
      )];
    }

    return sections;
  }

  private async getSectionChildren(sectionId: string): Promise<SvgItem[]> {
    const items: SvgItem[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    switch (sectionId) {
      case 'section:built': {
        // Group built icons by source file
        const byFile = new Map<string, number>();
        for (const icon of this.libraryIcons.values()) {
          if (icon.isBuilt) {
            const fileName = path.basename(icon.path);
            byFile.set(fileName, (byFile.get(fileName) || 0) + 1);
          }
        }
        for (const [fileName, count] of byFile) {
          items.push(new SvgItem(
            fileName,
            count,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `built:${fileName}`
          ));
        }
        break;
      }

      case 'section:files': {
        // Build hierarchical folder structure - show only top-level folders/files
        const allPaths: string[] = [];
        for (const icon of this.svgFiles.values()) {
          const relativePath = path.relative(workspaceRoot, icon.path).replace(/\\/g, '/');
          allPaths.push(relativePath);
        }
        
        const tree = this.buildFolderTree(allPaths);
        const rootNode = tree.get('');
        
        if (rootNode) {
          // Add top-level folders
          for (const subfolder of Array.from(rootNode.subfolders).sort()) {
            const folderName = subfolder.split('/').pop() || subfolder;
            let count = 0;
            for (const p of allPaths) {
              if (p.startsWith(subfolder + '/') || p === subfolder) count++;
            }
            items.push(new SvgItem(
              folderName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `folder:${subfolder}`
            ));
          }
          
          // Add root-level SVG files
          for (const filePath of rootNode.files.sort()) {
            const fileName = path.basename(filePath, '.svg');
            const fullPath = path.join(workspaceRoot, filePath);
            const icon = Array.from(this.svgFiles.values()).find(i => i.path === fullPath);
            if (icon) {
              items.push(new SvgItem(
                fileName,
                0,
                vscode.TreeItemCollapsibleState.None,
                'icon',
                icon,
                'folder:'
              ));
            }
          }
        }
        break;
      }

      case 'section:inline': {
        // Build hierarchical folder structure for inline SVGs
        const filePathsSet = new Set<string>();
        for (const icon of this.inlineSvgs.values()) {
          if (icon.filePath) {
            const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\/g, '/');
            filePathsSet.add(relativePath);
          }
        }
        const allPaths = Array.from(filePathsSet);
        
        const tree = this.buildFolderTree(allPaths);
        const rootNode = tree.get('');
        
        if (rootNode) {
          // Add top-level folders
          for (const subfolder of Array.from(rootNode.subfolders).sort()) {
            const folderName = subfolder.split('/').pop() || subfolder;
            let count = 0;
            for (const icon of this.inlineSvgs.values()) {
              if (icon.filePath) {
                const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\/g, '/');
                if (relativePath.startsWith(subfolder + '/')) count++;
              }
            }
            items.push(new SvgItem(
              folderName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `inlinedir:${subfolder}`
            ));
          }
          
          // Add root-level files
          for (const relPath of rootNode.files.sort()) {
            const fileName = path.basename(relPath);
            const fullPath = path.join(workspaceRoot, relPath);
            let count = 0;
            for (const icon of this.inlineSvgs.values()) {
              if (icon.filePath === fullPath) count++;
            }
            items.push(new SvgItem(
              fileName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `inline:${fullPath}`
            ));
          }
        }
        break;
      }

      case 'section:references': {
        // Build hierarchical folder structure for SVG references
        const allPaths: string[] = [];
        for (const filePath of this.svgReferences.keys()) {
          const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
          allPaths.push(relativePath);
        }
        
        const tree = this.buildFolderTree(allPaths);
        const rootNode = tree.get('');
        
        if (rootNode) {
          // Add top-level folders
          for (const subfolder of Array.from(rootNode.subfolders).sort()) {
            const folderName = subfolder.split('/').pop() || subfolder;
            let count = 0;
            for (const [filePath, refs] of this.svgReferences) {
              const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
              if (relativePath.startsWith(subfolder + '/')) count += refs.length;
            }
            items.push(new SvgItem(
              folderName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `refsdir:${subfolder}`
            ));
          }
          
          // Add root-level files
          for (const relPath of rootNode.files.sort()) {
            const fileName = path.basename(relPath);
            const fullPath = path.join(workspaceRoot, relPath);
            const refs = this.svgReferences.get(fullPath);
            if (refs) {
              items.push(new SvgItem(
                fileName,
                refs.length,
                vscode.TreeItemCollapsibleState.Collapsed,
                'category',
                undefined,
                `refs:${fullPath}`
              ));
            }
          }
        }
        break;
      }

      case 'section:usages': {
        // Lazy scan usages when section is expanded
        if (!this.usagesScanned) {
          await this.scanIconUsages();
          // Refresh tree to show updated count
          this._onDidChangeTreeData.fire();
        }

        // Group icon usages by file
        const usagesByFile = new Map<string, { iconName: string, usage: IconUsage }[]>();
        
        for (const [iconName, usages] of this.iconUsages) {
          for (const usage of usages) {
            if (!usagesByFile.has(usage.file)) {
              usagesByFile.set(usage.file, []);
            }
            usagesByFile.get(usage.file)!.push({ iconName, usage });
          }
        }

        // Build hierarchical folder structure
        const allPaths: string[] = [];
        for (const filePath of usagesByFile.keys()) {
          const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
          allPaths.push(relativePath);
        }

        const tree = this.buildFolderTree(allPaths);
        const rootNode = tree.get('');

        if (rootNode) {
          // Add top-level folders
          for (const subfolder of Array.from(rootNode.subfolders).sort()) {
            const folderName = subfolder.split('/').pop() || subfolder;
            let count = 0;
            for (const [filePath, usageList] of usagesByFile) {
              const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
              if (relativePath.startsWith(subfolder + '/')) count += usageList.length;
            }
            items.push(new SvgItem(
              folderName,
              count,
              vscode.TreeItemCollapsibleState.Collapsed,
              'category',
              undefined,
              `usagesdir:${subfolder}`
            ));
          }

          // Add root-level files
          for (const relPath of rootNode.files.sort()) {
            const fileName = path.basename(relPath);
            const fullPath = path.join(workspaceRoot, relPath);
            const usageList = usagesByFile.get(fullPath);
            if (usageList) {
              items.push(new SvgItem(
                fileName,
                usageList.length,
                vscode.TreeItemCollapsibleState.Collapsed,
                'category',
                undefined,
                `usages:${fullPath}`
              ));
            }
          }
        }
        break;
      }
    }

    return items;
  }

  private async initialize(): Promise<void> {
    console.log('[Bezier] Initializing...');
    // Load library icons first (fast, from JSON)
    await this.loadLibraryIcons();
    // Load built icons from output file
    await this.loadBuiltIcons();
    // Then scan workspace (slower, on demand)
    await this.scanWorkspace();
    // Scan inline SVGs in code files
    await this.scanInlineSvgs();
    // Note: Icon usages scan is now lazy - triggered when expanding the section
    console.log('[Bezier] Initialization complete. Total icons:', this.svgFiles.size + this.libraryIcons.size + this.inlineSvgs.size);
  }

  async scanFolder(folderPath: string): Promise<void> {
    console.log('[Bezier] Scanning folder:', folderPath);
    const svgFolders = getSvgConfig<string[]>('svgFolders', []);
    console.log('[Bezier] Configured svgFolders:', svgFolders);

    let foundAny = false;

    // First try configured folders
    for (const svgFolder of svgFolders) {
      const fullPath = path.join(folderPath, svgFolder);
      console.log('[Bezier] Checking folder:', fullPath, 'exists:', fs.existsSync(fullPath));
      if (fs.existsSync(fullPath)) {
        await this.scanDirectory(fullPath, svgFolder);
        foundAny = true;
      }
    }

    // If no configured folders found, scan ALL SVGs in workspace
    if (!foundAny) {
      console.log('[Bezier] No configured folders found, scanning all SVGs...');
      await this.scanAllSvgsInFolder(folderPath);
    }

    console.log('[Bezier] Scan complete. Found SVGs:', this.svgFiles.size);
    this._onDidChangeTreeData.fire();
  }

  // Scan entire folder for any SVG files
  private async scanAllSvgsInFolder(folderPath: string, relativePath: string = ''): Promise<void> {
    if (!fs.existsSync(folderPath)) return;

    // Check if this folder should be ignored
    if (shouldIgnorePath(folderPath)) {
      console.log('[Bezier] Ignoring folder (svgignore):', folderPath);
      return;
    }

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        // Skip node_modules, .git, dist, build, etc.
        if (entry.isDirectory()) {
          const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.svelte-kit'];
          if (!skipDirs.includes(entry.name)) {
            await this.scanAllSvgsInFolder(fullPath, relPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          // Check if this SVG file should be ignored
          if (shouldIgnorePath(fullPath)) {
            console.log('[Bezier] Ignoring SVG (svgignore):', fullPath);
            continue;
          }
          
          const iconName = path.basename(entry.name, '.svg');
          const category = path.dirname(relPath) || 'root';
          
          console.log('[Bezier] Found SVG (full scan):', iconName, 'at', fullPath);
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
      console.error(`Error scanning folder ${folderPath}:`, error);
    }
  }

  private async scanWorkspace(): Promise<void> {
    console.log('[Bezier] scanWorkspace: Starting...');
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('[Bezier] scanWorkspace: No workspace folders');
      return;
    }

    console.log('[Bezier] scanWorkspace: Found', workspaceFolders.length, 'workspace folders');
    for (const folder of workspaceFolders) {
      console.log('[Bezier] scanWorkspace: Scanning', folder.uri.fsPath);
      await this.scanFolder(folder.uri.fsPath);
    }
    console.log('[Bezier] scanWorkspace: Complete. Total SVG files:', this.svgFiles.size);
  }

  private async scanDirectory(dirPath: string, category: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    // Check if this directory should be ignored
    if (shouldIgnorePath(dirPath)) {
      console.log('[Bezier] Ignoring directory (svgignore):', dirPath);
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath, `${category}/${entry.name}`);
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          // Check if this SVG file should be ignored
          if (shouldIgnorePath(fullPath)) {
            console.log('[Bezier] Ignoring SVG (svgignore):', fullPath);
            continue;
          }
          
          const iconName = path.basename(entry.name, '.svg');
          // Don't read SVG content now - lazy load later
          console.log('[Bezier] Found SVG (dir scan):', iconName, 'at', fullPath);
          this.svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category,
            svg: undefined // Lazy load
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  private async loadLibraryIcons(): Promise<void> {
    const libraryPath = getSvgConfig<string>('libraryPath', '');

    if (!libraryPath) {
      // Try default AppData location
      const appDataPath = process.env.APPDATA || process.env.HOME || '';
      const defaultPath = path.join(appDataPath, 'icon-manager', 'icons.json');
      
      if (fs.existsSync(defaultPath)) {
        this.loadIconsFromJson(defaultPath);
      }
    } else if (fs.existsSync(libraryPath)) {
      this.loadIconsFromJson(libraryPath);
    }
  }

  private loadIconsFromJson(jsonPath: string): void {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const icons = JSON.parse(content);

      if (Array.isArray(icons)) {
        for (const icon of icons) {
          this.libraryIcons.set(icon.name, {
            name: icon.name,
            path: jsonPath,
            source: 'library',
            category: icon.name.includes(':') ? icon.name.split(':')[0] : 'custom',
            svg: icon.svg || icon.body
          });
        }
      }
    } catch (error) {
      console.error('Error loading library icons:', error);
    }
  }

  // Load built icons from the output directory (icons.js or sprite.svg)
  private async loadBuiltIcons(): Promise<void> {
    this.builtIcons.clear();
    
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    
    if (!outputDir) return;
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    
    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    
    // Try to load from icons.js (or legacy icons.js/icons.ts)
    const iconsBzJs = path.join(fullOutputPath, 'icons.js');
    const iconsJs = path.join(fullOutputPath, 'icons.js');
    const iconsTs = path.join(fullOutputPath, 'icons.ts');
    const iconsFile = fs.existsSync(iconsBzJs) ? iconsBzJs : (fs.existsSync(iconsJs) ? iconsJs : (fs.existsSync(iconsTs) ? iconsTs : null));
    
    console.log('[Bezier] Looking for icons in:', fullOutputPath);
    console.log('[Bezier] icons.js exists:', fs.existsSync(iconsBzJs));
    console.log('[Bezier] icons.js exists:', fs.existsSync(iconsJs));
    console.log('[Bezier] icons.ts exists:', fs.existsSync(iconsTs));
    
    if (iconsFile) {
      try {
        // Use VS Code API to ensure we get the latest content (not cached)
        const uri = vscode.Uri.file(iconsFile);
        const fileContent = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(fileContent).toString('utf-8');
        
        console.log('[Bezier] Reading icons file, length:', content.length);
        
        // Regex to match icon exports - capture everything including optional animation
        // Pattern: export const varName = { name: '...', body: `...`, viewBox: '...', animation?: {...} };
        const iconRegex = /export\s+const\s+(\w+)\s*=\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*body:\s*`([\s\S]*?)`\s*,\s*viewBox:\s*['"]([^'"]+)['"](?:\s*,\s*animation:\s*\{([^}]*)\})?\s*\}/g;
        let match;
        
        while ((match = iconRegex.exec(content)) !== null) {
          const varName = match[1];
          const iconName = match[2];
          const body = match[3];
          const viewBox = match[4];
          const animationStr = match[5];
          
          console.log('[Bezier] Parsing icon:', iconName, 'animationStr:', animationStr ? animationStr.substring(0, 50) : 'none');
          
          this.builtIcons.add(iconName);
          
          // Create a full SVG from the body
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
          
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
              console.warn('[Bezier] Failed to parse animation for', iconName);
            }
          }
          
          // Add to library icons so hover can find it
          this.libraryIcons.set(iconName, {
            name: iconName,
            path: iconsFile,
            source: 'library',
            category: 'built',
            svg: svg,
            isBuilt: true,
            animation
          });
          
          console.log('[Bezier] Loaded icon:', iconName, animation ? `with animation: ${animation.type}` : '');
        }
        
        console.log('[Bezier] Total built icons loaded:', this.builtIcons.size);
      } catch (error) {
        console.error('Error loading built icons:', error);
      }
    } else {
      console.log('[Bezier] No icons file found in output directory');
    }
    
    // Try to load from sprite.svg
    const spriteSvg = path.join(fullOutputPath, 'sprite.svg');
    if (fs.existsSync(spriteSvg)) {
      try {
        const content = fs.readFileSync(spriteSvg, 'utf-8');
        // Extract symbols with their content
        const symbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
        let match;
        while ((match = symbolRegex.exec(content)) !== null) {
          const iconName = match[1];
          const viewBox = match[2];
          const body = match[3];
          
          this.builtIcons.add(iconName);
          
          // Create a full SVG from the symbol
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
          
          // Add to library icons if not already there
          if (!this.libraryIcons.has(iconName)) {
            this.libraryIcons.set(iconName, {
              name: iconName,
              path: spriteSvg,
              source: 'library',
              category: 'built',
              svg: svg,
              isBuilt: true
            });
          }
        }
        console.log('[Bezier] Loaded built icons from sprite.svg:', this.builtIcons.size);
      } catch (error) {
        console.error('Error loading built icons from sprite.svg:', error);
      }
    }
  }

  // Check if an icon is built
  isIconBuilt(iconName: string): boolean {
    return this.builtIcons.has(iconName);
  }

  // Remove icons from the icons.js file
  async removeIcons(iconNames: string[]): Promise<{ success: boolean; removed: string[]; errors: string[] }> {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    const removed: string[] = [];
    const errors: string[] = [];

    if (!outputDir) {
      return { success: false, removed, errors: ['No output directory configured'] };
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return { success: false, removed, errors: ['No workspace folder found'] };
    }

    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const iconsJs = path.join(fullOutputPath, 'icons.js');

    if (!fs.existsSync(iconsJs)) {
      return { success: false, removed, errors: ['icons.js not found'] };
    }

    try {
      let content = fs.readFileSync(iconsJs, 'utf-8');
      
      for (const iconName of iconNames) {
        // Build regex to match the entire export statement for this icon
        // Match: export const varName = { name: 'iconName', body: `...`, viewBox: '...' };
        const escapedName = iconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const iconRegex = new RegExp(
          `export\\s+const\\s+\\w+\\s*=\\s*\\{\\s*name:\\s*['"]${escapedName}['"]\\s*,\\s*body:\\s*\`[\\s\\S]*?\`\\s*,\\s*viewBox:\\s*['"][^'"]+['"]\\s*\\};?\\n?`,
          'g'
        );
        
        const newContent = content.replace(iconRegex, '');
        
        if (newContent !== content) {
          content = newContent;
          removed.push(iconName);
          this.builtIcons.delete(iconName);
          this.libraryIcons.delete(iconName);
        } else {
          errors.push(`Could not find icon: ${iconName}`);
        }
      }

      // Clean up extra blank lines
      content = content.replace(/\n{3,}/g, '\n\n');
      
      fs.writeFileSync(iconsJs, content);
      
      // Refresh the tree view
      this._onDidChangeTreeData.fire();
      
      return { success: removed.length > 0, removed, errors };
    } catch (error) {
      return { success: false, removed, errors: [`Error: ${error}`] };
    }
  }

  async getAllIcons(): Promise<WorkspaceIcon[]> {
    const all: WorkspaceIcon[] = [];
    
    // Add workspace icons
    for (const icon of this.svgFiles.values()) {
      all.push(icon);
    }

    // Add library icons
    for (const icon of this.libraryIcons.values()) {
      all.push(icon);
    }

    return all;
  }

  /**
   * Get list of built icons only (for BuiltIconsProvider)
   */
  getBuiltIconsList(): WorkspaceIcon[] {
    const builtIcons: WorkspaceIcon[] = [];
    for (const icon of this.libraryIcons.values()) {
      if (icon.isBuilt) {
        builtIcons.push(icon);
      }
    }
    return builtIcons;
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
  getSvgFilesFolderStructure(): { folders: Map<string, string[]>, rootFiles: string[] } {
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
    // First check svg files and library
    let found = this.svgFiles.get(name) || this.libraryIcons.get(name);
    
    // If found but no SVG content, try to load it from file
    if (found && !found.svg && found.path && fs.existsSync(found.path)) {
      try {
        found.svg = fs.readFileSync(found.path, 'utf-8');
      } catch (err) {
        console.error('[Bezier] Error reading SVG for hover:', found.path, err);
      }
    }
    
    if (found) return found;
    
    // Then check inline SVGs by name
    for (const icon of this.inlineSvgs.values()) {
      if (icon.name === name || icon.name.toLowerCase() === name.toLowerCase()) {
        return icon;
      }
    }
    
    return undefined;
  }

  /**
   * Get all IMG references from the workspace
   * Used by buildAllReferences command
   */
  getImgReferences(): WorkspaceIcon[] {
    const refs: WorkspaceIcon[] = [];
    for (const icons of this.svgReferences.values()) {
      for (const icon of icons) {
        // Load SVG content if not already loaded
        if (!icon.svg && icon.path && icon.exists !== false && fs.existsSync(icon.path)) {
          try {
            icon.svg = fs.readFileSync(icon.path, 'utf-8');
          } catch (err) {
            console.error('[Bezier] Error reading SVG:', icon.path, err);
          }
        }
        refs.push(icon);
      }
    }
    return refs;
  }

  private getCategories(): { name: string; count: number; type: 'library' | 'file' | 'folder' }[] {
    const categoryCount = new Map<string, { count: number; type: 'library' | 'file' | 'folder' }>();

    // Count workspace icons by folder
    for (const icon of this.svgFiles.values()) {
      const cat = icon.category || 'workspace';
      const existing = categoryCount.get(cat);
      categoryCount.set(cat, { 
        count: (existing?.count || 0) + 1, 
        type: 'folder' 
      });
    }

    // Library icons - group by actual source file
    const libraryByFile = new Map<string, number>();
    for (const icon of this.libraryIcons.values()) {
      const fileName = path.basename(icon.path);
      libraryByFile.set(fileName, (libraryByFile.get(fileName) || 0) + 1);
    }
    
    // Add library groups
    for (const [fileName, count] of libraryByFile) {
      categoryCount.set(`📦 ${fileName}`, { count, type: 'library' });
    }

    // Inline SVGs grouped by file
    if (this.inlineSvgs.size > 0) {
      const inlineByFile = new Map<string, number>();
      for (const icon of this.inlineSvgs.values()) {
        if (icon.filePath) {
          const fileName = path.basename(icon.filePath);
          inlineByFile.set(fileName, (inlineByFile.get(fileName) || 0) + 1);
        }
      }
      
      for (const [fileName, count] of inlineByFile) {
        categoryCount.set(`📄 ${fileName}`, { count, type: 'file' });
      }
    }

    // SVG references (img src="...svg") grouped by file
    if (this.svgReferences.size > 0) {
      for (const [filePath, refs] of this.svgReferences) {
        const fileName = path.basename(filePath);
        // Use 🔗 emoji to distinguish from inline SVGs
        categoryCount.set(`🔗 ${fileName}`, { count: refs.length, type: 'file' });
      }
    }

    return Array.from(categoryCount.entries())
      .map(([name, data]) => ({ name, count: data.count, type: data.type }))
      .sort((a, b) => {
        // Sort: library first, then files
        if (a.type !== b.type) {
          if (a.type === 'library') return -1;
          if (b.type === 'library') return 1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  private getIconsByCategory(category: string): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];

    // Built icons by file (built: prefix)
    if (category.startsWith('built:')) {
      const fileName = category.replace('built:', '');
      for (const icon of this.libraryIcons.values()) {
        if (icon.isBuilt && path.basename(icon.path) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }

    // SVG files by folder (folder: prefix)
    if (category.startsWith('folder:')) {
      const folder = category.replace('folder:', '');
      for (const icon of this.svgFiles.values()) {
        if ((icon.category || 'root') === folder) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Inline SVGs by file (inline: prefix) - now uses full path
    if (category.startsWith('inline:')) {
      const filePath = category.replace('inline:', '');
      for (const icon of this.inlineSvgs.values()) {
        if (icon.filePath === filePath) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // SVG references by file (refs: prefix)
    if (category.startsWith('refs:')) {
      const filePath = category.replace('refs:', '');
      const refs = this.svgReferences.get(filePath);
      if (refs) {
        icons.push(...refs);
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // Legacy support for old category formats
    // Library icons (📦 prefix)
    if (category.startsWith('📦 ')) {
      const fileName = category.replace('📦 ', '');
      for (const icon of this.libraryIcons.values()) {
        if (path.basename(icon.path) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Inline SVGs by file (📄 prefix)
    if (category.startsWith('📄 ')) {
      const fileName = category.replace('📄 ', '');
      for (const icon of this.inlineSvgs.values()) {
        if (icon.filePath && path.basename(icon.filePath) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // SVG references by file (🔗 prefix)
    if (category.startsWith('🔗 ')) {
      const fileName = category.replace('🔗 ', '');
      for (const [filePath, refs] of this.svgReferences) {
        if (path.basename(filePath) === fileName) {
          icons.push(...refs);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }
    
    // Workspace folder icons
    for (const icon of this.svgFiles.values()) {
      if (icon.category === category) {
        icons.push(icon);
      }
    }

    return icons.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Scan all code files for inline <svg> elements and <img src="...svg"> references
  async scanInlineSvgs(): Promise<void> {
    this.inlineSvgs.clear();
    this.svgReferences.clear();
    console.log('[Bezier] Scanning for inline SVGs and SVG references...');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    // Reload ignore patterns before scanning
    ignorePatterns = loadIgnorePatterns();

    // Get output directory to exclude generated files
    const outputDir = getSvgConfig<string>('outputDirectory', '');

    // Search for files containing <svg
    const files = await vscode.workspace.findFiles(
      '**/*.{tsx,jsx,vue,svelte,astro,html,ts,js}',
      '**/node_modules/**'
    );

    for (const file of files) {
      try {
        // Check if file should be ignored
        if (shouldIgnorePath(file.fsPath)) {
          console.log('[Bezier] Ignoring file (svgignore):', file.fsPath);
          continue;
        }

        const fileName = path.basename(file.fsPath);
        
        // Skip generated icon files to avoid circular detection
        if (fileName === 'icon.js' || fileName === 'icons.js' ||
            fileName === 'icon.js' || fileName === 'icons.js' || 
            fileName === 'icon.ts' || fileName === 'icons.ts') {
          continue;
        }

        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        
        // Skip files that look like generated icon files
        if (text.includes('Auto-generated by Icon Manager')) {
          continue;
        }
        
        // Find all <svg...>...</svg> patterns (inline SVGs)
        const svgRegex = /<svg\s[^>]*>[\s\S]*?<\/svg>/gi;
        let match;
        let index = 0;

        while ((match = svgRegex.exec(text)) !== null) {
          const svgContent = match[0];
          
          // Skip template literals like ${icon.body}
          if (svgContent.includes('${')) {
            continue;
          }
          
          const startPos = document.positionAt(match.index);
          const endPos = document.positionAt(match.index + match[0].length);
          
          // Try to extract a name from id, class, aria-label, or nearby context
          let iconName = this.extractSvgName(svgContent, document, startPos.line);
          
          // Make name unique by adding file and index
          const fileBaseName = path.basename(file.fsPath, path.extname(file.fsPath));
          const uniqueKey = `${fileBaseName}:${iconName}:${startPos.line}`;
          
          this.inlineSvgs.set(uniqueKey, {
            name: iconName,
            path: file.fsPath,
            source: 'inline',
            category: 'icons',
            svg: svgContent,
            filePath: file.fsPath,
            line: startPos.line,
            column: startPos.character,
            endLine: endPos.line,
            endColumn: endPos.character,
            isBuilt: this.builtIcons.has(iconName)
          });
          
          index++;
        }

        // Find all <img src="...svg"> references
        const imgSvgRegex = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
        const fileReferences: WorkspaceIcon[] = [];
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        
        while ((match = imgSvgRegex.exec(text)) !== null) {
          const svgPath = match[1];
          const fullMatch = match[0];
          const startPos = document.positionAt(match.index);
          
          // Extract icon name from path
          const iconName = path.basename(svgPath, '.svg');
          
          // Try to resolve the actual SVG file path
          let resolvedPath = svgPath;
          let svgContent: string | undefined;
          
          if (svgPath.startsWith('./') || svgPath.startsWith('../')) {
            // First try relative to the file
            const fileDir = path.dirname(file.fsPath);
            resolvedPath = path.resolve(fileDir, svgPath);
            
            // If not found, try relative to workspace root
            if (!fs.existsSync(resolvedPath)) {
              const cleanPath = svgPath.replace(/^\.\//, '');
              const rootPath = path.join(workspaceRoot, cleanPath);
              if (fs.existsSync(rootPath)) {
                resolvedPath = rootPath;
              }
            }
          } else if (!path.isAbsolute(svgPath)) {
            // Path without ./ prefix - try from workspace root
            resolvedPath = path.join(workspaceRoot, svgPath);
          }
          
          // Read actual SVG content if file exists
          if (fs.existsSync(resolvedPath)) {
            try {
              svgContent = fs.readFileSync(resolvedPath, 'utf-8');
              console.log('[Bezier] Loaded SVG content for:', iconName, 'from', resolvedPath);
            } catch (err) {
              console.error('[Bezier] Error reading SVG file:', resolvedPath, err);
            }
          } else {
            console.log('[Bezier] SVG file not found for img ref:', svgPath, '-> resolved to:', resolvedPath);
          }
          
          const fileExists = fs.existsSync(resolvedPath);
          fileReferences.push({
            name: iconName,
            path: resolvedPath,
            source: 'inline', // Use 'inline' source to show in same section
            category: 'img-ref',
            svg: svgContent,
            filePath: file.fsPath,
            line: startPos.line,
            column: startPos.character,
            exists: fileExists
          });
        }
        
        if (fileReferences.length > 0) {
          const fileKey = file.fsPath;
          this.svgReferences.set(fileKey, fileReferences);
        }
      } catch (error) {
        console.error(`Error scanning file ${file.fsPath}:`, error);
      }
    }

    console.log('[Bezier] Found inline SVGs:', this.inlineSvgs.size);
    console.log('[Bezier] Found files with SVG references:', this.svgReferences.size);
    this._onDidChangeTreeData.fire();
  }

  private extractSvgName(svgContent: string, document: vscode.TextDocument, line: number): string {
    // Try to extract from id attribute
    const idMatch = svgContent.match(/id=["']([^"']+)["']/);
    if (idMatch) return idMatch[1];

    // Try to extract from aria-label
    const ariaMatch = svgContent.match(/aria-label=["']([^"']+)["']/);
    if (ariaMatch) return ariaMatch[1].toLowerCase().replace(/\s+/g, '-');

    // Try to extract from class name that looks like icon name
    const classMatch = svgContent.match(/class=["']([^"']*icon[^"']*)["']/i);
    if (classMatch) {
      const iconClass = classMatch[1].split(/\s+/).find(c => c.includes('icon'));
      if (iconClass) return iconClass.replace(/icon-?/i, '') || 'icon';
    }

    // Try to look at the line above for variable assignment or component name
    if (line > 0) {
      const prevLine = document.lineAt(line - 1).text;
      const varMatch = prevLine.match(/(?:const|let|var)\s+(\w+Icon|\w+Svg)\s*=/i);
      if (varMatch) return varMatch[1].replace(/Icon$|Svg$/i, '').toLowerCase();
    }

    // Default to svg-{line}
    return `svg-${line + 1}`;
  }

  getInlineSvgs(): WorkspaceIcon[] {
    return Array.from(this.inlineSvgs.values());
  }

  getInlineSvgByKey(key: string): WorkspaceIcon | undefined {
    return this.inlineSvgs.get(key);
  }

  // Get SVG data for preview panel
  getSvgData(item: SvgItem): { name: string; svg: string; location?: { file: string; line: number }; animation?: IconAnimation } | undefined {
    if (!item.icon) return undefined;
    
    const icon = item.icon;
    
    if (icon.svg) {
      return {
        name: icon.name,
        svg: icon.svg,
        location: icon.filePath && icon.line 
          ? { file: icon.filePath, line: icon.line }
          : undefined,
        animation: icon.animation
      };
    }
    
    // For file-based SVGs, read the file
    if (icon.path && fs.existsSync(icon.path)) {
      try {
        const svg = fs.readFileSync(icon.path, 'utf-8');
        return {
          name: icon.name,
          svg,
          location: { file: icon.path, line: 1 }
        };
      } catch {
        return undefined;
      }
    }
    
    return undefined;
  }

  // Scan workspace for icon usages
  async scanIconUsages(): Promise<void> {
    if (this.usagesScanned) return;
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    console.log('[Bezier] Scanning for icon usages...');
    this.iconUsages.clear();
    
    // Get all icon names (built icons only for now)
    const iconNames = new Set<string>();
    for (const [name, icon] of this.libraryIcons) {
      if (icon.isBuilt) {
        iconNames.add(name);
      }
    }

    if (iconNames.size === 0) {
      this.usagesScanned = true;
      return;
    }

    const includePattern = '**/*.{ts,tsx,js,jsx,vue,html,svelte,astro}';
    const excludePattern = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/svgs/**';

    try {
      const files = await vscode.workspace.findFiles(includePattern, excludePattern, 500);
      
      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();
          
          for (const iconName of iconNames) {
            // Search for icon usage patterns
            const patterns = [
              `name="${iconName}"`,
              `name='${iconName}'`,
              `name={\`${iconName}\`}`,
              `name={['"]${iconName}['"]}`
            ];
            
            for (const pattern of patterns) {
              let index = 0;
              while ((index = text.indexOf(pattern.replace(/\[.+?\]/g, ''), index)) !== -1) {
                const actualMatch = text.indexOf(`name="${iconName}"`, index) !== -1 || 
                                   text.indexOf(`name='${iconName}'`, index) !== -1;
                if (actualMatch) {
                  const position = document.positionAt(index);
                  const line = position.line;
                  const lineText = document.lineAt(line).text.trim();
                  
                  if (!this.iconUsages.has(iconName)) {
                    this.iconUsages.set(iconName, []);
                  }
                  
                  const usages = this.iconUsages.get(iconName)!;
                  const existing = usages.find(u => u.file === file.fsPath && u.line === line + 1);
                  
                  if (!existing) {
                    usages.push({
                      file: file.fsPath,
                      line: line + 1,
                      preview: lineText.substring(0, 80)
                    });
                  }
                }
                index += iconName.length;
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
      
      // Update ALL built icons with usage counts (including 0)
      for (const [name, icon] of this.libraryIcons) {
        if (icon.isBuilt) {
          const usages = this.iconUsages.get(name) || [];
          icon.usages = usages;
          icon.usageCount = usages.length;
        }
      }
      
      this.usagesScanned = true;
      console.log('[Bezier] Usage scan complete. Icons with usages:', this.iconUsages.size);
      
      // Refresh tree to show usage counts
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('[Bezier] Error scanning usages:', error);
    }
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
    // Check library icons, SVG files, and inline SVGs first
    const found = this.libraryIcons.get(name) || 
           this.svgFiles.get(name) || 
           this.inlineSvgs.get(name);
    if (found) return found;
    
    // Also check IMG references (svgReferences)
    for (const icons of this.svgReferences.values()) {
      for (const icon of icons) {
        if (icon.name === name) {
          return icon;
        }
      }
    }
    return undefined;
  }

  // Find icon by file path
  getIconByPath(filePath: string): WorkspaceIcon | undefined {
    // Check SVG files
    for (const icon of this.svgFiles.values()) {
      if (icon.path === filePath) {
        return icon;
      }
    }
    // Check inline SVGs by filePath
    for (const icon of this.inlineSvgs.values()) {
      if (icon.filePath === filePath || icon.path === filePath) {
        return icon;
      }
    }
    // Check IMG references
    for (const icons of this.svgReferences.values()) {
      for (const icon of icons) {
        if (icon.path === filePath || icon.filePath === filePath) {
          return icon;
        }
      }
    }
    return undefined;
  }

  // Helper to cache a SvgItem for later reveal
  private cacheItem(item: SvgItem): SvgItem {
    if (item.id) {
      this.itemCache.set(item.id, item);
    }
    return item;
  }

  // Get a cached item by its ID
  getItemById(id: string): SvgItem | undefined {
    return this.itemCache.get(id);
  }

  // Find item in cache by icon name or path
  findItemByIconNameOrPath(iconName: string, filePath?: string, lineNumber?: number): SvgItem | undefined {
    // Search through cached items - prefer exact match with line number
    let exactMatchWithLine: SvgItem | undefined;
    let exactNameMatch: SvgItem | undefined;
    let pathMatch: SvgItem | undefined;
    
    for (const [id, item] of this.itemCache) {
      if (item.type === 'icon' && item.icon) {
        // Check for exact name match
        if (item.icon.name === iconName) {
          // If we have line number, check if it matches for perfect disambiguation
          if (lineNumber !== undefined && item.icon.line === lineNumber - 1) {
            // Perfect match - name and line (line in icon is 0-based, lineNumber is 1-based)
            if (filePath && (item.icon.path === filePath || item.icon.filePath === filePath)) {
              return item; // Best possible match
            }
            exactMatchWithLine = item;
          }
          // If we also have a filePath, verify it matches too
          if (filePath && (item.icon.path === filePath || item.icon.filePath === filePath)) {
            if (!exactNameMatch) {
              exactNameMatch = item;
            }
          } else if (!exactNameMatch && !filePath) {
            exactNameMatch = item;
          }
        }
        // Path match as fallback (with line number check if available)
        if (!pathMatch && filePath && (item.icon.path === filePath || item.icon.filePath === filePath)) {
          if (lineNumber !== undefined && item.icon.line === lineNumber - 1) {
            pathMatch = item;
          } else if (lineNumber === undefined) {
            pathMatch = item;
          }
        }
      }
    }
    
    return exactMatchWithLine || exactNameMatch || pathMatch;
  }

  // Create a SvgItem from a WorkspaceIcon for TreeView reveal
  createSvgItemFromIcon(icon: WorkspaceIcon): SvgItem | undefined {
    if (!icon) return undefined;
    
    // Build expected ID to search in cache (must match SvgItem constructor format)
    let expectedId = `icon:${icon.name}:${icon.source || 'unknown'}:${icon.path || ''}`;
    if (icon.line !== undefined) {
      expectedId += `:L${icon.line}`;
    }
    
    // First check if we have this item cached
    const cachedItem = this.itemCache.get(expectedId);
    if (cachedItem) {
      return cachedItem;
    }
    
    // If not cached, create a new one (though reveal might not work)
    const isBuilt = icon.isBuilt || false;
    const isImgRef = icon.category === 'img-ref';
    const isMissingRef = isImgRef && icon.exists === false;
    let contextValue: string;
    
    if (isMissingRef) {
      contextValue = 'missingRef';
    } else if (isImgRef) {
      contextValue = 'imgRef';
    } else if (isBuilt) {
      contextValue = 'builtIcon';
    } else if (icon.source === 'inline') {
      contextValue = 'inlineSvg';
    } else {
      contextValue = 'svgIcon';
    }
    
    const item = new SvgItem(
      icon.name,
      0,
      vscode.TreeItemCollapsibleState.None,
      'icon',
      icon,
      undefined
    );
    
    // Manually set contextValue since constructor may set it differently
    (item as any).contextValue = contextValue;
    
    return item;
  }
}

export class SvgItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly count: number,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'section' | 'category' | 'icon' | 'action' | 'usage',
    public readonly icon?: WorkspaceIcon,
    public readonly category?: string,
    public readonly usage?: IconUsage
  ) {
    super(label, collapsibleState);

    // Set unique ID for TreeView.reveal() to work
    if (type === 'section' && category) {
      this.id = `section:${category}`;
    } else if (type === 'category' && category) {
      this.id = `category:${category}`;
    } else if (type === 'icon' && icon) {
      // Use icon name + source + path for unique ID
      // Name is essential for library icons that share the same path file
      this.id = `icon:${icon.name}:${icon.source || 'unknown'}:${icon.path || ''}`;
      if (icon.line !== undefined) {
        this.id += `:L${icon.line}`;
      }
    } else if (type === 'usage' && usage) {
      this.id = `usage:${usage.file}:${usage.line}`;
    } else if (type === 'action') {
      this.id = 'action:scan';
    }

    if (type === 'section') {
      this.description = `${count}`;
      this.contextValue = 'svgSection';
      // Use different icons based on section
      if (category === 'section:built') {
        this.iconPath = new vscode.ThemeIcon('package');
      } else if (category === 'section:files') {
        this.iconPath = new vscode.ThemeIcon('folder-library');
      } else if (category === 'section:inline') {
        this.iconPath = new vscode.ThemeIcon('code');
      } else if (category === 'section:references') {
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
      // Check if this is a missing/broken reference (exists === false)
      const isMissingRef = icon.category === 'img-ref' && icon.exists === false;
      
      // Get SVG content early for rasterization check
      let svgContent = icon.svg;
      if (!svgContent && icon.path) {
        try {
          if (fs.existsSync(icon.path)) {
            svgContent = fs.readFileSync(icon.path, 'utf-8');
          }
        } catch (err) {
          // Ignore read errors for now
        }
      }
      
      // Check if this is a rasterized SVG (too many colors)
      const isRasterized = this.isRasterizedSvg(svgContent);
      
      // Detect animation type from icon data or SVG content
      const animationType = this.detectAnimationType(icon);
      
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
      // Note: IMG refs use 'inline' source but need special contextValue
      // Rasterized SVGs get special contextValue to disable editing options
      if (isMissingRef) {
        this.contextValue = 'missingRef';
      } else if (isRasterized) {
        // Rasterized SVGs - limited menu options based on source
        // If it's built and rasterized, show "Rasterized" variant that allows unbuild
        if (icon.source === 'workspace') {
          this.contextValue = icon.isBuilt ? 'svgIconRasterizedBuilt' : 'svgIconRasterized';
        } else if (icon.category === 'img-ref') {
          this.contextValue = 'imgRefRasterized';
        } else if (icon.source === 'inline') {
          this.contextValue = icon.isBuilt ? 'inlineSvgRasterizedBuilt' : 'inlineSvgRasterized';
        } else {
          // Library built icon that's rasterized
          this.contextValue = 'builtIconRasterized';
        }
      } else if (icon.category === 'img-ref') {
        this.contextValue = 'imgRef';
      } else if (icon.source === 'inline') {
        // Inline SVG that's also built
        this.contextValue = icon.isBuilt ? 'inlineSvgBuilt' : 'inlineSvg';
      } else if (icon.isBuilt) {
        // Could be builtIcon from library or svgIcon that's also built
        this.contextValue = icon.source === 'workspace' ? 'svgIconBuilt' : 'builtIcon';
      } else {
        this.contextValue = 'svgIcon';
      }
      
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
      
      // For missing references, show special tooltip
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
          arguments: [this]
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
          arguments: [this]
        };
      }

      // For missing references, show error icon in red
      if (isMissingRef) {
        this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
        return;
      }

      // Use the actual SVG as icon (svgContent was already read above)
      if (svgContent) {
        try {
          const tempPath = saveTempSvgIcon(icon.name, svgContent);
          this.iconPath = vscode.Uri.file(tempPath);
        } catch (err) {
          console.error('[Bezier] Error saving temp SVG:', icon.name, err);
          this.iconPath = icon.isBuilt 
            ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('circle-outline');
        }
      } else {
        // Show symbol icon for missing SVGs
        this.iconPath = new vscode.ThemeIcon('symbol-misc');
      }
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
    console.log('[Bezier] BuiltIconsProvider: Loading built icons...');
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

    console.log('[Bezier] BuiltIconsProvider: Found', this.builtIcons.size, 'built icons');
  }

  private async parseSpriteFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log('[Bezier] BuiltIconsProvider: Parsing sprite file', filePath);

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

        console.log('[Bezier] BuiltIconsProvider: Found sprite icon:', iconName);

        this.builtIcons.set(iconName, {
          name: iconName,
          path: filePath,
          source: 'library',
          svg: svgContent,
          isBuilt: true
        });
        this.spriteIcons.add(iconName);
      }

      console.log('[Bezier] BuiltIconsProvider: Total from sprite:', this.builtIcons.size);
    } catch (error) {
      console.error('[Bezier] BuiltIconsProvider: Error parsing sprite file:', error);
    }
  }

  private async parseIconsFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log('[Bezier] BuiltIconsProvider: Parsing file', filePath);
      
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
            console.warn('[Bezier] BuiltIconsProvider: Failed to parse animation for', iconName);
          }
        }
        
        console.log('[Bezier] BuiltIconsProvider: Found icon:', iconName, animation ? `with animation: ${animation.type}` : '');
        
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

      console.log('[Bezier] BuiltIconsProvider: Total parsed:', this.builtIcons.size);
    } catch (error) {
      console.error('[Bezier] BuiltIconsProvider: Error parsing icons file:', error);
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

  private scanPromise: Promise<void> | null = null;

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
    console.log('[Bezier] SvgFilesProvider: Starting scan...');
    this.svgFiles.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('[Bezier] SvgFilesProvider: No workspace folders');
      return;
    }

    for (const folder of workspaceFolders) {
      await this.scanFolder(folder.uri.fsPath);
    }
    
    console.log('[Bezier] SvgFilesProvider: Scan complete. Found:', this.svgFiles.size, 'files');
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
      console.log('[Bezier] SvgFilesProvider: No configured folders, scanning all...');
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
      console.error(`[Bezier] SvgFilesProvider: Error scanning ${dirPath}:`, error);
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
      console.error(`[Bezier] SvgFilesProvider: Error scanning ${folderPath}:`, error);
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

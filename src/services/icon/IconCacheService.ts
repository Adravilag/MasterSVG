import * as vscode from 'vscode';
import { SvgItem } from '../../providers/tree/SvgItem';
import { WorkspaceIcon } from '../../types/icons';

/**
 * Service for managing cached SvgItems for tree view reveal functionality
 */
export class IconCacheService {
  private itemCache: Map<string, SvgItem> = new Map();

  /**
   * Cache an item by its ID
   */
  cacheItem(item: SvgItem): SvgItem {
    if (item.id) {
      this.itemCache.set(item.id, item);
    }
    return item;
  }

  /**
   * Get a cached item by its ID
   */
  getItemById(id: string): SvgItem | undefined {
    return this.itemCache.get(id);
  }

  /**
   * Clear all cached items
   */
  clear(): void {
    this.itemCache.clear();
  }

  /**
   * Delete items matching a filter predicate
   */
  deleteMatching(predicate: (key: string, item: SvgItem) => boolean): void {
    for (const [key, item] of this.itemCache.entries()) {
      if (predicate(key, item)) {
        this.itemCache.delete(key);
      }
    }
  }

  /**
   * Check if item matches by name and optionally line/file
   */
  private matchByNameAndLine(
    item: SvgItem,
    iconName: string,
    filePath?: string,
    lineNumber?: number
  ): { isBestMatch: boolean; isExactWithLine: boolean; isExactName: boolean } {
    const icon = item.icon;
    if (!icon || item.type !== 'icon' || icon.name !== iconName) {
      return { isBestMatch: false, isExactWithLine: false, isExactName: false };
    }

    const lineMatches = lineNumber !== undefined && icon.line === lineNumber - 1;
    const pathMatches = filePath && (icon.path === filePath || icon.filePath === filePath);

    if (lineMatches && pathMatches) return { isBestMatch: true, isExactWithLine: false, isExactName: false };
    if (lineMatches) return { isBestMatch: false, isExactWithLine: true, isExactName: false };
    if (pathMatches || !filePath) return { isBestMatch: false, isExactWithLine: false, isExactName: true };

    return { isBestMatch: false, isExactWithLine: false, isExactName: false };
  }

  /**
   * Check if item matches by path
   */
  private matchByPath(item: SvgItem, filePath: string, lineNumber?: number): boolean {
    const icon = item.icon;
    if (!icon || item.type !== 'icon') return false;

    const pathMatches = icon.path === filePath || icon.filePath === filePath;
    if (!pathMatches) return false;

    return lineNumber === undefined || icon.line === lineNumber - 1;
  }

  /**
   * Find item in cache by icon name or path
   */
  findItemByIconNameOrPath(
    iconName: string,
    filePath?: string,
    lineNumber?: number
  ): SvgItem | undefined {
    let exactMatchWithLine: SvgItem | undefined;
    let exactNameMatch: SvgItem | undefined;
    let pathMatch: SvgItem | undefined;

    for (const [, item] of this.itemCache) {
      const nameResult = this.matchByNameAndLine(item, iconName, filePath, lineNumber);

      if (nameResult.isBestMatch) return item;
      if (nameResult.isExactWithLine && !exactMatchWithLine) exactMatchWithLine = item;
      if (nameResult.isExactName && !exactNameMatch) exactNameMatch = item;

      if (!pathMatch && filePath && this.matchByPath(item, filePath, lineNumber)) {
        pathMatch = item;
      }
    }

    return exactMatchWithLine ?? exactNameMatch ?? pathMatch;
  }

  /**
   * Create a SvgItem from a WorkspaceIcon for TreeView reveal
   */
  createSvgItemFromIcon(icon: WorkspaceIcon): SvgItem | undefined {
    if (!icon) return undefined;

    // First check if we have this item cached by searching through the cache
    // The cache key includes instanceCounter prefix, so we search by icon properties
    const cachedItem = this.findItemByIconNameOrPath(
      icon.name,
      icon.filePath || icon.path,
      icon.line !== undefined ? icon.line + 1 : undefined
    );
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

    const item = SvgItem.create(
      icon.name,
      0,
      vscode.TreeItemCollapsibleState.None,
      'icon',
      icon,
      undefined
    );

    // Manually set contextValue since constructor may set it differently
    item.contextValue = contextValue;

    return item;
  }
}

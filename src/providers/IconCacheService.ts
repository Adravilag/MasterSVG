import * as vscode from 'vscode';
import { SvgItem } from './SvgItem';
import { WorkspaceIcon } from '../types/icons';

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

    for (const [_id, item] of this.itemCache) {
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
        if (
          !pathMatch &&
          filePath &&
          (item.icon.path === filePath || item.icon.filePath === filePath)
        ) {
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

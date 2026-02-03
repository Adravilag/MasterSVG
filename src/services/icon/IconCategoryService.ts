import * as path from 'path';
import { WorkspaceIcon } from '../../types/icons';
import type { CategoryInfo, IconStorageMaps } from '../types';

// Re-export for backwards compatibility
export type { CategoryInfo };
export type IconStorageMapsForCategory = IconStorageMaps<WorkspaceIcon>;

/**
 * Service for organizing icons by category
 */
export class IconCategoryService {
  /**
   * Get all categories with their counts
   */
  static getCategories(storage: IconStorageMapsForCategory): CategoryInfo[] {
    const categoryCount = new Map<string, { count: number; type: 'library' | 'file' | 'folder' }>();

    // Count workspace icons by folder
    for (const icon of storage.svgFiles.values()) {
      const cat = icon.category || 'workspace';
      const existing = categoryCount.get(cat);
      categoryCount.set(cat, {
        count: (existing?.count || 0) + 1,
        type: 'folder',
      });
    }

    // Library icons - group by actual source file
    const libraryByFile = new Map<string, number>();
    for (const icon of storage.libraryIcons.values()) {
      const fileName = path.basename(icon.path);
      libraryByFile.set(fileName, (libraryByFile.get(fileName) || 0) + 1);
    }

    // Add library groups
    for (const [fileName, count] of libraryByFile) {
      categoryCount.set(`📦 ${fileName}`, { count, type: 'library' });
    }

    // Inline SVGs grouped by file
    if (storage.inlineSvgs.size > 0) {
      const inlineByFile = new Map<string, number>();
      for (const icon of storage.inlineSvgs.values()) {
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
    if (storage.svgReferences.size > 0) {
      for (const [filePath, refs] of storage.svgReferences) {
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

  /** Sort icons by name */
  private static sortByName(icons: WorkspaceIcon[]): WorkspaceIcon[] {
    return icons.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Sort icons by line number */
  private static sortByLine(icons: WorkspaceIcon[]): WorkspaceIcon[] {
    return icons.sort((a, b) => (a.line || 0) - (b.line || 0));
  }

  /** Get built icons by file name */
  private static getBuiltIcons(fileName: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.libraryIcons.values()) {
      if (icon.isBuilt && path.basename(icon.path) === fileName) icons.push(icon);
    }
    return this.sortByName(icons);
  }

  /** Get SVG files by folder */
  private static getFolderIcons(folder: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.svgFiles.values()) {
      if ((icon.category || 'root') === folder) icons.push(icon);
    }
    return this.sortByName(icons);
  }

  /** Get inline SVGs by file path */
  private static getInlineByPath(filePath: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.inlineSvgs.values()) {
      if (icon.filePath === filePath) icons.push(icon);
    }
    return this.sortByLine(icons);
  }

  /** Get inline SVGs by file name (legacy) */
  private static getInlineByName(fileName: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.inlineSvgs.values()) {
      if (icon.filePath && path.basename(icon.filePath) === fileName) icons.push(icon);
    }
    return this.sortByLine(icons);
  }

  /** Get library icons by file name */
  private static getLibraryIcons(fileName: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.libraryIcons.values()) {
      if (path.basename(icon.path) === fileName) icons.push(icon);
    }
    return this.sortByName(icons);
  }

  /** Get references by file path or name */
  private static getRefsByPath(filePath: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const refs = storage.svgReferences.get(filePath);
    return refs ? this.sortByLine([...refs]) : [];
  }

  private static getRefsByName(fileName: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];
    for (const [fp, refs] of storage.svgReferences) {
      if (path.basename(fp) === fileName) icons.push(...refs);
    }
    return this.sortByLine(icons);
  }

  /**
   * Get icons by category string
   */
  static getIconsByCategory(category: string, storage: IconStorageMapsForCategory): WorkspaceIcon[] {
    if (category.startsWith('built:')) return this.getBuiltIcons(category.replace('built:', ''), storage);
    if (category.startsWith('folder:')) return this.getFolderIcons(category.replace('folder:', ''), storage);
    if (category.startsWith('inline:')) return this.getInlineByPath(category.replace('inline:', ''), storage);
    if (category.startsWith('refs:')) return this.getRefsByPath(category.replace('refs:', ''), storage);
    if (category.startsWith('📦 ')) return this.getLibraryIcons(category.replace('📦 ', ''), storage);
    if (category.startsWith('📄 ')) return this.getInlineByName(category.replace('📄 ', ''), storage);
    if (category.startsWith('🔗 ')) return this.getRefsByName(category.replace('🔗 ', ''), storage);

    // Workspace folder icons (default)
    const icons: WorkspaceIcon[] = [];
    for (const icon of storage.svgFiles.values()) {
      if (icon.category === category) icons.push(icon);
    }
    return this.sortByName(icons);
  }
}

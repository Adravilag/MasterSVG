import * as path from 'path';
import { WorkspaceIcon } from '../types/icons';

export interface CategoryInfo {
  name: string;
  count: number;
  type: 'library' | 'file' | 'folder';
}

export interface IconStorageMapsForCategory {
  svgFiles: Map<string, WorkspaceIcon>;
  libraryIcons: Map<string, WorkspaceIcon>;
  inlineSvgs: Map<string, WorkspaceIcon>;
  svgReferences: Map<string, WorkspaceIcon[]>;
}

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

  /**
   * Get icons by category string
   */
  static getIconsByCategory(
    category: string,
    storage: IconStorageMapsForCategory
  ): WorkspaceIcon[] {
    const icons: WorkspaceIcon[] = [];

    // Built icons by file (built: prefix)
    if (category.startsWith('built:')) {
      const fileName = category.replace('built:', '');
      for (const icon of storage.libraryIcons.values()) {
        if (icon.isBuilt && path.basename(icon.path) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }

    // SVG files by folder (folder: prefix)
    if (category.startsWith('folder:')) {
      const folder = category.replace('folder:', '');
      for (const icon of storage.svgFiles.values()) {
        if ((icon.category || 'root') === folder) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Inline SVGs by file (inline: prefix) - now uses full path
    if (category.startsWith('inline:')) {
      const filePath = category.replace('inline:', '');
      for (const icon of storage.inlineSvgs.values()) {
        if (icon.filePath === filePath) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // SVG references by file (refs: prefix)
    if (category.startsWith('refs:')) {
      const filePath = category.replace('refs:', '');
      const refs = storage.svgReferences.get(filePath);
      if (refs) {
        icons.push(...refs);
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // Legacy support for old category formats
    // Library icons (📦 prefix)
    if (category.startsWith('📦 ')) {
      const fileName = category.replace('📦 ', '');
      for (const icon of storage.libraryIcons.values()) {
        if (path.basename(icon.path) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Inline SVGs by file (📄 prefix)
    if (category.startsWith('📄 ')) {
      const fileName = category.replace('📄 ', '');
      for (const icon of storage.inlineSvgs.values()) {
        if (icon.filePath && path.basename(icon.filePath) === fileName) {
          icons.push(icon);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // SVG references by file (🔗 prefix)
    if (category.startsWith('🔗 ')) {
      const fileName = category.replace('🔗 ', '');
      for (const [filePath, refs] of storage.svgReferences) {
        if (path.basename(filePath) === fileName) {
          icons.push(...refs);
        }
      }
      return icons.sort((a, b) => (a.line || 0) - (b.line || 0)); // Sort by line number
    }

    // Workspace folder icons
    for (const icon of storage.svgFiles.values()) {
      if (icon.category === category) {
        icons.push(icon);
      }
    }

    return icons.sort((a, b) => a.name.localeCompare(b.name));
  }
}

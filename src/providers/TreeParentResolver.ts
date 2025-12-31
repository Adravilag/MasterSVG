/**
 * TreeParentResolver
 *
 * Handles resolving parent elements in the icon tree hierarchy.
 * Extracted from WorkspaceSvgProvider for better separation of concerns.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SvgItem } from './SvgItem';

/**
 * Configuration for creating section items
 */
interface SectionConfig {
  label: string;
  category: string;
}

/**
 * Resolves parent relationships for tree items
 */
export class TreeParentResolver {
  private static readonly SECTIONS: Record<string, SectionConfig> = {
    built: { label: 'Built Library', category: 'built' },
    files: { label: 'SVG Files', category: 'files' },
    inline: { label: 'Inline SVGs', category: 'inline' },
    references: { label: 'IMG References', category: 'references' },
  };

  /**
   * Get parent item for a given tree element
   */
  static getParent(element: SvgItem): SvgItem | undefined {
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
      return this.getCategoryParent(element);
    }

    // Icon items - find their parent category
    if (element.type === 'icon' && element.icon) {
      return this.getIconParent(element);
    }

    return undefined;
  }

  /**
   * Get parent for category/folder items
   */
  private static getCategoryParent(element: SvgItem): SvgItem | undefined {
    const category = element.category!;

    // Built library folders
    if (category.startsWith('built:')) {
      return this.createSectionItem('Built Library', 'built');
    }

    // SVG Files folders
    if (category.startsWith('folder:')) {
      return this.getFolderParent(category);
    }

    // Inline folders/files
    if (category.startsWith('inlinedir:') || category.startsWith('inline:')) {
      return this.createSectionItem('Inline SVGs', 'inline');
    }

    // Reference folders/files
    if (category.startsWith('refsdir:') || category.startsWith('refs:')) {
      return this.createSectionItem('IMG References', 'references');
    }

    return undefined;
  }

  /**
   * Get parent for folder items in SVG Files section
   */
  private static getFolderParent(category: string): SvgItem {
    const folderPath = category.replace('folder:', '');
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

    return this.createSectionItem('SVG Files', 'files');
  }

  /**
   * Get parent for icon items
   */
  private static getIconParent(element: SvgItem): SvgItem | undefined {
    const icon = element.icon!;

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
      return this.createSectionItem('SVG Files', 'files');
    }

    // Inline SVG - parent is the file
    if (icon.filePath && icon.name.startsWith('svg-') && !icon.path) {
      const relativePath = vscode.workspace.asRelativePath(icon.filePath);
      return new SvgItem(
        path.basename(icon.filePath),
        0,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `inline:${relativePath}`
      );
    }

    // IMG Reference - parent is the file
    if (icon.category === 'img-ref' && icon.filePath) {
      const relativePath = vscode.workspace.asRelativePath(icon.filePath);
      return new SvgItem(
        path.basename(icon.filePath),
        0,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `refs:${relativePath}`
      );
    }

    return undefined;
  }

  /**
   * Create a section item
   */
  private static createSectionItem(label: string, category: string): SvgItem {
    return new SvgItem(
      label,
      0,
      vscode.TreeItemCollapsibleState.Collapsed,
      'section',
      undefined,
      category
    );
  }
}

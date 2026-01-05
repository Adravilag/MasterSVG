import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon, IconUsage } from '../types/icons';
import { SvgItem } from './SvgItem';
import { FolderTreeBuilder } from './FolderTreeBuilder';
import { t } from '../i18n';

/**
 * Builds section children for different tree view sections
 */
export class SectionChildrenBuilder {
  /**
   * Get children for SVG Files folder hierarchy
   */
  static getFolderChildren(folderPath: string, svgFiles: Map<string, WorkspaceIcon>): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    // Build paths for all SVG files
    const allPaths: string[] = [];
    for (const icon of svgFiles.values()) {
      const relativePath = path.relative(workspaceRoot, icon.path).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }

    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const node = tree.get(folderPath);

    if (!node) return items;

    // Add subfolders first
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(node);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      const count = FolderTreeBuilder.countInSubtree(subfolder, allPaths);
      items.push(
        new SvgItem(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `folder:${subfolder}`
        )
      );
    }

    // Add SVG files in this folder
    const sortedFiles = FolderTreeBuilder.getSortedFiles(node);
    for (const filePath of sortedFiles) {
      const fileName = path.basename(filePath, '.svg');
      const fullPath = path.join(workspaceRoot, filePath);
      const icon = Array.from(svgFiles.values()).find(i => i.path === fullPath);
      if (icon) {
        items.push(
          new SvgItem(
            fileName,
            0,
            vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            `folder:${folderPath}`
          )
        );
      }
    }

    return items;
  }

  /**
   * Get children for Inline SVGs folder hierarchy
   */
  static getInlineDirChildren(dirPath: string, inlineSvgs: Map<string, WorkspaceIcon>): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    // Build paths for all files containing inline SVGs
    const filePathsSet = new Set<string>();
    for (const icon of inlineSvgs.values()) {
      if (icon.filePath) {
        const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\\\/g, '/');
        filePathsSet.add(relativePath);
      }
    }
    const allPaths = Array.from(filePathsSet);

    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);

    if (!node) return items;

    // Add subfolders first
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(node);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      // Count total inline SVGs in this subtree
      let count = 0;
      for (const icon of inlineSvgs.values()) {
        if (icon.filePath) {
          const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\\\/g, '/');
          if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
            count++;
          }
        }
      }
      items.push(
        new SvgItem(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `inlinedir:${subfolder}`
        )
      );
    }

    // Add files in this folder
    const sortedFiles = FolderTreeBuilder.getSortedFiles(node);
    for (const filePath of sortedFiles) {
      const fileName = path.basename(filePath);
      const fullPath = path.join(workspaceRoot, filePath);
      // Count icons in this file
      let count = 0;
      for (const icon of inlineSvgs.values()) {
        if (icon.filePath === fullPath) count++;
      }
      items.push(
        new SvgItem(
          fileName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `inline:${fullPath}`
        )
      );
    }

    return items;
  }

  /**
   * Get children (inline SVGs) for a specific file
   */
  static getInlineFileChildren(
    filePath: string,
    inlineSvgs: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    const items: SvgItem[] = [];

    for (const icon of inlineSvgs.values()) {
      if (icon.filePath === filePath) {
        items.push(
          new SvgItem(
            icon.name,
            0,
            vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            `inline:${filePath}`
          )
        );
      }
    }

    return items.sort((a, b) => (a.icon?.line || 0) - (b.icon?.line || 0));
  }

  /**
   * Get children for IMG References folder hierarchy
   */
  static getRefsDirChildren(
    dirPath: string,
    svgReferences: Map<string, WorkspaceIcon[]>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    // Build paths for all files containing SVG references
    const allPaths: string[] = [];
    for (const filePath of svgReferences.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }

    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);

    if (!node) return items;

    // Add subfolders first
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(node);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      // Count total refs in this subtree
      let count = 0;
      for (const [filePath, refs] of svgReferences) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
        if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
          count += refs.length;
        }
      }
      items.push(
        new SvgItem(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `refsdir:${subfolder}`
        )
      );
    }

    // Add files in this folder
    const sortedFiles = FolderTreeBuilder.getSortedFiles(node);
    for (const relPath of sortedFiles) {
      const fileName = path.basename(relPath);
      const fullPath = path.join(workspaceRoot, relPath);
      const refs = svgReferences.get(fullPath);
      if (refs) {
        items.push(
          new SvgItem(
            fileName,
            refs.length,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `refs:${fullPath}`
          )
        );
      }
    }

    return items;
  }

  /**
   * Get children (SVG references) for a specific file
   */
  static getRefsFileChildren(
    filePath: string,
    svgReferences: Map<string, WorkspaceIcon[]>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const refs = svgReferences.get(filePath);

    if (refs) {
      for (const icon of refs) {
        items.push(
          new SvgItem(
            icon.name,
            0,
            vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            `refs:${filePath}`
          )
        );
      }
    }

    return items.sort((a, b) => (a.icon?.line || 0) - (b.icon?.line || 0));
  }

  /**
   * Get children for Icon Component usages folder hierarchy
   */
  static getUsagesDirChildren(dirPath: string, iconUsages: Map<string, IconUsage[]>): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    // Group usages by file first
    const usagesByFile = this.groupUsagesByFile(iconUsages);

    // Build paths
    const allPaths: string[] = [];
    for (const filePath of usagesByFile.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }

    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const normalizedDir = dirPath === '(root)' ? '' : dirPath;
    const node = tree.get(normalizedDir);

    if (!node) return items;

    // Add subfolders first
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(node);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      let count = 0;
      for (const [filePath, usageList] of usagesByFile) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
        if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) {
          count += usageList.length;
        }
      }
      items.push(
        new SvgItem(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `usagesdir:${subfolder}`
        )
      );
    }

    // Add files in this folder
    const sortedFiles = FolderTreeBuilder.getSortedFiles(node);
    for (const relPath of sortedFiles) {
      const fileName = path.basename(relPath);
      const fullPath = path.join(workspaceRoot, relPath);
      const usageList = usagesByFile.get(fullPath);
      if (usageList) {
        items.push(
          new SvgItem(
            fileName,
            usageList.length,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `usages:${fullPath}`
          )
        );
      }
    }

    return items;
  }

  /**
   * Get children (icon usages) for a specific file
   */
  static getUsagesFileChildren(
    filePath: string,
    iconUsages: Map<string, IconUsage[]>,
    libraryIcons: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    const items: SvgItem[] = [];

    // Collect all usages for this file
    const fileUsages: { iconName: string; usage: IconUsage }[] = [];
    for (const [iconName, usages] of iconUsages) {
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
      const builtIcon = libraryIcons.get(iconName);

      // usage.line is 1-based (for display), convert to 0-based for internal use
      const lineZeroBased = usage.line - 1;

      // Check if icon exists in library
      const iconNotInLibrary = !builtIcon;

      const item = new SvgItem(
        iconName,
        0,
        vscode.TreeItemCollapsibleState.None,
        'icon',
        builtIcon
          ? { ...builtIcon, line: lineZeroBased, filePath }
          : {
              name: iconName,
              path: filePath,
              svg: '',
              source: 'library' as const,
              line: lineZeroBased,
              filePath,
              exists: false, // Mark as not existing in library
            },
        `usages:${filePath}`
      );

      // Show line number and warning if icon not in library
      if (iconNotInLibrary) {
        item.description = `Line ${usage.line} · ⚠ Not in library`;
        item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      } else {
        item.description = `Line ${usage.line}`;
      }
      
      item.tooltip = iconNotInLibrary 
        ? `${usage.preview}\n\n⚠ Icon "${iconName}" is not in your library.\nClick to import from Iconify.`
        : usage.preview;
      item.contextValue = iconNotInLibrary ? 'iconUsageMissing' : 'iconUsage';
      item.command = {
        command: 'masterSVG.goToInlineSvg',
        title: t('commands.goToUsage'),
        arguments: [{ icon: { filePath, line: lineZeroBased } }],
      };
      items.push(item);
    }

    return items;
  }

  /**
   * Group icon usages by file
   */
  static groupUsagesByFile(
    iconUsages: Map<string, IconUsage[]>
  ): Map<string, { iconName: string; usage: IconUsage }[]> {
    const usagesByFile = new Map<string, { iconName: string; usage: IconUsage }[]>();

    for (const [iconName, usages] of iconUsages) {
      for (const usage of usages) {
        if (!usagesByFile.has(usage.file)) {
          usagesByFile.set(usage.file, []);
        }
        usagesByFile.get(usage.file)!.push({ iconName, usage });
      }
    }

    return usagesByFile;
  }
}

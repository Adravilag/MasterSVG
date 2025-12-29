import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon, IconUsage } from '../types/icons';
import { SvgItem } from './SvgItem';
import { FolderTreeBuilder } from './FolderTreeBuilder';
import { SectionChildrenBuilder } from './SectionChildrenBuilder';

/**
 * Builds children for the top-level category sections in the tree view
 */
export class CategorySectionBuilder {
  /**
   * Build children for the SVG Files section
   */
  static buildFilesSectionChildren(
    svgFiles: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();
    
    // Build paths for all SVG files
    const allPaths: string[] = [];
    for (const icon of svgFiles.values()) {
      const relativePath = path.relative(workspaceRoot, icon.path).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }
    
    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const root = tree.get('');
    
    if (!root) {
      // No folder structure - return flat list
      return this.buildFlatFilesList(svgFiles);
    }
    
    // Add root subfolders
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(root);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      const count = FolderTreeBuilder.countInSubtree(subfolder, allPaths);
      items.push(new SvgItem(
        folderName,
        count,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        undefined,
        `folder:${subfolder}`
      ));
    }
    
    // Add root files
    const sortedFiles = FolderTreeBuilder.getSortedFiles(root);
    for (const filePath of sortedFiles) {
      const fileName = path.basename(filePath, '.svg');
      const fullPath = path.join(workspaceRoot, filePath);
      const icon = Array.from(svgFiles.values()).find(i => i.path === fullPath);
      if (icon) {
        items.push(new SvgItem(
          fileName,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          'files-section'
        ));
      }
    }
    
    return items;
  }

  /**
   * Build a flat list of files when there's no folder structure
   */
  private static buildFlatFilesList(
    svgFiles: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const sortedIcons = Array.from(svgFiles.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    for (const icon of sortedIcons) {
      items.push(new SvgItem(
        icon.name,
        0,
        vscode.TreeItemCollapsibleState.None,
        'icon',
        icon,
        'files-section'
      ));
    }
    
    return items;
  }

  /**
   * Build children for the Inline SVGs section
   */
  static buildInlineSectionChildren(
    inlineSvgs: Map<string, WorkspaceIcon>
  ): SvgItem[] {
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
    const root = tree.get('');
    
    if (!root) {
      return [];
    }
    
    // Add root subfolders
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(root);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      let count = 0;
      for (const icon of inlineSvgs.values()) {
        if (icon.filePath) {
          const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\\\/g, '/');
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
    
    // Add root files
    const sortedFiles = FolderTreeBuilder.getSortedFiles(root);
    for (const filePath of sortedFiles) {
      const fileName = path.basename(filePath);
      const fullPath = path.join(workspaceRoot, filePath);
      let count = 0;
      for (const icon of inlineSvgs.values()) {
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

  /**
   * Build children for the IMG References section
   */
  static buildReferencesSectionChildren(
    svgReferences: Map<string, WorkspaceIcon[]>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();
    
    // Build paths
    const allPaths: string[] = [];
    for (const filePath of svgReferences.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }
    
    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const root = tree.get('');
    
    if (!root) {
      return this.buildFlatReferencesList(svgReferences, workspaceRoot);
    }
    
    // Add root subfolders
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(root);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      let count = 0;
      for (const [filePath, refs] of svgReferences) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
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
    
    // Add root files
    const sortedFiles = FolderTreeBuilder.getSortedFiles(root);
    for (const relPath of sortedFiles) {
      const fileName = path.basename(relPath);
      const fullPath = path.join(workspaceRoot, relPath);
      const refs = svgReferences.get(fullPath);
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

  /**
   * Build a flat list of references when there's no folder structure
   */
  private static buildFlatReferencesList(
    svgReferences: Map<string, WorkspaceIcon[]>,
    workspaceRoot: string
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const sortedFiles = Array.from(svgReferences.keys())
      .sort((a, b) => a.localeCompare(b));
    
    for (const filePath of sortedFiles) {
      const refs = svgReferences.get(filePath);
      if (refs) {
        const fileName = path.basename(filePath);
        items.push(new SvgItem(
          fileName,
          refs.length,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `refs:${filePath}`
        ));
      }
    }
    
    return items;
  }

  /**
   * Build children for the Icon Component Usages section
   */
  static buildUsagesSectionChildren(
    iconUsages: Map<string, IconUsage[]>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    // Group usages by file
    const usagesByFile = SectionChildrenBuilder.groupUsagesByFile(iconUsages);

    // Build paths
    const allPaths: string[] = [];
    for (const filePath of usagesByFile.keys()) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      allPaths.push(relativePath);
    }

    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const root = tree.get('');

    if (!root) {
      return this.buildFlatUsagesList(usagesByFile);
    }

    // Add root subfolders
    const sortedSubfolders = FolderTreeBuilder.getSortedSubfolders(root);
    for (const subfolder of sortedSubfolders) {
      const folderName = subfolder.split('/').pop() || subfolder;
      let count = 0;
      for (const [filePath, usageList] of usagesByFile) {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
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

    // Add root files
    const sortedFiles = FolderTreeBuilder.getSortedFiles(root);
    for (const relPath of sortedFiles) {
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

  /**
   * Build a flat list of usages when there's no folder structure
   */
  private static buildFlatUsagesList(
    usagesByFile: Map<string, { iconName: string; usage: IconUsage }[]>
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const sortedFiles = Array.from(usagesByFile.keys())
      .sort((a, b) => a.localeCompare(b));
    
    for (const filePath of sortedFiles) {
      const usageList = usagesByFile.get(filePath);
      if (usageList) {
        const fileName = path.basename(filePath);
        items.push(new SvgItem(
          fileName,
          usageList.length,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `usages:${filePath}`
        ));
      }
    }
    
    return items;
  }
}

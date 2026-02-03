import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceIcon, IconUsage } from '../../types/icons';
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
  static buildFilesSectionChildren(svgFiles: Map<string, WorkspaceIcon>): SvgItem[] {
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
      items.push(
        SvgItem.create(
          folderName,
          count,
          vscode.TreeItemCollapsibleState.Collapsed,
          'category',
          undefined,
          `folder:${subfolder}`
        )
      );
    }

    // Add root files
    const sortedFiles = FolderTreeBuilder.getSortedFiles(root);
    for (const filePath of sortedFiles) {
      const fileName = path.basename(filePath, '.svg');
      const fullPath = path.join(workspaceRoot, filePath);
      const icon = Array.from(svgFiles.values()).find(i => i.path === fullPath);
      if (icon) {
        items.push(
          SvgItem.create(
            fileName,
            0,
            vscode.TreeItemCollapsibleState.None,
            'icon',
            icon,
            'files-section'
          )
        );
      }
    }

    return items;
  }

  /**
   * Build a flat list of files when there's no folder structure
   */
  private static buildFlatFilesList(svgFiles: Map<string, WorkspaceIcon>): SvgItem[] {
    const items: SvgItem[] = [];
    const sortedIcons = Array.from(svgFiles.values()).sort((a, b) => a.name.localeCompare(b.name));

    for (const icon of sortedIcons) {
      items.push(
        SvgItem.create(
          icon.name,
          0,
          vscode.TreeItemCollapsibleState.None,
          'icon',
          icon,
          'files-section'
        )
      );
    }

    return items;
  }

  /**
   * Count inline SVGs in a subfolder
   */
  private static countInlineInSubfolder(
    inlineSvgs: Map<string, WorkspaceIcon>,
    workspaceRoot: string,
    subfolder: string
  ): number {
    let count = 0;
    for (const icon of inlineSvgs.values()) {
      if (icon.filePath) {
        const relativePath = path.relative(workspaceRoot, icon.filePath).replace(/\\\\/g, '/');
        if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) count++;
      }
    }
    return count;
  }

  /**
   * Build children for the Inline SVGs section
   */
  static buildInlineSectionChildren(inlineSvgs: Map<string, WorkspaceIcon>): SvgItem[] {
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    const filePathsSet = new Set<string>();
    for (const icon of inlineSvgs.values()) {
      if (icon.filePath) {
        filePathsSet.add(path.relative(workspaceRoot, icon.filePath).replace(/\\\\/g, '/'));
      }
    }

    const tree = FolderTreeBuilder.buildFolderTree(Array.from(filePathsSet));
    const root = tree.get('');
    if (!root) return [];

    const items: SvgItem[] = [];

    for (const subfolder of FolderTreeBuilder.getSortedSubfolders(root)) {
      const folderName = subfolder.split('/').pop() || subfolder;
      const count = this.countInlineInSubfolder(inlineSvgs, workspaceRoot, subfolder);
      items.push(SvgItem.create(folderName, count, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `inlinedir:${subfolder}`));
    }

    for (const filePath of FolderTreeBuilder.getSortedFiles(root)) {
      const fullPath = path.join(workspaceRoot, filePath);
      const count = Array.from(inlineSvgs.values()).filter(i => i.filePath === fullPath).length;
      items.push(SvgItem.create(path.basename(filePath), count, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `inline:${fullPath}`));
    }

    return items;
  }

  /**
   * Count references in a subfolder
   */
  private static countRefsInSubfolder(
    svgReferences: Map<string, WorkspaceIcon[]>,
    workspaceRoot: string,
    subfolder: string
  ): number {
    let count = 0;
    for (const [filePath, refs] of svgReferences) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) count += refs.length;
    }
    return count;
  }

  /**
   * Build children for the IMG References section
   */
  static buildReferencesSectionChildren(svgReferences: Map<string, WorkspaceIcon[]>): SvgItem[] {
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();

    const allPaths = Array.from(svgReferences.keys()).map(fp => path.relative(workspaceRoot, fp).replace(/\\\\/g, '/'));
    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const root = tree.get('');

    if (!root) return this.buildFlatReferencesList(svgReferences, workspaceRoot);

    const items: SvgItem[] = [];

    for (const subfolder of FolderTreeBuilder.getSortedSubfolders(root)) {
      const folderName = subfolder.split('/').pop() || subfolder;
      const count = this.countRefsInSubfolder(svgReferences, workspaceRoot, subfolder);
      items.push(SvgItem.create(folderName, count, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `refsdir:${subfolder}`));
    }

    for (const relPath of FolderTreeBuilder.getSortedFiles(root)) {
      const fullPath = path.join(workspaceRoot, relPath);
      const refs = svgReferences.get(fullPath);
      if (refs) {
        items.push(SvgItem.create(path.basename(relPath), refs.length, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `refs:${fullPath}`));
      }
    }

    return items;
  }

  /**
   * Build a flat list of references when there's no folder structure
   */
  private static buildFlatReferencesList(
    svgReferences: Map<string, WorkspaceIcon[]>,
    _workspaceRoot: string
  ): SvgItem[] {
    const items: SvgItem[] = [];
    const sortedFiles = Array.from(svgReferences.keys()).sort((a, b) => a.localeCompare(b));

    for (const filePath of sortedFiles) {
      const refs = svgReferences.get(filePath);
      if (refs) {
        const fileName = path.basename(filePath);
        items.push(
          SvgItem.create(
            fileName,
            refs.length,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `refs:${filePath}`
          )
        );
      }
    }

    return items;
  }

  /**
   * Count usages in a subfolder
   */
  private static countUsagesInSubfolder(
    usagesByFile: Map<string, { iconName: string; usage: IconUsage }[]>,
    workspaceRoot: string,
    subfolder: string
  ): number {
    let count = 0;
    for (const [filePath, usageList] of usagesByFile) {
      const relativePath = path.relative(workspaceRoot, filePath).replace(/\\\\/g, '/');
      if (relativePath.startsWith(subfolder + '/') || relativePath === subfolder) count += usageList.length;
    }
    return count;
  }

  /**
   * Build children for the Icon Component Usages section
   */
  static buildUsagesSectionChildren(iconUsages: Map<string, IconUsage[]>): SvgItem[] {
    const workspaceRoot = FolderTreeBuilder.getWorkspaceRoot();
    const usagesByFile = SectionChildrenBuilder.groupUsagesByFile(iconUsages);

    const allPaths = Array.from(usagesByFile.keys()).map(fp => path.relative(workspaceRoot, fp).replace(/\\\\/g, '/'));
    const tree = FolderTreeBuilder.buildFolderTree(allPaths);
    const root = tree.get('');

    if (!root) return this.buildFlatUsagesList(usagesByFile);

    const items: SvgItem[] = [];

    for (const subfolder of FolderTreeBuilder.getSortedSubfolders(root)) {
      const folderName = subfolder.split('/').pop() || subfolder;
      const count = this.countUsagesInSubfolder(usagesByFile, workspaceRoot, subfolder);
      items.push(SvgItem.create(folderName, count, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `usagesdir:${subfolder}`));
    }

    for (const relPath of FolderTreeBuilder.getSortedFiles(root)) {
      const fullPath = path.join(workspaceRoot, relPath);
      const usageList = usagesByFile.get(fullPath);
      if (usageList) {
        items.push(SvgItem.create(path.basename(relPath), usageList.length, vscode.TreeItemCollapsibleState.Collapsed, 'category', undefined, `usages:${fullPath}`));
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
    const sortedFiles = Array.from(usagesByFile.keys()).sort((a, b) => a.localeCompare(b));

    for (const filePath of sortedFiles) {
      const usageList = usagesByFile.get(filePath);
      if (usageList) {
        const fileName = path.basename(filePath);
        items.push(
          SvgItem.create(
            fileName,
            usageList.length,
            vscode.TreeItemCollapsibleState.Collapsed,
            'category',
            undefined,
            `usages:${filePath}`
          )
        );
      }
    }

    return items;
  }
}

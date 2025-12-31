import { WorkspaceIcon, IconUsage } from '../types/icons';
import { SvgItem } from './SvgItem';
import { FolderTreeBuilder, FolderTreeNode } from './FolderTreeBuilder';
import { SectionChildrenBuilder } from './SectionChildrenBuilder';
import { CategorySectionBuilder } from './CategorySectionBuilder';

// Re-export FolderTreeNode for backward compatibility
export { FolderTreeNode };

/**
 * Helper class for tree navigation operations in WorkspaceSvgProvider.
 * This is now a facade that delegates to specialized builders.
 */
export class TreeNavigationHelper {
  /**
   * Build a tree structure from paths
   * @deprecated Use FolderTreeBuilder.buildFolderTree instead
   */
  static buildFolderTree(paths: string[]): Map<string, FolderTreeNode> {
    return FolderTreeBuilder.buildFolderTree(paths);
  }

  /**
   * Get workspace root path
   * @deprecated Use FolderTreeBuilder.getWorkspaceRoot instead
   */
  static getWorkspaceRoot(): string {
    return FolderTreeBuilder.getWorkspaceRoot();
  }

  /**
   * Get children for SVG Files folder hierarchy
   */
  static getFolderChildren(folderPath: string, svgFiles: Map<string, WorkspaceIcon>): SvgItem[] {
    return SectionChildrenBuilder.getFolderChildren(folderPath, svgFiles);
  }

  /**
   * Get children for Inline SVGs folder hierarchy
   */
  static getInlineDirChildren(dirPath: string, inlineSvgs: Map<string, WorkspaceIcon>): SvgItem[] {
    return SectionChildrenBuilder.getInlineDirChildren(dirPath, inlineSvgs);
  }

  /**
   * Get children (inline SVGs) for a specific file
   */
  static getInlineFileChildren(
    filePath: string,
    inlineSvgs: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    return SectionChildrenBuilder.getInlineFileChildren(filePath, inlineSvgs);
  }

  /**
   * Get children for IMG References folder hierarchy
   */
  static getRefsDirChildren(
    dirPath: string,
    svgReferences: Map<string, WorkspaceIcon[]>
  ): SvgItem[] {
    return SectionChildrenBuilder.getRefsDirChildren(dirPath, svgReferences);
  }

  /**
   * Get children (SVG references) for a specific file
   */
  static getRefsFileChildren(
    filePath: string,
    svgReferences: Map<string, WorkspaceIcon[]>
  ): SvgItem[] {
    return SectionChildrenBuilder.getRefsFileChildren(filePath, svgReferences);
  }

  /**
   * Get children for Icon Component usages folder hierarchy
   */
  static getUsagesDirChildren(dirPath: string, iconUsages: Map<string, IconUsage[]>): SvgItem[] {
    return SectionChildrenBuilder.getUsagesDirChildren(dirPath, iconUsages);
  }

  /**
   * Get children (icon usages) for a specific file
   */
  static getUsagesFileChildren(
    filePath: string,
    iconUsages: Map<string, IconUsage[]>,
    libraryIcons: Map<string, WorkspaceIcon>
  ): SvgItem[] {
    return SectionChildrenBuilder.getUsagesFileChildren(filePath, iconUsages, libraryIcons);
  }

  /**
   * Group icon usages by file
   */
  static groupUsagesByFile(
    iconUsages: Map<string, IconUsage[]>
  ): Map<string, { iconName: string; usage: IconUsage }[]> {
    return SectionChildrenBuilder.groupUsagesByFile(iconUsages);
  }

  /**
   * Build section children for files section
   */
  static buildFilesSectionChildren(svgFiles: Map<string, WorkspaceIcon>): SvgItem[] {
    return CategorySectionBuilder.buildFilesSectionChildren(svgFiles);
  }

  /**
   * Build section children for inline section
   */
  static buildInlineSectionChildren(inlineSvgs: Map<string, WorkspaceIcon>): SvgItem[] {
    return CategorySectionBuilder.buildInlineSectionChildren(inlineSvgs);
  }

  /**
   * Build section children for references section
   */
  static buildReferencesSectionChildren(svgReferences: Map<string, WorkspaceIcon[]>): SvgItem[] {
    return CategorySectionBuilder.buildReferencesSectionChildren(svgReferences);
  }

  /**
   * Build section children for usages section
   */
  static buildUsagesSectionChildren(iconUsages: Map<string, IconUsage[]>): SvgItem[] {
    return CategorySectionBuilder.buildUsagesSectionChildren(iconUsages);
  }
}

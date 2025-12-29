import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Type definition for folder tree node
 */
export interface FolderTreeNode {
  subfolders: Set<string>;
  files: string[];
}

/**
 * Utility class for building folder tree structures from file paths
 */
export class FolderTreeBuilder {
  /**
   * Build a tree structure from paths
   */
  static buildFolderTree(paths: string[]): Map<string, FolderTreeNode> {
    const tree = new Map<string, FolderTreeNode>();
    
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

  /**
   * Get workspace root path
   */
  static getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  /**
   * Convert absolute paths to relative paths
   */
  static toRelativePaths(absolutePaths: string[], workspaceRoot?: string): string[] {
    const root = workspaceRoot || this.getWorkspaceRoot();
    return absolutePaths.map(p => path.relative(root, p).replace(/\\\\/g, '/'));
  }

  /**
   * Convert relative path to absolute path
   */
  static toAbsolutePath(relativePath: string, workspaceRoot?: string): string {
    const root = workspaceRoot || this.getWorkspaceRoot();
    return path.join(root, relativePath);
  }

  /**
   * Get sorted subfolders from a tree node
   */
  static getSortedSubfolders(node: FolderTreeNode): string[] {
    return Array.from(node.subfolders).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get sorted files from a tree node
   */
  static getSortedFiles(node: FolderTreeNode): string[] {
    return [...node.files].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Count items in a subtree
   */
  static countInSubtree(
    subfolder: string,
    allPaths: string[],
    matcher?: (path: string) => boolean
  ): number {
    let count = 0;
    for (const p of allPaths) {
      if (p.startsWith(subfolder + '/') || p === subfolder) {
        if (!matcher || matcher(p)) {
          count++;
        }
      }
    }
    return count;
  }
}

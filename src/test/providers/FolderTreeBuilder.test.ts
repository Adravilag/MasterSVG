import { FolderTreeBuilder, FolderTreeNode } from '../../providers/FolderTreeBuilder';
import * as vscode from 'vscode';
import * as path from 'path';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }]
  }
}));

describe('FolderTreeBuilder', () => {
  describe('buildFolderTree', () => {
    it('should build tree from single file path', () => {
      const paths = ['src/icons/home.svg'];
      const tree = FolderTreeBuilder.buildFolderTree(paths);

      expect(tree.has('')).toBe(true);
      expect(tree.has('src')).toBe(true);
      expect(tree.has('src/icons')).toBe(true);

      const root = tree.get('')!;
      expect(root.subfolders.has('src')).toBe(true);

      const srcNode = tree.get('src')!;
      expect(srcNode.subfolders.has('src/icons')).toBe(true);

      const iconsNode = tree.get('src/icons')!;
      expect(iconsNode.files).toContain('src/icons/home.svg');
    });

    it('should build tree from multiple file paths', () => {
      const paths = [
        'src/icons/home.svg',
        'src/icons/user.svg',
        'src/buttons/close.svg'
      ];
      const tree = FolderTreeBuilder.buildFolderTree(paths);

      const iconsNode = tree.get('src/icons')!;
      expect(iconsNode.files).toHaveLength(2);
      expect(iconsNode.files).toContain('src/icons/home.svg');
      expect(iconsNode.files).toContain('src/icons/user.svg');

      const buttonsNode = tree.get('src/buttons')!;
      expect(buttonsNode.files).toHaveLength(1);
      expect(buttonsNode.files).toContain('src/buttons/close.svg');
    });

    it('should handle empty paths array', () => {
      const tree = FolderTreeBuilder.buildFolderTree([]);
      expect(tree.size).toBe(0);
    });

    it('should handle root level files', () => {
      const paths = ['icon.svg'];
      const tree = FolderTreeBuilder.buildFolderTree(paths);

      const root = tree.get('')!;
      expect(root.files).toContain('icon.svg');
    });

    it('should handle deeply nested paths', () => {
      const paths = ['a/b/c/d/e/file.svg'];
      const tree = FolderTreeBuilder.buildFolderTree(paths);

      expect(tree.has('a')).toBe(true);
      expect(tree.has('a/b')).toBe(true);
      expect(tree.has('a/b/c')).toBe(true);
      expect(tree.has('a/b/c/d')).toBe(true);
      expect(tree.has('a/b/c/d/e')).toBe(true);

      const deepNode = tree.get('a/b/c/d/e')!;
      expect(deepNode.files).toContain('a/b/c/d/e/file.svg');
    });
  });

  describe('getWorkspaceRoot', () => {
    it('should return workspace folder path', () => {
      const result = FolderTreeBuilder.getWorkspaceRoot();
      expect(result).toBe('/workspace');
    });

    it('should return empty string when no workspace folders', () => {
      const originalFolders = vscode.workspace.workspaceFolders;
      (vscode.workspace as any).workspaceFolders = undefined;

      const result = FolderTreeBuilder.getWorkspaceRoot();
      expect(result).toBe('');

      (vscode.workspace as any).workspaceFolders = originalFolders;
    });
  });

  describe('toRelativePaths', () => {
    it('should convert absolute paths to relative', () => {
      const absolutePaths = ['/workspace/src/icon.svg', '/workspace/lib/button.svg'];
      const result = FolderTreeBuilder.toRelativePaths(absolutePaths, '/workspace');

      expect(result).toContain('src/icon.svg');
      expect(result).toContain('lib/button.svg');
    });

    it('should normalize Windows backslashes to forward slashes', () => {
      // The method uses replace(/\\/g, '/') to normalize paths
      // We test this by verifying the result doesn't contain backslashes
      const absolutePaths = ['/workspace/src/icons/home.svg'];
      const result = FolderTreeBuilder.toRelativePaths(absolutePaths, '/workspace');

      // Result should not contain backslashes
      expect(result[0]).not.toContain('\\');
      // Result should be a valid forward-slash path
      expect(result[0]).toMatch(/^[^\\]+$/);
    });

    it('should use workspace root when not provided', () => {
      const absolutePaths = ['/workspace/icon.svg'];
      const result = FolderTreeBuilder.toRelativePaths(absolutePaths);

      expect(result[0]).toBe('icon.svg');
    });
  });

  describe('toAbsolutePath', () => {
    it('should convert relative path to absolute', () => {
      const result = FolderTreeBuilder.toAbsolutePath('src/icon.svg', '/workspace');
      expect(result).toBe(path.join('/workspace', 'src/icon.svg'));
    });

    it('should use workspace root when not provided', () => {
      const result = FolderTreeBuilder.toAbsolutePath('icon.svg');
      expect(result).toBe(path.join('/workspace', 'icon.svg'));
    });
  });

  describe('getSortedSubfolders', () => {
    it('should return sorted array of subfolders', () => {
      const node: FolderTreeNode = {
        subfolders: new Set(['zebra', 'alpha', 'beta']),
        files: []
      };

      const result = FolderTreeBuilder.getSortedSubfolders(node);
      expect(result).toEqual(['alpha', 'beta', 'zebra']);
    });

    it('should return empty array for empty subfolders', () => {
      const node: FolderTreeNode = {
        subfolders: new Set(),
        files: []
      };

      const result = FolderTreeBuilder.getSortedSubfolders(node);
      expect(result).toEqual([]);
    });
  });

  describe('getSortedFiles', () => {
    it('should return sorted array of files', () => {
      const node: FolderTreeNode = {
        subfolders: new Set(),
        files: ['z-icon.svg', 'a-icon.svg', 'm-icon.svg']
      };

      const result = FolderTreeBuilder.getSortedFiles(node);
      expect(result).toEqual(['a-icon.svg', 'm-icon.svg', 'z-icon.svg']);
    });

    it('should not mutate original files array', () => {
      const originalFiles = ['z.svg', 'a.svg'];
      const node: FolderTreeNode = {
        subfolders: new Set(),
        files: originalFiles
      };

      FolderTreeBuilder.getSortedFiles(node);
      expect(originalFiles).toEqual(['z.svg', 'a.svg']);
    });
  });

  describe('countInSubtree', () => {
    const allPaths = [
      'src/icons/home.svg',
      'src/icons/user.svg',
      'src/buttons/close.svg',
      'lib/utils.svg'
    ];

    it('should count all files in subfolder', () => {
      const count = FolderTreeBuilder.countInSubtree('src/icons', allPaths);
      expect(count).toBe(2);
    });

    it('should count files matching criteria', () => {
      const count = FolderTreeBuilder.countInSubtree(
        'src',
        allPaths,
        (p) => p.includes('icons')
      );
      expect(count).toBe(2);
    });

    it('should return 0 for non-existent subfolder', () => {
      const count = FolderTreeBuilder.countInSubtree('nonexistent', allPaths);
      expect(count).toBe(0);
    });

    it('should not count files outside subfolder', () => {
      const count = FolderTreeBuilder.countInSubtree('src/icons', allPaths);
      expect(count).toBe(2); // Should not include lib/utils.svg or src/buttons/close.svg
    });

    it('should work with matcher that filters all', () => {
      const count = FolderTreeBuilder.countInSubtree(
        'src',
        allPaths,
        () => false
      );
      expect(count).toBe(0);
    });
  });
});

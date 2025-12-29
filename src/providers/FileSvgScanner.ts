import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig } from '../utils/config';
import { WorkspaceIcon } from '../types/icons';
import { shouldIgnorePath } from './IgnorePatterns';

/**
 * Scanner for SVG files in the workspace
 */
export class FileSvgScanner {
  /**
   * Directories to skip when scanning
   */
  static readonly SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.svelte-kit'];

  /**
   * Scan a folder for SVG files
   */
  static async scanFolder(
    folderPath: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    console.log('[Bezier] Scanning folder:', folderPath);
    const svgFolders = getSvgConfig<string[]>('svgFolders', []);
    console.log('[Bezier] Configured svgFolders:', svgFolders);

    let foundAny = false;

    // First try configured folders
    for (const svgFolder of svgFolders) {
      const fullPath = path.join(folderPath, svgFolder);
      console.log('[Bezier] Checking folder:', fullPath, 'exists:', fs.existsSync(fullPath));
      if (fs.existsSync(fullPath)) {
        await this.scanDirectory(fullPath, svgFolder, svgFiles);
        foundAny = true;
      }
    }

    // If no configured folders found, scan ALL SVGs in workspace
    if (!foundAny) {
      console.log('[Bezier] No configured folders found, scanning all SVGs...');
      await this.scanAllSvgsInFolder(folderPath, '', svgFiles);
    }

    console.log('[Bezier] Scan complete. Found SVGs:', svgFiles.size);
  }

  /**
   * Scan entire folder for any SVG files
   */
  static async scanAllSvgsInFolder(
    folderPath: string,
    relativePath: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    if (!fs.existsSync(folderPath)) return;

    // Check if this folder should be ignored
    if (shouldIgnorePath(folderPath)) {
      console.log('[Bezier] Ignoring folder (svgignore):', folderPath);
      return;
    }

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (!this.SKIP_DIRS.includes(entry.name)) {
            await this.scanAllSvgsInFolder(fullPath, relPath, svgFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          // Check if this SVG file should be ignored
          if (shouldIgnorePath(fullPath)) {
            console.log('[Bezier] Ignoring SVG (svgignore):', fullPath);
            continue;
          }
          
          const iconName = path.basename(entry.name, '.svg');
          const category = path.dirname(relPath) || 'root';
          
          console.log('[Bezier] Found SVG (full scan):', iconName, 'at', fullPath);
          svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category === '.' ? 'root' : category,
            svg: undefined
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning folder ${folderPath}:`, error);
    }
  }

  /**
   * Scan a specific directory for SVG files
   */
  static async scanDirectory(
    dirPath: string,
    category: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    // Check if this directory should be ignored
    if (shouldIgnorePath(dirPath)) {
      console.log('[Bezier] Ignoring directory (svgignore):', dirPath);
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath, `${category}/${entry.name}`, svgFiles);
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          // Check if this SVG file should be ignored
          if (shouldIgnorePath(fullPath)) {
            console.log('[Bezier] Ignoring SVG (svgignore):', fullPath);
            continue;
          }
          
          const iconName = path.basename(entry.name, '.svg');
          console.log('[Bezier] Found SVG (dir scan):', iconName, 'at', fullPath);
          svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category,
            svg: undefined // Lazy load
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }
}

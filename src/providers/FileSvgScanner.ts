import * as path from 'node:path';
import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { getSvgConfig } from '../utils/config';
import { WorkspaceIcon } from '../types/icons';
import { shouldIgnorePath } from './IgnorePatterns';
import {
  ScannerConfig,
  DEFAULT_SCANNER_CONFIG,
  ProgressCallback,
  ScanResult,
  ScanError,
} from '../types/scanner';
import { ConcurrentProcessor } from '../utils/ConcurrentProcessor';

/**
 * Scanner for SVG files in the workspace
 * Optimized for large projects with concurrent processing and configurable limits
 */
export class FileSvgScanner {
  /**
   * Directories to skip when scanning
   */
  static readonly SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.svelte-kit',
    '__pycache__',
    '.cache',
    '.turbo',
    '.output',
    'out',
    '.vercel',
    '.netlify',
    'vendor',
    'target',
  ]);

  /**
   * Current scanner configuration
   */
  private static config: ScannerConfig = DEFAULT_SCANNER_CONFIG;

  /**
   * Configure scanner options
   */
  static configure(config: Partial<ScannerConfig>): void {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
  }

  /**
   * Reset configuration to defaults
   */
  static resetConfig(): void {
    this.config = DEFAULT_SCANNER_CONFIG;
  }

  /**
   * Scan a folder for SVG files with progress reporting
   */
  static async scanFolder(
    folderPath: string,
    svgFiles: Map<string, WorkspaceIcon>,
    onProgress?: ProgressCallback
  ): Promise<ScanResult<Map<string, WorkspaceIcon>>> {
    const startTime = Date.now();
    const errors: ScanError[] = [];
    let filesScanned = 0;
    let truncated = false;

    const svgFolders = getSvgConfig<string[]>('svgFolders', []);

    onProgress?.({ phase: 'preparing', processed: 0 });

    let foundAny = false;

    // First try configured folders (parallel check)
    const existingFolders: string[] = [];
    for (const svgFolder of svgFolders) {
      const fullPath = path.join(folderPath, svgFolder);
      if (fs.existsSync(fullPath)) {
        existingFolders.push(fullPath);
        foundAny = true;
      }
    }

    if (foundAny) {
      // Scan configured folders concurrently
      const scanResults = await ConcurrentProcessor.processConcurrent({
        items: existingFolders.map((fp, i) => ({ fullPath: fp, category: svgFolders[i] })),
        processor: async ({ fullPath, category }) => {
          const folderSvgs = new Map<string, WorkspaceIcon>();
          await this.scanDirectoryOptimized(fullPath, category, folderSvgs, 0, errors);
          return folderSvgs;
        },
        concurrency: this.config.concurrencyLimit,
        onProgress: (processed, total) => {
          onProgress?.({
            phase: 'scanning',
            processed,
            total,
            percentage: Math.round((processed / total) * 100),
          });
        },
      });

      // Merge results
      for (const result of scanResults) {
        if (result) {
          for (const [key, value] of result) {
            if (svgFiles.size >= this.config.maxFiles) {
              truncated = true;
              break;
            }
            svgFiles.set(key, value);
          }
        }
      }
      filesScanned = svgFiles.size;
    } else {
      // Scan all SVGs with optimized approach
      
      const result = await this.scanAllSvgsOptimized(
        folderPath,
        '',
        svgFiles,
        0,
        errors,
        onProgress
      );
      filesScanned = result.filesScanned;
      truncated = result.truncated;
    }

    onProgress?.({
      phase: 'complete',
      processed: svgFiles.size,
      total: svgFiles.size,
      percentage: 100,
    });
    

    return {
      items: svgFiles,
      filesScanned,
      itemsFound: svgFiles.size,
      duration: Date.now() - startTime,
      truncated,
      errors,
    };
  }

  /**
   * Optimized scan for entire folder using async directory reading
   * Uses batched processing for better performance with large directories
   */
  static async scanAllSvgsOptimized(
    folderPath: string,
    relativePath: string,
    svgFiles: Map<string, WorkspaceIcon>,
    depth: number,
    errors: ScanError[],
    onProgress?: ProgressCallback
  ): Promise<{ filesScanned: number; truncated: boolean }> {
    let filesScanned = 0;
    let truncated = false;

    if (!fs.existsSync(folderPath)) {
      return { filesScanned, truncated };
    }

    // Check depth limit
    if (depth > this.config.maxDepth) {
      return { filesScanned, truncated: true };
    }

    // Check if this folder should be ignored
    if (shouldIgnorePath(folderPath)) {
      return { filesScanned, truncated };
    }

    try {
      // Use async readdir for better performance
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });

      // Separate files and directories for optimized processing
      const svgFiles_list: { fullPath: string; relPath: string; name: string }[] = [];
      const directories: { fullPath: string; relPath: string }[] = [];

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (!this.SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            directories.push({ fullPath, relPath });
          }
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          svgFiles_list.push({ fullPath, relPath, name: entry.name });
        }
      }

      // Process SVG files in batch
      for (const file of svgFiles_list) {
        if (svgFiles.size >= this.config.maxFiles) {
          truncated = true;
          break;
        }

        // Check if this SVG file should be ignored
        if (shouldIgnorePath(file.fullPath)) {
          continue;
        }

        const iconName = path.basename(file.name, '.svg');
        const category = path.dirname(file.relPath) || 'root';

        svgFiles.set(iconName, {
          name: iconName,
          path: file.fullPath,
          source: 'workspace',
          category: category === '.' ? 'root' : category,
          svg: undefined,
        });
        filesScanned++;

        if (onProgress && filesScanned % 100 === 0) {
          onProgress({
            phase: 'scanning',
            processed: filesScanned,
            currentFile: file.fullPath,
          });
        }
      }

      // Process subdirectories concurrently with limit
      if (!truncated && directories.length > 0) {
        const subResults = await ConcurrentProcessor.processConcurrent({
          items: directories,
          processor: async dir => {
            if (svgFiles.size >= this.config.maxFiles) {
              return { filesScanned: 0, truncated: true };
            }
            return this.scanAllSvgsOptimized(
              dir.fullPath,
              dir.relPath,
              svgFiles,
              depth + 1,
              errors,
              onProgress
            );
          },
          concurrency: Math.min(this.config.concurrencyLimit, directories.length),
        });

        for (const result of subResults) {
          if (result) {
            filesScanned += result.filesScanned;
            if (result.truncated) truncated = true;
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scanning folder ${folderPath}:`, error);
      errors.push({
        filePath: folderPath,
        message: errorMessage,
        code: (error as NodeJS.ErrnoException).code,
      });
    }

    return { filesScanned, truncated };
  }

  /**
   * Scan entire folder for any SVG files (legacy method for backward compatibility)
   * @deprecated Use scanAllSvgsOptimized instead
   */
  static async scanAllSvgsInFolder(
    folderPath: string,
    relativePath: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    const errors: ScanError[] = [];
    await this.scanAllSvgsOptimized(folderPath, relativePath, svgFiles, 0, errors);
  }

  /**
   * Optimized directory scan with async operations
   */
  static async scanDirectoryOptimized(
    dirPath: string,
    category: string,
    svgFiles: Map<string, WorkspaceIcon>,
    depth: number,
    errors: ScanError[]
  ): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    // Check depth limit
    if (depth > this.config.maxDepth) return;

    // Check if this directory should be ignored
    if (shouldIgnorePath(dirPath)) {
      return;
    }

    try {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
      const directories: { fullPath: string; category: string }[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!this.SKIP_DIRS.has(entry.name)) {
            directories.push({
              fullPath,
              category: `${category}/${entry.name}`,
            });
          }
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          if (svgFiles.size >= this.config.maxFiles) break;

          // Check if this SVG file should be ignored
          if (shouldIgnorePath(fullPath)) {
            continue;
          }

          const iconName = path.basename(entry.name, '.svg');
          
          svgFiles.set(iconName, {
            name: iconName,
            path: fullPath,
            source: 'workspace',
            category: category,
            svg: undefined, // Lazy load
          });
        }
      }

      // Recursively scan subdirectories concurrently
      if (directories.length > 0) {
        await ConcurrentProcessor.processConcurrent({
          items: directories,
          processor: async dir => {
            await this.scanDirectoryOptimized(
              dir.fullPath,
              dir.category,
              svgFiles,
              depth + 1,
              errors
            );
          },
          concurrency: Math.min(this.config.concurrencyLimit, directories.length),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scanning directory ${dirPath}:`, error);
      errors.push({
        filePath: dirPath,
        message: errorMessage,
        code: (error as NodeJS.ErrnoException).code,
      });
    }
  }

  /**
   * Scan a specific directory for SVG files (legacy method for backward compatibility)
   * @deprecated Use scanDirectoryOptimized instead
   */
  static async scanDirectory(
    dirPath: string,
    category: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    const errors: ScanError[] = [];
    await this.scanDirectoryOptimized(dirPath, category, svgFiles, 0, errors);
  }

  /**
   * Get scanner statistics
   */
  static getConfig(): Readonly<ScannerConfig> {
    return { ...this.config };
  }
}

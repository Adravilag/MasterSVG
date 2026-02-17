import * as path from 'node:path';
import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import * as vscode from 'vscode';
import { getSvgConfig } from '../../utils/config';
import { WorkspaceIcon } from '../../types/icons';
import { shouldIgnorePath } from '../../utils/IgnorePatterns';
import {
  ScannerConfig,
  DEFAULT_SCANNER_CONFIG,
  ProgressCallback,
  ScanResult,
  ScanError,
} from '../../types/scanner';
import { ConcurrentProcessor } from '../../utils/ConcurrentProcessor';

/**
 * Options for scanAllSvgsOptimized method
 */
interface ScanAllOptions {
  folderPath: string;
  relativePath: string;
  svgFiles: Map<string, WorkspaceIcon>;
  depth: number;
  errors: ScanError[];
  onProgress?: ProgressCallback;
}

/**
 * Options for scanDirectoryOptimized method
 */
interface ScanDirOptions {
  dirPath: string;
  category: string;
  svgFiles: Map<string, WorkspaceIcon>;
  depth: number;
  errors: ScanError[];
}

/**
 * Options for scanConfiguredFolders method
 */
interface ScanConfiguredOptions {
  existingFolders: string[];
  svgFolders: string[];
  svgFiles: Map<string, WorkspaceIcon>;
  errors: ScanError[];
  onProgress?: ProgressCallback;
}

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
   * Check if a file is the output sprite.svg (should not be scanned as source)
   * @param filePath Absolute path to the file
   * @returns true if this is the output sprite.svg
   */
  private static isOutputSpriteSvg(filePath: string): boolean {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    if (!outputDir) return false;

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return false;

    const outputSpritePath = path.join(workspaceRoot, outputDir, 'sprite.svg');
    return path.normalize(filePath).toLowerCase() === path.normalize(outputSpritePath).toLowerCase();
  }

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
   * Scan configured folders concurrently
   */
  private static async scanConfiguredFolders(
    opts: ScanConfiguredOptions
  ): Promise<{ filesScanned: number; truncated: boolean }> {
    const { existingFolders, svgFolders, svgFiles, errors, onProgress } = opts;
    const scanResults = await ConcurrentProcessor.processConcurrent({
      items: existingFolders.map((fp, i) => ({ fullPath: fp, category: svgFolders[i] })),
      processor: async ({ fullPath, category }) => {
        const folderSvgs = new Map<string, WorkspaceIcon>();
        await this.scanDirectoryOptimized({ dirPath: fullPath, category, svgFiles: folderSvgs, depth: 0, errors });
        return folderSvgs;
      },
      concurrency: this.config.concurrencyLimit,
      onProgress: (processed, total) => {
        onProgress?.({ phase: 'scanning', processed, total, percentage: Math.round((processed / total) * 100) });
      },
    });

    let truncated = false;
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
    return { filesScanned: svgFiles.size, truncated };
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
    const svgFolders = getSvgConfig<string[]>('svgFolders', []);

    onProgress?.({ phase: 'preparing', processed: 0 });

    const existingFolders = svgFolders
      .map(sf => path.join(folderPath, sf))
      .filter(fp => fs.existsSync(fp));

    const { filesScanned, truncated } = existingFolders.length > 0
      ? await this.scanConfiguredFolders({ existingFolders, svgFolders, svgFiles, errors, onProgress })
      : await this.scanAllSvgsOptimized({ folderPath, relativePath: '', svgFiles, depth: 0, errors, onProgress });

    onProgress?.({ phase: 'complete', processed: svgFiles.size, total: svgFiles.size, percentage: 100 });

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
   * Process SVG files from a list
   */
  private static processSvgFiles(
    svgFilesList: { fullPath: string; relPath: string; name: string }[],
    svgFiles: Map<string, WorkspaceIcon>,
    onProgress?: ProgressCallback
  ): { filesScanned: number; truncated: boolean } {
    let filesScanned = 0;
    for (const file of svgFilesList) {
      if (svgFiles.size >= this.config.maxFiles) return { filesScanned, truncated: true };
      if (shouldIgnorePath(file.fullPath)) continue;
      // Skip the output sprite.svg - it's a build artifact, not a source file
      if (this.isOutputSpriteSvg(file.fullPath)) continue;

      const iconName = path.basename(file.name, '.svg');
      const category = path.dirname(file.relPath) || 'root';

      svgFiles.set(file.fullPath, {
        name: iconName,
        path: file.fullPath,
        source: 'workspace',
        category: category === '.' ? 'root' : category,
        svg: undefined,
      });
      filesScanned++;

      if (onProgress && filesScanned % 100 === 0) {
        onProgress({ phase: 'scanning', processed: filesScanned, currentFile: file.fullPath });
      }
    }
    return { filesScanned, truncated: false };
  }

  /**
   * Process subdirectories concurrently
   */
  private static async processSubdirectories(
    directories: { fullPath: string; relPath: string }[],
    opts: ScanAllOptions
  ): Promise<{ filesScanned: number; truncated: boolean }> {
    const { svgFiles, depth, errors, onProgress } = opts;
    let filesScanned = 0;
    let truncated = false;

    const subResults = await ConcurrentProcessor.processConcurrent({
      items: directories,
      processor: async dir => {
        if (svgFiles.size >= this.config.maxFiles) return { filesScanned: 0, truncated: true };
        return this.scanAllSvgsOptimized({
          folderPath: dir.fullPath,
          relativePath: dir.relPath,
          svgFiles,
          depth: depth + 1,
          errors,
          onProgress,
        });
      },
      concurrency: Math.min(this.config.concurrencyLimit, directories.length),
    });

    for (const sub of subResults) {
      if (sub) {
        filesScanned += sub.filesScanned;
        if (sub.truncated) truncated = true;
      }
    }
    return { filesScanned, truncated };
  }

  /**
   * Optimized scan for entire folder using async directory reading
   */
  static async scanAllSvgsOptimized(opts: ScanAllOptions): Promise<{ filesScanned: number; truncated: boolean }> {
    const { folderPath, relativePath, svgFiles, depth, errors } = opts;

    if (!fs.existsSync(folderPath)) return { filesScanned: 0, truncated: false };
    if (depth > this.config.maxDepth) return { filesScanned: 0, truncated: true };
    if (shouldIgnorePath(folderPath)) return { filesScanned: 0, truncated: false };

    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });
      const svgFilesList: { fullPath: string; relPath: string; name: string }[] = [];
      const directories: { fullPath: string; relPath: string }[] = [];

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory() && !this.SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          directories.push({ fullPath, relPath });
        } else if (entry.isFile() && entry.name.endsWith('.svg')) {
          svgFilesList.push({ fullPath, relPath, name: entry.name });
        }
      }

      const result = this.processSvgFiles(svgFilesList, svgFiles, opts.onProgress);
      if (result.truncated || directories.length === 0) return result;

      const subResult = await this.processSubdirectories(directories, opts);
      return { filesScanned: result.filesScanned + subResult.filesScanned, truncated: subResult.truncated };
    } catch (error) {
      errors.push({
        filePath: folderPath,
        message: error instanceof Error ? error.message : String(error),
        code: (error as NodeJS.ErrnoException).code,
      });
      return { filesScanned: 0, truncated: false };
    }
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
    await this.scanAllSvgsOptimized({ folderPath, relativePath, svgFiles, depth: 0, errors });
  }

  /**
   * Process directory entries for SVG files
   */
  private static processDirectoryEntries(
    entries: fs.Dirent[],
    dirPath: string,
    category: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): { fullPath: string; category: string }[] {
    const directories: { fullPath: string; category: string }[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !this.SKIP_DIRS.has(entry.name)) {
        directories.push({ fullPath, category: `${category}/${entry.name}` });
      } else if (entry.isFile() && entry.name.endsWith('.svg')) {
        if (svgFiles.size >= this.config.maxFiles) break;
        if (shouldIgnorePath(fullPath)) continue;
        // Skip the output sprite.svg - it's a build artifact, not a source file
        if (this.isOutputSpriteSvg(fullPath)) continue;

        const iconName = path.basename(entry.name, '.svg');
        svgFiles.set(fullPath, {
          name: iconName,
          path: fullPath,
          source: 'workspace',
          category,
          svg: undefined,
        });
      }
    }
    return directories;
  }

  /**
   * Optimized directory scan with async operations
   */
  static async scanDirectoryOptimized(opts: ScanDirOptions): Promise<void> {
    const { dirPath, category, svgFiles, depth, errors } = opts;

    if (!fs.existsSync(dirPath)) return;
    if (depth > this.config.maxDepth) return;
    if (shouldIgnorePath(dirPath)) return;

    try {
      const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
      const directories = this.processDirectoryEntries(entries, dirPath, category, svgFiles);

      if (directories.length > 0) {
        await ConcurrentProcessor.processConcurrent({
          items: directories,
          processor: async dir => {
            await this.scanDirectoryOptimized({
              dirPath: dir.fullPath,
              category: dir.category,
              svgFiles,
              depth: depth + 1,
              errors,
            });
          },
          concurrency: Math.min(this.config.concurrencyLimit, directories.length),
        });
      }
    } catch (error) {
      errors.push({
        filePath: dirPath,
        message: error instanceof Error ? error.message : String(error),
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
    await this.scanDirectoryOptimized({ dirPath, category, svgFiles, depth: 0, errors });
  }

  /**
   * Get scanner statistics
   */
  static getConfig(): Readonly<ScannerConfig> {
    return { ...this.config };
  }
}

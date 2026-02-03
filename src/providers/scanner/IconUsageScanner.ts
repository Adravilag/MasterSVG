import * as vscode from 'vscode';
import { promises as fsPromises } from 'node:fs';
import { WorkspaceIcon, IconUsage } from '../../types/icons';
import {
  ScannerConfig,
  DEFAULT_SCANNER_CONFIG,
  ProgressCallback,
  ScanResult,
  ScanError,
} from '../../types/scanner';
import { ConcurrentProcessor } from '../../utils/ConcurrentProcessor';

/**
 * Result of scanning a file for icon usages
 */
interface FileUsageResult {
  usages: Map<string, IconUsage[]>;
  error?: ScanError;
}

/**
 * Scanner for icon component usages in the workspace
 * Optimized with combined regex patterns and concurrent processing
 */
export class IconUsageScanner {
  /**
   * File patterns to include in search
   */
  static readonly INCLUDE_PATTERN = '**/*.{ts,tsx,js,jsx,vue,html,svelte,astro}';

  /**
   * File patterns to exclude from search
   */
  static readonly EXCLUDE_PATTERN = '{' + [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/svgs/**',
    '**/coverage/**',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    '**/bun.lockb',
    '**/*.min.js',
  ].join(',') + '}';

  /**
   * Maximum number of files to search (legacy - now uses config)
   */
  static readonly MAX_FILES = 500;

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
   * Scan workspace for icon usages with optimized single-pass algorithm
   */
  static async scanIconUsages(
    libraryIcons: Map<string, WorkspaceIcon>,
    iconUsages: Map<string, IconUsage[]>,
    onProgress?: ProgressCallback
  ): Promise<ScanResult<Map<string, IconUsage[]>>> {
    const startTime = Date.now();
    const errors: ScanError[] = [];
    let truncated = false;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return {
        items: iconUsages,
        filesScanned: 0,
        itemsFound: 0,
        duration: Date.now() - startTime,
        truncated: false,
        errors: [],
      };
    }

    iconUsages.clear();

    // Get all icon names (built icons only)
    const iconNames: string[] = [];
    for (const [name, icon] of libraryIcons) {
      if (icon.isBuilt) {
        iconNames.push(name);
      }
    }

    if (iconNames.length === 0) {
      return {
        items: iconUsages,
        filesScanned: 0,
        itemsFound: 0,
        duration: Date.now() - startTime,
        truncated: false,
        errors: [],
      };
    }

    onProgress?.({ phase: 'preparing', processed: 0 });

    // Build optimized combined regex pattern for all icons at once
    // This is O(n) per file instead of O(n*m) where m is number of icons
    const escapedNames = iconNames.map(name => this.escapeRegex(name));
    const combinedPattern = new RegExp(`name=["'\`](${escapedNames.join('|')})["'\`]`, 'g');

    try {
      const files = await vscode.workspace.findFiles(
        this.INCLUDE_PATTERN,
        this.EXCLUDE_PATTERN,
        this.config.maxFiles
      );

      if (files.length >= this.config.maxFiles) {
        truncated = true;
      }

      onProgress?.({
        phase: 'scanning',
        processed: 0,
        total: files.length,
        percentage: 0,
      });

      // Process files concurrently with batching
      const results = await ConcurrentProcessor.processBatches<vscode.Uri, FileUsageResult | null>({
        items: files,
        processor: async file => this.processFileForUsages(file, combinedPattern),
        batchSize: this.config.batchSize,
        concurrency: this.config.concurrencyLimit,
        onBatchComplete: (batchIndex: number, _totalBatches: number) => {
          const processed = Math.min(batchIndex * this.config.batchSize, files.length);
          onProgress?.({
            phase: 'processing',
            processed,
            total: files.length,
            percentage: Math.round((processed / files.length) * 100),
          });
        },
      });

      // Merge results
      for (const result of results) {
        if (!result) continue;

        if (result.error) {
          errors.push(result.error);
        }

        for (const [iconName, usages] of result.usages) {
          const existing = iconUsages.get(iconName) || [];
          iconUsages.set(iconName, [...existing, ...usages]);
        }
      }

      // Update ALL built icons with usage counts (including 0)
      for (const [name, icon] of libraryIcons) {
        if (icon.isBuilt) {
          const usages = iconUsages.get(name) || [];
          icon.usages = usages;
          icon.usageCount = usages.length;
        }
      }

      onProgress?.({
        phase: 'complete',
        processed: files.length,
        total: files.length,
        percentage: 100,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        filePath: 'workspace',
        message: errorMessage,
      });
    }

    return {
      items: iconUsages,
      filesScanned: 0,
      itemsFound: iconUsages.size,
      duration: Date.now() - startTime,
      truncated,
      errors,
    };
  }

  /**
   * Process a single file for icon usages using combined regex
   */
  private static async processFileForUsages(
    file: vscode.Uri,
    combinedPattern: RegExp
  ): Promise<FileUsageResult | null> {
    const result: FileUsageResult = {
      usages: new Map(),
    };

    try {
      // Read file directly for performance
      const text = await fsPromises.readFile(file.fsPath, 'utf-8');

      // Quick check if file might contain any usages
      if (!text.includes('name=')) {
        return null;
      }

      // Reset regex for reuse
      combinedPattern.lastIndex = 0;

      let match;
      const lines = text.split('\n');

      while ((match = combinedPattern.exec(text)) !== null) {
        const iconName = match[1];

        // Calculate line number efficiently
        const textBeforeMatch = text.substring(0, match.index);
        const lineNumber = (textBeforeMatch.match(/\n/g) || []).length;
        const lineText = lines[lineNumber]?.trim() || '';

        if (!result.usages.has(iconName)) {
          result.usages.set(iconName, []);
        }

        const usages = result.usages.get(iconName)!;

        // Avoid duplicate entries for same file/line
        const existing = usages.find(u => u.file === file.fsPath && u.line === lineNumber + 1);
        if (!existing) {
          usages.push({
            file: file.fsPath,
            line: lineNumber + 1,
            preview: lineText.substring(0, 80),
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.error = {
        filePath: file.fsPath,
        message: errorMessage,
        code: (error as NodeJS.ErrnoException).code,
      };
    }

    return result.usages.size > 0 ? result : null;
  }

  /**
   * Escape special regex characters in icon names
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use findIconUsagesInFile instead
   */
  private static findIconUsagesInText(
    iconName: string,
    text: string,
    document: vscode.TextDocument,
    file: vscode.Uri,
    iconUsages: Map<string, IconUsage[]>
  ): void {
    // Search for icon usage patterns
    const patterns = [
      `name="${iconName}"`,
      `name='${iconName}'`,
      `name={\`${iconName}\`}`,
      `name={['"]${iconName}['"]}`,
    ];

    for (const pattern of patterns) {
      let index = 0;
      while ((index = text.indexOf(pattern.replace(/\[.+?\]/g, ''), index)) !== -1) {
        const actualMatch =
          text.indexOf(`name="${iconName}"`, index) !== -1 ||
          text.indexOf(`name='${iconName}'`, index) !== -1;
        if (actualMatch) {
          const position = document.positionAt(index);
          const line = position.line;
          const lineText = document.lineAt(line).text.trim();

          if (!iconUsages.has(iconName)) {
            iconUsages.set(iconName, []);
          }

          const usages = iconUsages.get(iconName)!;
          const existing = usages.find(u => u.file === file.fsPath && u.line === line + 1);

          if (!existing) {
            usages.push({
              file: file.fsPath,
              line: line + 1,
              preview: lineText.substring(0, 80),
            });
          }
        }
        index += iconName.length;
      }
    }
  }

  /**
   * Get current scanner configuration
   */
  static getConfig(): Readonly<ScannerConfig> {
    return { ...this.config };
  }
}

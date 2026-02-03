import * as vscode from 'vscode';
import { WorkspaceIcon, IconUsage } from '../../types/icons';
import { FileSvgScanner } from './FileSvgScanner';
import { InlineSvgScanner } from './InlineSvgScanner';
import { BuiltIconLoader } from '../tree/BuiltIconLoader';
import { IconUsageScanner } from './IconUsageScanner';
import { ScannerConfig, ProgressCallback, ScanResult } from '../../types/scanner';

/**
 * Scanner for SVG files, inline SVGs, and icon usages in the workspace.
 * This is now a facade that delegates to specialized scanners.
 * Optimized for large projects with progress reporting and configurable limits.
 */
export class SvgScanner {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Configure all scanners with the same settings
   */
  static configure(config: Partial<ScannerConfig>): void {
    FileSvgScanner.configure(config);
    InlineSvgScanner.configure(config);
    IconUsageScanner.configure(config);
  }

  /**
   * Reset all scanner configurations to defaults
   */
  static resetConfig(): void {
    FileSvgScanner.resetConfig();
    InlineSvgScanner.resetConfig();
    IconUsageScanner.resetConfig();
  }

  /**
   * Scan a folder for SVG files with optional progress reporting
   */
  async scanFolder(
    folderPath: string,
    svgFiles: Map<string, WorkspaceIcon>,
    onProgress?: ProgressCallback
  ): Promise<ScanResult<Map<string, WorkspaceIcon>>> {
    return FileSvgScanner.scanFolder(folderPath, svgFiles, onProgress);
  }

  /**
   * Load library icons from JSON file
   */
  loadLibraryIcons(libraryIcons: Map<string, WorkspaceIcon>): void {
    return BuiltIconLoader.loadLibraryIcons(libraryIcons);
  }

  /**
   * Load built icons from the output directory (icons.js or sprite.svg)
   */
  async loadBuiltIcons(
    libraryIcons: Map<string, WorkspaceIcon>,
    builtIcons: Set<string>
  ): Promise<void> {
    return BuiltIconLoader.loadBuiltIcons(libraryIcons, builtIcons);
  }

  /**
   * Scan all code files for inline <svg> elements and <img src="...svg"> references
   * with optional progress reporting
   */
  async scanInlineSvgs(
    inlineSvgs: Map<string, WorkspaceIcon>,
    svgReferences: Map<string, WorkspaceIcon[]>,
    builtIcons: Set<string>,
    onProgress?: ProgressCallback
  ): Promise<
    ScanResult<{
      inlineSvgs: Map<string, WorkspaceIcon>;
      svgReferences: Map<string, WorkspaceIcon[]>;
    }>
  > {
    return InlineSvgScanner.scanInlineSvgs(inlineSvgs, svgReferences, builtIcons, onProgress);
  }

  /**
   * Scan workspace for icon usages with optional progress reporting
   */
  async scanIconUsages(
    libraryIcons: Map<string, WorkspaceIcon>,
    iconUsages: Map<string, IconUsage[]>,
    onProgress?: ProgressCallback
  ): Promise<ScanResult<Map<string, IconUsage[]>>> {
    return IconUsageScanner.scanIconUsages(libraryIcons, iconUsages, onProgress);
  }
}

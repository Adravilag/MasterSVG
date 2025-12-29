import * as vscode from 'vscode';
import { WorkspaceIcon, IconUsage } from '../types/icons';
import { FileSvgScanner } from './FileSvgScanner';
import { InlineSvgScanner } from './InlineSvgScanner';
import { BuiltIconLoader } from './BuiltIconLoader';
import { IconUsageScanner } from './IconUsageScanner';

/**
 * Scanner for SVG files, inline SVGs, and icon usages in the workspace.
 * This is now a facade that delegates to specialized scanners.
 */
export class SvgScanner {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Scan a folder for SVG files
   */
  async scanFolder(
    folderPath: string,
    svgFiles: Map<string, WorkspaceIcon>
  ): Promise<void> {
    return FileSvgScanner.scanFolder(folderPath, svgFiles);
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
   */
  async scanInlineSvgs(
    inlineSvgs: Map<string, WorkspaceIcon>,
    svgReferences: Map<string, WorkspaceIcon[]>,
    builtIcons: Set<string>
  ): Promise<void> {
    return InlineSvgScanner.scanInlineSvgs(inlineSvgs, svgReferences, builtIcons);
  }

  /**
   * Scan workspace for icon usages
   */
  async scanIconUsages(
    libraryIcons: Map<string, WorkspaceIcon>,
    iconUsages: Map<string, IconUsage[]>
  ): Promise<void> {
    return IconUsageScanner.scanIconUsages(libraryIcons, iconUsages);
  }
}


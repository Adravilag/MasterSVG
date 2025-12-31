/**
 * IconRemovalService
 *
 * Handles removal of icons from the built icons file (icons.js).
 * Extracted from WorkspaceSvgProvider for better separation of concerns.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig } from '../utils/config';
import { removeIconExportFromContent } from '../utils/outputFileManager';

/**
 * Result of icon removal operation
 */
export interface IconRemovalResult {
  success: boolean;
  removed: string[];
  errors: string[];
}

/**
 * Service for removing icons from the icons.js file
 */
export class IconRemovalService {
  /**
   * Remove icons from the icons.js file
   * @param iconNames Names of icons to remove
   * @param builtIcons Set of built icon names (will be modified)
   * @param libraryIcons Map of library icons (will be modified)
   * @returns Result with success status, removed icons, and errors
   */
  static async removeIcons(
    iconNames: string[],
    builtIcons: Set<string>,
    libraryIcons: Map<string, unknown>
  ): Promise<IconRemovalResult> {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    const removed: string[] = [];
    const errors: string[] = [];

    // Validate configuration
    if (!outputDir) {
      return { success: false, removed, errors: ['No output directory configured'] };
    }

    // Validate workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return { success: false, removed, errors: ['No workspace folder found'] };
    }

    // Locate icons.js file
    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const iconsJsPath = path.join(fullOutputPath, 'icons.js');

    if (!fs.existsSync(iconsJsPath)) {
      return { success: false, removed, errors: ['icons.js not found'] };
    }

    try {
      let content = fs.readFileSync(iconsJsPath, 'utf-8');

      // Remove each icon
      for (const iconName of iconNames) {
        const originalContent = content;
        content = removeIconExportFromContent(content, iconName);

        if (content !== originalContent) {
          removed.push(iconName);
          builtIcons.delete(iconName);
          libraryIcons.delete(iconName);
        } else {
          errors.push(`Could not find icon: ${iconName}`);
        }
      }

      // Clean up extra blank lines
      content = content.replace(/\n{3,}/g, '\n\n');

      // Write back to file
      fs.writeFileSync(iconsJsPath, content);

      return { success: removed.length > 0, removed, errors };
    } catch (error) {
      return { success: false, removed, errors: [`Error: ${error}`] };
    }
  }

  /**
   * Get the icons.js file path if it exists
   * @returns Path to icons.js or undefined if not found
   */
  static getIconsJsPath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    if (!outputDir) return undefined;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined;

    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const iconsJsPath = path.join(fullOutputPath, 'icons.js');

    return fs.existsSync(iconsJsPath) ? iconsJsPath : undefined;
  }
}

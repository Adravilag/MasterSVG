/**
 * IconRemovalService
 *
 * Handles removal of icons from the built icons file (icons.js or sprite.svg).
 * Extracted from WorkspaceSvgProvider for better separation of concerns.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig } from '../../utils/config';
import { getConfig } from '../../utils/configHelper';
import {
  removeIconExportFromContent,
  removeSymbolFromSpriteContent,
} from '../../utils/outputFileManager';
import { IconRemovalResult as CentralizedIconRemovalResult } from '../types/mastersvgTypes';

// Re-export for backwards compatibility
export type IconRemovalResult = CentralizedIconRemovalResult;

/**
 * Service for removing icons from the icons.js or sprite.svg file
 */
export class IconRemovalService {
  /**
   * Remove icons from the built icons file (icons.js or sprite.svg)
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

    // Determine build format
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';

    // Locate target file based on build format
    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const targetFile = isSprite
      ? path.join(fullOutputPath, 'sprite.svg')
      : path.join(fullOutputPath, 'icons.js');

    if (!fs.existsSync(targetFile)) {
      return {
        success: false,
        removed,
        errors: [`${isSprite ? 'sprite.svg' : 'icons.js'} not found`],
      };
    }

    try {
      let content = fs.readFileSync(targetFile, 'utf-8');

      // Remove each icon using the appropriate method
      for (const iconName of iconNames) {
        const originalContent = content;

        if (isSprite) {
          content = removeSymbolFromSpriteContent(content, iconName);
        } else {
          content = removeIconExportFromContent(content, iconName);
        }

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
      fs.writeFileSync(targetFile, content);

      return { success: removed.length > 0, removed, errors };
    } catch (error) {
      return { success: false, removed, errors: [`Error: ${error}`] };
    }
  }

  /**
   * Get the built icons file path if it exists (icons.js or sprite.svg)
   * @returns Path to the built icons file or undefined if not found
   */
  static getBuiltIconsPath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    if (!outputDir) return undefined;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined;

    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';

    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const targetFile = isSprite
      ? path.join(fullOutputPath, 'sprite.svg')
      : path.join(fullOutputPath, 'icons.js');

    return fs.existsSync(targetFile) ? targetFile : undefined;
  }

  /**
   * Get the icons.js file path if it exists
   * @returns Path to icons.js or undefined if not found
   * @deprecated Use getBuiltIconsPath() instead
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

  /**
   * Get the sprite.svg file path if it exists
   * @returns Path to sprite.svg or undefined if not found
   */
  static getSpriteSvgPath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    if (!outputDir) return undefined;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return undefined;

    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    const spriteSvgPath = path.join(fullOutputPath, 'sprite.svg');

    return fs.existsSync(spriteSvgPath) ? spriteSvgPath : undefined;
  }
}

/**
 * Icon Persistence Service
 *
 * Handles saving/updating icons to sprite.svg and icons.js files,
 * as well as regenerating TypeScript definition files.
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SvgTransformer } from './SvgTransformer';
import { ErrorHandler } from '../utils/errorHandler';
import { getSvgConfig } from '../utils/config';
import { toVariableName } from '../utils/extensionHelpers';
import { t } from '../i18n';

export class IconPersistenceService {
  private static _instance: IconPersistenceService;

  private constructor() {}

  public static getInstance(): IconPersistenceService {
    if (!IconPersistenceService._instance) {
      IconPersistenceService._instance = new IconPersistenceService();
    }
    return IconPersistenceService._instance;
  }

  /**
   * Get the output path for generated icon files.
   *
   * Combines the workspace root with the configured output directory.
   *
   * @returns The absolute path to the output directory, or undefined if no workspace is open
   * @example
   * ```typescript
   * const outputPath = service.getOutputPath();
   * // Returns: '/workspace/icons' (based on config)
   * ```
   */
  public getOutputPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const outputDir = getSvgConfig<string>('outputDirectory', 'icons');
    if (!workspaceFolders || !outputDir) return undefined;
    return path.join(workspaceFolders[0].uri.fsPath, outputDir);
  }

  /**
   * Get the full path to the svg-data.js file.
   *
   * This file contains all icon definitions as JavaScript exports.
   *
   * @returns Absolute path to svg-data.js, or undefined if workspace unavailable
   * @example
   * ```typescript
   * const filePath = service.getIconsFilePath();
   * // Returns: '/workspace/icons/svg-data.js'
   * ```
   */
  public getIconsFilePath(): string | undefined {
    const outputPath = this.getOutputPath();
    if (!outputPath) return undefined;
    return path.join(outputPath, 'svg-data.js');
  }

  /**
   * Update an existing icon in a sprite.svg file.
   *
   * Finds the symbol by ID and replaces its content and viewBox.
   * Also regenerates the TypeScript definition file.
   *
   * @param iconName - The icon identifier (must match symbol id in sprite)
   * @param svg - The new SVG content to replace with
   * @param spriteFile - Absolute path to the sprite.svg file
   * @param viewBox - Optional viewBox value; extracted from svg if not provided
   * @returns Promise resolving to true if update succeeded, false otherwise
   * @example
   * ```typescript
   * const success = await service.updateSpriteFile(
   *   'home',
   *   '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
   *   '/workspace/icons/sprite.svg'
   * );
   * ```
   */
  public async updateSpriteFile(
    iconName: string,
    svg: string,
    spriteFile: string,
    viewBox?: string
  ): Promise<boolean> {
    if (!iconName || !spriteFile) {
      return false;
    }

    if (!fs.existsSync(spriteFile)) {
      return false;
    }

    try {
      let spriteContent = fs.readFileSync(spriteFile, 'utf-8');

      // Use extractSvgBody to properly clean animation styles/wrappers
      const transformer = new SvgTransformer();
      const newContent = transformer.extractSvgBody(svg);

      // Extract viewBox from the SVG
      const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
      const newViewBox = viewBoxMatch ? viewBoxMatch[1] : viewBox || '0 0 24 24';

      // Find and replace the symbol in the sprite
      const symbolPattern = new RegExp(
        `(<symbol[^>]*id=["']${iconName}["'][^>]*viewBox=["'])([^"']+)(["'][^>]*>)[\\s\\S]*?(<\\/symbol>)`,
        'i'
      );

      const symbolMatch = spriteContent.match(symbolPattern);

      if (symbolMatch) {
        // Replace viewBox and content
        const newSymbol = `${symbolMatch[1]}${newViewBox}${symbolMatch[3]}${newContent}${symbolMatch[4]}`;
        spriteContent = spriteContent.replace(symbolPattern, newSymbol);

        fs.writeFileSync(spriteFile, spriteContent, 'utf-8');

        // Regenerate .d.ts with icon names from sprite
        await this.regenerateTypesFromSprite(spriteFile, spriteContent);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating sprite file:', error);
      return false;
    }
  }

  /**
   * Update an existing icon in the svg-data.js file.
   *
   * Searches for the icon export and replaces its body content.
   * Supports legacy icons.js filename for backward compatibility.
   *
   * @param iconName - The icon name (will be converted to variable format)
   * @param svg - The new SVG content
   * @returns Promise resolving to true if update succeeded, false otherwise
   * @example
   * ```typescript
   * const success = await service.updateBuiltIconsFile(
   *   'arrow-left',
   *   '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>'
   * );
   * ```
   */
  public async updateBuiltIconsFile(iconName: string, svg: string): Promise<boolean> {
    if (!iconName) {
      return false;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    // Get output directory from config
    const outputDir = getSvgConfig<string>('outputDirectory', 'icons');

    // Look for svg-data.js in configured output and common locations (with legacy fallbacks)
    const possiblePaths = outputDir
      ? [`${outputDir}/svg-data.js`, `${outputDir}/icons.js`, 'svg/icons.js', 'icons.js']
      : [
          'icons/svg-data.js',
          'icons/icons.js',
          'svg/icons.js',
          'dist/icons.js',
          'build/icons.js',
          'public/icons.js',
          'src/icons.js',
          'icons.js',
        ];

    for (const folder of workspaceFolders) {
      for (const relativePath of possiblePaths) {
        const iconsUri = vscode.Uri.joinPath(folder.uri, relativePath);

        try {
          const document = await vscode.workspace.openTextDocument(iconsUri);

          // File found, attempt update with error handling
          const result = await ErrorHandler.wrapAsync(async () => {
            const text = document.getText();

            // Convert icon name to variable name format
            const varName = toVariableName(iconName);

            // Use extractSvgBody to properly clean animation styles/wrappers
            const transformer = new SvgTransformer();
            const body = transformer.extractSvgBody(svg);

            // Find the icon export and replace the body content
            const iconStartPattern = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*\\{`);
            const match = iconStartPattern.exec(text);

            if (match) {
              const startIdx = match.index;
              const afterStart = text.substring(startIdx);
              const bodyStartMatch = afterStart.match(/body:\s*`/);

              if (bodyStartMatch?.index !== undefined) {
                const bodyContentStart = startIdx + bodyStartMatch.index + bodyStartMatch[0].length;

                // Find closing backtick (handle escaped backticks)
                let bodyContentEnd = bodyContentStart;
                let i = bodyContentStart;
                while (i < text.length) {
                  if (text[i] === '\\' && text[i + 1] === '`') {
                    i += 2; // Skip escaped backtick
                  } else if (text[i] === '`') {
                    bodyContentEnd = i;
                    break;
                  } else {
                    i++;
                  }
                }

                if (bodyContentEnd > bodyContentStart) {
                  // Escape backticks and dollar signs in body
                  const escapedBody = body.replace(/`/g, '\\`').replace(/\$/g, '\\$');

                  const newText =
                    text.substring(0, bodyContentStart) +
                    escapedBody +
                    text.substring(bodyContentEnd);

                  const edit = new vscode.WorkspaceEdit();
                  const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                  );
                  edit.replace(iconsUri, fullRange, newText);
                  await vscode.workspace.applyEdit(edit);
                  await document.save();

                  vscode.window.showInformationMessage(
                    t('messages.updatedFile', { path: relativePath })
                  );
                  return { success: true, path: iconsUri.fsPath, content: newText };
                }
              }
            }
            return { success: false, path: '', content: '' };
          }, `updating icons.js at ${relativePath}`);

          if (result?.success && result.path && result.content) {
            await this.regenerateTypesFromIconsFile(result.path, result.content);
            return true;
          }
        } catch {
          // File doesn't exist at this path, continue searching
          continue;
        }
      }
    }
    return false;
  }

  /**
   * Regenerate icons.d.ts based on icons in sprite.svg
   */
  public async regenerateTypesFromSprite(spritePath: string, content: string): Promise<void> {
    // Extract all symbol IDs from sprite
    const symbolPattern = /<symbol[^>]*id=["']([^"']+)["']/gi;
    const iconNames: string[] = [];
    let match;
    while ((match = symbolPattern.exec(content)) !== null) {
      iconNames.push(match[1]);
    }

    if (iconNames.length === 0) return;

    // Generate .d.ts in same directory as sprite
    const outputDir = path.dirname(spritePath);
    await this.writeTypesFile(outputDir, iconNames);
  }

  /**
   * Regenerate icons.d.ts based on icons in icons.js
   */
  public async regenerateTypesFromIconsFile(iconsPath: string, content: string): Promise<void> {
    // Extract all exported icon names (export const iconName = { ...)
    const exportPattern = /export\s+const\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*\{/g;
    const iconNames: string[] = [];
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      // Convert camelCase back to kebab-case for .d.ts
      const varName = match[1];
      const kebabName = varName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      iconNames.push(kebabName);
    }

    if (iconNames.length === 0) return;

    // Generate .d.ts in same directory as icons.js
    const outputDir = path.dirname(iconsPath);
    await this.writeTypesFile(outputDir, iconNames);
  }

  /**
   * Write icons.d.ts file with given icon names
   */
  public async writeTypesFile(outputDir: string, iconNames: string[]): Promise<void> {
    const typesPath = path.join(outputDir, 'icons.d.ts');
    const sortedNames = [...iconNames].sort((a, b) => a.localeCompare(b));

    const content = `// Auto-generated by MasterSVG
// Do not edit manually

export type IconName = ${sortedNames.map(n => `'${n}'`).join(' | ')};

export const iconNames = [
${sortedNames.map(n => `  '${n}'`).join(',\n')}
] as const;

export type IconNameTuple = typeof iconNames;

/**
 * Check if a string is a valid icon name
 */
export function isValidIconName(name: string): name is IconName {
  return iconNames.includes(name as IconName);
}
`;

    const uri = vscode.Uri.file(typesPath);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
  }

  /**
   * Ensure SVG has an ID attribute for animation/variation reference
   */
  public ensureSvgId(svg: string, iconName: string): string {
    // Check if SVG already has an id
    const hasId = /<svg[^>]*\sid=["'][^"']+["']/i.test(svg);
    if (hasId) {
      return svg;
    }

    // Generate ID from icon name (kebab-case to valid ID)
    const id = `bz-${iconName.replace(/[^a-zA-Z0-9-]/g, '-')}`;

    // Add id attribute to SVG tag
    return svg.replace(/<svg/, `<svg id="${id}"`);
  }
}

/**
 * Get the singleton instance
 */
export function getIconPersistenceService(): IconPersistenceService {
  return IconPersistenceService.getInstance();
}

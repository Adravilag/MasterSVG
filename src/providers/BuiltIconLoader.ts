import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig } from '../utils/config';
import { WorkspaceIcon, IconAnimation } from '../types/icons';

/**
 * Loader for built icons from output directory
 */
export class BuiltIconLoader {
  /**
   * Load library icons from JSON file
   */
  static loadLibraryIcons(libraryIcons: Map<string, WorkspaceIcon>): void {
    const libraryPath = getSvgConfig<string>('libraryPath', '');

    if (!libraryPath) {
      // Try default AppData location
      const appDataPath = process.env.APPDATA || process.env.HOME || '';
      const defaultPath = path.join(appDataPath, 'icon-manager', 'icons.json');
      
      if (fs.existsSync(defaultPath)) {
        this.loadIconsFromJson(defaultPath, libraryIcons);
      }
    } else if (fs.existsSync(libraryPath)) {
      this.loadIconsFromJson(libraryPath, libraryIcons);
    }
  }

  /**
   * Load icons from JSON file
   */
  private static loadIconsFromJson(jsonPath: string, libraryIcons: Map<string, WorkspaceIcon>): void {
    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const icons = JSON.parse(content);

      if (Array.isArray(icons)) {
        for (const icon of icons) {
          libraryIcons.set(icon.name, {
            name: icon.name,
            path: jsonPath,
            source: 'library',
            category: icon.name.includes(':') ? icon.name.split(':')[0] : 'custom',
            svg: icon.svg || icon.body
          });
        }
      }
    } catch (error) {
      console.error('Error loading library icons:', error);
    }
  }

  /**
   * Load built icons from the output directory (icons.js or sprite.svg)
   */
  static async loadBuiltIcons(
    libraryIcons: Map<string, WorkspaceIcon>,
    builtIcons: Set<string>
  ): Promise<void> {
    builtIcons.clear();
    
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    
    if (!outputDir) return;
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    
    const fullOutputPath = path.join(workspaceFolders[0].uri.fsPath, outputDir);
    
    // Try to load from icons.js (or legacy icons.js/icons.ts)
    const iconsBzJs = path.join(fullOutputPath, 'icons.js');
    const iconsJs = path.join(fullOutputPath, 'icons.js');
    const iconsTs = path.join(fullOutputPath, 'icons.ts');
    const iconsFile = fs.existsSync(iconsBzJs) ? iconsBzJs : (fs.existsSync(iconsJs) ? iconsJs : (fs.existsSync(iconsTs) ? iconsTs : null));
    
    console.log('[Icon Studio] Looking for icons in:', fullOutputPath);
    
    if (iconsFile) {
      await this.loadIconsFromJsFile(iconsFile, libraryIcons, builtIcons);
    } else {
      console.log('[Icon Studio] No icons file found in output directory');
    }
    
    // Try to load from sprite.svg
    const spriteSvg = path.join(fullOutputPath, 'sprite.svg');
    if (fs.existsSync(spriteSvg)) {
      this.loadIconsFromSprite(spriteSvg, libraryIcons, builtIcons);
    }
  }

  /**
   * Load icons from JS file
   */
  private static async loadIconsFromJsFile(
    iconsFile: string,
    libraryIcons: Map<string, WorkspaceIcon>,
    builtIcons: Set<string>
  ): Promise<void> {
    try {
      // Use VS Code API to ensure we get the latest content (not cached)
      const uri = vscode.Uri.file(iconsFile);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf-8');
      
      console.log('[Icon Studio] Reading icons file, length:', content.length);
      
      // Regex to match icon exports - capture everything including optional animation
      const iconRegex = /export\s+const\s+(\w+)\s*=\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*body:\s*`([\s\S]*?)`\s*,\s*viewBox:\s*['"]([^'"]+)['"](?:\s*,\s*animation:\s*\{([^}]*)\})?\s*\}/g;
      let match;
      
      while ((match = iconRegex.exec(content)) !== null) {
        const iconName = match[2];
        const body = match[3];
        const viewBox = match[4];
        const animationStr = match[5];
        
        builtIcons.add(iconName);
        
        // Create a full SVG from the body
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
        
        // Parse animation if present
        const animation = this.parseAnimation(animationStr);
        
        // Add to library icons so hover can find it
        libraryIcons.set(iconName, {
          name: iconName,
          path: iconsFile,
          source: 'library',
          category: 'built',
          svg: svg,
          isBuilt: true,
          animation
        });
        
        console.log('[Icon Studio] Loaded icon:', iconName, animation ? `with animation: ${animation.type}` : '');
      }
      
      console.log('[Icon Studio] Total built icons loaded:', builtIcons.size);
    } catch (error) {
      console.error('Error loading built icons:', error);
    }
  }

  /**
   * Parse animation string from icon definition
   */
  static parseAnimation(animationStr: string | undefined): IconAnimation | undefined {
    if (!animationStr) return undefined;
    
    try {
      const typeMatch = animationStr.match(/type:\s*['"]([^'"]+)['"]/);
      const durationMatch = animationStr.match(/duration:\s*([\d.]+)/);
      const timingMatch = animationStr.match(/timing:\s*['"]([^'"]+)['"]/);
      const iterationMatch = animationStr.match(/iteration:\s*['"]([^'"]+)['"]/);
      const delayMatch = animationStr.match(/delay:\s*([\d.]+)/);
      const directionMatch = animationStr.match(/direction:\s*['"]([^'"]+)['"]/);
      
      if (typeMatch) {
        return {
          type: typeMatch[1],
          duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
          timing: timingMatch ? timingMatch[1] : 'ease',
          iteration: iterationMatch ? iterationMatch[1] : 'infinite',
          delay: delayMatch ? parseFloat(delayMatch[1]) : undefined,
          direction: directionMatch ? directionMatch[1] : undefined
        };
      }
    } catch (e) {
      console.warn('[Icon Studio] Failed to parse animation');
    }
    return undefined;
  }

  /**
   * Load icons from sprite SVG
   */
  private static loadIconsFromSprite(
    spriteSvg: string,
    libraryIcons: Map<string, WorkspaceIcon>,
    builtIcons: Set<string>
  ): void {
    try {
      const content = fs.readFileSync(spriteSvg, 'utf-8');
      // Extract symbols with their content
      const symbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
      let match;
      while ((match = symbolRegex.exec(content)) !== null) {
        const iconName = match[1];
        const viewBox = match[2];
        const body = match[3];
        
        builtIcons.add(iconName);
        
        // Create a full SVG from the symbol
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
        
        // Add to library icons if not already there
        if (!libraryIcons.has(iconName)) {
          libraryIcons.set(iconName, {
            name: iconName,
            path: spriteSvg,
            source: 'library',
            category: 'built',
            svg: svg,
            isBuilt: true
          });
        }
      }
      console.log('[Icon Studio] Loaded built icons from sprite.svg:', builtIcons.size);
    } catch (error) {
      console.error('Error loading built icons from sprite.svg:', error);
    }
  }
}


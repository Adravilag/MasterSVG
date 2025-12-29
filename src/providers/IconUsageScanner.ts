import * as vscode from 'vscode';
import { WorkspaceIcon, IconUsage } from '../types/icons';

/**
 * Scanner for icon component usages in the workspace
 */
export class IconUsageScanner {
  /**
   * File patterns to include in search
   */
  static readonly INCLUDE_PATTERN = '**/*.{ts,tsx,js,jsx,vue,html,svelte,astro}';

  /**
   * File patterns to exclude from search
   */
  static readonly EXCLUDE_PATTERN = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/svgs/**';

  /**
   * Maximum number of files to search
   */
  static readonly MAX_FILES = 500;

  /**
   * Scan workspace for icon usages
   */
  static async scanIconUsages(
    libraryIcons: Map<string, WorkspaceIcon>,
    iconUsages: Map<string, IconUsage[]>
  ): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    console.log('[Bezier] Scanning for icon usages...');
    iconUsages.clear();
    
    // Get all icon names (built icons only for now)
    const iconNames = new Set<string>();
    for (const [name, icon] of libraryIcons) {
      if (icon.isBuilt) {
        iconNames.add(name);
      }
    }

    if (iconNames.size === 0) {
      return;
    }

    try {
      const files = await vscode.workspace.findFiles(
        this.INCLUDE_PATTERN,
        this.EXCLUDE_PATTERN,
        this.MAX_FILES
      );
      
      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();
          
          for (const iconName of iconNames) {
            this.findIconUsagesInText(iconName, text, document, file, iconUsages);
          }
        } catch {
          // Skip files that can't be read
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
      
      console.log('[Bezier] Usage scan complete. Icons with usages:', iconUsages.size);
    } catch (error) {
      console.error('[Bezier] Error scanning usages:', error);
    }
  }

  /**
   * Find usages of a specific icon in text
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
      `name={['"]${iconName}['"]}`
    ];
    
    for (const pattern of patterns) {
      let index = 0;
      while ((index = text.indexOf(pattern.replace(/\[.+?\]/g, ''), index)) !== -1) {
        const actualMatch = text.indexOf(`name="${iconName}"`, index) !== -1 || 
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
              preview: lineText.substring(0, 80)
            });
          }
        }
        index += iconName.length;
      }
    }
  }
}

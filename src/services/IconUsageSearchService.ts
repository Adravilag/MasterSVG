import * as vscode from 'vscode';

/**
 * Service for finding icon usages across the workspace
 */
export class IconUsageSearchService {
  /**
   * Search patterns for icon usage
   */
  static getSearchPatterns(iconName: string): string[] {
    return [
      `name="${iconName}"`, // <svg-icon name="icon-name">
      `name='${iconName}'`, // <svg-icon name='icon-name'>
      `"${iconName}"`, // General string reference
      `'${iconName}'`, // General string reference
      `icon-${iconName}`, // CSS class pattern
      `.${iconName}`, // Class selector
      `#${iconName}`, // ID selector
    ];
  }

  /**
   * File patterns to include in search
   */
  static readonly INCLUDE_PATTERN = '**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,svelte,astro}';

  /**
   * File patterns to exclude from search
   */
  static readonly EXCLUDE_PATTERN = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**';

  /**
   * Maximum number of files to search
   */
  static readonly MAX_FILES = 500;

  /**
   * Maximum results to return
   */
  static readonly MAX_RESULTS = 50;

  /**
   * Find all usages of an icon in the workspace
   */
  static async findUsages(iconName: string): Promise<{
    usages: Array<{ file: string; line: number; preview: string }>;
    total: number;
  }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return { usages: [], total: 0 };
    }

    const usages: { file: string; line: number; preview: string }[] = [];
    const patterns = this.getSearchPatterns(iconName);

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

          for (const pattern of patterns) {
            let index = 0;
            while ((index = text.indexOf(pattern, index)) !== -1) {
              const position = document.positionAt(index);
              const line = position.line;
              const lineText = document.lineAt(line).text.trim();

              // Avoid duplicates on same line
              const existing = usages.find(u => u.file === file.fsPath && u.line === line + 1);
              if (!existing) {
                usages.push({
                  file: file.fsPath,
                  line: line + 1,
                  preview: lineText.substring(0, 80) + (lineText.length > 80 ? '...' : ''),
                });
              }
              index += pattern.length;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Sort by file and line
      usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

      return {
        usages: usages.slice(0, this.MAX_RESULTS),
        total: usages.length,
      };
    } catch {
      return { usages: [], total: 0 };
    }
  }

  /**
   * Navigate to a specific file location
   */
  static async goToLocation(file: string, line: number): Promise<void> {
    const uri = vscode.Uri.file(file);
    const position = new vscode.Position(line - 1, 0);
    await vscode.window.showTextDocument(uri, {
      selection: new vscode.Range(position, position),
      preview: true,
    });
  }
}

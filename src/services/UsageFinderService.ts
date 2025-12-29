/**
 * Usage Finder Service
 * Searches for icon usages across the workspace
 */
import * as vscode from 'vscode';

export interface IconUsage {
  file: string;
  relativePath: string;
  line: number;
  column: number;
  text: string;
  context: string;
}

export class UsageFinderService {
  /**
   * Find all usages of an icon in the workspace
   */
  async findIconUsages(iconName: string): Promise<IconUsage[]> {
    const usages: IconUsage[] = [];

    // Build search patterns for the icon name
    const patterns = this.buildSearchPatterns(iconName);
    
    // Search in common file types that might contain icon references
    const filePatterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.vue', '**/*.svelte',
      '**/*.html', '**/*.css', '**/*.scss', '**/*.less',
      '**/*.json'
    ];

    for (const filePattern of filePatterns) {
      const files = await vscode.workspace.findFiles(filePattern, '**/node_modules/**');
      
      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();
          
          for (const pattern of patterns) {
            const matches = this.findMatches(text, pattern);
            
            for (const match of matches) {
              const position = document.positionAt(match.index);
              const lineText = document.lineAt(position.line).text;
              
              // Avoid duplicates
              const existingUsage = usages.find(
                u => u.file === file.fsPath && u.line === position.line + 1
              );
              
              if (!existingUsage) {
                usages.push({
                  file: file.fsPath,
                  relativePath: vscode.workspace.asRelativePath(file),
                  line: position.line + 1,
                  column: position.character + 1,
                  text: lineText.trim(),
                  context: this.getContext(document, position.line)
                });
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }

    // Sort by file path and line number
    return usages.sort((a, b) => {
      const pathCompare = a.relativePath.localeCompare(b.relativePath);
      return pathCompare !== 0 ? pathCompare : a.line - b.line;
    });
  }

  /**
   * Build search patterns for different naming conventions
   */
  private buildSearchPatterns(iconName: string): string[] {
    const patterns: string[] = [];
    
    // Exact match (case sensitive)
    patterns.push(iconName);
    
    // With quotes (for string references)
    patterns.push(`"${iconName}"`);
    patterns.push(`'${iconName}'`);
    
    // Common prefix patterns
    patterns.push(`icon-${iconName}`);
    patterns.push(`icon:${iconName}`);
    
    // As a component or identifier
    const pascalCase = this.toPascalCase(iconName);
    if (pascalCase !== iconName) {
      patterns.push(pascalCase);
    }
    
    return patterns;
  }

  /**
   * Find all matches of a pattern in text
   */
  private findMatches(text: string, pattern: string): { index: number }[] {
    const matches: { index: number }[] = [];
    let index = 0;
    
    while ((index = text.indexOf(pattern, index)) !== -1) {
      matches.push({ index });
      index += pattern.length;
    }
    
    return matches;
  }

  /**
   * Get context around a line (1 line before and after)
   */
  private getContext(document: vscode.TextDocument, line: number): string {
    const lines: string[] = [];
    const start = Math.max(0, line - 1);
    const end = Math.min(document.lineCount - 1, line + 1);
    
    for (let i = start; i <= end; i++) {
      lines.push(document.lineAt(i).text);
    }
    
    return lines.join('\n');
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toUpperCase());
  }
}

// Singleton instance
let usageFinderInstance: UsageFinderService | undefined;

export function getUsageFinderService(): UsageFinderService {
  if (!usageFinderInstance) {
    usageFinderInstance = new UsageFinderService();
  }
  return usageFinderInstance;
}


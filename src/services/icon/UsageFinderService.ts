/**
 * Usage Finder Service
 * Searches for icon usages across the workspace
 */
import * as vscode from 'vscode';
import type { IconUsageInfo } from '../types';

// Re-export for backwards compatibility
export type IconUsage = IconUsageInfo;

export class UsageFinderService {
  /**
   * Directories and files to exclude from usage search
   */
  private static readonly EXCLUDE_PATTERN = '{' + [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    '**/bun.lockb',
    '**/*.min.js',
    '**/*.min.css',
  ].join(',') + '}';

  /**
   * Find all usages of an icon in the workspace.
   * For inline SVGs (auto-generated names), pass location to find the SVG at its origin.
   */
  async findIconUsages(
    iconName: string,
    location?: { file: string; line: number }
  ): Promise<IconUsage[]> {
    const usages: IconUsage[] = [];

    // For inline SVGs with auto-generated names, add the origin as a known usage
    if (location?.file) {
      const originUsage = await this.extractOriginUsage(location);
      if (originUsage) {
        usages.push(originUsage);
      }
    }

    // Build search patterns and scan workspace files
    const patterns = this.buildSearchPatterns(iconName);
    const files = await this.findWorkspaceFiles();

    for (const file of files) {
      const fileUsages = await this.scanFileForUsages(file, patterns, usages);
      usages.push(...fileUsages);
    }

    return usages.sort((a, b) => {
      const pathCompare = a.relativePath.localeCompare(b.relativePath);
      return pathCompare !== 0 ? pathCompare : a.line - b.line;
    });
  }

  /**
   * Find all workspace files matching supported extensions
   */
  private async findWorkspaceFiles(): Promise<vscode.Uri[]> {
    const filePatterns = [
      '**/*.{ts,tsx,js,jsx,vue,svelte,html,css,scss,less,json}',
    ];
    const allFiles: vscode.Uri[] = [];
    for (const pattern of filePatterns) {
      const files = await vscode.workspace.findFiles(pattern, UsageFinderService.EXCLUDE_PATTERN);
      allFiles.push(...files);
    }
    return allFiles;
  }

  /**
   * Scan a single file for icon usage matches
   */
  private async scanFileForUsages(
    file: vscode.Uri,
    patterns: string[],
    existingUsages: IconUsage[]
  ): Promise<IconUsage[]> {
    const newUsages: IconUsage[] = [];
    try {
      const document = await vscode.workspace.openTextDocument(file);
      const text = document.getText();

      for (const pattern of patterns) {
        const matches = this.findMatches(text, pattern);
        for (const match of matches) {
          const usage = this.resolveMatch({
            document, file, text,
            matchIndex: match.index,
            allUsages: [...existingUsages, ...newUsages],
          });
          if (usage) newUsages.push(usage);
        }
      }
    } catch {
      // Skip files that can't be read
    }
    return newUsages;
  }

  /**
   * Resolve a single match into an IconUsage, deduplicating against existing results
   */
  private resolveMatch(params: {
    document: vscode.TextDocument;
    file: vscode.Uri;
    text: string;
    matchIndex: number;
    allUsages: IconUsage[];
  }): IconUsage | null {
    const { document, file, text, matchIndex, allUsages } = params;
    const position = document.positionAt(matchIndex);
    const lineText = document.lineAt(position.line).text;

    const fullSvg = this.extractFullSvgIfInline(text, matchIndex);
    const fullElement = !fullSvg ? this.extractFullElement(text, matchIndex) : null;

    const displayText = fullSvg || fullElement?.text || lineText.trim();
    const usageLine = fullElement
      ? document.positionAt(fullElement.startOffset).line + 1
      : position.line + 1;

    const isDuplicate = allUsages.some(
      u => u.file === file.fsPath && u.line === usageLine
    );
    if (isDuplicate) return null;

    return {
      file: file.fsPath,
      relativePath: vscode.workspace.asRelativePath(file),
      line: usageLine,
      column: position.character + 1,
      text: displayText,
      context: this.getContext(document, usageLine - 1),
    };
  }

  /**
   * Extract usage from the origin location (for inline SVGs)
   * Opens the file at the given line and extracts the full <svg> element.
   */
  private async extractOriginUsage(
    location: { file: string; line: number }
  ): Promise<IconUsage | null> {
    try {
      const fileUri = vscode.Uri.file(location.file);
      const document = await vscode.workspace.openTextDocument(fileUri);
      const text = document.getText();
      const lineIndex = location.line - 1;

      // Find the <svg at or near the origin line
      const lineOffset = document.offsetAt(new vscode.Position(lineIndex, 0));
      const textFromLine = text.substring(lineOffset);
      const svgOpenIdx = textFromLine.indexOf('<svg');
      if (svgOpenIdx === -1) return null;

      const absoluteIdx = lineOffset + svgOpenIdx;

      // Find the closing </svg> tag from the opening position
      const textAfterOpen = text.substring(absoluteIdx);
      const svgCloseMatch = textAfterOpen.match(/<\/svg\s*>/i);
      if (!svgCloseMatch || svgCloseMatch.index === undefined) return null;

      const fullSvg = textAfterOpen.substring(0, svgCloseMatch.index + svgCloseMatch[0].length);

      // Dedent the SVG for clean display
      const lines = fullSvg.split('\n');
      const indentLines = lines.slice(1).filter(l => l.trim().length > 0);
      const minIndent = indentLines.length > 0
        ? indentLines.reduce((min, l) => {
            const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
            return Math.min(min, indent);
          }, Infinity)
        : 0;
      const dedented = [lines[0].trim(), ...lines.slice(1).map(l => l.substring(minIndent))].join('\n');

      // Truncate long attribute values (like path d="...") for readable preview
      const truncated = this.truncateLongAttributes(dedented);

      const svgLine = document.positionAt(absoluteIdx).line + 1;

      return {
        file: location.file,
        relativePath: vscode.workspace.asRelativePath(fileUri),
        line: svgLine,
        column: 1,
        text: truncated,
        context: this.getContext(document, svgLine - 1),
      };
    } catch {
      return null;
    }
  }

  /**
   * Truncate long attribute values in SVG/HTML for readable previews.
   * Shortens values like d="M19.14 12.94c..." to d="M19.14 12.94c...".
   */
  private truncateLongAttributes(text: string): string {
    const maxAttrLen = 40;
    return text.replace(
      /(\w+)="([^"]+)"/g,
      (_match, attr: string, value: string) => {
        if (value.length > maxAttrLen) {
          return `${attr}="${value.substring(0, maxAttrLen)}…"`;
        }
        return _match;
      }
    );
  }

  /**
   * Build search patterns for different naming conventions
   */
  private buildSearchPatterns(iconName: string): string[] {
    const patterns: string[] = [];

    // SVG file reference (e.g. src="/icons/rocket.svg")
    patterns.push(`${iconName}.svg`);

    // With quotes (for exact string references like name="rocket")
    patterns.push(`"${iconName}"`);
    patterns.push(`'${iconName}'`);
    patterns.push(`\`${iconName}\``);

    // Common prefix patterns (CSS classes, bindings)
    patterns.push(`icon-${iconName}`);
    patterns.push(`icon:${iconName}`);

    // As a JSX/Vue component tag (e.g. <Rocket />)
    const pascalCase = this.toPascalCase(iconName);
    if (pascalCase !== iconName) {
      patterns.push(`<${pascalCase}`);
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
   * Extract the full HTML element when match is inside a multi-line tag.
   * Returns collapsed element text and the start offset, or null.
   */
  private extractFullElement(text: string, matchIndex: number): { text: string; startOffset: number } | null {
    // Look backwards to find the opening < (that isn't a closing tag)
    let openIdx = matchIndex - 1;
    while (openIdx >= 0) {
      if (text[openIdx] === '>') return null; // Hit closing bracket, not inside a tag
      if (text[openIdx] === '<' && openIdx + 1 < text.length && text[openIdx + 1] !== '/') {
        break;
      }
      openIdx--;
    }
    if (openIdx < 0 || text[openIdx] !== '<') return null;

    // Look forward to find the closing > or />, tracking JSX brace depth
    let closeIdx = matchIndex;
    let braceDepth = 0;
    while (closeIdx < text.length) {
      const ch = text[closeIdx];
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '>' && braceDepth === 0) break;
      closeIdx++;
    }
    if (closeIdx >= text.length) return null;

    const fullElement = text.substring(openIdx, closeIdx + 1);

    // Only return if it actually spans multiple lines
    if (!fullElement.includes('\n')) return null;

    // Dedent: remove common leading whitespace but preserve structure
    // Skip first line for min indent calculation (it starts at '<' with 0 indent)
    const lines = fullElement.split('\n');
    const indentLines = lines.slice(1).filter(l => l.trim().length > 0);
    const minIndent = indentLines.length > 0
      ? indentLines.reduce((min, l) => {
          const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
          return Math.min(min, indent);
        }, Infinity)
      : 0;
    const dedented = [lines[0], ...lines.slice(1).map(l => l.substring(minIndent))].join('\n');

    return { text: dedented, startOffset: openIdx };
  }

  /**
   * Extract full SVG content if the match is inside an inline SVG tag
   * Returns the complete SVG from <svg> to </svg>, or null if not in an SVG
   */
  private extractFullSvgIfInline(text: string, matchIndex: number): string | null {
    // Look backwards to find the opening <svg tag
    const beforeMatch = text.substring(0, matchIndex);
    const svgOpenIndex = beforeMatch.lastIndexOf('<svg');

    if (svgOpenIndex === -1) {
      return null; // Not inside an SVG tag
    }

    // Look forward to find the closing </svg> tag
    const afterMatch = text.substring(matchIndex);
    const svgCloseMatch = afterMatch.match(/<\/svg\s*>/i);

    if (!svgCloseMatch) {
      return null; // No closing SVG tag found
    }

    // Extract the complete SVG from <svg to </svg>
    const svgEndIndex = matchIndex + afterMatch.indexOf(svgCloseMatch[0]) + svgCloseMatch[0].length;
    const completeSvg = text.substring(svgOpenIndex, svgEndIndex);

    return completeSvg;
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

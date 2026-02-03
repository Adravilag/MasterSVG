/**
 * Syntax Highlighting Service
 *
 * Provides syntax highlighting for SVG, CSS, HTML, and JavaScript code.
 * Extracted from IconEditorPanel to improve maintainability.
 */

// Placeholder markers for safe escaping
const MARKERS = {
  AMP: '⟨AMP⟩',
  LT: '⟨LT⟩',
  GT: '⟨GT⟩',
  // Highlight markers
  B_OPEN: '⦃b⦄', // Brackets
  B_CLOSE: '⦃/b⦄',
  T_OPEN: '⦃t⦄', // Tags
  T_CLOSE: '⦃/t⦄',
  A_OPEN: '⦃a⦄', // Attributes/Props
  A_CLOSE: '⦃/a⦄',
  S_OPEN: '⦃s⦄', // Strings
  S_CLOSE: '⦃/s⦄',
  C_OPEN: '⦃c⦄', // Comments
  C_CLOSE: '⦃/c⦄',
  K_OPEN: '⦃k⦄', // CSS Keywords
  K_CLOSE: '⦃/k⦄',
  SEL_OPEN: '⦃sel⦄', // Selectors
  SEL_CLOSE: '⦃/sel⦄',
  V_OPEN: '⦃v⦄', // CSS Values
  V_CLOSE: '⦃/v⦄',
  BR_OPEN: '⦃br⦄', // Braces
  BR_CLOSE: '⦃/br⦄',
};

export class SyntaxHighlighter {
  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Convert placeholder markers to HTML tags
   */
  private _markersToHtml(text: string): string {
    return text
      .replace(/⟨AMP⟩/g, '&amp;')
      .replace(/⟨LT⟩/g, '&lt;')
      .replace(/⟨GT⟩/g, '&gt;')
      .replace(/⦃b⦄/g, '<span class="punctuation">')
      .replace(/⦃\/b⦄/g, '</span>')
      .replace(/⦃t⦄/g, '<span class="tag">')
      .replace(/⦃\/t⦄/g, '</span>')
      .replace(/⦃a⦄/g, '<span class="attr-name">')
      .replace(/⦃\/a⦄/g, '</span>')
      .replace(/⦃s⦄/g, '<span class="string">')
      .replace(/⦃\/s⦄/g, '</span>')
      .replace(/⦃c⦄/g, '<span class="comment">')
      .replace(/⦃\/c⦄/g, '</span>')
      .replace(/⦃k⦄/g, '<span class="keyword">')
      .replace(/⦃\/k⦄/g, '</span>')
      .replace(/⦃sel⦄/g, '<span class="variable">')
      .replace(/⦃\/sel⦄/g, '</span>')
      .replace(/⦃v⦄/g, '<span class="value">')
      .replace(/⦃\/v⦄/g, '</span>')
      .replace(/⦃br⦄/g, '<span class="punctuation">')
      .replace(/⦃\/br⦄/g, '</span>');
  }

  /**
   * Apply CSS-specific highlighting
   */
  private _highlightCss(line: string): string {
    return line
      .replace(/(@[\w-]+)/g, '⦃k⦄$1⦃/k⦄')
      .replace(/^(\s*)([^{]+)(\s*\{)/g, '$1⦃sel⦄$2⦃/sel⦄$3')
      .replace(/([\w-]+)(\s*:)/g, '⦃a⦄$1⦃/a⦄$2')
      .replace(/(:\s*)([^;{}]+)/g, '$1⦃v⦄$2⦃/v⦄')
      .replace(/([{}])/g, '⦃br⦄$1⦃/br⦄');
  }

  /**
   * Apply SVG/XML-specific highlighting
   */
  private _highlightXml(line: string): string {
    return line
      .replace(/(⟨LT⟩!--.*?--⟨GT⟩)/g, '⦃c⦄$1⦃/c⦄')
      .replace(/(⟨LT⟩\/?)([\w:-]+)/g, '⦃b⦄$1⦃/b⦄⦃t⦄$2⦃/t⦄')
      .replace(/(\/?⟨GT⟩)/g, '⦃b⦄$1⦃/b⦄')
      .replace(/(^|\s)([\w:-]+)(?==)/g, '$1⦃a⦄$2⦃/a⦄')
      .replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄');
  }

  /**
   * Format CSS with proper indentation
   */
  formatCss(css: string): string {
    if (!css) return '';

    const cleanCss = css
      .replace(/\s+/g, ' ')
      .replace(/\s*\{\s*/g, ' {\n')
      .replace(/\s*\}\s*/g, '\n}\n')
      .replace(/;\s*/g, ';\n')
      .trim();

    const lines = cleanCss.split('\n');
    const formatted: string[] = [];
    let indentLevel = 1;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('}')) {
        indentLevel = Math.max(1, indentLevel - 1);
      }

      formatted.push('  '.repeat(indentLevel) + line);

      if (line.endsWith('{')) {
        indentLevel++;
      }
    }

    return formatted.join('\n') + '\n  ';
  }

  /**
   * Format SVG with proper indentation and line breaks
   */
  formatSvg(svg: string): string {
    if (!svg) return '';

    const result = svg.trim().replace(/\s*style="[^"]*animation[^"]*"/gi, '');

    const formatted: string[] = [];
    let indent = 0;
    let pos = 0;

    while (pos < result.length) {
      while (pos < result.length && /\s/.test(result[pos])) pos++;
      if (pos >= result.length) break;

      if (result[pos] === '<') {
        let tagEnd = result.indexOf('>', pos);
        if (tagEnd === -1) tagEnd = result.length;

        const tag = result.substring(pos, tagEnd + 1).trim();
        const isClosing = tag.startsWith('</');
        const isSelfClosing = tag.endsWith('/>');
        const isComment = tag.startsWith('<!--');

        if (isClosing) indent = Math.max(0, indent - 1);

        if (!isComment && tag.length > 80) {
          const tagMatch = tag.match(/^<(\/?[\w:-]+)([\s\S]*?)(\/?>)$/);
          if (tagMatch) {
            const [, tagName, attrsStr, closing] = tagMatch;
            const attrs: string[] = [];
            const attrRegex = /([\w:-]+)(?:=("[^"]*"|'[^']*'|[^\s>]*))?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
              if (attrMatch[2]) {
                attrs.push(`${attrMatch[1]}=${attrMatch[2]}`);
              } else if (attrMatch[1]) {
                attrs.push(attrMatch[1]);
              }
            }

            if (attrs.length > 0) {
              formatted.push('  '.repeat(indent) + `<${tagName}`);
              attrs.forEach((attr, i) => {
                const isLast = i === attrs.length - 1;
                formatted.push('  '.repeat(indent + 1) + attr + (isLast ? closing : ''));
              });
            } else {
              formatted.push('  '.repeat(indent) + tag);
            }
          } else {
            formatted.push('  '.repeat(indent) + tag);
          }
        } else {
          formatted.push('  '.repeat(indent) + tag);
        }

        if (!isClosing && !isSelfClosing && !isComment) {
          indent++;
        }

        pos = tagEnd + 1;
      } else {
        let textEnd = result.indexOf('<', pos);
        if (textEnd === -1) textEnd = result.length;

        const text = result.substring(pos, textEnd).trim();
        if (text) {
          formatted.push('  '.repeat(indent) + text);
        }
        pos = textEnd;
      }
    }

    let finalResult = formatted.join('\n');

    // Format CSS inside <style> tags
    finalResult = finalResult.replace(/<style>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
      return `<style>\n${this.formatCss(cssContent)}</style>`;
    });

    return finalResult;
  }

  // Helper to create consistent HTML rows
  private _createRowHtml(lineContent: string, lineNumber: number): string {
    const content = lineContent.trim().length === 0 ? '&nbsp;' : this._markersToHtml(lineContent);
    return `<div class="code-row"><div class="ln">${lineNumber}</div><div class="cl">${content}</div></div>`;
  }

  /**
   * Highlight SVG code with syntax coloring
   */
  highlightSvg(svg: string): string {
    const formatted = this.formatSvg(svg);
    const lines = formatted.split('\n'); // Don't filter empty lines
    let insideStyle = false;

    const codeRows = lines
      .map((line, i) => {
        if (line.includes('<style')) insideStyle = true;
        const wasInsideStyle = insideStyle;
        if (line.includes('</style')) insideStyle = false;

        let highlighted = line
          .replace(/&/g, MARKERS.AMP)
          .replace(/</g, MARKERS.LT)
          .replace(/>/g, MARKERS.GT);

        if (wasInsideStyle && !line.trim().startsWith('<')) {
          highlighted = this._highlightCss(highlighted);
        } else {
          highlighted = this._highlightXml(highlighted);
        }

        return this._createRowHtml(highlighted, i + 1);
      })
      .join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }

  /**
   * Highlight CSS code
   */
  highlightCssCode(css: string): string {
    const lines = css.split('\n');

    const codeRows = lines
      .map((line, i) => {
        let highlighted = this.escapeHtml(line);

        if (line.trim().startsWith('/*')) {
          highlighted = `⦃c⦄${highlighted}⦃/c⦄`;
        } else if (line.includes('@keyframes')) {
          highlighted = highlighted.replace(/(@keyframes)\s+([\w-]+)/, '⦃k⦄$1⦃/k⦄ ⦃sel⦄$2⦃/sel⦄');
        } else if (line.includes('{') || line.includes('}')) {
          highlighted = highlighted.replace(/([{}])/g, '⦃br⦄$1⦃/br⦄');
          highlighted = highlighted.replace(/\b(from|to|\d+%)\b/g, '⦃sel⦄$1⦃/sel⦄');
        } else if (line.includes(':')) {
          highlighted = highlighted.replace(/([\w-]+)(\s*:)/, '⦃a⦄$1⦃/a⦄$2');
          highlighted = highlighted.replace(/:\s*([^;]+)(;?)/, ': ⦃v⦄$1⦃/v⦄$2');
        }

        return this._createRowHtml(highlighted, i + 1);
      })
      .join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }

  /**
   * Highlight usage code (HTML/JS mixed)
   */
  highlightUsageCode(lines: string[]): string {
    const codeRows = lines
      .map((line, i) => {
        let highlighted = this.escapeHtml(line);

        if (line.trim().startsWith('<!--')) {
          highlighted = `⦃c⦄${highlighted}⦃/c⦄`;
        } else if (line.includes('<')) {
          highlighted = highlighted.replace(/&lt;(\/?)([\w-]+)/g, '⦃b⦄&lt;$1⦃/b⦄⦃t⦄$2⦃/t⦄');
          highlighted = highlighted.replace(/(\s)([\w-]+)=/g, '$1⦃a⦄$2⦃/a⦄=');
          highlighted = highlighted.replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄');
          highlighted = highlighted.replace(/&gt;/g, '⦃b⦄&gt;⦃/b⦄');
        } else if (line.includes('import')) {
          highlighted = highlighted.replace(/(import|from)/g, '⦃k⦄$1⦃/k⦄');
          highlighted = highlighted.replace(/\{ ([^}]+) \}/, '{ ⦃sel⦄$1⦃/sel⦄ }');
          highlighted = highlighted.replace(/'([^']+)'/g, "⦃s⦄'$1'⦃/s⦄");
        }

        return this._createRowHtml(highlighted, i + 1);
      })
      .join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }
}

// Singleton instance
let syntaxHighlighterInstance: SyntaxHighlighter | undefined;

export function getSyntaxHighlighter(): SyntaxHighlighter {
  if (!syntaxHighlighterInstance) {
    syntaxHighlighterInstance = new SyntaxHighlighter();
  }
  return syntaxHighlighterInstance;
}

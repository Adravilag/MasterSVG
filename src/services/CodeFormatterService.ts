/**
 * Service for code formatting and syntax highlighting
 * Extracted from IconEditorPanel for reusability
 */
export class CodeFormatterService {
  /**
   * Convert a name to camelCase variable name
   */
  toVariableName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .split('-')
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

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
   * Highlight SVG code with syntax coloring
   */
  highlightSvgCode(svg: string): string {
    // First format the SVG (before escaping)
    const formatted = this.formatSvgPretty(svg);
    // Filter out empty lines
    const lines = formatted.split('\n').filter(line => line.trim() !== '');

    // Track if we're inside a style tag for CSS highlighting
    let insideStyle = false;

    // Generate highlighted code rows
    const codeRows = lines.map((line, i) => {
      // Check if entering/exiting style
      if (line.includes('<style')) insideStyle = true;
      const wasInsideStyle = insideStyle;
      if (line.includes('</style')) insideStyle = false;

      // Apply syntax highlighting before escaping
      let highlighted = line;

      // Replace special chars that would be escaped, using placeholders
      highlighted = highlighted
        .replace(/&/g, '⟨AMP⟩')
        .replace(/</g, '⟨LT⟩')
        .replace(/>/g, '⟨GT⟩');

      // If this is CSS content (not the style tag itself)
      if (wasInsideStyle && !line.trim().startsWith('<')) {
        // CSS highlighting
        // Highlight @keyframes and @media
        highlighted = highlighted.replace(/@([\w-]+)/g, '⦃k⦄@$1⦃/k⦄');
        // Highlight selectors (before {)
        highlighted = highlighted.replace(/^(\s*)([\w\s.#:-]+)(\s*\{)/g, '$1⦃sel⦄$2⦃/sel⦄$3');
        // Highlight property names
        highlighted = highlighted.replace(/([\w-]+)(\s*:)/g, '⦃a⦄$1⦃/a⦄$2');
        // Highlight property values (after : until ;)
        highlighted = highlighted.replace(/:\s*([^;{}]+)(;?)/g, ': ⦃v⦄$1⦃/v⦄$2');
        // Highlight braces
        highlighted = highlighted.replace(/([{}])/g, '⦃br⦄$1⦃/br⦄');
      } else {
        // SVG/XML highlighting
        // Highlight comments
        highlighted = highlighted.replace(/(⟨LT⟩!--.*?--⟨GT⟩)/g, '⦃c⦄$1⦃/c⦄');

        // Highlight tag names (opening and closing)
        highlighted = highlighted.replace(/(⟨LT⟩\/?)([\w:-]+)/g, '⦃b⦄$1⦃/b⦄⦃t⦄$2⦃/t⦄');

        // Highlight closing brackets
        highlighted = highlighted.replace(/(\/?⟨GT⟩)/g, '⦃b⦄$1⦃/b⦄');

        // Highlight attribute names  
        highlighted = highlighted.replace(/\s([\w:-]+)(=)/g, ' ⦃a⦄$1⦃/a⦄$2');

        // Highlight attribute values (strings in quotes)
        highlighted = highlighted.replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄');
      }

      // Now convert placeholders to actual HTML
      highlighted = highlighted
        .replace(/⟨AMP⟩/g, '&amp;')
        .replace(/⟨LT⟩/g, '&lt;')
        .replace(/⟨GT⟩/g, '&gt;')
        .replace(/⦃b⦄/g, '<b>')
        .replace(/⦃\/b⦄/g, '</b>')
        .replace(/⦃t⦄/g, '<i>')
        .replace(/⦃\/t⦄/g, '</i>')
        .replace(/⦃a⦄/g, '<u>')
        .replace(/⦃\/a⦄/g, '</u>')
        .replace(/⦃s⦄/g, '<em>')
        .replace(/⦃\/s⦄/g, '</em>')
        .replace(/⦃c⦄/g, '<cite>')
        .replace(/⦃\/c⦄/g, '</cite>')
        // CSS specific
        .replace(/⦃k⦄/g, '<kbd>')
        .replace(/⦃\/k⦄/g, '</kbd>')
        .replace(/⦃sel⦄/g, '<var>')
        .replace(/⦃\/sel⦄/g, '</var>')
        .replace(/⦃v⦄/g, '<samp>')
        .replace(/⦃\/v⦄/g, '</samp>')
        .replace(/⦃br⦄/g, '<s>')
        .replace(/⦃\/br⦄/g, '</s>');

      return `<div class="code-row"><div class="ln">${i + 1}</div><div class="cl">${highlighted}</div></div>`;
    }).join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }

  /**
   * Format SVG with proper indentation
   */
  formatSvgPretty(svg: string): string {
    if (!svg) return '';

    // Clean animation styles from preview
    let result = svg.trim()
      .replace(/\s*style="[^"]*animation[^"]*"/gi, '');

    // Format SVG with proper indentation and line breaks
    const formatted: string[] = [];
    let indent = 0;
    let pos = 0;
    
    while (pos < result.length) {
      // Skip whitespace
      while (pos < result.length && /\s/.test(result[pos])) pos++;
      if (pos >= result.length) break;
      
      if (result[pos] === '<') {
        // Find end of tag
        let tagEnd = result.indexOf('>', pos);
        if (tagEnd === -1) tagEnd = result.length;
        
        let tag = result.substring(pos, tagEnd + 1).trim();
        
        // Check if closing tag
        const isClosing = tag.startsWith('</');
        const isSelfClosing = tag.endsWith('/>');
        const isComment = tag.startsWith('<!--');
        
        if (isClosing) indent = Math.max(0, indent - 1);
        
        // Format tag with attributes on separate lines if it's long
        if (!isComment && tag.length > 80) {
          // Extract tag name and attributes
          const tagMatch = tag.match(/^<(\/?[\w:-]+)([\s\S]*?)(\/?>)$/);
          if (tagMatch) {
            const [, tagName, attrsStr, closing] = tagMatch;
            
            // Parse attributes
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
              // First line with tag name and first attribute
              formatted.push('  '.repeat(indent) + `<${tagName}`);
              // Each attribute on its own line
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
        
        // Increase indent for opening non-self-closing tags
        if (!isClosing && !isSelfClosing && !isComment) {
          indent++;
        }
        
        pos = tagEnd + 1;
      } else {
        // Text content
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

  /**
   * Highlight code with alternative format (with line numbers sidebar)
   */
  highlightCode(svg: string): string {
    const formatted = this.formatSvgPretty(svg);
    const lines = formatted.split('\n').filter(line => line.trim() !== '');

    const lineNumbers = lines.map((_, i) => `<span class="ln">${i + 1}</span>`).join('');
    let insideStyle = false;

    const codeLines = lines.map(line => {
      // Detectar si entramos en bloque de CSS
      if (line.includes('<style')) insideStyle = true;
      const wasInsideStyle = insideStyle;
      if (line.includes('</style')) insideStyle = false;

      // 1. Escapado preventivo con marcadores
      let highlighted = line
        .replace(/&/g, '⟨AMP⟩')
        .replace(/</g, '⟨LT⟩')
        .replace(/>/g, '⟨GT⟩');

      if (wasInsideStyle && !line.trim().startsWith('<')) {
        // --- RESALTADO CSS ---
        highlighted = highlighted
          .replace(/(@[\w-]+)/g, '⦃k⦄$1⦃/k⦄') // Keyframes/Media
          .replace(/^(\s*)([^{]+)(\s*\{)/g, '$1⦃sel⦄$2⦃/sel⦄$3') // Selectores
          .replace(/([\w-]+)(\s*:)/g, '⦃a⦄$1⦃/a⦄$2') // Propiedades
          .replace(/(:\s*)([^;{}]+)/g, '$1⦃v⦄$2⦃/v⦄') // Valores
          .replace(/([{}])/g, '⦃br⦄$1⦃/br⦄'); // Llaves
      } else {
        // --- RESALTADO SVG ---
        highlighted = highlighted
          .replace(/(⟨LT⟩!--.*?--⟨GT⟩)/g, '⦃c⦄$1⦃/c⦄') // Comentarios
          .replace(/(⟨LT⟩\/?)([\w:-]+)/g, '⦃b⦄$1⦃/b⦄⦃t⦄$2⦃/t⦄') // Tags
          .replace(/(\/?⟨GT⟩)/g, '⦃b⦄$1⦃/b⦄') // Brackets
          .replace(/\s([\w:-]+)(?==)/g, ' ⦃a⦄$1⦃/a⦄') // Atributos
          .replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄'); // Valores string
      }

      // 2. Inyección de HTML final
      return `<span class="cl">${this.placeholdersToHtml(highlighted)}</span>`;
    }).join('\n');

    return `<div class="code-editor"><div class="line-numbers">${lineNumbers}</div><pre class="code-block"><code>${codeLines}</code></pre></div>`;
  }

  /**
   * Convert placeholder markers to HTML tags
   */
  placeholdersToHtml(text: string): string {
    return text
      .replace(/⟨AMP⟩/g, '&amp;').replace(/⟨LT⟩/g, '&lt;').replace(/⟨GT⟩/g, '&gt;')
      .replace(/⦃b⦄/g, '<b>').replace(/⦃\/b⦄/g, '</b>') // Brackets
      .replace(/⦃t⦄/g, '<i>').replace(/⦃\/t⦄/g, '</i>') // Tags
      .replace(/⦃a⦄/g, '<u>').replace(/⦃\/a⦄/g, '</u>') // Attributes/Props
      .replace(/⦃s⦄/g, '<em>').replace(/⦃\/s⦄/g, '</em>') // Strings
      .replace(/⦃c⦄/g, '<cite>').replace(/⦃\/c⦄/g, '</cite>') // Comments
      .replace(/⦃k⦄/g, '<kbd>').replace(/⦃\/k⦄/g, '</kbd>') // CSS Keywords
      .replace(/⦃sel⦄/g, '<var>').replace(/⦃\/sel⦄/g, '</var>') // Selectors
      .replace(/⦃v⦄/g, '<samp>').replace(/⦃\/v⦄/g, '</samp>') // CSS Values
      .replace(/⦃br⦄/g, '<s>').replace(/⦃\/br⦄/g, '</s>'); // Braces
  }

  /**
   * Format CSS with proper indentation
   */
  formatCss(css: string): string {
    if (!css) return '';

    // Limpieza: colapsa espacios y fuerza saltos de línea estratégicos
    const cleanCss = css
      .replace(/\s+/g, ' ')
      .replace(/\s*\{\s*/g, ' {\n')
      .replace(/\s*\}\s*/g, '\n}\n')
      .replace(/;\s*/g, ';\n')
      .trim();

    const lines = cleanCss.split('\n');
    const formatted: string[] = [];
    let indentLevel = 1; // Base 1 porque vive dentro de <style>

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Si la línea cierra bloque, reduce indentación antes de añadirla
      if (line.startsWith('}')) {
        indentLevel = Math.max(1, indentLevel - 1);
      }

      formatted.push('  '.repeat(indentLevel) + line);

      // Si la línea abre bloque, aumenta para la siguiente
      if (line.endsWith('{')) {
        indentLevel++;
      }
    }

    // El espacio final ayuda a alinear el cierre de </style>
    return formatted.join('\n') + '\n  ';
  }

  /**
   * Convert color to hex format
   */
  toHexColor(color: string): string {
    if (color.startsWith('#')) {
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    }

    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }

    const namedColors: Record<string, string> = {
      'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
      'green': '#008000', 'blue': '#0000ff', 'yellow': '#ffff00',
      'cyan': '#00ffff', 'magenta': '#ff00ff', 'gray': '#808080',
      'grey': '#808080', 'orange': '#ffa500', 'purple': '#800080',
      'currentcolor': '#000000'
    };

    return namedColors[color.toLowerCase()] || '#000000';
  }

  /**
   * Get keyframes CSS for a specific animation type
   */
  getKeyframesForAnimation(animationType: string): string {
    const keyframesMap: Record<string, string> = {
      'spin': '@keyframes spin {\n  from { transform: rotate(0deg); }\n  to { transform: rotate(360deg); }\n}',
      'spin-reverse': '@keyframes spin-reverse {\n  from { transform: rotate(360deg); }\n  to { transform: rotate(0deg); }\n}',
      'pulse': '@keyframes pulse {\n  0%, 100% { transform: scale(1); opacity: 1; }\n  50% { transform: scale(1.1); opacity: 0.8; }\n}',
      'pulse-grow': '@keyframes pulse-grow {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.2); }\n}',
      'bounce': '@keyframes bounce {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-8px); }\n}',
      'bounce-horizontal': '@keyframes bounce-horizontal {\n  0%, 100% { transform: translateX(0); }\n  50% { transform: translateX(8px); }\n}',
      'shake': '@keyframes shake {\n  0%, 100% { transform: translateX(0); }\n  25% { transform: translateX(-4px); }\n  75% { transform: translateX(4px); }\n}',
      'shake-vertical': '@keyframes shake-vertical {\n  0%, 100% { transform: translateY(0); }\n  25% { transform: translateY(-4px); }\n  75% { transform: translateY(4px); }\n}',
      'fade': '@keyframes fade {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.3; }\n}',
      'fade-in': '@keyframes fade-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
      'fade-out': '@keyframes fade-out {\n  from { opacity: 1; }\n  to { opacity: 0; }\n}',
      'float': '@keyframes float {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-6px); }\n}',
      'swing': '@keyframes swing {\n  0%, 100% { transform: rotate(0deg); transform-origin: top center; }\n  25% { transform: rotate(15deg); }\n  75% { transform: rotate(-15deg); }\n}',
      'flip': '@keyframes flip {\n  0% { transform: perspective(400px) rotateY(0); }\n  100% { transform: perspective(400px) rotateY(360deg); }\n}',
      'flip-x': '@keyframes flip-x {\n  0% { transform: perspective(400px) rotateX(0); }\n  100% { transform: perspective(400px) rotateX(360deg); }\n}',
      'heartbeat': '@keyframes heartbeat {\n  0%, 100% { transform: scale(1); }\n  14% { transform: scale(1.15); }\n  28% { transform: scale(1); }\n  42% { transform: scale(1.15); }\n  70% { transform: scale(1); }\n}',
      'wobble': '@keyframes wobble {\n  0%, 100% { transform: translateX(0) rotate(0); }\n  15% { transform: translateX(-6px) rotate(-5deg); }\n  30% { transform: translateX(5px) rotate(3deg); }\n  45% { transform: translateX(-4px) rotate(-3deg); }\n  60% { transform: translateX(3px) rotate(2deg); }\n  75% { transform: translateX(-2px) rotate(-1deg); }\n}',
      'rubber-band': '@keyframes rubber-band {\n  0%, 100% { transform: scaleX(1); }\n  30% { transform: scaleX(1.25) scaleY(0.75); }\n  40% { transform: scaleX(0.75) scaleY(1.25); }\n  50% { transform: scaleX(1.15) scaleY(0.85); }\n  65% { transform: scaleX(0.95) scaleY(1.05); }\n  75% { transform: scaleX(1.05) scaleY(0.95); }\n}',
      'jello': '@keyframes jello {\n  0%, 11.1%, 100% { transform: skewX(0) skewY(0); }\n  22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); }\n  33.3% { transform: skewX(6.25deg) skewY(6.25deg); }\n  44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); }\n  55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); }\n}',
      'tada': '@keyframes tada {\n  0%, 100% { transform: scale(1) rotate(0); }\n  10%, 20% { transform: scale(0.9) rotate(-3deg); }\n  30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }\n  40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }\n}',
      'zoom-in': '@keyframes zoom-in {\n  from { transform: scale(0); opacity: 0; }\n  to { transform: scale(1); opacity: 1; }\n}',
      'zoom-out': '@keyframes zoom-out {\n  from { transform: scale(1); opacity: 1; }\n  to { transform: scale(0); opacity: 0; }\n}',
      'slide-in-up': '@keyframes slide-in-up {\n  from { transform: translateY(100%); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}',
      'slide-in-down': '@keyframes slide-in-down {\n  from { transform: translateY(-100%); opacity: 0; }\n  to { transform: translateY(0); opacity: 1; }\n}',
      'slide-in-left': '@keyframes slide-in-left {\n  from { transform: translateX(-100%); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}',
      'slide-in-right': '@keyframes slide-in-right {\n  from { transform: translateX(100%); opacity: 0; }\n  to { transform: translateX(0); opacity: 1; }\n}',
      'blink': '@keyframes blink {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0; }\n}',
      'glow': '@keyframes glow {\n  0%, 100% { filter: drop-shadow(0 0 2px currentColor); }\n  50% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor); }\n}',
      'draw': '@keyframes draw {\n  from { stroke-dashoffset: var(--path-length, 1000); }\n  to { stroke-dashoffset: 0; }\n}',
      'draw-reverse': '@keyframes draw-reverse {\n  from { stroke-dashoffset: 0; }\n  to { stroke-dashoffset: var(--path-length, 1000); }\n}',
      'draw-loop': '@keyframes draw-loop {\n  0% { stroke-dashoffset: var(--path-length, 1000); }\n  45% { stroke-dashoffset: 0; }\n  55% { stroke-dashoffset: 0; }\n  100% { stroke-dashoffset: var(--path-length, 1000); }\n}'
    };

    return keyframesMap[animationType] || `@keyframes ${animationType} {\n  /* Custom animation */\n}`;
  }

  /**
   * Generate HTML for animation CSS code section
   */
  generateAnimationCodeHtml(animationType: string, settings?: { duration?: number; timing?: string; iteration?: string; delay?: number; direction?: string }): string {
    if (!animationType || animationType === 'none') {
      return '<div class="code-editor"><div class="code-row"><div class="ln">1</div><div class="cl" style="color: var(--vscode-descriptionForeground); font-style: italic;">No animation selected</div></div></div>';
    }

    const duration = settings?.duration || 1;
    const timing = settings?.timing || 'ease';
    const iteration = settings?.iteration || 'infinite';
    const delay = settings?.delay || 0;
    const direction = settings?.direction || 'normal';

    // Generate the CSS keyframes and animation rule
    const keyframes = this.getKeyframesForAnimation(animationType);
    const animationRule = `.bz-anim-${animationType} {
  animation: ${animationType} ${duration}s ${timing} ${delay}s ${iteration} ${direction};
}`;

    const fullCss = `/* Animation: ${animationType} */
${keyframes}

${animationRule}`;

    // Highlight CSS
    const lines = fullCss.split('\n').filter(line => line.trim() !== '');
    const codeRows = lines.map((line, i) => {
      let highlighted = this.escapeHtml(line);
      
      // CSS highlighting
      if (line.includes('/*')) {
        highlighted = `<cite>${highlighted}</cite>`;
      } else if (line.includes('@keyframes')) {
        highlighted = highlighted.replace(/@keyframes\s+(\w+)/, '<kbd>@keyframes</kbd> <var>$1</var>');
      } else if (line.includes('{') || line.includes('}')) {
        highlighted = highlighted.replace(/([{}])/g, '<s>$1</s>');
        // Highlight percentages or from/to
        highlighted = highlighted.replace(/(from|to|\d+%)/g, '<var>$1</var>');
      } else if (line.includes(':')) {
        highlighted = highlighted.replace(/([\w-]+)(\s*:)/, '<u>$1</u>$2');
        highlighted = highlighted.replace(/:\s*([^;]+)(;?)/, ': <samp>$1</samp>$2');
      }

      return `<div class="code-row"><div class="ln">${i + 1}</div><div class="cl">${highlighted}</div></div>`;
    }).join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }

  /**
   * Generate HTML for usage code section
   */
  generateUsageCodeHtml(iconName: string, animationType?: string, tagName: string = 'bz-icon'): string {
    const lines: string[] = [
      `<!-- Web Component -->`,
      `<${tagName} name="${iconName}"${animationType && animationType !== 'none' ? ` animation="${animationType}"` : ''}></${tagName}>`,
      ``,
      `<!-- SVG Use (Sprite) -->`,
      `<svg><use href="sprite.svg#${iconName}"></use></svg>`,
      ``,
      `<!-- JavaScript Import -->`,
      `import { ${this.toVariableName(iconName)} } from './icons.js';`
    ];

    const codeRows = lines.map((line, i) => {
      let highlighted = this.escapeHtml(line);
      
      if (line.startsWith('<!--')) {
        highlighted = `<cite>${highlighted}</cite>`;
      } else if (line.includes('<')) {
        // HTML/XML highlighting
        highlighted = highlighted.replace(/&lt;(\/?)([\w-]+)/g, '<b>&lt;$1</b><i>$2</i>');
        highlighted = highlighted.replace(/([\w-]+)=/g, '<u>$1</u>=');
        highlighted = highlighted.replace(/"([^"]*)"/g, '<em>"$1"</em>');
        highlighted = highlighted.replace(/&gt;/g, '<b>&gt;</b>');
      } else if (line.includes('import')) {
        // JS highlighting
        highlighted = highlighted.replace(/(import|from)/g, '<kbd>$1</kbd>');
        highlighted = highlighted.replace(/\{ ([^}]+) \}/, '{ <var>$1</var> }');
        highlighted = highlighted.replace(/'([^']+)'/g, '<em>\'$1\'</em>');
      }

      return `<div class="code-row"><div class="ln">${i + 1}</div><div class="cl">${highlighted}</div></div>`;
    }).join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }
}

// Singleton instance
let codeFormatterService: CodeFormatterService | undefined;

export function getCodeFormatterService(): CodeFormatterService {
  if (!codeFormatterService) {
    codeFormatterService = new CodeFormatterService();
  }
  return codeFormatterService;
}


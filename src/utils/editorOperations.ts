/**
 * Editor Operations
 * Pure utility functions for text document manipulation.
 * These functions work with text content and return edit information
 * without directly depending on VS Code APIs.
 */

// ============================================================================
// Types
// ============================================================================

export interface ImportInfo {
  statement: string;
  insertPosition: number;
}

export interface ScriptTagInfo {
  tag: string;
  insertPosition: number;
}

export interface EditPosition {
  line: number;
  character: number;
}

export interface TextEdit {
  position: EditPosition;
  text: string;
}

// ============================================================================
// Import Detection
// ============================================================================

/**
 * Check if an import statement already exists for a component
 */
export function hasImportForComponent(content: string, componentName: string): boolean {
  const importRegex = new RegExp(`import.*\\b${componentName}\\b.*from`);
  return importRegex.test(content);
}

/**
 * Check if a module is already imported (any named export)
 */
export function hasImportFromModule(content: string, modulePath: string): boolean {
  const escapedPath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importRegex = new RegExp(`import.*from\\s*['"]${escapedPath}['"]`);
  return importRegex.test(content);
}

/**
 * Find the line number where a new import should be inserted
 * @returns The line number (0-indexed) where import should be added
 */
export function findImportInsertLine(content: string): number {
  const lines = content.split('\n');
  let insertLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('import ')) {
      insertLine = i + 1;
    } else if (line.trim() && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
      break;
    }
  }

  return insertLine;
}

/**
 * Generate an import statement
 */
export function generateImport(componentName: string, importPath: string): string {
  return `import { ${componentName} } from '${importPath}';\n`;
}

/**
 * Generate a default import statement
 */
export function generateDefaultImport(name: string, importPath: string): string {
  return `import ${name} from '${importPath}';\n`;
}

/**
 * Generate a named imports statement with multiple imports
 */
export function generateNamedImports(names: string[], importPath: string): string {
  return `import { ${names.join(', ')} } from '${importPath}';\n`;
}

/**
 * Get import edit information for adding an import
 */
export function getImportEdit(content: string, componentName: string, importPath: string): TextEdit | null {
  if (hasImportForComponent(content, componentName)) {
    return null;
  }

  const insertLine = findImportInsertLine(content);
  const statement = generateImport(componentName, importPath);

  return {
    position: { line: insertLine, character: 0 },
    text: statement
  };
}

// ============================================================================
// Script Tag Detection (for HTML files)
// ============================================================================

/**
 * Check if a script tag for icons already exists
 */
export function hasIconsScriptTag(content: string): boolean {
  return content.includes('icon.js') || content.includes('icons.js');
}

/**
 * Find position to insert script tag in HTML
 * Returns position before </head> or after <body>
 */
export function findScriptTagInsertPosition(content: string): { position: number; beforeHead: boolean } | null {
  const headCloseMatch = content.match(/<\/head>/i);
  if (headCloseMatch && headCloseMatch.index !== undefined) {
    return { position: headCloseMatch.index, beforeHead: true };
  }

  const bodyOpenMatch = content.match(/<body[^>]*>/i);
  if (bodyOpenMatch && bodyOpenMatch.index !== undefined) {
    return { position: bodyOpenMatch.index + bodyOpenMatch[0].length, beforeHead: false };
  }

  return null;
}

/**
 * Generate a script tag for module import
 */
export function generateModuleScriptTag(relativePath: string, indent: string = '    '): string {
  return `${indent}<script type="module" src="${relativePath}"></script>\n`;
}

/**
 * Generate a regular script tag
 */
export function generateScriptTag(src: string, indent: string = '    '): string {
  return `${indent}<script src="${src}"></script>\n`;
}

/**
 * Calculate relative path between two file paths
 */
export function calculateRelativePath(fromPath: string, toPath: string): string {
  // Split paths into parts
  const fromParts = fromPath.replace(/\\/g, '/').split('/');
  const toParts = toPath.replace(/\\/g, '/').split('/');

  // Remove file names from paths (keep directories)
  fromParts.pop();

  // Find common base
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length - 1);
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const relativeParts = [];

  for (let i = 0; i < upCount; i++) {
    relativeParts.push('..');
  }

  for (let i = commonLength; i < toParts.length; i++) {
    relativeParts.push(toParts[i]);
  }

  let result = relativeParts.join('/');

  // Ensure it starts with ./ for relative imports
  if (!result.startsWith('.') && !result.startsWith('/')) {
    result = './' + result;
  }

  return result;
}

/**
 * Get script tag edit information
 */
export function getScriptTagEdit(content: string, relativePath: string): TextEdit | null {
  if (hasIconsScriptTag(content)) {
    return null;
  }

  const insertInfo = findScriptTagInsertPosition(content);
  if (!insertInfo) {
    return null;
  }

  const scriptTag = generateModuleScriptTag(relativePath);
  const lines = content.substring(0, insertInfo.position).split('\n');
  
  if (insertInfo.beforeHead) {
    return {
      position: { line: lines.length - 1, character: 0 },
      text: scriptTag
    };
  } else {
    return {
      position: { line: lines.length, character: 0 },
      text: scriptTag
    };
  }
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Check if language ID is HTML
 */
export function isHtmlLanguage(languageId: string): boolean {
  return languageId === 'html' || languageId === 'htm';
}

/**
 * Check if language ID supports imports
 */
export function supportsImports(languageId: string): boolean {
  const importLanguages = [
    'javascript', 'javascriptreact', 'typescript', 'typescriptreact',
    'vue', 'svelte', 'astro'
  ];
  return importLanguages.includes(languageId);
}

/**
 * Check if language ID is JSX/TSX
 */
export function isJsxLanguage(languageId: string): boolean {
  return languageId === 'javascriptreact' || languageId === 'typescriptreact';
}

/**
 * Check if language ID is a framework SFC (Vue, Svelte, Astro)
 */
export function isSfcLanguage(languageId: string): boolean {
  return ['vue', 'svelte', 'astro'].includes(languageId);
}

// ============================================================================
// Code Position Utilities
// ============================================================================

/**
 * Convert character offset to line and column
 */
export function offsetToPosition(content: string, offset: number): EditPosition {
  const lines = content.substring(0, offset).split('\n');
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}

/**
 * Convert line and column to character offset
 */
export function positionToOffset(content: string, line: number, character: number): number {
  const lines = content.split('\n');
  let offset = 0;
  
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  
  offset += character;
  return offset;
}

/**
 * Get the line content at a specific line number
 */
export function getLineContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber] || '';
}

/**
 * Get line count
 */
export function getLineCount(content: string): number {
  return content.split('\n').length;
}

// ============================================================================
// Text Manipulation
// ============================================================================

/**
 * Insert text at a specific offset
 */
export function insertTextAtOffset(content: string, offset: number, text: string): string {
  return content.slice(0, offset) + text + content.slice(offset);
}

/**
 * Insert text at a specific line
 */
export function insertTextAtLine(content: string, line: number, text: string): string {
  const lines = content.split('\n');
  lines.splice(line, 0, text.replace(/\n$/, ''));
  return lines.join('\n');
}

/**
 * Replace text between two offsets
 */
export function replaceTextRange(content: string, start: number, end: number, newText: string): string {
  return content.slice(0, start) + newText + content.slice(end);
}

/**
 * Find all occurrences of a pattern
 */
export function findAllOccurrences(content: string, pattern: RegExp): Array<{ index: number; match: string }> {
  const results: Array<{ index: number; match: string }> = [];
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  
  let match;
  while ((match = globalPattern.exec(content)) !== null) {
    results.push({ index: match.index, match: match[0] });
  }
  
  return results;
}

// ============================================================================
// Import Analysis
// ============================================================================

/**
 * Extract all imports from content
 */
export function extractImports(content: string): Array<{ statement: string; line: number }> {
  const lines = content.split('\n');
  const imports: Array<{ statement: string; line: number }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('import ')) {
      imports.push({ statement: line, line: i });
    }
  }
  
  return imports;
}

/**
 * Extract named exports from an import statement
 */
export function extractNamedImports(importStatement: string): string[] {
  const match = importStatement.match(/import\s*\{([^}]+)\}\s*from/);
  if (!match) return [];
  
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Extract module path from an import statement
 */
export function extractModulePath(importStatement: string): string | null {
  const match = importStatement.match(/from\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * Add a named import to an existing import statement
 */
export function addNamedImport(importStatement: string, newImport: string): string {
  const existingImports = extractNamedImports(importStatement);
  if (existingImports.includes(newImport)) {
    return importStatement;
  }
  
  existingImports.push(newImport);
  const modulePath = extractModulePath(importStatement);
  
  return `import { ${existingImports.join(', ')} } from '${modulePath}';`;
}

// ============================================================================
// Component/Element Detection
// ============================================================================

/**
 * Find JSX/TSX component usage in content
 */
export function findComponentUsages(content: string, componentName: string): Array<{ index: number; match: string }> {
  const pattern = new RegExp(`<${componentName}[\\s/>]`, 'g');
  return findAllOccurrences(content, pattern);
}

/**
 * Find HTML custom element usage
 */
export function findCustomElementUsages(content: string, tagName: string): Array<{ index: number; match: string }> {
  const pattern = new RegExp(`<${tagName}[\\s/>]`, 'gi');
  return findAllOccurrences(content, pattern);
}

/**
 * Check if content contains JSX syntax
 */
export function containsJsx(content: string): boolean {
  // Look for JSX patterns: self-closing tags, className, etc.
  return /<[A-Z][a-zA-Z]*[\s/>]/.test(content) || 
         /className=/.test(content) ||
         /<\/[A-Z][a-zA-Z]*>/.test(content);
}

// ============================================================================
// Indentation Utilities
// ============================================================================

/**
 * Detect the indentation style used in content
 */
export function detectIndentation(content: string): { char: string; size: number } {
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const indent = match[1];
      if (indent.includes('\t')) {
        return { char: '\t', size: 1 };
      } else {
        return { char: ' ', size: indent.length };
      }
    }
  }
  
  return { char: '  ', size: 2 }; // Default to 2 spaces
}

/**
 * Get indentation at a specific line
 */
export function getLineIndentation(content: string, lineNumber: number): string {
  const line = getLineContent(content, lineNumber);
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Add indentation to each line of a text block
 */
export function indentText(text: string, indent: string): string {
  return text.split('\n').map(line => line ? indent + line : line).join('\n');
}

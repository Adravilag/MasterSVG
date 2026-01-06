/**
 * Output File Manager utilities
 * Functions for managing icons.js, sprite.svg, and related output files
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * SVG attributes extracted from SVG content
 */
export interface SvgAttributes {
  viewBox?: string;
  width?: string;
  height?: string;
}

/**
 * Animation config for icons
 */
export interface IconAnimationConfig {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

/**
 * Icon entry in the icons file
 */
export interface IconEntry {
  name: string;
  body: string;
  viewBox: string;
  animation?: IconAnimationConfig;
}

/**
 * Transformer interface for SVG operations
 */
export interface SvgTransformerInterface {
  extractSvgBody(svg: string): string;
  extractSvgAttributes(svg: string): SvgAttributes;
}

// ==================== Variable Name Conversion ====================

/**
 * Convert kebab-case icon name to camelCase variable name
 * @example toVariableName('arrow-right') => 'arrowRight'
 * @example toVariableName('mdi:home') => 'mdiHome'
 */
export function toVariableName(name: string): string {
  return name
    .split(/[-:]/)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/**
 * Convert camelCase variable name back to kebab-case
 * @example toIconName('arrowRight') => 'arrow-right'
 */
export function toIconName(varName: string): string {
  return varName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ==================== Icon Entry Generation ====================

/**
 * Generate an icon entry object for icons.js
 */
export function generateIconEntry(
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): IconEntry {
  return {
    name: iconName,
    body,
    viewBox,
  };
}

/**
 * Generate export statement for an icon
 */
export function generateIconExport(
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24',
  animation?: IconAnimationConfig
): string {
  const varName = toVariableName(iconName);
  if (animation) {
    const delay = animation.delay ?? 0;
    const direction = animation.direction || 'normal';
    return `export const ${varName} = {
  name: '${iconName}',
  body: \`${body}\`,
  viewBox: '${viewBox}',
  animation: { type: '${animation.type}', duration: ${animation.duration}, timing: '${animation.timing}', iteration: '${animation.iteration}', delay: ${delay}, direction: '${direction}' }
};`;
  }
  return `export const ${varName} = {
  name: '${iconName}',
  body: \`${body}\`,
  viewBox: '${viewBox}'
};`;
}

// ==================== Icons File Operations ====================

/**
 * Check if an icon export exists in file content
 */
export function iconExportExistsInContent(content: string, iconName: string): boolean {
  const varName = toVariableName(iconName);
  const pattern = new RegExp(`export\\s+const\\s+${varName}\\s*=`);
  return pattern.test(content);
}

/**
 * Replace an existing icon export in content
 */
export function replaceIconExportInContent(
  content: string,
  iconName: string,
  newExport: string
): string {
  const varName = toVariableName(iconName);
  const regex = new RegExp(`export const ${varName} = \\{[\\s\\S]*?\\};`, 'g');
  return content.replace(regex, newExport);
}

/**
 * Find the position of the icons object in content
 * @returns The index where icons object starts, or -1 if not found
 */
export function findIconsObjectPosition(content: string): number {
  const match = content.match(/export const icons = \{/);
  return match?.index ?? -1;
}

/**
 * Extract the icons object content by properly matching braces
 * @returns Object with start index (after opening brace), end index (before closing brace), and inner content
 */
export function extractIconsObjectContent(
  content: string
): { startIndex: number; endIndex: number; inner: string } | null {
  const iconsMatch = content.match(/export const icons = \{/);
  if (!iconsMatch || iconsMatch.index === undefined) {
    return null;
  }

  const startIndex = iconsMatch.index + iconsMatch[0].length;
  let braceCount = 1;
  let endIndex = startIndex;

  while (braceCount > 0 && endIndex < content.length) {
    if (content[endIndex] === '{') braceCount++;
    if (content[endIndex] === '}') braceCount--;
    endIndex++;
  }

  return {
    startIndex,
    endIndex: endIndex - 1, // Position of closing brace
    inner: content.substring(startIndex, endIndex - 1),
  };
}

/**
 * Add a new icon export before the icons object
 */
export function addIconBeforeIconsObject(
  content: string,
  iconExport: string,
  iconName: string
): string {
  const varName = toVariableName(iconName);
  const iconsObjPos = findIconsObjectPosition(content);

  if (iconsObjPos !== -1) {
    // Insert before icons object
    let newContent =
      content.slice(0, iconsObjPos) + iconExport + '\n\n' + content.slice(iconsObjPos);

    // Add to the icons object using proper brace matching
    // Use original name as key, variable name as value
    const iconEntry = `'${iconName}': ${varName}`;
    const objData = extractIconsObjectContent(newContent);
    if (objData) {
      const existingIcons = objData.inner.trim();
      const newInner = existingIcons ? `${existingIcons},\n  ${iconEntry}` : `\n  ${iconEntry}\n`;
      newContent =
        newContent.substring(0, objData.startIndex) +
        newInner +
        newContent.substring(objData.endIndex);
    }
    return newContent;
  }

  // No icons object found, append at end
  return content + '\n\n' + iconExport;
}

/**
 * Update icons file content with a new or updated icon
 */
export function updateIconsFileContent(
  content: string,
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): string {
  const iconExport = generateIconExport(iconName, body, viewBox);

  if (iconExportExistsInContent(content, iconName)) {
    return replaceIconExportInContent(content, iconName, iconExport);
  }

  return addIconBeforeIconsObject(content, iconExport, iconName);
}

/**
 * Generate new icons.js file content
 */
export function generateNewIconsFileContent(
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): string {
  const varName = toVariableName(iconName);
  const iconExport = generateIconExport(iconName, body, viewBox);

  return `// Auto-generated by MasterSVG
// Do not edit manually

${iconExport}

export const icons = {
  '${iconName}': ${varName}
};
`;
}

// ==================== Sprite File Operations ====================

/**
 * Generate a symbol element for sprite.svg
 */
export function generateSpriteSymbol(
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): string {
  return `  <symbol id="${iconName}" viewBox="${viewBox}">\n    ${body}\n  </symbol>`;
}

/**
 * Check if a symbol exists in sprite content
 */
export function symbolExistsInSprite(content: string, iconName: string): boolean {
  const pattern = new RegExp(`<symbol[^>]*id=["']${iconName}["']`);
  return pattern.test(content);
}

/**
 * Replace an existing symbol in sprite content
 */
export function replaceSymbolInSprite(
  content: string,
  iconName: string,
  newSymbol: string
): string {
  const pattern = new RegExp(`<symbol[^>]*id=["']${iconName}["'][\\s\\S]*?<\\/symbol>`, 'g');
  return content.replace(pattern, newSymbol);
}

/**
 * Add a new symbol to sprite content (before closing </svg>)
 */
export function addSymbolToSprite(content: string, symbol: string): string {
  return content.replace('</svg>', `${symbol}\n</svg>`);
}

/**
 * Update sprite file content with a new or updated symbol
 */
export function updateSpriteContent(
  content: string,
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): string {
  const symbol = generateSpriteSymbol(iconName, body, viewBox);

  if (symbolExistsInSprite(content, iconName)) {
    return replaceSymbolInSprite(content, iconName, symbol);
  }

  return addSymbolToSprite(content, symbol);
}

/**
 * Generate new sprite.svg file content
 */
export function generateNewSpriteContent(
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): string {
  const symbol = generateSpriteSymbol(iconName, body, viewBox);
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
${symbol}
</svg>
`;
}

// ==================== Variants File Operations ====================

/**
 * Generate default variants.js content
 */
export function generateDefaultVariantsContent(): string {
  return `// Auto-generated by MasterSVG
// Variants for icons - edit freely or use the Icon Editor

// NOTE: defaultVariants support removed - variant must be specified explicitly

export const colorMappings = {
};

export const Variants = {
};
`;
}

// ==================== Animations File Operations ====================

/**
 * Generate default animations.js content
 */
export function generateDefaultAnimationsContent(): string {
  return `// Auto-generated by MasterSVG
// Animations for icons - defines default animation per icon
// Use: <svg-icon name="icon-name" animation="spin"></svg-icon>
// Available animations: spin, pulse, bounce, shake, fade

export const animations = {
};
`;
}

// ==================== File System Operations ====================

/**
 * Ensure a directory exists, creating it recursively if necessary
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read file content if it exists, return null otherwise
 */
export function readFileIfExists(filePath: string): string | null {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

/**
 * Write content to a file, creating directories if needed
 */
export function writeFileSafe(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(filePath, content);
}

/**
 * Create a file if it doesn't exist
 */
export function createFileIfNotExists(filePath: string, content: string): boolean {
  if (!fs.existsSync(filePath)) {
    writeFileSafe(filePath, content);
    return true;
  }
  return false;
}

// ==================== High-Level Operations ====================

/**
 * Add or update an icon in icons.js file
 */
export function addIconToIconsFile(
  outputPath: string,
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): void {
  const iconsPath = path.join(outputPath, 'icons.js');
  const existingContent = readFileIfExists(iconsPath);

  if (existingContent) {
    const updatedContent = updateIconsFileContent(existingContent, iconName, body, viewBox);
    fs.writeFileSync(iconsPath, updatedContent);
  } else {
    const newContent = generateNewIconsFileContent(iconName, body, viewBox);
    writeFileSafe(iconsPath, newContent);
  }
}

/**
 * Add or update an icon in sprite.svg file
 */
export function addIconToSpriteFile(
  outputPath: string,
  iconName: string,
  body: string,
  viewBox: string = '0 0 24 24'
): void {
  const spritePath = path.join(outputPath, 'sprite.svg');
  const existingContent = readFileIfExists(spritePath);

  if (existingContent) {
    const updatedContent = updateSpriteContent(existingContent, iconName, body, viewBox);
    fs.writeFileSync(spritePath, updatedContent);
  } else {
    const newContent = generateNewSpriteContent(iconName, body, viewBox);
    writeFileSafe(spritePath, newContent);
  }
}

/**
 * Create supporting files (variants.js, animations.js) if they don't exist
 */
export function createSupportingFilesIfNeeded(outputPath: string): {
  variantsCreated: boolean;
  animationsCreated: boolean;
} {
  const variantsPath = path.join(outputPath, 'variants.js');
  const animationsPath = path.join(outputPath, 'animations.js');

  return {
    variantsCreated: createFileIfNotExists(variantsPath, generateDefaultVariantsContent()),
    animationsCreated: createFileIfNotExists(animationsPath, generateDefaultAnimationsContent()),
  };
}

// ==================== Icon Removal Operations ====================

/**
 * Remove an icon export from icons.js content
 */
export function removeIconExportFromContent(content: string, iconName: string): string {
  const varName = toVariableName(iconName);

  // Remove the export statement - use word boundary to avoid matching partial names
  const exportRegex = new RegExp(`export const ${varName}\\s*=\\s*\\{[\\s\\S]*?\\};\\n?\\n?`, 'g');
  let result = content.replace(exportRegex, '');

  // Remove from icons object - handle both formats:
  // 1. Old format: varName or varName,
  // 2. New format: 'icon-name': varName or 'icon-name': varName,
  const oldFormatRegex = new RegExp(`\\s*\\b${varName}\\b,?`, 'g');
  const newFormatRegex = new RegExp(`\\s*['"]${iconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:\\s*${varName},?`, 'g');
  const iconsMatch = result.match(/export const icons = \{/);

  if (iconsMatch && iconsMatch.index !== undefined) {
    const startIndex = iconsMatch.index + iconsMatch[0].length;
    // Find the matching closing brace by counting braces
    let braceCount = 1;
    let endIndex = startIndex;
    while (braceCount > 0 && endIndex < result.length) {
      if (result[endIndex] === '{') braceCount++;
      if (result[endIndex] === '}') braceCount--;
      endIndex++;
    }

    // Extract the inner content of the icons object
    const inner = result.substring(startIndex, endIndex - 1);
    // Try new format first, then old format
    let cleaned = inner.replace(newFormatRegex, '').replace(oldFormatRegex, '').trim();

    // Remove trailing commas and clean up
    cleaned = cleaned.replace(/,\s*$/, '');

    // Check if only comments remain (no actual icon names)
    // Remove the placeholder comment if no icons left
    const withoutComments = cleaned.replace(/\/\/[^\n]*/g, '').trim();
    if (!withoutComments || withoutComments === ',') {
      cleaned = '';
    }

    // Format the inner content properly
    // If empty, create an empty object with proper formatting
    // If has content, wrap with newlines and proper indentation
    let newInner: string;
    if (!cleaned) {
      newInner = ''; // Will result in `export const icons = {};`
    } else {
      // Ensure proper formatting with each icon on its own line
      const iconNames = cleaned
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      newInner = '\n  ' + iconNames.join(',\n  ') + '\n';
    }

    result = result.substring(0, startIndex) + newInner + result.substring(endIndex - 1);
  }

  // Clean up extra newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Remove a symbol from sprite.svg content
 */
export function removeSymbolFromSpriteContent(content: string, iconName: string): string {
  const pattern = new RegExp(`\\s*<symbol[^>]*id=["']${iconName}["'][\\s\\S]*?<\\/symbol>`, 'g');
  return content.replace(pattern, '');
}

// ==================== Bulk Operations ====================

/**
 * Build multiple icons into icons.js content
 */
export function buildIconsFileContent(
  icons: Array<{ name: string; svg: string; animation?: IconAnimationConfig }>,
  transformer: SvgTransformerInterface
): string {
  let iconExports = '// Auto-generated by MasterSVG\n// Do not edit manually\n\n';
  const iconEntries: string[] = [];

  for (const icon of icons) {
    if (!icon.svg) continue;

    const varName = toVariableName(icon.name);
    const body = transformer.extractSvgBody(icon.svg);
    const attrs = transformer.extractSvgAttributes(icon.svg);

    iconExports +=
      generateIconExport(icon.name, body, attrs.viewBox || '0 0 24 24', icon.animation) + '\n\n';
    // Use original name as key, variable name as value
    iconEntries.push(`'${icon.name}': ${varName}`);
  }

  iconExports += `export const icons = {\n  ${iconEntries.join(',\n  ')}\n};\n`;

  return iconExports;
}

/**
 * Build sprite.svg content from multiple icons
 */
export function buildSpriteFileContent(
  icons: Array<{ name: string; svg: string }>,
  transformer: SvgTransformerInterface
): string {
  let spriteContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none">
  <defs>\n`;

  for (const icon of icons) {
    if (!icon.svg) continue;
    const body = transformer.extractSvgBody(icon.svg);
    const attrs = transformer.extractSvgAttributes(icon.svg);
    spriteContent += `    <symbol id="${icon.name}" viewBox="${attrs.viewBox || '0 0 24 24'}">${body}</symbol>\n`;
  }

  spriteContent += `  </defs>
</svg>`;

  return spriteContent;
}

// ==================== Path Utilities ====================

/**
 * Get icons.js file path
 */
export function getIconsFilePath(outputPath: string): string {
  return path.join(outputPath, 'icons.js');
}

/**
 * Get sprite.svg file path
 */
export function getSpriteFilePath(outputPath: string): string {
  return path.join(outputPath, 'sprite.svg');
}

/**
 * Get icon.js (web component) file path
 */
export function getWebComponentFilePath(outputPath: string): string {
  return path.join(outputPath, 'icon.js');
}

/**
 * Get variants.js file path
 */
export function getVariantsFilePath(outputPath: string): string {
  return path.join(outputPath, 'variants.js');
}

/**
 * Get animations.js file path
 */
export function getAnimationsFilePath(outputPath: string): string {
  return path.join(outputPath, 'animations.js');
}

/**
 * Calculate relative path from one file to another
 */
export function calculateRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile).replace(/\\/g, '/');

  // Ensure it starts with ./ for relative imports
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

// ==================== Icon Count Operations ====================

/**
 * Count icons in icons.js content
 */
export function countIconsInContent(content: string): number {
  const matches = content.match(/export const \w+ = \{[^}]*name:/g);
  return matches?.length ?? 0;
}

/**
 * Count symbols in sprite.svg content
 */
export function countSymbolsInSprite(content: string): number {
  const matches = content.match(/<symbol\s/g);
  return matches?.length ?? 0;
}

/**
 * Extract all icon names from icons.js content
 */
export function extractIconNamesFromContent(content: string): string[] {
  const names: string[] = [];
  const regex = /name:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Extract all symbol IDs from sprite.svg content
 */
export function extractSymbolIdsFromSprite(content: string): string[] {
  const ids: string[] = [];
  const regex = /<symbol[^>]*id=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

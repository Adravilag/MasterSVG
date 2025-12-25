/**
 * Name conversion utilities for icons and components
 * Extracted from extension.ts for better testability
 */

/**
 * Convert icon name (kebab-case) to variable name (camelCase)
 * Example: "arrow-right" -> "arrowRight"
 * Example: "mdi:home" -> "mdiHome"
 */
export function toVariableName(name: string): string {
  if (!name) return '';
  return name
    .split(/[-:]/)
    .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert variable name (camelCase/PascalCase) to icon name (kebab-case)
 * Example: "arrowRight" -> "arrow-right"
 * Example: "ArrowRight" -> "arrow-right"
 */
export function toKebabCase(name: string): string {
  if (!name) return '';
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert to PascalCase for component names
 * Example: "arrow-right" -> "ArrowRight"
 * Example: "my_icon" -> "MyIcon"
 */
export function toPascalCase(name: string): string {
  if (!name) return '';
  return name
    .split(/[-_:\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert to snake_case
 * Example: "arrowRight" -> "arrow_right"
 * Example: "ArrowRight" -> "arrow_right"
 */
export function toSnakeCase(name: string): string {
  if (!name) return '';
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Convert to custom element name (must contain hyphen)
 * Example: "Icon" -> "icon-icon"
 * Example: "MyIcon" -> "my-icon"
 * Example: "sg-icon" -> "sg-icon" (unchanged)
 */
export function toCustomElementName(name: string): string {
  if (!name) return 'icon-element';
  
  let tagName = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  
  // Custom elements MUST have a hyphen
  if (!tagName.includes('-')) {
    tagName = `${tagName}-icon`;
  }
  
  return tagName;
}

/**
 * Convert to constant name (SCREAMING_SNAKE_CASE)
 * Example: "arrowRight" -> "ARROW_RIGHT"
 */
export function toConstantCase(name: string): string {
  if (!name) return '';
  return toSnakeCase(name).toUpperCase();
}

/**
 * Sanitize name for use as identifier
 * Removes invalid characters and ensures valid JS identifier
 */
export function sanitizeIdentifier(name: string): string {
  if (!name) return 'unnamed';
  
  // Replace invalid chars with underscore
  let result = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  
  // If starts with number, prefix with underscore
  if (/^[0-9]/.test(result)) {
    result = '_' + result;
  }
  
  // Remove consecutive underscores
  result = result.replace(/_+/g, '_');
  
  return result || 'unnamed';
}

/**
 * Extract icon name from file path
 * Example: "/path/to/arrow-right.svg" -> "arrow-right"
 * Example: "C:\\icons\\my-icon.svg" -> "my-icon"
 */
export function extractIconNameFromPath(filePath: string): string {
  if (!filePath) return '';
  
  // Get filename without extension
  const fileName = filePath
    .replace(/\\/g, '/')
    .split('/')
    .pop() || '';
  
  // Remove extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // Clean up the name
  return nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Parse collection prefix from icon name
 * Example: "mdi:home" -> { prefix: "mdi", name: "home" }
 * Example: "arrow-right" -> { prefix: null, name: "arrow-right" }
 */
export function parseIconPrefix(iconName: string): { prefix: string | null; name: string } {
  if (!iconName) return { prefix: null, name: '' };
  
  const colonIndex = iconName.indexOf(':');
  if (colonIndex > 0) {
    return {
      prefix: iconName.substring(0, colonIndex),
      name: iconName.substring(colonIndex + 1)
    };
  }
  
  return { prefix: null, name: iconName };
}

/**
 * Format icon name with prefix
 * Example: ("mdi", "home") -> "mdi:home"
 * Example: (null, "arrow") -> "arrow"
 */
export function formatIconWithPrefix(prefix: string | null, name: string): string {
  if (!name) return '';
  if (!prefix) return name;
  return `${prefix}:${name}`;
}

/**
 * Normalize icon name for consistent lookup
 * Handles case variations and formatting
 */
export function normalizeIconName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9:-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Check if name is a valid icon name
 * Must be lowercase, alphanumeric with hyphens, colons allowed for prefixes
 */
export function isValidIconName(name: string): boolean {
  if (!name || name.length === 0) return false;
  return /^[a-z][a-z0-9]*(?:[-:][a-z0-9]+)*$/.test(name);
}

/**
 * Check if name is a valid JavaScript identifier
 */
export function isValidIdentifier(name: string): boolean {
  if (!name) return false;
  // Must not start with number, only alphanumeric and underscore/$
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Generate unique name by appending number if needed
 * Example: ("icon", ["icon", "icon-1"]) -> "icon-2"
 */
export function generateUniqueName(baseName: string, existingNames: string[]): string {
  if (!baseName) baseName = 'icon';
  
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  
  let counter = 1;
  let newName = `${baseName}-${counter}`;
  
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName}-${counter}`;
  }
  
  return newName;
}

/**
 * Truncate name to max length, preserving meaning
 */
export function truncateName(name: string, maxLength: number): string {
  if (!name || name.length <= maxLength) return name || '';
  
  // Try to truncate at word boundary
  const truncated = name.substring(0, maxLength);
  const lastHyphen = truncated.lastIndexOf('-');
  
  if (lastHyphen > maxLength / 2) {
    return truncated.substring(0, lastHyphen);
  }
  
  return truncated;
}

/**
 * Compare icon names for sorting (alphabetical, case-insensitive)
 */
export function compareIconNames(a: string, b: string): number {
  const normalizedA = normalizeIconName(a);
  const normalizedB = normalizeIconName(b);
  return normalizedA.localeCompare(normalizedB);
}

/**
 * Group icon names by prefix
 * Example: ["mdi:home", "mdi:star", "fa:user"] -> { mdi: ["home", "star"], fa: ["user"] }
 */
export function groupIconsByPrefix(iconNames: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  
  for (const fullName of iconNames) {
    const { prefix, name } = parseIconPrefix(fullName);
    const key = prefix || '_unprefixed';
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(name);
  }
  
  return groups;
}

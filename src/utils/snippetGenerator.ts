/**
 * Utility functions for generating code snippets for icon usage
 * Extracted from extension.ts for better testability
 */

/**
 * Supported output formats for icon components
 */
export type IconFormat = 'jsx' | 'vue' | 'svelte' | 'astro' | 'html' | 'angular' | 'webcomponent';

/**
 * Snippet generation options
 */
export interface SnippetOptions {
  componentName?: string;
  nameAttribute?: string;
  format?: IconFormat;
  useTabstops?: boolean;
  includeSizeProps?: boolean;
  includeClassProp?: boolean;
}

/**
 * Default options for snippet generation
 */
export const DEFAULT_SNIPPET_OPTIONS: Required<SnippetOptions> = {
  componentName: 'Icon',
  nameAttribute: 'name',
  format: 'jsx',
  useTabstops: true,
  includeSizeProps: false,
  includeClassProp: false,
};

/**
 * Get output format based on VS Code language ID
 */
export function getOutputFormatFromLanguageId(languageId: string): IconFormat {
  const formatMap: Record<string, IconFormat> = {
    'javascriptreact': 'jsx',
    'typescriptreact': 'jsx',
    'vue': 'vue',
    'svelte': 'svelte',
    'astro': 'astro',
    'html': 'html',
    'angular': 'angular',
    'javascript': 'jsx',
    'typescript': 'jsx',
  };
  return formatMap[languageId] || 'jsx';
}

/**
 * Generate an icon snippet for a given format
 */
export function generateIconSnippet(
  iconName: string,
  options: SnippetOptions = {}
): string {
  const opts = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const { componentName, nameAttribute, format, useTabstops, includeSizeProps, includeClassProp } = opts;
  
  // Build props string
  const props: string[] = [`${nameAttribute}="${iconName}"`];
  
  if (includeSizeProps && useTabstops) {
    props.push('size={${1:24}}');
  }
  
  if (includeClassProp && useTabstops) {
    props.push('className="${2:}"');
  }
  
  const propsString = props.join(' ');
  
  switch (format) {
    case 'jsx':
      return `<${componentName} ${propsString} />`;
    
    case 'vue':
      return `<${componentName} ${propsString} />`;
    
    case 'svelte':
      return `<${componentName} ${propsString} />`;
    
    case 'astro':
      return `<${componentName} ${propsString} />`;
    
    case 'angular':
      return `<${toKebabCase(componentName)} ${propsString}></${toKebabCase(componentName)}>`;
    
    case 'webcomponent':
      const tagName = toKebabCase(componentName);
      return `<${tagName} ${propsString}></${tagName}>`;
    
    case 'html':
    default:
      return `<iconify-icon icon="${iconName}"></iconify-icon>`;
  }
}

/**
 * Generate an icon component import statement
 */
export function generateImportStatement(
  componentName: string,
  importPath: string,
  format: IconFormat = 'jsx'
): string {
  switch (format) {
    case 'vue':
      return `import ${componentName} from '${importPath}.vue'`;
    
    case 'svelte':
      return `import ${componentName} from '${importPath}.svelte'`;
    
    case 'angular':
      return `// Add ${componentName}Component to module imports`;
    
    case 'jsx':
    default:
      return `import { ${componentName} } from '${importPath}'`;
  }
}

/**
 * Generate snippet with size variants
 */
export function generateSizedIconSnippet(
  iconName: string,
  size: number | string,
  options: SnippetOptions = {}
): string {
  const opts = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const { componentName, nameAttribute, format } = opts;
  
  const sizeAttr = typeof size === 'number' ? `size={${size}}` : `size="${size}"`;
  
  switch (format) {
    case 'jsx':
      return `<${componentName} ${nameAttribute}="${iconName}" ${sizeAttr} />`;
    
    case 'vue':
      const vueSize = typeof size === 'number' ? `:size="${size}"` : `size="${size}"`;
      return `<${componentName} ${nameAttribute}="${iconName}" ${vueSize} />`;
    
    case 'svelte':
      return `<${componentName} ${nameAttribute}="${iconName}" ${sizeAttr} />`;
    
    case 'html':
    default:
      return `<iconify-icon icon="${iconName}" width="${size}" height="${size}"></iconify-icon>`;
  }
}

/**
 * Generate snippet with color
 */
export function generateColoredIconSnippet(
  iconName: string,
  color: string,
  options: SnippetOptions = {}
): string {
  const opts = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const { componentName, nameAttribute, format } = opts;
  
  switch (format) {
    case 'jsx':
      return `<${componentName} ${nameAttribute}="${iconName}" color="${color}" />`;
    
    case 'vue':
      return `<${componentName} ${nameAttribute}="${iconName}" color="${color}" />`;
    
    case 'svelte':
      return `<${componentName} ${nameAttribute}="${iconName}" color="${color}" />`;
    
    case 'html':
    default:
      return `<iconify-icon icon="${iconName}" style="color: ${color}"></iconify-icon>`;
  }
}

/**
 * Generate snippet with animation
 */
export function generateAnimatedIconSnippet(
  iconName: string,
  animation: 'spin' | 'pulse' | 'bounce' | 'shake' | 'fade',
  options: SnippetOptions = {}
): string {
  const opts = { ...DEFAULT_SNIPPET_OPTIONS, ...options };
  const { componentName, nameAttribute, format } = opts;
  
  const animationClass = `icon-${animation}`;
  
  switch (format) {
    case 'jsx':
      return `<${componentName} ${nameAttribute}="${iconName}" className="${animationClass}" />`;
    
    case 'vue':
      return `<${componentName} ${nameAttribute}="${iconName}" class="${animationClass}" />`;
    
    case 'svelte':
      return `<${componentName} ${nameAttribute}="${iconName}" class="${animationClass}" />`;
    
    case 'html':
    default:
      return `<iconify-icon icon="${iconName}" class="${animationClass}"></iconify-icon>`;
  }
}

/**
 * Generate a use element for SVG sprites
 */
export function generateSpriteUseSnippet(
  iconName: string,
  spritePath: string = '/sprite.svg',
  options: { size?: number; className?: string } = {}
): string {
  const { size = 24, className } = options;
  const classAttr = className ? ` class="${className}"` : '';
  
  return `<svg width="${size}" height="${size}"${classAttr}>
  <use href="${spritePath}#${iconName}"></use>
</svg>`;
}

/**
 * Generate an inline SVG snippet
 */
export function generateInlineSvgSnippet(
  svgContent: string,
  options: { size?: number; className?: string; ariaLabel?: string } = {}
): string {
  const { size, className, ariaLabel } = options;
  
  let svg = svgContent;
  
  // Add size attributes if specified
  if (size) {
    svg = svg.replace(/<svg/, `<svg width="${size}" height="${size}"`);
  }
  
  // Add class if specified
  if (className) {
    svg = svg.replace(/<svg/, `<svg class="${className}"`);
  }
  
  // Add aria-label if specified
  if (ariaLabel) {
    svg = svg.replace(/<svg/, `<svg aria-label="${ariaLabel}" role="img"`);
  }
  
  return svg;
}

/**
 * Generate React component snippet
 */
export function generateReactComponentSnippet(
  iconName: string,
  svgBody: string,
  viewBox: string = '0 0 24 24'
): string {
  const componentName = toPascalCase(iconName);
  
  return `import React from 'react';

export const ${componentName}: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${viewBox}"
    fill="currentColor"
    {...props}
  >
    ${svgBody}
  </svg>
);`;
}

/**
 * Generate Vue component snippet
 */
export function generateVueComponentSnippet(
  iconName: string,
  svgBody: string,
  viewBox: string = '0 0 24 24'
): string {
  return `<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${viewBox}"
    fill="currentColor"
    v-bind="$attrs"
  >
    ${svgBody}
  </svg>
</template>

<script setup lang="ts">
defineOptions({
  name: '${toPascalCase(iconName)}',
  inheritAttrs: false,
});
</script>`;
}

/**
 * Generate Svelte component snippet
 */
export function generateSvelteComponentSnippet(
  iconName: string,
  svgBody: string,
  viewBox: string = '0 0 24 24'
): string {
  return `<script lang="ts">
  export let size: number | string = 24;
  export let color: string = 'currentColor';
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  width={size}
  height={size}
  fill={color}
  {...$$restProps}
>
  ${svgBody}
</svg>`;
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Generate icon usage example for documentation
 */
export function generateUsageExample(
  iconName: string,
  componentName: string = 'Icon',
  format: IconFormat = 'jsx'
): string {
  const basic = generateIconSnippet(iconName, { componentName, format, useTabstops: false });
  const sized = generateSizedIconSnippet(iconName, 32, { componentName, format });
  const colored = generateColoredIconSnippet(iconName, '#3b82f6', { componentName, format });
  
  return `// Basic usage
${basic}

// With size
${sized}

// With color
${colored}`;
}

/**
 * Generate icon set import for batch usage
 */
export function generateIconSetImport(
  iconNames: string[],
  importPath: string
): string {
  const imports = iconNames.map(name => toPascalCase(name)).join(', ');
  return `import { ${imports} } from '${importPath}'`;
}

/**
 * Check if snippet needs closing tag
 */
export function needsClosingTag(format: IconFormat): boolean {
  return ['html', 'angular', 'webcomponent'].includes(format);
}

/**
 * Get file extension for format
 */
export function getFileExtensionForFormat(format: IconFormat): string {
  const extensions: Record<IconFormat, string> = {
    'jsx': '.tsx',
    'vue': '.vue',
    'svelte': '.svelte',
    'astro': '.astro',
    'html': '.html',
    'angular': '.component.ts',
    'webcomponent': '.ts',
  };
  return extensions[format] || '.tsx';
}

/**
 * Generate complete icon file content
 */
export function generateIconFileContent(
  iconName: string,
  svgBody: string,
  format: IconFormat,
  viewBox: string = '0 0 24 24'
): string {
  switch (format) {
    case 'jsx':
      return generateReactComponentSnippet(iconName, svgBody, viewBox);
    case 'vue':
      return generateVueComponentSnippet(iconName, svgBody, viewBox);
    case 'svelte':
      return generateSvelteComponentSnippet(iconName, svgBody, viewBox);
    default:
      return generateReactComponentSnippet(iconName, svgBody, viewBox);
  }
}

/**
 * Parse icon name from component usage
 */
export function parseIconNameFromUsage(code: string): string | null {
  // Match name="icon-name" or name='icon-name'
  const nameMatch = code.match(/name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) return nameMatch[1];
  
  // Match icon="prefix:name"
  const iconMatch = code.match(/icon\s*=\s*["']([^"']+)["']/);
  if (iconMatch) return iconMatch[1];
  
  return null;
}

/**
 * Extract component name from JSX/TSX code
 */
export function extractComponentNameFromCode(code: string): string | null {
  const match = code.match(/<([A-Z][a-zA-Z0-9]*)\s/);
  return match ? match[1] : null;
}

/**
 * Generate TypeScript type definition for icon names
 */
export function generateIconTypeDefinition(iconNames: string[]): string {
  const unionType = iconNames.map(name => `'${name}'`).join(' | ');
  return `export type IconName = ${unionType};

export const iconNames = [${iconNames.map(n => `'${n}'`).join(', ')}] as const;`;
}

/**
 * Generate icon manifest JSON
 */
export function generateIconManifest(
  icons: Array<{ name: string; category?: string; tags?: string[] }>
): string {
  return JSON.stringify({
    version: '1.0.0',
    icons: icons.map(icon => ({
      name: icon.name,
      category: icon.category || 'uncategorized',
      tags: icon.tags || [],
    })),
    total: icons.length,
    generatedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Extension Helper Functions
 * 
 * Funciones utilitarias extraídas de extension.ts para facilitar testing
 */
import * as path from 'node:path';

// Cache for loaded templates
const templateCache: Map<string, string> = new Map();

/**
 * Loads a template file from the templates directory.
 * Templates are cached for performance.
 * Uses require('fs') to avoid being mocked in tests - templates should always load from disk.
 * @param templateName - The filename of the template (e.g., 'IconWebComponent.js')
 * @returns The template content as a string
 */
export function loadTemplate(templateName: string): string {
  // Check cache first
  const cached = templateCache.get(templateName);
  if (cached) {
    return cached;
  }
  
  // Use require('fs') to get the real fs module, not a mocked version
  // This ensures templates are always loaded from disk even in tests
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realFs = require('fs');
  
  // Load from disk - path is relative to utils folder
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templatePath = path.join(templatesDir, templateName);
  
  const content = realFs.readFileSync(templatePath, 'utf-8');
  templateCache.set(templateName, content);
  
  return content;
}

/**
 * Clears the template cache. Useful for testing or hot reloading.
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Obtiene el formato de salida basado en el languageId del documento
 */
export function getOutputFormat(languageId: string): string {
  const formatMap: Record<string, string> = {
    'javascriptreact': 'jsx',
    'typescriptreact': 'jsx',
    'vue': 'vue',
    'svelte': 'svelte',
    'astro': 'astro',
    'html': 'html'
  };
  return formatMap[languageId] || 'jsx';
}

/**
 * Genera un snippet de código para insertar un componente de icono
 */
export function generateIconSnippet(
  iconName: string,
  componentName: string,
  nameAttr: string,
  format: string
): string {
  switch (format) {
    case 'vue':
      return `<${componentName} ${nameAttr}="${iconName}" \${1::size="\${2:24}"} />`;
    case 'svelte':
      return `<${componentName} ${nameAttr}="${iconName}" \${1:size={\${2:24}}} />`;
    case 'astro':
      return `<${componentName} ${nameAttr}="${iconName}" \${1:size={\${2:24}}} />`;
    case 'html':
      return `<${componentName} ${nameAttr}="${iconName}"\${1: size="\${2:24}"}></${componentName}>`;
    default: // jsx
      return `<${componentName} ${nameAttr}="${iconName}" \${1:size={\${2:24}}} />`;
  }
}

/**
 * Convierte un nombre de icono (ej: "arrow-right") a un nombre de variable válido (ej: "arrowRight")
 */
export function toVariableName(name: string): string {
  return name
    .split(/[-:]/)
    .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convierte un nombre a kebab-case para usar como nombre de icono
 */
export function toIconName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase to kebab-case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanumeric with dashes
    .replace(/^-|-$/g, '');  // remove leading/trailing dashes
}

/**
 * Convierte un nombre a kebab-case para usar como tag de custom element
 * Los custom elements DEBEN tener un guión
 */
export function toCustomElementName(componentName: string): string {
  let tagName = componentName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  
  // Custom elements MUST have a hyphen - if none, add suffix
  if (!tagName.includes('-')) {
    tagName = `${tagName}-icon`;
  }
  
  return tagName;
}

/**
 * Encuentra la mejor posición para insertar un import en un archivo
 * Retorna el número de línea donde insertar
 */
export function findImportInsertPosition(text: string): number {
  const lines = text.split('\n');
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
 * Verifica si un import ya existe para un componente
 */
export function hasImport(text: string, componentName: string): boolean {
  const importRegex = new RegExp(`import.*${componentName}.*from`);
  return importRegex.test(text);
}

/**
 * Genera el statement de import para un componente
 */
export function generateImportStatement(componentName: string, importPath: string): string {
  return `import { ${componentName} } from '${importPath}';\n`;
}

/**
 * Genera contenido del archivo icons.js para un nuevo icono
 */
export function generateIconEntry(
  varName: string,
  iconName: string,
  body: string,
  viewBox: string
): string {
  return `export const ${varName} = {
  name: '${iconName}',
  body: \`${body}\`,
  viewBox: '${viewBox}'
};`;
}

/**
 * Genera el contenido inicial de icons.js
 */
export function generateIconsFileContent(iconEntry: string, varName: string): string {
  return `// Auto-generated by Icon Manager
// Do not edit manually

${iconEntry}

export const icons = {
  ${varName}
};
`;
}

/**
 * Genera el contenido inicial de variants.js
 */
export function generateVariantsFileContent(): string {
  return `// Auto-generated by Icon Manager
// Variants for icons - edit freely or use the Icon Editor

// Default Variant for each icon (used when no variant attribute is specified)
export const defaultVariants = {
};

export const Variants = {
};
`;
}

/**
 * Genera el contenido inicial de animations.js
 */
export function generateAnimationsFileContent(): string {
  return `// Auto-generated by Icon Manager
// Animations for icons - defines default animation per icon
// Use: <bz-icon name="icon-name" animation="spin"></bz-icon>
// Available animations: spin, pulse, bounce, shake, fade

export const animations = {
};
`;
}

/**
 * Genera un symbol SVG para sprite
 */
export function generateSvgSymbol(iconName: string, body: string, viewBox: string): string {
  return `  <symbol id="${iconName}" viewBox="${viewBox}">\n    ${body}\n  </symbol>`;
}

/**
 * Genera el contenido inicial de sprite.svg
 */
export function generateSpriteFileContent(symbolEntry: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
${symbolEntry}
</svg>
`;
}

/**
 * Genera el script tag para incluir icon.js en HTML
 */
export function generateScriptTag(relativePath: string): string {
  return `    <script type="module" src="${relativePath}"></script>\n`;
}

/**
 * Parsea resultados de búsqueda de Iconify
 */
export interface IconifySearchResult {
  prefix: string;
  name: string;
}

export function parseIconifySearchResults(data: any): IconifySearchResult[] {
  const icons: IconifySearchResult[] = [];
  
  if (data.icons && Array.isArray(data.icons)) {
    for (const iconId of data.icons) {
      const [prefix, name] = iconId.split(':');
      if (prefix && name) {
        icons.push({ prefix, name });
      }
    }
  }
  
  return icons;
}

/**
 * Verifica si un icono ya existe en el contenido de icons.js
 */
export function iconExistsInFile(content: string, varName: string): boolean {
  return content.includes(`export const ${varName}`);
}

/**
 * Reemplaza un icono existente en el contenido de icons.js
 */
export function replaceIconInFile(content: string, varName: string, newEntry: string): string {
  const regex = new RegExp(`export const ${varName} = \\{[\\s\\S]*?\\};`, 'g');
  return content.replace(regex, newEntry);
}

/**
 * Añade un icono nuevo al contenido de icons.js
 */
export function addIconToFile(content: string, varName: string, newEntry: string): string {
  // Find the icons object and add before it
  const iconsObjMatch = content.match(/export const icons = \{/);
  if (iconsObjMatch && iconsObjMatch.index !== undefined) {
    content = content.slice(0, iconsObjMatch.index) + newEntry + '\n\n' + content.slice(iconsObjMatch.index);
    
    // Also add to the icons object
    const objContent = content.match(/export const icons = \{([^}]*)\}/);
    if (objContent) {
      const existingIcons = objContent[1].trim();
      const newIcons = existingIcons ? `${existingIcons},\n  ${varName}` : `\n  ${varName}\n`;
      content = content.replace(/export const icons = \{([^}]*)\}/, `export const icons = {${newIcons}}`);
    }
  } else {
    // Just append at the end
    content += '\n\n' + newEntry;
  }
  
  return content;
}

/**
 * Verifica si un symbol ya existe en sprite.svg
 */
export function symbolExistsInSprite(content: string, iconName: string): boolean {
  const existingSymbol = new RegExp(`<symbol[^>]*id=["']${iconName}["']`);
  return existingSymbol.test(content);
}

/**
 * Reemplaza un symbol existente en sprite.svg
 */
export function replaceSymbolInSprite(content: string, iconName: string, newSymbol: string): string {
  const existingSymbol = new RegExp(`<symbol[^>]*id=["']${iconName}["'][\\s\\S]*?<\\/symbol>`, 'g');
  return content.replace(existingSymbol, newSymbol);
}

/**
 * Añade un symbol a sprite.svg
 */
export function addSymbolToSprite(content: string, newSymbol: string): string {
  return content.replace('</svg>', `${newSymbol}\n</svg>`);
}

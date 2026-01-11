/**
 * Constants for file and directory names used across the extension.
 * Centralizes magic strings to avoid typos and ease future changes.
 */

// ==================== Output File Names ====================

/** Main icons data file */
export const SVG_DATA_FILE = 'svg-data.js';

/** Legacy icons data file (for backward compatibility) */
export const ICONS_FILE_LEGACY = 'icons.js';

/** Icon wrapper component file */
export const SVG_ELEMENT_FILE = 'svg-element.js';

/** Legacy icon wrapper file */
export const ICON_FILE_LEGACY = 'icon.js';

/** Variants definitions file */
export const SVG_VARIANTS_FILE = 'svg-variants.js';

/** Legacy variants file */
export const VARIANTS_FILE_LEGACY = 'variants.js';

/** Animations definitions file */
export const SVG_ANIMATIONS_FILE = 'svg-animations.js';

/** Legacy animations file */
export const ANIMATIONS_FILE_LEGACY = 'animations.js';

/** SVG sprite file */
export const SPRITE_FILE = 'sprite.svg';

/** TypeScript definitions file */
export const TYPES_FILE = 'types.d.ts';

/** Index/barrel export file */
export const INDEX_FILE = 'index.js';

// ==================== Default Directories ====================

/** Default output directory for generated files */
export const DEFAULT_OUTPUT_DIRECTORY = 'icons';

/** Legacy output directory */
export const OUTPUT_DIRECTORY_LEGACY = 'mastersvg-icons';

// ==================== Component Names ====================

/** Default component name for most frameworks */
export const DEFAULT_COMPONENT_NAME = 'SvgIcon';

/** Default component name for Web Components/Angular (requires hyphen) */
export const DEFAULT_WEB_COMPONENT_NAME = 'svg-icon';

// ==================== ViewBox ====================

/** Default viewBox for icons */
export const DEFAULT_VIEWBOX = '0 0 24 24';

// ==================== File Extensions ====================

export const EXTENSIONS = {
  svg: '.svg',
  js: '.js',
  ts: '.ts',
  tsx: '.tsx',
  vue: '.vue',
  svelte: '.svelte',
  astro: '.astro',
} as const;

// ==================== Framework File Patterns ====================

export const FRAMEWORK_WRAPPER_EXTENSIONS: Record<string, string> = {
  html: '.js',
  react: '.tsx',
  vue: '.vue',
  angular: '.component.ts',
  svelte: '.svelte',
  astro: '.astro',
  solid: '.tsx',
  qwik: '.tsx',
};

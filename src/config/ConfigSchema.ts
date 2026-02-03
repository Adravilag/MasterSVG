/**
 * ConfigSchema - TypeScript types for mastersvg.config.json
 *
 * Defines the complete schema for MasterSVG configuration.
 */

/** Animation timing functions */
export type AnimationTiming = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** Animation iteration count */
export type AnimationIteration = number | 'infinite';

/** Animation direction */
export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

/** Supported frameworks */
export type FrameworkType = 'html' | 'react' | 'vue' | 'angular' | 'svelte' | 'solid' | 'qwik' | 'astro';

/** Output format types */
export type OutputFormat = 'icons.ts' | 'icons.js' | 'sprite.svg';

/** Output structure types */
export type OutputStructure = 'flat' | 'separated';

/** Naming conventions */
export type NamingConvention = 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';

/** Category source types */
export type CategorySource = 'folders' | 'filename' | 'manual';

/** Preview background types */
export type PreviewBackground = 'transparent' | 'light' | 'dark' | 'checkered';

// ═══════════════════════════════════════════════════════════
// ANIMATION CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Animation preset configuration */
export interface AnimationPreset {
  duration: number;
  timing: AnimationTiming;
  iteration: AnimationIteration;
  delay?: number;
  direction?: AnimationDirection;
}

/** Animation configuration section */
export interface AnimationConfig {
  presets?: Record<string, AnimationPreset>;
}

// ═══════════════════════════════════════════════════════════
// SOURCE CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Source directories configuration */
export interface SourceConfig {
  /** Directories to scan for SVG files */
  directories: string[];
  /** Glob patterns to ignore */
  ignore?: string[];
}

// ═══════════════════════════════════════════════════════════
// OUTPUT CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Output paths for separated structure */
export interface OutputPaths {
  /** Path for components (Icon.tsx, index.ts) */
  components: string;
  /** Path for assets (svg-data.ts) */
  assets: string;
  /** Path for types (types.d.ts) - optional, defaults to components */
  types?: string;
}

/** Output configuration section */
export interface OutputConfig {
  /** Output format */
  format: OutputFormat;
  /** Output structure type */
  structure: OutputStructure;
  /** Output directory (for flat structure) */
  directory?: string;
  /** Output paths (for separated structure) */
  paths?: OutputPaths;
}

// ═══════════════════════════════════════════════════════════
// FRAMEWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Component configuration */
export interface ComponentConfig {
  /** Component name (default: 'Icon') */
  name?: string;
  /** Web component tag name (for HTML/Angular) */
  webComponentTag?: string;
}

/** Framework configuration section */
export interface FrameworkConfig {
  /** Target framework */
  type: FrameworkType;
  /** Generate TypeScript files */
  typescript?: boolean;
  /** Component configuration */
  component?: ComponentConfig;
}

// ═══════════════════════════════════════════════════════════
// OPTIMIZATION CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Color conversion options */
export interface ColorConversionConfig {
  /** Convert fills to currentColor */
  currentColor?: boolean;
}

/** SVGO configuration */
export interface SvgoConfig {
  /** Enable SVGO optimization */
  enabled?: boolean;
  /** Remove XML comments */
  removeComments?: boolean;
  /** Remove metadata elements */
  removeMetadata?: boolean;
  /** Remove title elements */
  removeTitle?: boolean;
  /** Remove width/height, keep viewBox */
  removeDimensions?: boolean;
  /** Color conversion options */
  convertColors?: ColorConversionConfig;
}

/** Optimization configuration section */
export interface OptimizationConfig {
  svgo?: SvgoConfig;
}

// ═══════════════════════════════════════════════════════════
// ICONS CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Category configuration */
export interface CategoryConfig {
  /** Enable categories */
  enabled?: boolean;
  /** Category source type */
  source?: CategorySource;
}

/** Icons configuration section */
export interface IconsConfig {
  /** Default icon size in pixels */
  defaultSize?: number;
  /** Naming convention for icon exports */
  naming?: NamingConvention;
  /** Icon name prefix */
  prefix?: string;
  /** Category configuration */
  categories?: CategoryConfig;
}

// ═══════════════════════════════════════════════════════════
// LICENSES CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Licenses configuration section */
export interface LicensesConfig {
  /** Auto-generate license file */
  autoGenerate?: boolean;
  /** License file name */
  outputFile?: string;
  /** Include Iconify icon licenses */
  includeIconify?: boolean;
}

// ═══════════════════════════════════════════════════════════
// EDITOR CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Editor behavior configuration */
export interface EditorConfig {
  /** Scan for SVGs on startup */
  scanOnStartup?: boolean;
  /** Preview background style */
  previewBackground?: PreviewBackground;
  /** Auto-add import statements */
  autoImport?: boolean;
  /** Delete source SVG after build */
  deleteAfterBuild?: boolean;
}

// ═══════════════════════════════════════════════════════════
// MAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════

/** Complete MasterSVG configuration */
export interface MasterSvgConfig {
  /** JSON Schema URL */
  $schema?: string;
  /** Configuration version */
  version: string;
  /** Source configuration */
  source: SourceConfig;
  /** Output configuration */
  output: OutputConfig;
  /** Framework configuration */
  framework: FrameworkConfig;
  /** Optimization configuration */
  optimization?: OptimizationConfig;
  /** Icons configuration */
  icons?: IconsConfig;
  /** Animation configuration */
  animations?: AnimationConfig;
  /** Licenses configuration */
  licenses?: LicensesConfig;
  /** Editor configuration */
  editor?: EditorConfig;
}

/** Partial config for merging with defaults */
export type PartialMasterSvgConfig = Partial<Omit<MasterSvgConfig, 'source' | 'output' | 'framework'>> & {
  source?: Partial<SourceConfig>;
  output?: Partial<OutputConfig>;
  framework?: Partial<FrameworkConfig>;
};

/**
 * Type definitions for MasterSVG Icon System
 * Defines interfaces for animations, variations, and build configuration
 */

// ============================================================================
// Animation Types
// ============================================================================

/**
 * Supported animation timing functions
 */
export type AnimationTimingFunction =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | `cubic-bezier(${number}, ${number}, ${number}, ${number})`;

/**
 * Animation iteration count
 */
export type AnimationIteration = 'infinite' | number;

/**
 * Animation direction
 */
export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

/**
 * Animation fill mode
 */
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';

/**
 * Animation play state
 */
export type AnimationPlayState = 'running' | 'paused';

/**
 * Animation trigger type
 */
export type AnimationTrigger =
  | 'hover'
  | 'click'
  | 'focus'
  | 'load'
  | 'visible'
  | 'manual'
  | 'active'
  | 'error';

/**
 * Keyframe definition
 */
export interface AnimationKeyframe {
  /** Percentage or 'from'/'to' */
  offset: number | 'from' | 'to';
  /** CSS transform */
  transform?: string;
  /** CSS opacity */
  opacity?: number;
  /** CSS filter */
  filter?: string;
  /** Any additional CSS properties */
  [key: string]: string | number | undefined;
}

/**
 * Complete animation definition
 */
export interface AnimationDefinition {
  /** Unique animation name (used as CSS animation-name) */
  name: string;
  /** Human-readable label */
  label: string;
  /** Animation category */
  category: AnimationCategory;
  /** Keyframes definition */
  keyframes: AnimationKeyframe[];
  /** Default duration in seconds */
  defaultDuration: number;
  /** Default timing function */
  defaultTiming: AnimationTimingFunction;
  /** Default iteration count */
  defaultIteration: AnimationIteration;
  /** Default direction */
  defaultDirection?: AnimationDirection;
  /** Default fill mode */
  defaultFillMode?: AnimationFillMode;
  /** Applicable triggers */
  triggers?: AnimationTrigger[];
  /** Preview description */
  description?: string;
}

/**
 * Animation categories for organization
 */
export type AnimationCategory =
  | 'rotation' // spin, rotate
  | 'scale' // pulse, grow, shrink
  | 'translate' // bounce, shake, slide
  | 'fade' // fade-in, fade-out, blink
  | 'complex' // wobble, jello, tada
  | 'attention' // heartbeat, rubber-band
  | 'entrance' // zoom-in, slide-in
  | 'exit' // zoom-out, slide-out
  | 'effect'; // glow, morph

/**
 * Animation instance settings (applied to an icon)
 */
export interface AnimationSettings {
  /** Reference to animation name */
  animationName: string;
  /** Duration override in seconds */
  duration?: number;
  /** Timing function override */
  timing?: AnimationTimingFunction;
  /** Iteration count override */
  iteration?: AnimationIteration;
  /** Direction override */
  direction?: AnimationDirection;
  /** Delay in seconds */
  delay?: number;
  /** Fill mode override */
  fillMode?: AnimationFillMode;
  /** Trigger type */
  trigger?: AnimationTrigger;
}

/**
 * Animation variant - a preset configuration for an animation
 * Allows defining variations like spin-slow, pulse-subtle, etc.
 */
export interface AnimationVariant {
  /** Variant name suffix (e.g., 'slow', 'fast', 'subtle') */
  name: string;
  /** Human-readable label */
  label: string;
  /** Duration multiplier or absolute value */
  duration?: number | { multiplier: number };
  /** Timing function override */
  timing?: AnimationTimingFunction;
  /** Iteration count override */
  iteration?: AnimationIteration;
  /** Direction override */
  direction?: AnimationDirection;
  /** Delay in seconds */
  delay?: number;
  /** Fill mode override */
  fillMode?: AnimationFillMode;
  /** Scale factor for transform values (for intensity) */
  intensityScale?: number;
  /** Description of the variant */
  description?: string;
}

/**
 * Animation with its variants
 */
export interface AnimationWithVariants {
  /** Base animation definition */
  animation: AnimationDefinition;
  /** Available variants for this animation */
  variants: AnimationVariant[];
}

/**
 * Resolved animation (base + variant applied)
 */
export interface ResolvedAnimation {
  /** Full name (e.g., 'spin-slow', 'pulse-intense') */
  fullName: string;
  /** Base animation name */
  baseName: string;
  /** Variant name (if any) */
  variantName?: string;
  /** Final duration in seconds */
  duration: number;
  /** Final timing function */
  timing: AnimationTimingFunction;
  /** Final iteration count */
  iteration: AnimationIteration;
  /** Final direction */
  direction: AnimationDirection;
  /** Final delay in seconds */
  delay: number;
  /** Final fill mode */
  fillMode: AnimationFillMode;
  /** Intensity scale applied */
  intensityScale: number;
}

/**
 * Icon animation mapping (icon-id -> animation settings)
 */
export interface IconAnimationMap {
  [iconId: string]: AnimationSettings;
}

// ============================================================================
// Variation Types
// ============================================================================

/**
 * Color mode for variations
 */
export type ColorMode = 'light' | 'dark' | 'system' | 'custom';

/**
 * Icon state for variations
 */
export type IconState =
  | 'default'
  | 'hover'
  | 'active'
  | 'disabled'
  | 'focus'
  | 'selected'
  | 'loading'
  | 'error'
  | 'success'
  | 'warning';

/**
 * Predefined size tokens
 */
export type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/**
 * Size configuration
 */
export interface SizeConfig {
  /** Size token name */
  token: SizeToken;
  /** Size in pixels */
  value: number;
  /** Stroke width for this size (optional) */
  strokeWidth?: number;
}

/**
 * Color variation definition
 */
export interface ColorVariation {
  /** Variation name */
  name: string;
  /** Primary color (fill) */
  primary: string;
  /** Secondary color (stroke or accent) */
  secondary?: string;
  /** Background color (if applicable) */
  background?: string;
  /** Opacity */
  opacity?: number;
}

/**
 * State variation definition
 */
export interface StateVariation {
  /** State name */
  state: IconState;
  /** Color overrides */
  color?: Partial<ColorVariation>;
  /** Transform applied in this state */
  transform?: string;
  /** Opacity in this state */
  opacity?: number;
  /** Transition duration in ms */
  transitionDuration?: number;
  /** Animation to apply in this state */
  animation?: string;
}

/**
 * Complete variation definition for an icon
 */
export interface VariationDefinition {
  /** Base icon ID */
  iconId: string;
  /** Available sizes */
  sizes?: SizeConfig[];
  /** Color variations */
  colors?: ColorVariation[];
  /** State variations */
  states?: StateVariation[];
  /** Custom CSS class name */
  className?: string;
  /** CSS custom properties (variables) */
  cssVariables?: Record<string, string>;
}

/**
 * Icon variation map (icon-id -> variation definition)
 */
export interface IconVariationMap {
  [iconId: string]: VariationDefinition;
}

// ============================================================================
// Build Output Types
// ============================================================================

/**
 * Animation build output configuration
 */
export interface AnimationBuildConfig {
  /** Output filename */
  filename: string;
  /** Include CSS keyframes */
  includeKeyframes: boolean;
  /** Include JavaScript animation controller */
  includeController: boolean;
  /** Minify output */
  minify: boolean;
  /** Export format */
  format: 'esm' | 'cjs' | 'iife';
  /** Global variable name (for IIFE) */
  globalName?: string;
}

/**
 * Variation build output configuration
 */
export interface VariationBuildConfig {
  /** Output filename */
  filename: string;
  /** Include CSS custom properties */
  includeCssVariables: boolean;
  /** Include utility classes */
  includeUtilityClasses: boolean;
  /** Minify output */
  minify: boolean;
  /** Export format */
  format: 'esm' | 'cjs' | 'iife';
  /** Global variable name (for IIFE) */
  globalName?: string;
}

/**
 * Complete build configuration
 */
export interface MasterSVGBuildConfig {
  /** Output directory */
  outputDir: string;
  /** Animation configuration */
  animation: AnimationBuildConfig;
  /** Variation configuration */
  variation: VariationBuildConfig;
  /** Generate TypeScript declarations */
  generateTypes: boolean;
  /** Watch mode */
  watch: boolean;
}

/**
 * Build result
 */
export interface MasterSVGBuildResult {
  /** Generated files */
  files: GeneratedFile[];
  /** Build statistics */
  stats: {
    animationCount: number;
    variationCount: number;
    totalSize: number;
    buildTime: number;
  };
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
}

/**
 * Generated file info
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** File type */
  type: 'animation' | 'variation' | 'types' | 'css';
  /** File size in bytes */
  size: number;
  /** Content hash */
  hash: string;
}

// ============================================================================
// Icon Element Types (for different rendering methods)
// ============================================================================

/**
 * Icon rendering method
 */
export type IconRenderMethod = 'svg-inline' | 'svg-use' | 'img' | 'web-component' | 'svg-icon';

// ============================================================================
// Icon Suggestion Types (Iconify, extensible)
// ============================================================================

/**
 * Icon suggestion result (for UI/insert)
 */
export interface IconSuggestion {
  prefix: string;
  name: string;
  /** Score de relevancia (0-1) */
  score: number;
  /** Tags relevantes (ej: medical, health) */
  tags?: string[];
  /** Colores que hicieron match */
  matchingColors?: string[];
  /** Nombre de la colección */
  collection?: string;
  /** Licencia (ej: MIT) */
  license?: string;
  /** SVG para preview (opcional, lazy) */
  previewSvg?: string;
  /** Etiqueta accesible sugerida */
  ariaLabel?: string;
}

/**
 * Opciones para sugerir iconos
 */
export interface IconSuggestionOptions {
  /** Paleta de colores (solo para preview, no para búsqueda) */
  colors?: string[];
  /** Tags/contexto semántico — driver principal de búsqueda */
  contextTags?: string[];
  /** Estilo preferido */
  style?: 'outline' | 'solid' | 'duotone';
  /** Limitar resultados */
  limit?: number;
  /** Usar LLM/Copilot para análisis avanzado */
  useLLM?: boolean;
}

/**
 * Proveedor de sugerencias de iconos (extensible)
 */
export interface IconSuggestionProvider {
  suggest(options: IconSuggestionOptions): Promise<IconSuggestion[]>;
}

/**
 * Icon element configuration
 */
export interface IconElementConfig {
  /** Rendering method */
  method: IconRenderMethod;
  /** Icon ID (used for animation/variation lookup) */
  iconId: string;
  /** Size token or pixel value */
  size?: SizeToken | number;
  /** Color variation name */
  colorVariation?: string;
  /** Animation name */
  animation?: string;
  /** Custom class */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Additional attributes */
  attributes?: Record<string, string>;
}

/**
 * Web component attributes for svg-icon
 */
export interface BzIconAttributes {
  name: string;
  size?: SizeToken | number;
  color?: string;
  animation?: string;
  variant?: string;
}
// ============================================================================
// Color Service Types
// ============================================================================

/**
 * Result of extracting colors from an SVG
 */
export interface ColorExtractionResult {
  /** List of extracted colors */
  colors: string[];
  /** Whether currentColor is used */
  hasCurrentColor: boolean;
  /** Whether SMIL animations are present */
  hasSmil: boolean;
}

/**
 * Supported color formats
 */
export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named';

/**
 * Color with metadata
 */
export interface ColorInfo {
  /** Original color string */
  original: string;
  /** Normalized hex value */
  hex: string;
  /** Color format */
  format: ColorFormat;
  /** RGB values */
  rgb?: { r: number; g: number; b: number };
  /** HSL values */
  hsl?: { h: number; s: number; l: number };
  /** Alpha/opacity (0-1) */
  alpha?: number;
}

/**
 * Color palette definition
 */
export interface ColorPalette {
  /** Palette name */
  name: string;
  /** Color entries */
  colors: ColorPaletteEntry[];
}

/**
 * Single color in a palette
 */
export interface ColorPaletteEntry {
  /** Color name/label */
  name: string;
  /** Hex color value */
  value: string;
  /** CSS variable name (optional) */
  cssVar?: string;
}

// ============================================================================
// Code Formatter Types
// ============================================================================

/**
 * Code formatting options
 */
export interface CodeFormatOptions {
  /** Indentation type */
  indentType: 'spaces' | 'tabs';
  /** Indentation size (for spaces) */
  indentSize: number;
  /** Maximum line length before wrapping */
  maxLineLength?: number;
  /** Whether to sort attributes alphabetically */
  sortAttributes?: boolean;
  /** Whether to preserve comments */
  preserveComments?: boolean;
}

/**
 * Syntax highlighting theme
 */
export interface SyntaxHighlightTheme {
  /** Tag/element color */
  tag: string;
  /** Attribute name color */
  attribute: string;
  /** Attribute value color */
  value: string;
  /** Comment color */
  comment: string;
  /** Keyword color (for CSS) */
  keyword: string;
  /** Selector color (for CSS) */
  selector: string;
  /** Brace/bracket color */
  brace: string;
  /** String color */
  string: string;
  /** Number color */
  number: string;
}

/**
 * Code language for syntax highlighting
 */
export type CodeLanguage =
  | 'svg'
  | 'xml'
  | 'html'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'vue'
  | 'svelte'
  | 'javascriptreact'
  | 'typescriptreact'
  | 'angular';

// ============================================================================
// Framework Detection Types
// ============================================================================

/**
 * Framework signature for detection
 */
export interface FrameworkSignature {
  /** Framework identifier */
  framework: string;
  /** Config files that indicate this framework */
  configFiles: string[];
  /** Package.json dependencies that indicate this framework */
  dependencies: string[];
  /** Detection priority (higher = checked first) */
  priority: number;
}

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  /** Detected framework */
  framework: string;
  /** Confidence level (0-100) */
  confidence: number;
  /** Detection method used */
  detectedBy: 'config-file' | 'dependency' | 'file-extension' | 'default';
  /** Additional metadata */
  metadata?: {
    configFile?: string;
    dependency?: string;
    version?: string;
  };
}

/**
 * Framework capabilities
 */
export interface FrameworkCapabilities {
  /** Supports TypeScript */
  typescript: boolean;
  /** Supports JSX/TSX */
  jsx: boolean;
  /** Supports SFC (Single File Components) */
  sfc: boolean;
  /** Supports CSS modules */
  cssModules: boolean;
  /** Supports CSS-in-JS */
  cssInJs: boolean;
  /** Icon component style */
  iconStyle: 'component' | 'function' | 'directive';
}

// ============================================================================
// Icon Persistence Types
// ============================================================================

/**
 * Icon save options
 */
export interface IconSaveOptions {
  /** Icon name/identifier */
  name: string;
  /** SVG content */
  svg: string;
  /** ViewBox attribute */
  viewBox?: string;
  /** Animation to apply */
  animation?: AnimationSettings;
  /** Color variant */
  variant?: string;
  /** Overwrite if exists */
  overwrite?: boolean;
}

/**
 * Icon save result
 */
export interface IconSaveResult {
  /** Whether save was successful */
  success: boolean;
  /** Path where icon was saved */
  path?: string;
  /** Error message if failed */
  error?: string;
  /** Whether icon was updated vs created */
  updated?: boolean;
}

/**
 * Icon file format
 */
export type IconFileFormat = 'js' | 'ts' | 'json' | 'sprite';

/**
 * Icon library file structure
 */
export interface IconLibraryStructure {
  /** Main icons file path */
  iconsFile: string;
  /** Sprite file path (optional) */
  spriteFile?: string;
  /** TypeScript definitions path */
  typesFile?: string;
  /** Variants file path */
  variantsFile?: string;
  /** Animations file path */
  animationsFile?: string;
}

// ============================================================================
// SVG Manipulation Types
// ============================================================================

/**
 * SVG attribute
 */
export interface SvgAttribute {
  /** Attribute name */
  name: string;
  /** Attribute value */
  value: string;
  /** Namespace (if any) */
  namespace?: string;
}

/**
 * SVG element info
 */
export interface SvgElementInfo {
  /** Tag name */
  tagName: string;
  /** Element attributes */
  attributes: SvgAttribute[];
  /** Inner content */
  content?: string;
  /** Child elements */
  children?: SvgElementInfo[];
}

/**
 * SVG parsing result
 */
export interface SvgParseResult {
  /** Whether parsing was successful */
  valid: boolean;
  /** Root SVG element info */
  root?: SvgElementInfo;
  /** ViewBox value */
  viewBox?: string;
  /** Width attribute */
  width?: string;
  /** Height attribute */
  height?: string;
  /** Parsing errors */
  errors?: string[];
}

/**
 * SVG transformation type
 */
export type SvgTransformationType =
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'skewX'
  | 'skewY'
  | 'matrix';

/**
 * SVG transformation
 */
export interface SvgTransformation {
  /** Transformation type */
  type: SvgTransformationType;
  /** Transformation values */
  values: number[];
}

// ============================================================================
// Usage Scanner Types
// ============================================================================

/**
 * Icon usage context
 */
export type UsageContext =
  | 'jsx-component'
  | 'vue-template'
  | 'svelte-template'
  | 'angular-template'
  | 'html-img'
  | 'html-svg'
  | 'css-background'
  | 'css-mask'
  | 'inline-svg';

/**
 * Detailed usage information
 */
export interface DetailedUsage {
  /** Icon name */
  iconName: string;
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** Usage context */
  context: UsageContext;
  /** Code preview */
  preview: string;
  /** Props/attributes used */
  props?: Record<string, string>;
}

/**
 * Usage scan options
 */
export interface UsageScanOptions {
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Maximum files to scan */
  maxFiles?: number;
  /** Follow symbolic links */
  followSymlinks?: boolean;
}

/**
 * Usage scan result
 */
export interface UsageScanResult {
  /** Total usages found */
  totalUsages: number;
  /** Usages grouped by icon */
  byIcon: Map<string, DetailedUsage[]>;
  /** Usages grouped by file */
  byFile: Map<string, DetailedUsage[]>;
  /** Files scanned */
  filesScanned: number;
  /** Scan duration in ms */
  duration: number;
}

// ============================================================================
// License Service Types
// ============================================================================

/**
 * License type
 */
export type LicenseType =
  | 'MIT'
  | 'Apache-2.0'
  | 'GPL-3.0'
  | 'BSD-3-Clause'
  | 'CC0-1.0'
  | 'CC-BY-4.0'
  | 'ISC'
  | 'custom'
  | 'unknown';

/**
 * Icon license information
 */
export interface IconLicense {
  /** License type/SPDX identifier */
  type: LicenseType;
  /** Author/creator */
  author?: string;
  /** Source URL */
  source?: string;
  /** Full license text */
  text?: string;
  /** Attribution required */
  attributionRequired?: boolean;
}

/**
 * License attribution
 */
export interface LicenseAttribution {
  /** Icon set name */
  iconSet: string;
  /** License type */
  license: LicenseType;
  /** Author */
  author: string;
  /** URL */
  url?: string;
  /** Icons from this set */
  icons: string[];
}

// ============================================================================
// Preview Service Types
// ============================================================================

/**
 * Preview animation settings
 */
export interface PreviewAnimation {
  /** Animation type */
  type: string;
  /** Duration in seconds */
  duration: number;
  /** Timing function */
  timing: string;
  /** Iteration count */
  iteration: string;
  /** Delay in seconds */
  delay?: number;
  /** Animation direction */
  direction?: string;
}

/**
 * Preview template options
 */
export interface PreviewTemplateOptions {
  /** Icon name */
  name: string;
  /** SVG content */
  svg: string;
  /** Source location */
  location?: { file: string; line: number };
  /** Whether icon is built */
  isBuilt?: boolean;
  /** Animation settings */
  animation?: PreviewAnimation;
  /** Whether icon is rasterized */
  isRasterized?: boolean;
}

/**
 * Preview size option
 */
export interface PreviewSizeOption {
  /** Size label */
  label: string;
  /** Size in pixels */
  value: number;
}

/**
 * Preview background option
 */
export interface PreviewBackgroundOption {
  /** Background label */
  label: string;
  /** CSS color value */
  value: string;
  /** Whether this is a pattern (checkerboard) */
  isPattern?: boolean;
}

// ============================================================================
// Syntax Highlighter Types
// ============================================================================

/**
 * Syntax highlight marker
 */
export interface SyntaxMarker {
  /** Marker name */
  name: string;
  /** Opening marker */
  open: string;
  /** Closing marker */
  close: string;
  /** CSS class to apply */
  cssClass: string;
}

/**
 * Highlighted code result
 */
export interface HighlightedCode {
  /** HTML with syntax highlighting */
  html: string;
  /** Number of lines */
  lineCount: number;
  /** Language detected */
  language: CodeLanguage;
}

// ============================================================================
// Template Service Types
// ============================================================================

/**
 * Template variables for HTML generation
 */
export interface TemplateVariables {
  /** CSS content */
  css?: string;
  /** JavaScript content */
  js?: string;
  /** Body content */
  body: string;
  /** Page title */
  title?: string;
  /** Additional head content */
  head?: string;
  /** VS Code webview nonce */
  nonce?: string;
  /** CSP source for scripts */
  cspSource?: string;
}

/**
 * Icon editor state
 */
export interface IconEditorState {
  /** Current icon name */
  iconName: string;
  /** Current SVG content */
  svg: string;
  /** Original SVG (before edits) */
  originalSvg: string;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Current color selections */
  colors: string[];
  /** Current animation */
  animation?: AnimationSettings;
  /** Current variant */
  variant?: string;
}

/**
 * Webview message from extension to webview
 */
export interface WebviewMessage {
  /** Message command/type */
  command: string;
  /** Message payload */
  payload?: unknown;
}

/**
 * Webview message from webview to extension
 */
export interface WebviewResponse {
  /** Response command/type */
  command: string;
  /** Response data */
  data?: unknown;
  /** Error if any */
  error?: string;
}

// ============================================================================
// Provider Types (Tree View)
// ============================================================================

/**
 * Tree item type
 */
export type TreeItemType = 'section' | 'category' | 'icon' | 'action' | 'usage';

/**
 * Tree item options for SvgItem
 */
export interface TreeItemOptions {
  /** Display label */
  label: string;
  /** Item count (for categories) */
  count: number;
  /** Collapsible state */
  collapsibleState: 'none' | 'collapsed' | 'expanded';
  /** Item type */
  type: TreeItemType;
  /** Associated icon data */
  icon?: WorkspaceIconRef;
  /** Category identifier */
  category?: string;
  /** Usage information */
  usage?: TreeItemUsage;
}

/**
 * Reference to workspace icon (lightweight)
 */
export interface WorkspaceIconRef {
  /** Icon name */
  name: string;
  /** Icon path */
  path: string;
  /** Icon source */
  source: 'workspace' | 'library' | 'inline';
  /** Whether icon is built */
  isBuilt?: boolean;
}

/**
 * Usage information for tree items
 */
export interface TreeItemUsage {
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Code preview */
  preview: string;
}

/**
 * Folder tree node
 */
export interface FolderTreeNode {
  /** Child subfolders */
  subfolders: Set<string>;
  /** Files in this folder */
  files: string[];
}

// ============================================================================
// Scanner Types (Extended)
// ============================================================================

/**
 * File scan result
 */
export interface FileScanResult {
  /** Found inline SVGs */
  inlineSvgs: Map<string, WorkspaceIconRef>;
  /** Found IMG references */
  imgReferences: WorkspaceIconRef[];
  /** Scan error if any */
  error?: ScanErrorInfo;
}

/**
 * Scan error information
 */
export interface ScanErrorInfo {
  /** Error message */
  message: string;
  /** File that caused the error */
  file?: string;
  /** Error code */
  code?: string;
}

/**
 * Scanner statistics
 */
export interface ScannerStats {
  /** Total files scanned */
  filesScanned: number;
  /** Files with errors */
  filesWithErrors: number;
  /** Total SVGs found */
  svgsFound: number;
  /** Scan duration in ms */
  duration: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
}

// ============================================================================
// Component Exporter Types (Extended)
// ============================================================================

/**
 * Component format type
 */
export type ComponentFormat =
  | 'react'
  | 'react-native'
  | 'vue'
  | 'vue-sfc'
  | 'svelte'
  | 'angular'
  | 'solid'
  | 'qwik'
  | 'preact'
  | 'lit'
  | 'web-component'
  | 'vanilla';

/**
 * Component export options
 */
export interface ComponentExportOptions {
  /** Target format */
  format: ComponentFormat;
  /** Use TypeScript */
  typescript: boolean;
  /** Icon name */
  iconName: string;
  /** SVG content */
  svg: string;
  /** Default icon size */
  defaultSize?: number;
  /** Default icon color */
  defaultColor?: string;
  /** Wrap in memo (React) */
  memo?: boolean;
  /** Forward ref (React) */
  forwardRef?: boolean;
  /** Export type */
  exportType?: 'named' | 'default';
  /** Include prop types */
  includePropTypes?: boolean;
}

/**
 * Component export result
 */
export interface ComponentExportResult {
  /** Generated code */
  code: string;
  /** Suggested filename */
  filename: string;
  /** Code language */
  language: CodeLanguage;
  /** Dependencies required */
  dependencies?: string[];
}

// ============================================================================
// Sprite Generator Types (Extended)
// ============================================================================

/**
 * Sprite icon entry
 */
export interface SpriteIcon {
  /** Icon ID in sprite */
  id: string;
  /** Icon name */
  name: string;
  /** SVG content */
  svg: string;
  /** ViewBox attribute */
  viewBox?: string;
}

/**
 * Sprite generation options
 */
export interface SpriteOptions {
  /** Output path */
  outputPath: string;
  /** Output filename */
  filename?: string;
  /** Include title elements */
  includeTitle?: boolean;
  /** Include desc elements */
  includeDesc?: boolean;
  /** Remove inline styles */
  removeStyles?: boolean;
  /** Generate TypeScript types */
  generateTypes?: boolean;
  /** Generate helper component */
  generateHelper?: boolean;
  /** Helper component format */
  helperFormat?: 'react' | 'vue' | 'svelte' | 'vanilla';
  /** Web component tag name */
  webComponentName?: string;
  /** Optimize output */
  optimize?: boolean;
}

/**
 * Sprite generation result
 */
export interface SpriteResult {
  /** Generated sprite content */
  sprite: string;
  /** Icon IDs in sprite */
  iconIds: string[];
  /** TypeScript definitions */
  typeDefinitions?: string;
  /** Helper component code */
  helperComponent?: string;
  /** Generation statistics */
  stats: SpriteStats;
}

/**
 * Sprite generation statistics
 */
export interface SpriteStats {
  /** Total icons in sprite */
  totalIcons: number;
  /** Total size in bytes */
  totalSize: number;
  /** Average icon size in bytes */
  averageSize: number;
}

// ============================================================================
// Optimization Types (Extended)
// ============================================================================

/**
 * SVG optimization options
 */
export interface OptimizeOptions {
  /** Remove XML comments */
  removeComments?: boolean;
  /** Remove metadata */
  removeMetadata?: boolean;
  /** Remove title element */
  removeTitle?: boolean;
  /** Remove desc element */
  removeDesc?: boolean;
  /** Remove useless defs */
  removeUselessDefs?: boolean;
  /** Remove editor namespace data */
  removeEditorsNSData?: boolean;
  /** Remove empty attributes */
  removeEmptyAttrs?: boolean;
  /** Remove hidden elements */
  removeHiddenElems?: boolean;
  /** Remove empty text nodes */
  removeEmptyText?: boolean;
  /** Remove empty containers */
  removeEmptyContainers?: boolean;
  /** Minify CSS styles */
  minifyStyles?: boolean;
  /** Convert colors to shorter form */
  convertColors?: boolean;
  /** Optimize path data */
  convertPathData?: boolean;
  /** Convert transforms */
  convertTransform?: boolean;
  /** Remove unused namespaces */
  removeUnusedNS?: boolean;
  /** Sort attributes */
  sortAttrs?: boolean;
  /** Merge paths */
  mergePaths?: boolean;
  /** Remove off-canvas paths */
  removeOffCanvasPaths?: boolean;
  /** Decimal precision */
  precision?: number;
}

/**
 * SVG optimization result
 */
export interface OptimizeResult {
  /** Optimized SVG */
  svg: string;
  /** Original size in bytes */
  originalSize: number;
  /** Optimized size in bytes */
  optimizedSize: number;
  /** Bytes saved */
  savings: number;
  /** Percentage saved */
  savingsPercent: number;
}

// ============================================================================
// Category Service Types
// ============================================================================

/**
 * Category type
 */
export type CategoryType = 'library' | 'file' | 'folder';

/**
 * Category information
 */
export interface CategoryInfo {
  /** Category name */
  name: string;
  /** Number of icons in category */
  count: number;
  /** Category type */
  type: CategoryType;
}

/**
 * Icon storage maps for category operations
 * Uses generic T to allow different icon types (WorkspaceIcon, etc.)
 */
export interface IconStorageMaps<T = unknown> {
  /** SVG files from workspace */
  svgFiles: Map<string, T>;
  /** Library (built) icons */
  libraryIcons: Map<string, T>;
  /** Inline SVGs found in code */
  inlineSvgs: Map<string, T>;
  /** SVG references (img tags, etc.) */
  svgReferences: Map<string, T[]>;
}

// ============================================================================
// Icon Lookup Service Types
// ============================================================================

/**
 * SVG data lookup result
 */
export interface SvgDataResult {
  /** Icon name */
  name: string;
  /** SVG content */
  svg: string;
  /** Source location */
  location?: { file: string; line: number };
  /** Animation settings - uses PreviewAnimation for compatibility */
  animation?: PreviewAnimation;
}

/**
 * Icon animation data (simplified for lookup)
 */
export interface IconAnimationData {
  /** Animation type */
  type: string;
  /** Duration in seconds */
  duration?: number;
  /** Timing function */
  timing?: string;
  /** Iteration count */
  iteration?: string;
  /** Delay in seconds */
  delay?: number;
  /** Direction */
  direction?: string;
}

// ============================================================================
// Usage Finder Service Types
// ============================================================================

/**
 * Icon usage in code
 */
export interface IconUsageInfo {
  /** File path */
  file: string;
  /** Relative file path */
  relativePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Line text */
  text: string;
  /** Surrounding context */
  context: string;
}

// ============================================================================
// Animation Assignment Service Types
// ============================================================================

/**
 * Icon animation assignment
 */
export interface IconAnimationAssignment {
  /** Animation type */
  type: string;
  /** Duration in seconds */
  duration?: number;
  /** Timing function */
  timing?: string;
  /** Iteration count */
  iteration?: string;
  /** Delay in seconds */
  delay?: number;
  /** Direction */
  direction?: string;
}

/**
 * Animations data file structure
 */
export interface AnimationsDataFile {
  /** Animations by icon name */
  animations: Record<string, IconAnimationAssignment>;
}

// ============================================================================
// Variants Service Types
// ============================================================================

/**
 * Color variant definition
 */
export interface ColorVariant {
  /** Variant name */
  name: string;
  /** Color values */
  colors: string[];
}

/**
 * Color mapping (original → new color)
 */
export interface ColorMappingRecord {
  [originalColor: string]: string;
}

/**
 * Animation preset for variants
 */
export interface AnimationPresetConfig {
  /** Preset name */
  name: string;
  /** Animation type */
  type: string;
  /** Duration in seconds */
  duration?: number;
  /** Timing function */
  timing?: string;
  /** Iteration count */
  iteration?: string;
  /** Delay in seconds */
  delay?: number;
  /** Direction */
  direction?: string;
}

/**
 * Variants data file structure
 */
export interface VariantsDataFile {
  /** Variants by icon name */
  variants: Record<string, Record<string, string[]>>;
  /** Default variant per icon */
  defaults: Record<string, string>;
  /** Color mappings per icon */
  colorMappings?: Record<string, ColorMappingRecord>;
  /** Animation presets per icon */
  animations?: Record<string, AnimationPresetConfig[]>;
}

// ============================================================================
// Detected Animation Types (for AnimationService)
// ============================================================================

/**
 * Simple animation settings (for service layer)
 */
export interface SimpleAnimationSettings {
  /** Duration in seconds */
  duration: number;
  /** Timing function */
  timing: string;
  /** Iteration count */
  iteration: string;
  /** Direction */
  direction?: string;
  /** Delay in seconds */
  delay?: number;
}

/**
 * Detected animation from SVG analysis
 */
export interface DetectedAnimationInfo {
  /** Animation type */
  type: string;
  /** Animation settings */
  settings: SimpleAnimationSettings;
}

// ============================================================================
// SVG Transformer Types
// ============================================================================

/**
 * Options for SVG to component transformation
 */
export interface SvgTransformOptions {
  /** Component name */
  componentName: string;
  /** Name attribute */
  nameAttribute: string;
  /** Output format */
  format: string;
  /** Whether to optimize SVG */
  optimizeSvg?: boolean;
}

/**
 * Result of SVG transformation
 */
export interface SvgTransformResult {
  /** Generated component code */
  component: string;
  /** Cleaned SVG content */
  svg: string;
  /** Extracted icon name */
  iconName: string;
}

// ============================================================================
// License Service Types (Iconify)
// ============================================================================

/**
 * License information from Iconify collection
 */
export interface IconifyLicenseInfo {
  /** License title */
  title: string;
  /** SPDX identifier */
  spdx: string;
  /** License URL */
  url?: string;
}

/**
 * Author information from Iconify collection
 */
export interface IconifyAuthorInfo {
  /** Author name */
  name: string;
  /** Author URL */
  url?: string;
}

/**
 * Collection metadata from Iconify
 */
export interface IconifyCollectionInfo {
  /** Collection name */
  name: string;
  /** Total icons in collection */
  total: number;
  /** Author information */
  author: IconifyAuthorInfo;
  /** License information */
  license: IconifyLicenseInfo;
  /** Collection category */
  category?: string;
}

/**
 * Icon attribution entry
 */
export interface IconifyAttribution {
  /** Icon name */
  iconName: string;
  /** Collection prefix */
  prefix: string;
  /** Collection name */
  collection: string;
  /** Author information */
  author: IconifyAuthorInfo;
  /** License information */
  license: IconifyLicenseInfo;
}

// ============================================================================
// Astro Library Types
// ============================================================================

/**
 * Configuration for Astro library server
 */
export interface AstroLibraryConfig {
  /** Path to the Astro project */
  projectPath: string;
  /** Port to run the server on */
  port: number;
  /** Whether to use development mode */
  devMode: boolean;
}

/**
 * Result of icon selection from library
 */
export interface IconSelectionResult {
  /** Icon name */
  name: string;
  /** SVG content */
  content: string;
  /** Icon category */
  category?: string;
}

/**
 * Message for icon selection event
 */
export interface IconSelectedMessage {
  /** Message type */
  type: 'iconSelected';
  /** Selected icon */
  icon: IconSelectionResult;
}

/**
 * Message for panel close event
 */
export interface CloseMessage {
  /** Message type */
  type: 'close';
}

/**
 * Union of library panel messages
 */
export type LibraryMessage = IconSelectedMessage | CloseMessage;

// ============================================================================
// Icon Removal Types
// ============================================================================

/**
 * Result of icon removal operation
 */
export interface IconRemovalResult {
  /** Whether operation succeeded */
  success: boolean;
  /** List of removed icon names */
  removed: string[];
  /** List of error messages */
  errors: string[];
}

// ============================================================================
// Code Action Provider Types
// ============================================================================

/**
 * Icon source options for transformation
 */
export type IconSourceOption = 'iconify' | 'workspace' | 'current' | 'manual';

/**
 * Transform options for code action
 */
export interface CodeActionTransformOptions {
  /** Original SVG path from the img tag */
  originalPath: string;
  /** Extracted icon name */
  iconName: string;
  /** Document URI */
  documentUri: string;
  /** Line number */
  line: number;
  /** Original HTML to replace */
  originalHtml: string;
  /** Whether this is an inline SVG */
  isInlineSvg?: boolean;
  /** The inline SVG content */
  svgContent?: string;
  /** Start offset for multi-line replacement */
  startOffset?: number;
  /** End offset for multi-line replacement */
  endOffset?: number;
}

// ============================================================================
// Iconify Service Types
// ============================================================================

/**
 * Iconify search result
 */
export interface IconifySearchResult {
  /** Collection prefix */
  prefix: string;
  /** Icon name */
  name: string;
}

/**
 * Extended search result with collection info
 */
export interface IconifySearchResultExtended extends IconifySearchResult {
  /** Collection display name */
  collectionName?: string;
  /** Total icons in collection */
  collectionTotal?: number;
}

/**
 * Search options for Iconify API
 */
export interface IconifySearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Filter by collection prefixes */
  prefixes?: string[];
  /** Filter by category */
  category?: string;
}

// ============================================================================
// Output File Manager Types
// ============================================================================

/**
 * SVG attributes extracted from SVG content
 */
export interface SvgAttributes {
  /** ViewBox attribute */
  viewBox?: string;
  /** Width attribute */
  width?: string;
  /** Height attribute */
  height?: string;
}

/**
 * Animation config for icons (used in icons.js)
 */
export interface IconAnimationConfig {
  /** Animation type */
  type: string;
  /** Duration in seconds */
  duration: number;
  /** Timing function */
  timing: string;
  /** Iteration count */
  iteration: string;
  /** Delay in seconds */
  delay?: number;
  /** Animation direction */
  direction?: string;
}

/**
 * Icon entry in the icons file
 */
export interface IconEntry {
  /** Icon name */
  name: string;
  /** SVG body content */
  body: string;
  /** ViewBox attribute */
  viewBox: string;
  /** Animation configuration */
  animation?: IconAnimationConfig;
}

/**
 * Transformer interface for SVG operations
 */
export interface SvgTransformerInterface {
  /** Extract SVG body from full SVG */
  extractSvgBody(svg: string): string;
  /** Extract SVG attributes */
  extractSvgAttributes(svg: string): SvgAttributes;
}

// ============================================================================
// Icons File Manager Types
// ============================================================================

/**
 * Options for creating an icon entry
 */
export interface IconEntryOptions {
  /** Variable name */
  varName: string;
  /** Icon name */
  iconName: string;
  /** SVG body content */
  body: string;
  /** ViewBox attribute */
  viewBox: string;
  /** Animation configuration */
  animation?: IconAnimationConfig;
}

/**
 * Options for adding an icon to icons.js
 */
export interface AddToIconsJsOptions {
  /** Output path */
  outputPath: string;
  /** Icon name */
  iconName: string;
  /** Full SVG content */
  svgContent: string;
  /** SVG transformer instance */
  transformer: SvgTransformerInterface;
  /** Animation configuration */
  animation?: IconAnimationConfig;
  /** Skip web component generation */
  skipWebComponentGeneration?: boolean;
}

// ============================================================================
// Icon Build Helpers Types
// ============================================================================

/**
 * Result of a build operation
 */
export interface BuildResult {
  /** Whether build succeeded */
  success: boolean;
  /** Icon name */
  iconName: string;
  /** Output path */
  outputPath: string;
  /** Output format */
  format: 'sprite' | 'icons';
  /** Error message if failed */
  error?: string;
}

/**
 * Options for building an icon
 * T is the transformer type (defaults to SvgTransformerInterface)
 */
export interface BuildIconOptions<T = SvgTransformerInterface> {
  /** Icon name */
  iconName: string;
  /** Full SVG content */
  svgContent: string;
  /** SVG transformer instance */
  svgTransformer: T;
  /** Custom output path */
  outputPath?: string;
}

// ============================================================================
// Icon Picker Types
// ============================================================================

/**
 * Color preset for icon picker
 */
export interface ColorPreset {
  /** Color value */
  color: string;
  /** Display title */
  title: string;
}

/**
 * Popular collection info for icon picker
 */
export interface PopularCollection {
  /** Collection prefix */
  prefix: string;
  /** Collection name */
  name: string;
  /** Total icons in collection */
  total?: number;
}

/**
 * Raw response from Iconify search API
 */
export interface IconifySearchResponse {
  /** Array of icon IDs */
  icons?: string[];
}

// ============================================================================
// Config Helper Types
// ============================================================================

/**
 * Supported framework types
 */
export type FrameworkType =
  | 'html'
  | 'react'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'solid'
  | 'qwik'
  | 'astro'
  | 'lit';

/**
 * Icon Studio configuration
 */
export interface IconStudioConfig {
  /** Output directory for built icons */
  outputDirectory: string;
  /** Component name for icon wrapper */
  componentName: string;
  /** Attribute name for icon name */
  nameAttribute: string;
  /** Default icon size in pixels */
  defaultSize: number;
  /** Default icon color */
  defaultColor: string;
  /** Web component tag name */
  webComponentName: string;
  /** Build output format */
  buildFormat: 'icons.js' | 'sprite.svg' | 'css';
  /** Target framework */
  framework: FrameworkType;
}

// ============================================================================
// Iconify API Types
// ============================================================================

/**
 * Icon data within an Iconify icon set
 */
export interface IconifyIconData {
  /** SVG body content */
  body: string;
  /** Icon width */
  width?: number;
  /** Icon height */
  height?: number;
}

/**
 * Iconify icon set response from API
 */
export interface IconifyIconSet {
  /** Collection prefix */
  prefix: string;
  /** Icons in the set */
  icons: Record<string, IconifyIconData>;
  /** Default width for icons */
  width?: number;
  /** Default height for icons */
  height?: number;
}

/**
 * Iconify collection metadata
 */
export interface IconifyCollection {
  /** Collection display name */
  name: string;
  /** Total number of icons */
  total: number;
  /** Author information */
  author?: {
    name: string;
    url?: string;
  };
  /** License information */
  license?: {
    title: string;
    spdx?: string;
    url?: string;
  };
  /** Sample icon names */
  samples?: string[];
  /** Collection category */
  category?: string;
}

// ============================================================================
// Build Helper Types
// ============================================================================

/**
 * Options for showing delete original prompt
 */
export interface DeletePromptOptions {
  /** Title shown in quick pick */
  title?: string;
  /** Default value if user cancels */
  defaultValue?: boolean;
}

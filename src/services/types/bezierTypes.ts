/**
 * Type definitions for Bezier Icon System
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
export interface BezierBuildConfig {
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
export interface BezierBuildResult {
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
export type IconRenderMethod = 'svg-inline' | 'svg-use' | 'img' | 'web-component' | 'sg-icon';

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
 * Web component attributes for sg-icon
 */
export interface BzIconAttributes {
  name: string;
  size?: SizeToken | number;
  color?: string;
  animation?: string;
  variant?: string;
}

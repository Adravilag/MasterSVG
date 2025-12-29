/**
 * Common types for Icon Manager extension
 */

/**
 * Animation settings for icons
 */
export interface IconAnimation {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

/**
 * Icon usage location
 */
export interface IconUsage {
  file: string;
  line: number;
  preview: string;
}

/**
 * Workspace icon from providers
 */
export interface WorkspaceIcon {
  name: string;
  path: string;
  source: 'workspace' | 'library' | 'inline';
  category?: string;
  svg?: string;
  // Animation settings (from icons.js)
  animation?: IconAnimation;
  // For inline SVGs
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  // Build status
  isBuilt?: boolean;
  // Usages tracking
  usages?: IconUsage[];
  usageCount?: number;
  // For IMG references: whether the SVG file exists
  exists?: boolean;
}

/**
 * Icon data structure used across the extension
 */
export interface IconData {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  spriteFile?: string;
  iconsFile?: string;
  viewBox?: string;
  isBuilt?: boolean;
  animation?: IconAnimation;
}

/**
 * Icon details for panels
 */
export interface IconDetails {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  isBuilt?: boolean;
  animation?: IconAnimation;
}

/**
 * Workspace icon from providers
 */
export interface WorkspaceIconData {
  name: string;
  svg?: string;
  path?: string;
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  category?: string;
  exists?: boolean;
  animation?: IconAnimation;
}

/**
 * Icon with SVG content for building
 */
export interface IconWithSvg {
  name: string;
  svg: string;
  animation?: IconAnimation;
}

/**
 * Sprite icon structure
 */
export interface SpriteIconData {
  id: string;
  name: string;
  svg: string;
  viewBox?: string;
}

